"""
align_fuse.py — the ONE unified mapping algorithm.

Fuses every available signal in a single decision process (spec FR-004):

  1. RECOGNITION   — faster-whisper transcript tokens with word timestamps
                     (align_recognize) folded to phones (align_roman).
  2. PHONETICS     — Smith–Waterman of the KNOWN text phones against the
                     transcript phones, scored by phonetic_similarity.
  3. RHYTHM        — detected silences (align_audio) snap region boundaries.
  4. MĀTRĀ/length  — the text's own duration gates confidence.

Ordering model (FR-006: "more likely in order"):
  * PRIMARY pass = ONE GLOBAL monotonic alignment of the whole concatenated
    text against the whole transcript. Because the path is monotonic, sections
    come out in document order by construction — which is what a faithful
    recitation produces. Partial coverage falls out naturally (unmatched text
    sits in gaps).
  * SECONDARY pass = for sections the global pass left unplaced, an independent
    local search over the full transcript recovers out-of-order or skipped-over
    lines without disturbing the in-order bulk.

Sections with too little phonetic support stay 'unassigned' (never fabricated).
"""

from __future__ import annotations

import math
from typing import Dict, List, Sequence, Tuple

try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:  # pragma: no cover
    np = None
    _HAS_NUMPY = False

from align_core import (
    TargetSection, PlacedRegion, phonetic_similarity,
    UNASSIGNED_BELOW, WARN_BELOW,
)
from align_roman import to_phones
from align_audio import snap_to_silence

_SKIP_TEXT = -0.5
_SKIP_TRANS = -0.25
_MIN_COVERAGE = 0.34   # a section needs at least this fraction of its phones matched

_PHONES = ['a', 'e', 'i', 'o', 'u', 'k', 'g', 'c', 'j', 't', 'd',
           'n', 'p', 'b', 'm', 'y', 'r', 'l', 'v', 's', 'h']
_PHONE_IDX = {p: i for i, p in enumerate(_PHONES)}
if _HAS_NUMPY:
    _SIM = np.zeros((len(_PHONES), len(_PHONES)), dtype=np.float32)
    for _i, _a in enumerate(_PHONES):
        for _j, _b in enumerate(_PHONES):
            _SIM[_i, _j] = phonetic_similarity(_a, _b)


def _codes(phones: Sequence[str]) -> List[int]:
    return [_PHONE_IDX[p] for p in phones if p in _PHONE_IDX]


def _match_matrix(t_codes, p_codes):
    """2*sim - 0.6 per (text, trans) cell (exact→1.4, class→0.6, none→-0.6)."""
    if _HAS_NUMPY:
        tc = np.array(t_codes, dtype=np.int32)
        pc = np.array(p_codes, dtype=np.int32)
        return (2.0 * _SIM[tc[:, None], pc[None, :]] - 0.6)
    return [[2.0 * phonetic_similarity(_PHONES[a], _PHONES[b]) - 0.6
             for b in p_codes] for a in t_codes]


def _sw_pairs(t_codes: List[int], p_codes: List[int]):
    """Local Smith–Waterman. Returns (pairs, sim_of_pair) where pairs is the
    list of (text_i, trans_j) diagonal matches along the best local path."""
    m, n = len(t_codes), len(p_codes)
    if m == 0 or n == 0:
        return [], {}
    match = _match_matrix(t_codes, p_codes)
    dp = [[0.0] * (n + 1) for _ in range(m + 1)]
    back = [[0] * (n + 1) for _ in range(m + 1)]
    best = 0.0
    bi = bj = 0
    for i in range(1, m + 1):
        row = match[i - 1]
        dpi, dpi1, bki = dp[i], dp[i - 1], back[i]
        for j in range(1, n + 1):
            diag = dpi1[j - 1] + float(row[j - 1])
            up = dpi1[j] + _SKIP_TEXT
            left = dpi[j - 1] + _SKIP_TRANS
            cell = 0.0
            d = 0
            if diag > cell:
                cell, d = diag, 1
            if up > cell:
                cell, d = up, 2
            if left > cell:
                cell, d = left, 3
            dpi[j] = cell
            bki[j] = d
            if cell > best:
                best, bi, bj = cell, i, j
    pairs = []
    sim_of = {}
    i, j = bi, bj
    while i > 0 and j > 0 and dp[i][j] > 0:
        d = back[i][j]
        if d == 1:
            s = phonetic_similarity(_PHONES[t_codes[i - 1]], _PHONES[p_codes[j - 1]])
            if s > 0:
                pairs.append((i - 1, j - 1))
                sim_of[i - 1] = s
            i -= 1
            j -= 1
        elif d == 2:
            i -= 1
        elif d == 3:
            j -= 1
        else:
            break
    pairs.reverse()
    return pairs, sim_of


