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
_MIN_BREATH = 0.22    # silence length that counts as a real inter-pada BREATH (vs a
                      # within-word stop-closure ~0.10–0.20s). Boundaries snap to breaths.
# A None-run between two anchors is only rhythm-filled if the inter-anchor gap is at least
# this fraction of the missing padas' expected duration (else the recording skipped them).
# Biased high: the user strongly prefers honest-UNASSIGNED over a fabricated placement for
# text the reciter skipped (e.g. an optional gāyatrī verse), so only fill when the available
# audio closely matches the missing padas' expected length.
_FILL_GAP_FRACTION = 0.75
# Minimum forced-alignment (CTC) confidence to KEEP a placement. Forced alignment will place
# every token somewhere even when the text is not in the recording, but those force-fits score
# distinctly lower than real lines (measured: real ≥0.64, an out-of-audio verse 0.32). Below
# this floor we UNASSIGN rather than fabricate/steal a neighbour's audio (recognition can't
# help — Whisper produces garbage on Vedic chant). Tunable; honest-over-wrong per the user.
_CONF_FLOOR = 0.40


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


def _content_after(silences, t, hi):
    """Time at which speech resumes after `t`: the END of the first real breath at/after
    `t` (so a preceding anchor's compressed tail, which sits before that breath, is left
    to the anchor and not stolen by the following run). Clamped to < hi."""
    cand = None
    for s0, s1 in silences:
        if s1 - s0 < _MIN_BREATH:
            continue
        if s1 <= t or s0 >= hi:
            continue
        if cand is None or s0 < cand[0]:
            cand = (s0, s1)
    return min(hi, cand[1]) if cand else t


def _content_before(silences, t, lo):
    """Time at which speech ends before `t`: the START of the last real breath before `t`
    (so the following anchor's lead-in breath is excluded). Clamped to > lo."""
    cand = None
    for s0, s1 in silences:
        if s1 - s0 < _MIN_BREATH:
            continue
        if s0 >= t or s1 <= lo:
            continue
        if cand is None or s0 > cand[0]:
            cand = (s0, s1)
    return max(lo, cand[0]) if cand else t


def _speech_segments(silences: Sequence[Tuple[float, float]],
                     lo: float, hi: float, min_breath: float = _MIN_BREATH,
                     min_dur: float = _MIN_REGION) -> List[Tuple[float, float]]:
    """Split [lo, hi] into speech segments separated by real breaths (silences ≥
    min_breath). Returns segments (between breaths) whose duration ≥ min_dur — i.e.
    the actual spoken units in that span. Used to count how many padas the recording
    contains in a gap the forced aligner left unplaced."""
    if hi - lo < min_dur:
        return []
    breaths = sorted([(max(lo, s0), min(hi, s1)) for s0, s1 in silences
                      if s1 - s0 >= min_breath and s1 > lo and s0 < hi])
    segs: List[Tuple[float, float]] = []
    cursor = lo
    for b0, b1 in breaths:
        if b0 - cursor >= min_dur:
            segs.append((cursor, b0))
        cursor = max(cursor, b1)
    if hi - cursor >= min_dur:
        segs.append((cursor, hi))
    return segs


