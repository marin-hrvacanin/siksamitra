"""
align_service.py — the single entry point for audio→text mapping.

One unified path (no tiers, no mode selection):

    decode 16 kHz mono  →  detect silences + speech span  →  recognize
    (faster-whisper)  →  fuse (phonetic SW + prior + silence)  →  regions.

If recognition is unavailable (faster-whisper not installed / load fails),
it degrades to a proportional mātrā-based layout with every region flagged
needs-review — never a hard failure, never fabricated confidence.

Request:
    {
      "audio": <data-URI | base64>,
      "mime":  "audio/mpeg",
      "model": "tiny" | "small",          (optional; default "tiny")
      "targets": [ {index, text, level, syllables, hasSvaras, pauseAfterHint,
                    iastNormalized, events:[{type,matras,svara,char}, …]}, … ]
    }

Response:
    {
      "engine": "whisper-tiny" | "whisper-small" | "proportional",
      "regions": [ {targetIndex, start, end, confidence, status, breakdown} ],
      "unassigned": [targetIndex, …],
      "speech_span": [start, end],
      "summary": {matched, warn, unassigned},
      "diagnostics": {…}
    }
"""

from __future__ import annotations

import base64
import time
from typing import Any, Dict, List

from align_core import TargetSection, TextEvent, PlacedRegion, coarsen_text_events


def _decode_audio_field(audio_field: Any) -> bytes:
    if isinstance(audio_field, bytes):
        return audio_field
    if not isinstance(audio_field, str):
        raise ValueError('audio field must be a string or bytes')
    s = audio_field
    if s.startswith('data:'):
        try:
            _, b64 = s.split(',', 1)
            return base64.b64decode(b64)
        except Exception as e:
            raise ValueError(f'malformed data URI: {e}') from e
    return base64.b64decode(s)


def _target_from_dict(t: Dict[str, Any]) -> TargetSection:
    raw_events = t.get('events') or []
    events: List[TextEvent] = []
    for e in raw_events:
        if not isinstance(e, dict):
            continue
        events.append(TextEvent(
            type=str(e.get('type', '')),
            matras=float(e.get('matras', 1.0) or 1.0),
            svara=(e.get('svara') or None),
            char=str(e.get('char', '')),
        ))
    return TargetSection(
        index=int(t.get('index', 0) or 0),
        text=str(t.get('text', '') or '')[:400],
        level=str(t.get('level', 'line') or 'line'),
        syllables=int(t.get('syllables', 0) or 0),
        events=events,
        has_svaras=bool(t.get('hasSvaras') or any(ev.svara for ev in events)),
        pause_after_hint=bool(t.get('pauseAfterHint') or False),
        iast_normalized=str(t.get('iastNormalized', '') or ''),
    )


def _proportional(targets: List[TargetSection],
                  speech_span) -> List[PlacedRegion]:
    """Degraded fallback: split the spoken span by mātrā weight; all needs-review."""
    start, end = speech_span
    total = max(0.1, end - start)
    weights = []
    for t in targets:
        w = sum(max(0.1, e.matras) for e in (t.events or [])) or max(1.0, t.syllables or 1)
        weights.append(w)
    wsum = max(1e-6, sum(weights))
    out: List[PlacedRegion] = []
    cursor = start
    for t, w in zip(targets, weights):
        seg = w / wsum * total
        s = cursor
        e = min(end, cursor + seg)
        cursor = e
        out.append(PlacedRegion(
            target_index=t.index, start=round(s, 3), end=round(e, 3),
            confidence=0.3, status='warn',
            channel_breakdown={'proportional': True}))
    return out


def _summarize(placed: List[PlacedRegion]) -> Dict[str, int]:
    s = {'matched': 0, 'warn': 0, 'unassigned': 0}
    for p in placed:
        s[p.status] = s.get(p.status, 0) + 1
    return s