def _target_phones(t: TargetSection) -> List[str]:
    return to_phones(t.iast_normalized or t.text or '')


def _confidence(matched: int, total: int, sim_sum: float,
                observed_dur: float, expected_dur: float) -> Tuple[float, float, float, float]:
    coverage = min(1.0, matched / max(1, total))
    quality = (sim_sum / matched) if matched else 0.0
    quality = max(0.0, min(1.0, quality))
    dur_factor = max(0.0, 1.0 - abs(math.log(max(1e-3, observed_dur) /
                                             max(0.15, expected_dur))) / 2.0)
    base = 0.55 * coverage + 0.45 * quality
    conf = max(0.0, min(1.0, base * (0.35 + 0.65 * dur_factor)))
    return conf, coverage, quality, dur_factor


def fuse(targets: Sequence[TargetSection],
         transcript_tokens: Sequence,
         silences: List[Tuple[float, float]],
         speech_span: Tuple[float, float]) -> List[PlacedRegion]:
    speech_start, speech_end = speech_span
    if not targets:
        return []

    # Transcript → phone stream with per-phone times.
    p_phones: List[str] = []
    p_times: List[float] = []
    for tok in transcript_tokens:
        phones = getattr(tok, 'phones', None) or to_phones(getattr(tok, 'text', ''))
        if not phones:
            continue
        dur = max(1e-3, tok.end - tok.start)
        k = len(phones)
        for idx, ph in enumerate(phones):
            p_phones.append(ph)
            p_times.append(tok.start + (idx + 0.5) / k * dur)
    p_codes = _codes(p_phones)

    # Per-target phones; tempo for duration gating.
    tphones = [_target_phones(t) for t in targets]
    tcodes = [_codes(p) for p in tphones]
    total_phones = max(1, sum(len(c) for c in tcodes))
    tempo = max(1e-3, (speech_end - speech_start)) / total_phones

    if not p_codes:
        return [PlacedRegion(t.index, 0.0, 0.0, 0.0, 'unassigned') for t in targets]

    # ── PRIMARY: one global monotonic alignment of all text vs transcript ──
    t_all: List[int] = []
    owner: List[int] = []          # owner[k] = target position for global-text phone k
    for ti, codes in enumerate(tcodes):
        for c in codes:
            t_all.append(c)
            owner.append(ti)
    gpairs, gsim = _sw_pairs(t_all, p_codes)
    times_by_t: Dict[int, List[float]] = {ti: [] for ti in range(len(targets))}
    simsum_by_t: Dict[int, float] = {ti: 0.0 for ti in range(len(targets))}
    for (gi, pj) in gpairs:
        ti = owner[gi]
        times_by_t[ti].append(p_times[pj])
        simsum_by_t[ti] += gsim.get(gi, 0.0)

    placed: List[PlacedRegion] = []
    unresolved: List[int] = []
    for ti, t in enumerate(targets):
        times = times_by_t[ti]
        n_tot = max(1, len(tcodes[ti]))
        if len(times) >= max(2, int(_MIN_COVERAGE * n_tot)):
            start_t, end_t = min(times), max(times)
            if end_t <= start_t:
                end_t = start_t + 0.2
            expected = len(tcodes[ti]) * tempo
            conf, cov, qual, durf = _confidence(len(times), n_tot, simsum_by_t[ti],
                                                end_t - start_t, expected)
            placed.append(_make_region(t.index, start_t, end_t, conf, cov, qual, durf,
                                       silences, speech_span, 'global'))
        else:
            placed.append(PlacedRegion(t.index, 0.0, 0.0, 0.0, 'unassigned'))
            unresolved.append(ti)

    # ── SECONDARY: recover unplaced sections, CONSTRAINED to their in-order
    #    time window (between the nearest already-placed neighbours). This keeps
    #    recovery from violating document order — an out-of-order line is left
    #    unmatched (honest) rather than confidently mis-placed. ──
    def _placed_ok(tj):
        return placed[tj].status in ('matched', 'warn') and placed[tj].end > placed[tj].start

    for ti in sorted(unresolved):
        codes = tcodes[ti]
        if not codes:
            continue
        lo = speech_start
        for tj in range(ti - 1, -1, -1):
            if _placed_ok(tj):
                lo = placed[tj].end
                break
        hi = speech_end
        for tj in range(ti + 1, len(targets)):
            if _placed_ok(tj):
                hi = placed[tj].start
                break
        if hi - lo < 0.3:
            continue
        win = [(p_codes[k], p_times[k]) for k in range(len(p_codes))
               if lo - 0.5 <= p_times[k] <= hi + 0.5]
        if len(win) < 2:
            continue
        sub_codes = [c for c, _ in win]
        sub_times = [t for _, t in win]
        pairs, sim_of = _sw_pairs(codes, sub_codes)
        if len(pairs) < max(2, int(_MIN_COVERAGE * len(codes))):
            continue
        times = [sub_times[pj] for (_i, pj) in pairs]
        start_t, end_t = min(times), max(times)
        if end_t <= start_t:
            end_t = start_t + 0.2
        conf, cov, qual, durf = _confidence(len(pairs), len(codes), sum(sim_of.values()),
                                            end_t - start_t, len(codes) * tempo)
        if conf >= UNASSIGNED_BELOW:
            placed[ti] = _make_region(targets[ti].index, start_t, end_t, conf,
                                      cov, qual, durf, silences, speech_span, 'local')

    placed.sort(key=lambda p: p.target_index)
    _resolve_overlaps(placed)
    return placed


