"""
align_core.py — shared alignment primitives for śikṣāmitra audio–text matching.

Provides the tier-independent pieces:
 * Smith–Waterman local alignment between an audio event sequence and a text
   event sequence, with skip-both-sides semantics.
 * Cross-section assembly DP that picks non-overlapping audio ranges for the
   full target list while allowing dropped targets and audio-only gaps, with
   a small neighbor-propagation bonus for temporally consistent placements.
 * Confidence thresholding.

Every tier (DSP / Whisper / IndicConformer) reduces its raw signal into the
same two inputs: audio_events (a list of class-labelled segments with times)
and section_events (per-target lists from the editor). This module then does
the cross-section alignment.

This file intentionally has zero external dependencies beyond stdlib + numpy,
so it can be imported at editor startup without paying the cost of torch or
librosa.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:
    np = None
    _HAS_NUMPY = False


# ── Scoring weights (see plan file) ─────────────────────────────────────────
W_CLASS = 1.0
W_DUR = 0.5
W_PAUSE = 0.4
W_SVARA = 0.3
W_ANCHOR = 1.2

SKIP_AUDIO = -0.3
SKIP_TEXT = -0.5
GAP_EXTEND = -0.1

# Accept-reject thresholds after assembly
UNASSIGNED_BELOW = 0.35
WARN_BELOW = 0.55


# ── Data types ──────────────────────────────────────────────────────────────

@dataclass
class AudioEvent:
    """One observed acoustic segment."""
    type: str           # SIL | VOW_S | VOW_L | NAS | SIB | STOP | APP
    start: float        # seconds
    end: float          # seconds
    confidence: float = 1.0   # per-frame classifier confidence
    f0_contour: Optional[List[float]] = None  # for svara channel

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class TextEvent:
    """One expected event projected from IAST."""
    type: str           # same alphabet as AudioEvent.type
    matras: float       # expected duration in mātrās
    svara: Optional[str] = None   # 'udatta' | 'anudatta' | 'svarita' | None
    char: str = ''


@dataclass
class TargetSection:
    """A single text target to be located in the audio."""
    index: int
    text: str
    level: str = 'line'
    syllables: int = 0
    events: List[TextEvent] = field(default_factory=list)
    has_svaras: bool = False
    pause_after_hint: bool = False
    iast_normalized: str = ''   # script-normalized IAST, romanized for the phone aligner


def coarsen_text_events(events: Sequence[TextEvent]) -> List[TextEvent]:
    """
    Collapse per-phoneme text events into per-syllable events.

    A syllable is (consonant cluster)* (vowel) — the vowel is the nucleus and
    determines the syllable's event type (VOW_S / VOW_L). Any leading consonants
    contribute their class as metadata (in char) but don't produce separate events.
    This matches the acoustic reality: each syllable produces one voiced vowel
    nucleus in the audio stream, and the preceding consonants are rapid
    spectral transitions that our DSP classifier collapses together.

    SIL events (pauses) pass through unchanged. A trailing nasal coda (m, n,
    ṁ) is also preserved as its own NAS event so mantras ending in ṁ are
    represented.
    """
    out: List[TextEvent] = []
    pending_cons: List[TextEvent] = []
    for e in events:
        if e.type == 'SIL':
            # Flush any pending consonant cluster as its own compressed event
            # (mantra-final consonants like 'phaṭ' can be coda-only).
            if pending_cons:
                chars = ''.join(p.char for p in pending_cons)
                matras = sum(p.matras for p in pending_cons)
                # pick the "heaviest" class from the cluster
                for cls_pref in ('SIB', 'NAS', 'APP', 'STOP'):
                    if any(p.type == cls_pref for p in pending_cons):
                        out.append(TextEvent(type=cls_pref, matras=matras,
                                             svara=None, char=chars))
                        break
                pending_cons = []
            out.append(e)
            continue
        if e.type in ('VOW_S', 'VOW_L'):
            # Syllable nucleus — absorb prior consonants into this event.
            onset_chars = ''.join(p.char for p in pending_cons)
            matras = e.matras + sum(p.matras for p in pending_cons) * 0.3
            out.append(TextEvent(
                type=e.type, matras=matras,
                svara=e.svara, char=onset_chars + e.char,
            ))
            pending_cons = []
        else:
            # Consonant — hold onto it for the next vowel
            pending_cons.append(e)
    if pending_cons:
        # Trailing consonants with no following vowel (mantra-final)
        for cls_pref in ('NAS', 'SIB', 'APP', 'STOP'):
            if any(p.type == cls_pref for p in pending_cons):
                chars = ''.join(p.char for p in pending_cons)
                matras = sum(p.matras for p in pending_cons)
                out.append(TextEvent(type=cls_pref, matras=matras, svara=None, char=chars))
                break
    return out


@dataclass
class PlacedRegion:
    target_index: int
    start: float
    end: float
    confidence: float
    status: str           # 'matched' | 'warn' | 'unassigned'
    channel_breakdown: Dict[str, float] = field(default_factory=dict)


# ── Class-compatibility matrix for Smith–Waterman ───────────────────────────

_COMPATIBLE_PAIRS = {
    # Vowel-duration disagreements happen often (tempo variation); be lenient.
    frozenset(['VOW_S', 'VOW_L']): 1.5,
    # Stops & approximants share a rapid-transition profile.
    frozenset(['STOP', 'APP']):    1.2,
    # Nasal/vowel confusion: audio VOW can include nasal onset/coda.
    frozenset(['NAS', 'VOW_S']):   0.6,
    frozenset(['NAS', 'VOW_L']):   0.6,
    # Audio often labels m/n as VOW because the nasal is voiced; allow.
    frozenset(['SIB', 'STOP']):    0.3,
    # Approximants can blend with adjacent vowels.
    frozenset(['APP', 'VOW_S']):   0.5,
    frozenset(['APP', 'VOW_L']):   0.5,
}


# ── Phonetic similarity (for the unified text↔transcript phone aligner) ──────

# Phone → broad articulatory class, used by phonetic_similarity().
_PHONE_CLASS = {
    'a': 'V', 'e': 'V', 'i': 'V', 'o': 'V', 'u': 'V',
    'k': 'velar', 'g': 'velar',
    'c': 'palatal', 'j': 'palatal',
    't': 'dental', 'd': 'dental',
    'p': 'labial', 'b': 'labial',
    'n': 'nasal', 'm': 'nasal',
    'y': 'glide', 'r': 'glide', 'l': 'glide', 'v': 'glide',
    's': 'sibilant', 'h': 'sibilant',
}


def phonetic_similarity(a: str, b: str) -> float:
    """Similarity in [0, 1] between two phone tokens (align_roman alphabet).

    Exact match = 1.0; same articulatory class (e.g. t≈d, k≈g, n≈m, vowel≈vowel)
    = 0.6; otherwise 0.0. Lenient by design: the romanization is lossy and the
    ASR transcript is noisy, so near-misses must still pull the alignment.
    """
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ca = _PHONE_CLASS.get(a)
    cb = _PHONE_CLASS.get(b)
    if ca == 'V' and cb == 'V':
        return 0.3   # distinct vowels: weak (only 5 folded vowels carry real info)
    if ca is not None and ca == cb:
        return 0.6   # same consonant articulatory class (t≈d, k≈g, n≈m, s≈h)
    return 0.0


def class_match_score(a_type: str, t_type: str) -> float:
    """
    +2.0 identical, compatible pair lookup, -0.8 otherwise.
    SIL vs non-SIL is a strong mismatch but not fatal (whisper sometimes inserts SILs mid-word).
    """
    if a_type == t_type:
        return 2.0
    if a_type == 'SIL' and t_type == 'SIL':
        return 2.0
    if a_type == 'SIL' or t_type == 'SIL':
        return -1.0
    compat = _COMPATIBLE_PAIRS.get(frozenset([a_type, t_type]))
    if compat is not None:
        return compat
    return -0.8


# ── Smith–Waterman between one section and one audio window ─────────────────

def _sw_python(audio_events, text_events, tempo, expected_center,
               expected_half_width, prior_weight):
    n = len(audio_events); m = len(text_events)
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]
    best_score = 0.0; best_end_i = 0; best_end_j = 0

    for i in range(1, n + 1):
        a = audio_events[i - 1]
        if expected_center is not None and prior_weight > 0:
            delta = abs(a.start - expected_center)
            if delta <= expected_half_width:
                prior_bonus = prior_weight * (1.0 - delta / expected_half_width)
            else:
                prior_bonus = -prior_weight * min(1.0, (delta - expected_half_width) / expected_half_width)
        else:
            prior_bonus = 0.0
        for j in range(1, m + 1):
            t = text_events[j - 1]
            cls = class_match_score(a.type, t.type)
            expected_dur = max(1e-3, t.matras * tempo)
            obs_dur = max(1e-3, a.duration)
            dur_err = -abs(math.log(obs_dur / expected_dur))
            dur_err = max(dur_err, -3.0)
            match_score = W_CLASS * cls + W_DUR * dur_err + prior_bonus
            diag = dp[i - 1][j - 1] + match_score
            up   = dp[i - 1][j]     + SKIP_AUDIO
            left = dp[i][j - 1]     + SKIP_TEXT
            best = max(0.0, diag, up, left)
            dp[i][j] = best
            if best == 0.0: back[i][j] = 0
            elif best == diag: back[i][j] = 1
            elif best == up:   back[i][j] = 2
            else:              back[i][j] = 3
            if best > best_score:
                best_score = best; best_end_i = i; best_end_j = j
    return dp, back, best_score, best_end_i, best_end_j


def _sw_numpy(audio_events, text_events, tempo, expected_center,
              expected_half_width, prior_weight):
    """Vectorized Smith–Waterman. Precomputes per-cell match scores in numpy,
    then runs the serial fill in a tight Python loop (vectorizing rows is
    wrong because each row depends on the previous row via dp[i][j-1])."""
    n = len(audio_events); m = len(text_events)

    # Per-cell match scores (n × m)
    a_types = [e.type for e in audio_events]
    a_durs  = np.array([max(1e-3, e.duration) for e in audio_events])
    a_starts = np.array([e.start for e in audio_events])
    t_types = [e.type for e in text_events]
    t_matras = np.array([max(0.1, e.matras) for e in text_events])

    exp_dur = t_matras * tempo                            # (m,)
    log_ratio = np.log(a_durs[:, None] / np.maximum(1e-3, exp_dur[None, :]))
    dur_err = np.maximum(-np.abs(log_ratio), -3.0)       # (n, m)

    # Class matrix via class_match_score — only a few distinct types so cache
    unique_types = list(set(a_types) | set(t_types))
    class_score_cache = {
        (x, y): class_match_score(x, y)
        for x in unique_types for y in unique_types
    }
    cls_mat = np.array([
        [class_score_cache[(at, tt)] for tt in t_types]
        for at in a_types
    ])
    # Positional prior (per audio event)
    if expected_center is not None and prior_weight > 0:
        delta = np.abs(a_starts - expected_center)
        inside = delta <= expected_half_width
        prior = np.where(
            inside,
            prior_weight * (1.0 - delta / max(1e-3, expected_half_width)),
            -prior_weight * np.minimum(1.0, (delta - expected_half_width) / max(1e-3, expected_half_width)),
        )  # (n,)
    else:
        prior = np.zeros(n)

    match_mat = W_CLASS * cls_mat + W_DUR * dur_err + prior[:, None]   # (n, m)

    # DP fill (still serial row-by-row, but inner loop over j is numpy-friendly only
    # if we allow per-row vectorization of the three options. Diagonal depends on
    # dp[i-1][j-1], up on dp[i-1][j], left on dp[i][j-1]; left breaks parallelism.
    # Accept serial loop for correctness; cache arrays as contiguous numpy.)
    dp = np.zeros((n + 1, m + 1), dtype=np.float64)
    back = np.zeros((n + 1, m + 1), dtype=np.int8)
    best_score = 0.0; best_end_i = 0; best_end_j = 0
    for i in range(1, n + 1):
        prev_row = dp[i - 1]
        cur_row = dp[i]
        mm_row = match_mat[i - 1]
        back_row = back[i]
        for j in range(1, m + 1):
            diag = prev_row[j - 1] + mm_row[j - 1]
            up   = prev_row[j]     + SKIP_AUDIO
            left = cur_row[j - 1]  + SKIP_TEXT
            best = 0.0
            direction = 0
            if diag > best: best, direction = diag, 1
            if up   > best: best, direction = up, 2
            if left > best: best, direction = left, 3
            cur_row[j] = best
            back_row[j] = direction
            if best > best_score:
                best_score = best; best_end_i = i; best_end_j = j
    return dp, back, best_score, best_end_i, best_end_j


def local_alignment(audio_events: Sequence[AudioEvent],
                    text_events: Sequence[TextEvent],
                    tempo_sec_per_matra: float,
                    expected_center: Optional[float] = None,
                    expected_half_width: float = 15.0,
                    prior_weight: float = 0.6) -> Dict[str, float]:
    """
    Local-align `text_events` against the full `audio_events` sequence.

    Returns: { 'score', 'start_time', 'end_time', 'confidence', 'matched_count' }

    tempo_sec_per_matra: observed tempo for scoring duration terms.
    expected_center: if provided, the audio time at which this section is most
        likely centered (e.g. i / N × speech_duration). The aligner adds a soft
        Gaussian-like bonus for matches near this center so that sections
        don't arbitrarily latch onto stronger-looking matches far from their
        expected position.
    expected_half_width: the ±tolerance (seconds) around expected_center within
        which the prior contributes full reward; beyond that it tapers off.
    prior_weight: strength of the positional prior (0 = off).
    """
    if not text_events or not audio_events:
        return {
            'score': 0.0, 'start_time': 0.0, 'end_time': 0.0,
            'confidence': 0.0, 'matched_count': 0,
        }
    tempo = max(1e-4, float(tempo_sec_per_matra or 0.15))

    n = len(audio_events)
    m = len(text_events)

    if _HAS_NUMPY:
        dp, back, best_score, best_end_i, best_end_j = _sw_numpy(
            audio_events, text_events, tempo,
            expected_center, expected_half_width, prior_weight,
        )
    else:
        dp, back, best_score, best_end_i, best_end_j = _sw_python(
            audio_events, text_events, tempo,
            expected_center, expected_half_width, prior_weight,
        )

    if best_score <= 0.0:
        return {
            'score': 0.0, 'start_time': 0.0, 'end_time': 0.0,
            'confidence': 0.0, 'matched_count': 0,
        }

    # Traceback to find the start and the *matched text range*
    i, j = best_end_i, best_end_j
    matched = 0
    start_i = i
    start_j = j
    while i > 0 and j > 0 and dp[i][j] > 0:
        direction = back[i][j]
        start_i = i
        start_j = j
        if direction == 1:
            i -= 1; j -= 1
            matched += 1
        elif direction == 2:
            i -= 1
        elif direction == 3:
            j -= 1
        else:
            break

    # Compute times from the involved audio events
    start_time = audio_events[max(0, start_i - 1)].start
    end_time = audio_events[best_end_i - 1].end

    # Confidence: normalize the achieved score against the maximum score that
    # the MATCHED portion of the text could theoretically have earned. This
    # prevents partial matches from being unfairly penalized for text events
    # that weren't reachable from this audio window.
    matched_text_events = max(1, best_end_j - start_j + 1)
    # Also consider overall text-coverage so one-event matches don't overwhelm
    # multi-event sections. 50/50 weighting.
    per_matched_max = matched_text_events * (W_CLASS * 2.0)
    full_max = len(text_events) * (W_CLASS * 2.0)
    conf_matched = best_score / per_matched_max if per_matched_max > 0 else 0.0
    conf_coverage = matched_text_events / max(1, len(text_events))
    confidence = 0.5 * conf_matched + 0.5 * conf_coverage
    confidence = max(0.0, min(1.0, confidence))

    return {
        'score': best_score,
        'start_time': float(start_time),
        'end_time': float(end_time),
        'confidence': float(confidence),
        'matched_count': int(matched),
        'full_max': full_max,
    }


# ── Channel helpers ─────────────────────────────────────────────────────────

def pause_channel(audio_events: Sequence[AudioEvent],
                  text_events: Sequence[TextEvent],
                  window_start: float,
                  window_end: float,
                  tempo_sec_per_matra: float) -> float:
    """
    Reward SIL events in audio that co-locate with pause points in the text.
    Text pauses are TextEvents of type SIL with matras >= 1.0 (danda or explicit pause).
    """
    text_pauses = [e for e in text_events if e.type == 'SIL' and e.matras >= 1.0]
    if not text_pauses:
        return 0.0
    audio_pauses = [e for e in audio_events
                    if e.type == 'SIL' and e.duration >= 0.15
                    and window_start <= e.start <= window_end]
    if not audio_pauses:
        return -0.2 * len(text_pauses) / max(1, len(text_pauses))

    # Simple overlap counting: for each text pause, is there a nearby audio pause?
    window_span = max(1e-3, window_end - window_start)
    tempo = max(1e-4, float(tempo_sec_per_matra or 0.15))
    # Position of each text pause proportionally inside the window
    matra_cum = 0.0
    total_matras = sum(max(0.1, e.matras) for e in text_events)
    total_matras = max(1e-3, total_matras)
    matches = 0
    for t in text_events:
        if t.type == 'SIL' and t.matras >= 1.0:
            expected_time = window_start + (matra_cum / total_matras) * window_span
            tol = max(0.15, 0.5 * tempo * t.matras)
            if any(abs(ap.start - expected_time) <= tol for ap in audio_pauses):
                matches += 1
        matra_cum += max(0.1, t.matras)
    return matches / len(text_pauses)


def svara_channel(audio_events: Sequence[AudioEvent],
                  text_events: Sequence[TextEvent]) -> Tuple[float, bool]:
    """
    Pitch-contour match — only meaningful if the text section has any svara marks.

    Returns (score_0_1, applicable). If applicable is False, caller must NOT
    fold this channel into the final confidence.

    This version is the lightweight baseline: it scores how well the AUDIO
    vowel events carry an f0_contour with a directional profile matching each
    adjacent text svara (udātta → peak, anudātta → trough, svarita → rise-fall).
    """
    marked = [e for e in text_events if e.svara]
    if not marked:
        return 0.0, False

    audio_vowels = [e for e in audio_events
                    if e.type in ('VOW_S', 'VOW_L') and e.f0_contour]
    if not audio_vowels:
        # No pitch info → return a neutral 0.5 so we don't falsely penalize
        return 0.5, True

    # Pair marked text vowels with same-ordered audio vowels (best-effort).
    pairs = min(len(marked), len(audio_vowels))
    if pairs == 0:
        return 0.5, True

    # Window-median for normalization
    all_f0 = []
    for e in audio_vowels:
        all_f0.extend([f for f in (e.f0_contour or []) if f and f > 0])
    if not all_f0:
        return 0.5, True
    median = sorted(all_f0)[len(all_f0) // 2]

    hits = 0
    for k in range(pairs):
        tag = marked[k].svara
        contour = [f for f in (audio_vowels[k].f0_contour or []) if f and f > 0]
        if not contour:
            continue
        # semitone-like ratio to median
        def st(v): return 12.0 * math.log2(max(1.0, v) / max(1.0, median))
        vals = [st(v) for v in contour]
        vmax = max(vals)
        vmin = min(vals)
        n = len(vals)
        if tag == 'udatta':
            if vmax > 1.5: hits += 1
        elif tag == 'anudatta':
            if vmin < -1.0: hits += 1
        elif tag == 'svarita':
            # rise-then-fall within the contour
            if n >= 3:
                peak_idx = vals.index(vmax)
                if 0 < peak_idx < n - 1 and vals[0] < vmax and vals[-1] < vmax:
                    hits += 1
    return hits / pairs, True


# ── Cross-section assembly ──────────────────────────────────────────────────

def assemble_sections(audio_events: Sequence[AudioEvent],
                      sections: Sequence[TargetSection],
                      speech_span: Tuple[float, float],
                      anchor_bonus_fn=None) -> List[PlacedRegion]:
    """
    Pick non-overlapping audio ranges, one per section (or none, if confidence is low).

    Algorithm:
      1. Per-section local alignment → candidate (start, end, confidence, breakdown).
      2. Greedy placement in text order, enforcing monotonic start times.
      3. For each section, if its candidate conflicts with already-placed neighbors,
         try progressively later placements or drop the section.
      4. Apply neighbor bonus: if a section is between two already-matched
         sections whose combined span brackets a clear sub-interval, and that
         sub-interval scores above threshold, pull the section into that slot.

    Returns a list of PlacedRegion in text order. Any section below
    UNASSIGNED_BELOW ends up as status='unassigned' with start=end=0.
    """
    speech_start, speech_end = speech_span
    tempo = _estimate_tempo(sections, speech_end - speech_start)

    # Pass 1: per-section candidate (independent local alignment with a
    # positional prior centered on the section's expected slot in the audio.)
    candidates: List[Dict] = []
    N = max(1, len(sections))
    total_span = max(0.1, speech_end - speech_start)
    # Estimate expected per-section duration using each section's mātrā count
    matras_per_section = [max(1.0, sum(e.matras for e in (s.events or []))) for s in sections]
    matra_sum = max(1e-3, sum(matras_per_section))
    expected_centers: List[float] = []
    cursor = speech_start
    for mps in matras_per_section:
        frac = mps / matra_sum
        center = cursor + frac * total_span * 0.5
        expected_centers.append(center)
        cursor += frac * total_span
    # Half-width ≈ a bit more than half the average per-section duration so
    # there's tolerance for tempo variation but not enough to swap sections.
    half_width = max(8.0, (total_span / N) * 0.75)

    for sec_idx, sec in enumerate(sections):
        if not sec.events:
            candidates.append(_empty_candidate(sec.index))
            continue
        la = local_alignment(
            audio_events, sec.events, tempo,
            expected_center=expected_centers[sec_idx],
            expected_half_width=half_width,
            prior_weight=0.8,
        )
        cand = {
            'section': sec,
            'start': la['start_time'],
            'end': la['end_time'],
            'raw_class_conf': la['confidence'],
            'score': la['score'],
        }
        # extra channels
        pause_score = pause_channel(audio_events, sec.events,
                                    la['start_time'], la['end_time'], tempo)
        svara_score, svara_on = svara_channel(
            [a for a in audio_events if la['start_time'] <= a.start <= la['end_time']],
            sec.events,
        )
        dur_err = _duration_channel(la, sec.events, tempo)
        weighted, bd = _combine_channels(la['confidence'], dur_err,
                                         pause_score, svara_score, svara_on)
        cand['confidence'] = weighted
        cand['breakdown'] = bd
        candidates.append(cand)

    # Pass 2: monotonic greedy placement — if candidate i overlaps i-1, drop.
    placed: List[PlacedRegion] = []
    last_end = speech_start
    for cand in candidates:
        sec = cand['section']
        conf = cand['confidence']
        if not cand.get('start') and not cand.get('end'):
            placed.append(PlacedRegion(
                target_index=sec.index, start=0.0, end=0.0,
                confidence=0.0, status='unassigned',
            ))
            continue
        if cand['start'] < last_end - 0.05:
            # Conflicts with previous — attempt a shift: clip to last_end
            shift = last_end - cand['start']
            cand['start'] += shift
            cand['end'] = max(cand['end'] + shift, cand['start'] + 0.1)
            conf *= 0.75  # penalize the shift
        # Clamp to audio boundaries so we don't extend past the file end
        if cand['end'] > speech_end:
            overrun = cand['end'] - speech_end
            cand['end'] = speech_end
            cand['start'] = max(cand['start'], speech_start)
            if overrun > 0.5:
                conf *= 0.8
        if cand['start'] < speech_start:
            cand['start'] = speech_start
        if conf < UNASSIGNED_BELOW:
            placed.append(PlacedRegion(
                target_index=sec.index, start=0.0, end=0.0,
                confidence=conf, status='unassigned',
                channel_breakdown=cand.get('breakdown', {}),
            ))
            continue
        status = 'warn' if conf < WARN_BELOW else 'matched'
        placed.append(PlacedRegion(
            target_index=sec.index,
            start=cand['start'], end=cand['end'],
            confidence=conf, status=status,
            channel_breakdown=cand.get('breakdown', {}),
        ))
        last_end = cand['end']

    # Pass 3: neighbor bonus — a weak-but-non-zero section sandwiched between two
    # strong placements gets its confidence re-scored using the bracketed interval.
    for k in range(1, len(placed) - 1):
        cur = placed[k]
        prev = placed[k - 1]
        nxt = placed[k + 1]
        if cur.status == 'unassigned' and prev.status != 'unassigned' and nxt.status != 'unassigned':
            # Try placing cur in the gap [prev.end, nxt.start]
            gap_start = prev.end
            gap_end = nxt.start
            if gap_end - gap_start < 0.2:
                continue
            sec = sections[k]
            # local alignment restricted to the gap
            gap_events = [a for a in audio_events
                          if a.start >= gap_start and a.end <= gap_end]
            if not gap_events:
                continue
            la = local_alignment(gap_events, sec.events, tempo)
            if la['confidence'] >= UNASSIGNED_BELOW * 0.7:
                boosted_conf = min(1.0, la['confidence'] + 0.15)
                placed[k] = PlacedRegion(
                    target_index=sec.index,
                    start=la['start_time'],
                    end=la['end_time'],
                    confidence=boosted_conf,
                    status='warn' if boosted_conf < WARN_BELOW else 'matched',
                    channel_breakdown={'neighbor_bonus': 0.15, **(cur.channel_breakdown or {})},
                )
    return placed


# ── Internal helpers ────────────────────────────────────────────────────────

def _empty_candidate(index: int) -> Dict:
    return {
        'section': TargetSection(index=index, text='', events=[]),
        'start': 0.0, 'end': 0.0, 'raw_class_conf': 0.0,
        'score': 0.0, 'confidence': 0.0, 'breakdown': {},
    }


def _estimate_tempo(sections: Sequence[TargetSection], total_speech_span: float) -> float:
    """Average sec/matra estimate from the full section list."""
    total_matras = 0.0
    for s in sections:
        total_matras += sum(max(0.1, e.matras) for e in (s.events or []))
    if total_matras <= 0 or total_speech_span <= 0:
        return 0.15
    return total_speech_span / total_matras


def _duration_channel(la_result: Dict, text_events: Sequence[TextEvent],
                      tempo: float) -> float:
    observed = max(1e-3, la_result['end_time'] - la_result['start_time'])
    expected = max(1e-3, sum(max(0.1, e.matras) for e in text_events) * tempo)
    return max(-1.0, -abs(math.log(observed / expected)))


def _combine_channels(class_conf: float,
                      dur_err: float,
                      pause_score: float,
                      svara_score: float,
                      svara_applicable: bool) -> Tuple[float, Dict[str, float]]:
    # Normalize dur_err (which is ≤ 0) to a 0..1 channel
    dur_0_1 = max(0.0, 1.0 + dur_err)  # -1 → 0, 0 → 1
    pause_0_1 = max(0.0, min(1.0, pause_score))
    svara_0_1 = max(0.0, min(1.0, svara_score)) if svara_applicable else 0.0
    w_svara_applied = W_SVARA if svara_applicable else 0.0

    w_sum = W_CLASS + W_DUR + W_PAUSE + w_svara_applied
    if w_sum <= 0:
        return 0.0, {}
    combined = (
        W_CLASS * class_conf +
        W_DUR * dur_0_1 +
        W_PAUSE * pause_0_1 +
        w_svara_applied * svara_0_1
    ) / w_sum
    return combined, {
        'class':  round(class_conf, 3),
        'dur':    round(dur_0_1, 3),
        'pause':  round(pause_0_1, 3),
        'svara':  round(svara_0_1, 3) if svara_applicable else None,
        'combined': round(combined, 3),
    }
