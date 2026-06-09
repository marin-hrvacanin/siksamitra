"""
align_fused.py — fusion + bleed-free boundary refinement (the final mapping stage).

The coarse drivers (MMS forced alignment; recognition+phonetic fuse) place each pada
roughly in the right spot and order, but their per-pada edges come straight from token
times, so adjacent regions overlap or cut a hair early — and per-line playback then bleeds
the previous pada's tail / clips the last syllable.

This module takes those coarse placements and re-derives CLEAN boundaries:

  * confident, order-consistent placements become ANCHORS with trusted absolute time;
  * padas between anchors are (re)placed by mātrā-weighted rhythm, so any boundary error
    resets at each anchor instead of accumulating across the clip;
  * every inter-pada boundary is snapped to a real SILENCE and the silent gap is given to
    NEITHER neighbour (no bleed). With no silence, the cut is the mātrā split point and both
    sides are trimmed inward by a small margin (the user prefers "a hair short" to bleed);
  * a small fade-in/out is suggested so any residual edge content fades, never clicks;
  * text the recording does not contain stays UNASSIGNED (never fabricated).

Pure / dependency-light (stdlib + the project's align_audio.snap_to_silence). Engine-agnostic:
operates on align_core.PlacedRegion lists, so it improves every driver. Designed so the same
boundary logic can later split a pada into words.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence, Tuple

from align_core import PlacedRegion, TargetSection

# Tunables (seconds).
_TRIM = 0.04          # inward trim when no silence is available at a boundary
_FADE = 0.04          # suggested fade-in/out per region
_SNAP_WINDOW = 0.6    # search radius for a silence near a provisional boundary
_MIN_SIL = 0.10       # minimum silence length to anchor a cut on
_MIN_REGION = 0.18    # regions shorter than this are demoted to unassigned
# A None-run between two anchors is only rhythm-filled if the inter-anchor gap is at least
# this fraction of the missing padas' expected duration (else the recording skipped them).
_FILL_GAP_FRACTION = 0.55


def _weight(t: TargetSection) -> float:
    """Expected relative duration of a pada, in mātrā-ish units."""
    if t is not None and getattr(t, 'events', None):
        w = sum(max(0.1, getattr(e, 'matras', 1.0) or 1.0) for e in t.events)
        if w > 0:
            return w
    syl = getattr(t, 'syllables', 0) or 0
    return float(max(1, syl))


def _best_pause(silences: Sequence[Tuple[float, float]],
                lo: float, hi: float, min_len: float = _MIN_SIL,
                target: Optional[float] = None) -> Optional[Tuple[float, float]]:
    """Pick the best real PAUSE overlapping [lo, hi]. Prefers longer silences (real
    breaths, not stop-closures); among comparable lengths, prefers the one closest to
    `target`. Silences shorter than min_len (stop closures) are ignored."""
    if hi <= lo:
        return None
    best = None
    best_key = None
    for s0, s1 in silences:
        length = s1 - s0
        if length < min_len:
            continue
        if s1 <= lo or s0 >= hi:
            continue
        mid = 0.5 * (s0 + s1)
        # Rank: longer is better; tie-break by closeness to target (or window centre).
        ref = target if target is not None else 0.5 * (lo + hi)
        key = (round(length, 2), -abs(mid - ref))
        if best_key is None or key > best_key:
            best_key = key
            best = (s0, s1)
    return best


def refine(placed: Sequence[PlacedRegion],
           targets: Sequence[TargetSection],
           silences: List[Tuple[float, float]],
           speech_span: Tuple[float, float],
           strategy: str = 'silence_gap',
           trim: float = _TRIM,
           fade: float = _FADE) -> List[PlacedRegion]:
    """Return refined, monotonic, non-overlapping, silence-snapped PlacedRegions.

    `placed` and `targets` cover the same chant padas (matched/warn/unassigned). The result
    is in target-index order; each region's channel_breakdown gains fadeIn/fadeOut and the
    boundary provenance. strategy: 'silence_gap' (default) or 'inward_only' (A/B).
    """
    speech_start, speech_end = speech_span
    if speech_end <= speech_start:
        speech_end = speech_start + max(1.0, (placed[-1].end if placed else 1.0))

    # Index → target, in document order.
    tmap: Dict[int, TargetSection] = {t.index: t for t in targets}
    order = sorted(tmap.keys())
    pmap: Dict[int, PlacedRegion] = {p.target_index: p for p in placed}
    weights = {i: _weight(tmap[i]) for i in order}

    # ── 1. Anchors: confident, order-consistent coarse placements. ──────────────
    # Walk in document order; accept a placement as an anchor only if it keeps start times
    # monotonic (skip ones that would go backwards — they are the drift/duplication errors).
    anchor: Dict[int, Tuple[float, float, float]] = {}   # idx -> (start, end, conf)
    last_start = speech_start - 1.0
    for i in order:
        p = pmap.get(i)
        if p is None or p.status not in ('matched', 'warn') or p.end <= p.start:
            continue
        if p.start < last_start - 0.05:
            continue  # out-of-order coarse edge → don't trust as an anchor
        anchor[i] = (max(speech_start, p.start), min(speech_end, p.end), p.confidence)
        last_start = p.start

    # ── 2. Provisional [start,end] per pada: anchors kept; None-runs filled by rhythm
    #       between bracketing anchors (re-sync → no accumulated drift). ───────────
    prov: Dict[int, Optional[Tuple[float, float]]] = {}
    for i in order:
        prov[i] = (anchor[i][0], anchor[i][1]) if i in anchor else None

    k = 0
    N = len(order)
    while k < N:
        i = order[k]
        if prov[i] is not None:
            k += 1
            continue
        # maximal None-run order[k..j-1]
        j = k
        while j < N and prov[order[j]] is None:
            j += 1
        run = order[k:j]
        left_end = anchor[order[k - 1]][1] if k > 0 and order[k - 1] in anchor else speech_start
        right_start = anchor[order[j]][0] if j < N and order[j] in anchor else speech_end
        gap = right_start - left_end
        run_w = sum(weights[r] for r in run)
        # tempo from the bracketing anchors' own content if possible, else global.
        expected = run_w * _global_tempo(order, weights, anchor, speech_start, speech_end)
        bracketed = (k > 0 and order[k - 1] in anchor) and (j < N and order[j] in anchor)
        if gap <= 0.05 or (bracketed and gap < _FILL_GAP_FRACTION * expected):
            # The audio between the anchors is too short to contain these padas →
            # the recording skipped them. Leave unassigned (honest, FR-007).
            for r in run:
                prov[r] = None
            k = j
            continue
        # Distribute [left_end, right_start] by mātrā weight.
        cursor = left_end
        for r in run:
            seg = gap * (weights[r] / max(1e-6, run_w))
            prov[r] = (cursor, cursor + seg)
            cursor += seg
        k = j

    # Collect the padas that have a provisional slot, in order.
    seq = [i for i in order if prov[i] is not None]
    unassigned = [i for i in order if prov[i] is None]

    # ── 3. Bleed-free boundaries between consecutive placed padas. ──────────────
    starts: Dict[int, float] = {}
    ends: Dict[int, float] = {}
    on_silence: Dict[int, bool] = {i: False for i in seq}
    for i in seq:
        starts[i], ends[i] = prov[i]

    # edges
    if seq:
        starts[seq[0]] = _snap(speech_start, silences, 'start', speech_start, speech_end)
        ends[seq[-1]] = _snap(speech_end, silences, 'end', speech_start, speech_end)

    for a, b in zip(seq, seq[1:]):
        ea, sb = ends[a], starts[b]
        # The true transition is the verse-breath in the audio the driver left BETWEEN
        # the two padas (forced alignment often compresses a pada, dropping its
        # elongated tail into this gap). Search there, NOT across each pada's interior
        # (which is full of within-pada pauses). Bias the cut toward the gap.
        if sb > ea + 0.02:                       # a real gap exists between a and b
            lo, hi = ea - 0.20, sb + 0.20
            target = 0.5 * (ea + sb)
        else:                                    # driver placed them adjacent/overlapping
            mid = 0.5 * (ea + sb)
            lo, hi = mid - _SNAP_WINDOW, mid + _SNAP_WINDOW
            target = mid
        # Keep the cut strictly inside both padas.
        lo = max(lo, starts[a] + 0.10)
        hi = min(hi, ends[b] - 0.10)
        sil = (_best_pause(silences, lo, hi, min_len=0.18, target=target)
               if strategy == 'silence_gap' else None)
        if sil is not None:
            ends[a] = sil[0]
            starts[b] = sil[1]
            on_silence[a] = True
            on_silence[b] = True
        else:
            cut = min(max(target, lo), hi)
            ends[a] = cut - trim
            starts[b] = cut + trim
        # never invert
        if ends[a] <= starts[a]:
            ends[a] = starts[a] + 0.05
        if starts[b] >= ends[b]:
            starts[b] = max(ends[a], ends[b] - 0.05)

    # ── 4. Build refined regions with fades + recomputed confidence. ────────────
    tempo = _global_tempo(order, weights, anchor, speech_start, speech_end)
    out: List[PlacedRegion] = []
    for i in order:
        if i not in starts:
            p0 = pmap.get(i)
            conf = p0.confidence if p0 else 0.0
            out.append(PlacedRegion(i, 0.0, 0.0, round(conf, 3), 'unassigned',
                                    channel_breakdown={'reason': 'no-audio'}))
            continue
        s = round(max(speech_start, starts[i]), 3)
        e = round(min(speech_end, ends[i]), 3)
        dur = e - s
        if dur < _MIN_REGION:
            out.append(PlacedRegion(i, 0.0, 0.0, 0.0, 'unassigned',
                                    channel_breakdown={'reason': 'too-short'}))
            continue
        expected = max(0.15, weights[i] * tempo)
        dur_factor = max(0.0, 1.0 - abs(math.log(max(1e-3, dur) / expected)) / 2.0)
        base = anchor[i][2] if i in anchor else 0.5
        bonus = 0.05 if on_silence.get(i) else 0.0
        conf = max(0.0, min(1.0, 0.6 * base + 0.4 * dur_factor + bonus))
        status = 'matched' if conf >= 0.55 else 'warn'
        f = round(min(fade, 0.25 * dur), 3)
        out.append(PlacedRegion(
            target_index=i, start=s, end=e, confidence=round(conf, 3), status=status,
            channel_breakdown={
                'src': 'fused', 'anchor': i in anchor, 'on_silence': on_silence.get(i, False),
                'dur_factor': round(dur_factor, 3), 'fadeIn': f, 'fadeOut': f,
            },
        ))
    out.sort(key=lambda p: p.target_index)
    return out


def _global_tempo(order, weights, anchor, speech_start, speech_end) -> float:
    total_w = sum(weights[i] for i in order) or 1.0
    span = max(0.5, speech_end - speech_start)
    return span / total_w


def _snap(t: float, silences, edge: str, lo: float, hi: float) -> float:
    try:
        from align_audio import snap_to_silence
        v = snap_to_silence(t, silences, edge=edge)
        return min(hi, max(lo, v))
    except Exception:
        return t