def _make_region(target_index, start_t, end_t, conf, cov, qual, durf,
                 silences, speech_span, src) -> PlacedRegion:
    speech_start, speech_end = speech_span
    if conf < UNASSIGNED_BELOW:
        return PlacedRegion(target_index, 0.0, 0.0, round(conf, 3), 'unassigned',
                            channel_breakdown={'phonetic': round(qual, 3),
                                               'coverage': round(cov, 3),
                                               'dur_factor': round(durf, 3)})
    snapped_start = snap_to_silence(start_t, silences, edge='start')
    snapped_end = snap_to_silence(end_t, silences, edge='end')
    if snapped_end - snapped_start < max(0.2, 0.5 * (end_t - start_t)):
        snapped_start, snapped_end = start_t, end_t
    status = 'warn' if conf < WARN_BELOW else 'matched'
    hi = speech_end if speech_end > speech_start else snapped_end + 0.1
    return PlacedRegion(
        target_index=target_index,
        start=round(max(speech_start, snapped_start), 3),
        end=round(min(hi, snapped_end), 3),
        confidence=round(conf, 3),
        status=status,
        channel_breakdown={'phonetic': round(qual, 3), 'coverage': round(cov, 3),
                           'dur_factor': round(durf, 3), 'src': src},
    )


def _resolve_overlaps(placed: List[PlacedRegion]) -> None:
    """Clip overlapping audio spans (lower-confidence yields); demote slivers."""
    active = [p for p in placed if p.status in ('matched', 'warn') and p.end > p.start]
    active.sort(key=lambda p: p.start)
    for a, b in zip(active, active[1:]):
        if b.start < a.end - 0.02:
            if a.confidence >= b.confidence:
                b.start = min(b.end - 0.05, max(b.start, a.end))
            else:
                a.end = max(a.start + 0.05, min(a.end, b.start))
            if b.start >= b.end:
                b.start = max(a.end, b.end - 0.05)
    for p in active:
        if (p.end - p.start) < 0.2:
            p.status = 'unassigned'
            p.start = 0.0
            p.end = 0.0
            p.confidence = round(p.confidence * 0.5, 3)