def _latest_breath(silences: Sequence[Tuple[float, float]],
                   lo: float, hi: float, min_len: float = _MIN_BREATH
                   ) -> Optional[Tuple[float, float]]:
    """The LATEST real breath (silence ≥ min_len) overlapping [lo, hi]. Picking the
    latest (rather than the longest) keeps the preceding pada's elongated tail with it,
    cutting only at the final breath before the next pada's content."""
    if hi <= lo:
        return None
    best = None
    for s0, s1 in silences:
        if s1 - s0 < min_len:
            continue
        if s1 <= lo or s0 >= hi:
            continue
        if best is None or s0 > best[0]:
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
        if p.confidence < _CONF_FLOOR:
            continue  # low-CTC force-fit (text likely not in the audio) → NOT a trustworthy
                      # anchor. Letting it anchor lets out-of-audio text occupy a real line's
                      # audio (the gāyatrī stealing line 59). It falls into a None-run instead,
                      # where segment+mātrā recovery decides honestly if anything is there.
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
        # SEGMENT + MĀTRĀ RECOVERY (the robust fix). The audio the forced aligner left
        # unplaced between two anchors may contain SOME of these padas (a line it fumbled)
        # but not others (a verse the reciter skipped). Decide HOW MANY using the recording:
        #   * the left anchor's compressed tail lives just before the first breath here, so
        #     the run's real content starts at that breath (don't steal the anchor's tail);
        #   * likewise it ends at the last breath before the right anchor;
        #   * count how many padas (in document order) the available SPEECH duration can
        #     hold by cumulative mātrā expectation — assign those, leave the rest UNASSIGNED.
        run_lo = _content_after(silences, left_end, right_start)
        run_hi = _content_before(silences, right_start, run_lo)
        segs = _speech_segments(silences, run_lo, run_hi, _MIN_BREATH, _MIN_REGION)
        avail = sum(e - s for s, e in segs)
        if avail < _MIN_REGION:
            for r in run:
                prov[r] = None
            k = j
            continue
        tempo = _global_tempo(order, weights, anchor, speech_start, speech_end)
        cum, fit = 0.0, 0
        for r in run:
            cum += max(_MIN_REGION, weights[r] * tempo)
            # Add a pada only if the available speech can plausibly hold it (allow the
            # recitation to be up to ~25% faster than the mātrā estimate). Kept tight so
            # skipped verses are NOT fabricated; the first present pada is guaranteed below.
            if cum <= avail * 1.25:
                fit += 1
            else:
                break
        fit = max(1, fit) if avail >= _MIN_REGION else 0   # at least the first present pada
        # Distribute [run_lo, run_hi] across the `fit` padas by mātrā; the boundary step
        # then snaps each split to a real breath (so a pada with an internal pause is kept
        # whole). Padas beyond `fit` were skipped by the reciter → honest unassigned.
        fit_run = run[:fit]
        fw = sum(weights[r] for r in fit_run) or 1.0
        cursor = run_lo
        total = run_hi - run_lo
        for r in fit_run:
            seg = total * (weights[r] / fw)
            prov[r] = (cursor, cursor + seg)
            cursor += seg
        for r in run[fit:]:
            prov[r] = None
        k = j

    # Collect the padas that have a provisional slot, in order.
    seq = [i for i in order if prov[i] is not None]
    unassigned = [i for i in order if prov[i] is None]
    order_pos = {idx: p for p, idx in enumerate(order)}

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
        # If document lines BETWEEN a and b are unassigned, the audio in this gap belongs
        # to THOSE lines (the recording has content the driver couldn't confidently place)
        # — it must NOT be absorbed into a or b. Just tidy each edge to a nearby silence
        # within a small window of its own placement; never pull them toward each other.
        # (This is what stole an unassigned line's audio into the next anchor before.)
        if order_pos[b] - order_pos[a] > 1:
            for x, edge in ((a, 'end'), (b, 'start')):
                t = ends[a] if x is a else starts[b]
                snapped = _snap(t, silences, edge, max(speech_start, t - 0.30),
                                min(speech_end, t + 0.30))
                if x is a:
                    ends[a] = max(starts[a] + 0.05, snapped)
                else:
                    starts[b] = min(ends[b] - 0.05, snapped)
            continue
        # Forced alignment COMPRESSES padas — it drops the elongated final syllable of
        # pada a into the gap before b, which is why per-line playback "cuts off the last
        # word". The fix the user asked for: give pada a its tail by cutting at the LATEST
        # real breath before b's content (not the longest pause, which may sit before the
        # tail). The cut lands in true silence so this keeps a's tail without bleeding b.
        if sb > ea + 0.02:                       # a real gap exists between a and b
            # Search only up to b's onset (sb), never past it — a breath AFTER sb is b's
            # own internal pause; cutting there would hand b's first syllable to a.
            lo, hi = ea - 0.20, sb + 0.05
        else:                                    # driver placed them adjacent/overlapping
            mid = 0.5 * (ea + sb)
            lo, hi = mid - _SNAP_WINDOW, mid + _SNAP_WINDOW
        # Keep the cut strictly inside both padas.
        lo = max(lo, starts[a] + 0.10)
        hi = min(hi, ends[b] - 0.10)
        sil = (_latest_breath(silences, lo, hi, min_len=_MIN_BREATH)
               if strategy == 'silence_gap' else None)
        if sil is None and strategy == 'silence_gap':   # fall back to any pause
            sil = _best_pause(silences, lo, hi, min_len=_MIN_SIL, target=0.5 * (lo + hi))
        if sil is not None:
            ends[a] = sil[0]
            starts[b] = sil[1]
            on_silence[a] = True
            on_silence[b] = True
        else:
            cut = min(max(0.5 * (ea + sb), lo), hi)
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
        # Honest-unassign: a forced-alignment anchor that scored below the floor is almost
        # certainly text the recording does not contain (the aligner force-fits it anyway).
        # Leave it UNASSIGNED instead of fabricating a region / stealing a neighbour's audio.
        if i in anchor and anchor[i][2] < _CONF_FLOOR:
            out.append(PlacedRegion(i, 0.0, 0.0, round(anchor[i][2], 3), 'unassigned',
                                    channel_breakdown={'reason': 'low-ctc',
                                                       'ctc': round(anchor[i][2], 3)}))
            continue
        expected = max(0.15, weights[i] * tempo)
        dur_factor = max(0.0, 1.0 - abs(math.log(max(1e-3, dur) / expected)) / 2.0)
        base = anchor[i][2] if i in anchor else 0.5
        bonus = 0.05 if on_silence.get(i) else 0.0
        # Do NOT let a weak raw score be laundered into a confident match by the duration
        # term — a low-CTC line must stay visibly low-confidence (capped near its raw score).
        conf = max(0.0, min(1.0, min(0.6 * base + 0.4 * dur_factor + bonus, base + 0.12)))
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
