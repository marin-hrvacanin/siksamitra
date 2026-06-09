"""Synthetic fixtures for alignment tests (T002).

Provides deterministic builders so fusion logic can be tested without shipping
or decoding real audio:

  * make_targets(texts)  → TargetSection list (iast_normalized set).
  * make_tokens(spec)    → TranscriptToken list from [(text, start, end), …].
  * silence_delimited_pcm(...) → a tiny 16 kHz mono ndarray of sine bursts
    separated by silence (for optional end-to-end VAD checks).
"""
from __future__ import annotations

import os
import sys
from typing import List, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from align_core import TargetSection
from align_recognize import TranscriptToken


def make_targets(texts: List[str]) -> List[TargetSection]:
    return [TargetSection(index=i, text=t, iast_normalized=t) for i, t in enumerate(texts)]


def make_tokens(spec: List[Tuple[str, float, float]]) -> List[TranscriptToken]:
    return [TranscriptToken(text, s, e, 0.9) for (text, s, e) in spec]


def silence_delimited_pcm(segment_durs, gap=0.4, sr=16000, freq=200.0):
    """Return (samples, sr, segment_times) — sine bursts separated by silence."""
    import numpy as np
    samples = []
    times = []
    t = 0.0
    for dur in segment_durs:
        n = int(dur * sr)
        tt = np.arange(n) / sr
        burst = (0.3 * np.sin(2 * np.pi * freq * tt)).astype('float32')
        start = t
        samples.append(burst)
        t += dur
        times.append((start, t))
        gap_n = int(gap * sr)
        samples.append(np.zeros(gap_n, dtype='float32'))
        t += gap
    import numpy as np  # noqa
    return np.concatenate(samples), sr, times