def run(request: Dict[str, Any]) -> Dict[str, Any]:
    """Entry point called from the Flask endpoint."""
    t0 = time.perf_counter()
    raw_audio = _decode_audio_field(request.get('audio') or '')
    mime = str(request.get('mime') or '')
    model = str(request.get('model') or 'small').lower()
    targets_raw = request.get('targets') or []
    targets: List[TargetSection] = [_target_from_dict(t) for t in targets_raw]

    if not targets:
        return {'engine': 'none', 'regions': [], 'unassigned': [],
                'speech_span': [0.0, 0.0], 'summary': _summarize([]),
                'diagnostics': {'error': 'no targets'}}

    # Coarsen events to syllable granularity for the mātrā weighting used by the
    # prior / proportional fallback (the phone aligner uses iastNormalized text).
    for t in targets:
        if t.events:
            t.events = coarsen_text_events(t.events)

    diagnostics: Dict[str, Any] = {}

    # 1. Decode + 2. silences/span
    from align_audio import decode_16k_mono, detect_silences, speech_span as _span
    samples, sr = decode_16k_mono(raw_audio, mime)
    t_decode = time.perf_counter()
    if len(samples) == 0:
        return {'engine': 'none', 'regions': [],
                'unassigned': [t.index for t in targets],
                'speech_span': [0.0, 0.0], 'summary': _summarize([]),
                'diagnostics': {'error': 'empty/undecodable audio'}}
    silences = detect_silences(samples, sr)
    span = _span(samples, sr, silences)
    diagnostics['silence_intervals'] = len(silences)
    diagnostics['decode_ms'] = round((t_decode - t0) * 1000, 1)

    # Non-chant lines (title/subtitle/comment/translation) are never mapped —
    # they are reported 'skipped', excluded from the audio search (FR-008).
    NON_CHANT = {'title', 'subtitle', 'comment', 'translation'}
    chant = [t for t in targets if (t.level or 'line') not in NON_CHANT]
    skipped = [t for t in targets if (t.level or 'line') in NON_CHANT]
    diagnostics['skipped_levels'] = len(skipped)

    placed = None
    engine = 'none'

    # 3. PRIMARY engine — MMS forced alignment (text-driven, most accurate).
    if chant:
        try:
            from align_ctc import ctc_available, align as ctc_align
            if ctc_available():
                tc = time.perf_counter()
                placed, cdiag = ctc_align(samples, sr, chant, silences, span)
                diagnostics.update(cdiag)
                diagnostics['ctc_ms'] = round((time.perf_counter() - tc) * 1000, 1)
                engine = 'mms_fa'
        except Exception as e:  # pragma: no cover
            diagnostics['ctc_error'] = repr(e)
            placed = None

    # 4. FALLBACK — Whisper recognition + phonetic fusion; then proportional.
    if chant and placed is None:
        try:
            from align_recognize import recognize
            t_rec = time.perf_counter()
            tokens, rec_span, rec_diag = recognize(samples, sr, model)
            diagnostics.update(rec_diag)
            diagnostics['recognize_ms'] = round((time.perf_counter() - t_rec) * 1000, 1)
            if rec_span[1] > rec_span[0]:
                span = (min(span[0], rec_span[0]) if span[1] > span[0] else rec_span[0],
                        max(span[1], rec_span[1]))
            if tokens:
                from align_fuse import fuse
                placed = fuse(chant, tokens, silences, span)
                engine = f'whisper-{model}'
        except Exception as e:
            diagnostics['whisper_error'] = repr(e)
        if placed is None:
            engine = 'proportional'
            diagnostics.setdefault('degraded', True)
            placed = _proportional(chant, span)

    if placed is None:
        placed = []

    # 5. FUSED REFINEMENT — turn the coarse per-pada placements into clean, monotonic,
    #    non-overlapping, silence-snapped regions (bleed-free), re-syncing on confident
    #    anchors and rhythm-filling between them. Engine-agnostic; improves every driver.
    if chant and placed:
        try:
            from align_fused import refine as _refine
            tr = time.perf_counter()
            placed = _refine(placed, chant, silences, span)
            diagnostics['fused_ms'] = round((time.perf_counter() - tr) * 1000, 1)
            diagnostics['fused'] = True
        except Exception as e:  # pragma: no cover - defensive
            diagnostics['fused_error'] = repr(e)

    # Append skipped non-chant lines, then restore document order.
    for t in skipped:
        placed.append(PlacedRegion(t.index, 0.0, 0.0, 0.0, 'skipped'))
    placed.sort(key=lambda p: p.target_index)

    regions = []
    unassigned = []
    for p in placed:
        if p.status == 'unassigned':
            unassigned.append(p.target_index)
        bd = p.channel_breakdown or {}
        regions.append({
            'targetIndex': p.target_index,
            'start': round(p.start, 3),
            'end': round(p.end, 3),
            'confidence': round(p.confidence, 3),
            'status': p.status,
            'fadeIn': float(bd.get('fadeIn', 0) or 0),
            'fadeOut': float(bd.get('fadeOut', 0) or 0),
            'breakdown': bd,
        })

    return {
        'engine': engine,
        'regions': regions,
        'unassigned': unassigned,
        'speech_span': [round(span[0], 3), round(span[1], 3)],
        'summary': _summarize(placed),
        'diagnostics': {**diagnostics, 'targets_count': len(targets)},
    }
