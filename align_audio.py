"""
align_audio.py — audio decoding + silence/rhythm detection.

This replaces the spectral phoneme-class guessing of the old align_dsp.py
(which was the root cause of poor alignment). We keep only the two things that
are acoustically RELIABLE and genuinely useful to the unified aligner:

  * decode_audio / decode_16k_mono — robust decode to float32 PCM.
  * detect_silences — adaptive RMS voice-activity detection → list of silent
    gaps, used to snap region boundaries to real pauses and to bound the
    spoken span.

No pitch tracking, no per-frame class labels. numpy required; librosa used for
decoding compressed formats when present (it is, in this project).
"""

from __future__ import annotations

import io
import wave
from typing import List, Tuple

import numpy as np

try:
    import librosa
    _HAS_LIBROSA = True
except ImportError:  # pragma: no cover
    librosa = None
    _HAS_LIBROSA = False


# ── Decoding ────────────────────────────────────────────────────────────────

def decode_audio(raw_bytes: bytes, declared_mime: str = '') -> Tuple[np.ndarray, int]:
    """Decode audio bytes to mono float32 PCM in [-1, 1]. Returns (samples, sr).

    Prefers librosa (handles mp3/m4a/ogg/…); falls back to stdlib `wave`.
    """
    if _HAS_LIBROSA:
        try:
            with io.BytesIO(raw_bytes) as buf:
                samples, sr = librosa.load(buf, sr=None, mono=True)
                return samples.astype(np.float32), int(sr)
        except Exception:
            pass

    try:
        with io.BytesIO(raw_bytes) as buf:
            with wave.open(buf, 'rb') as wf:
                sr = wf.getframerate()
                nch = wf.getnchannels()
                sw = wf.getsampwidth()
                frames = wf.readframes(wf.getnframes())
        if sw == 2:
            arr = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        elif sw == 1:
            arr = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
        elif sw == 4:
            arr = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / (1 << 31)
        else:
            raise ValueError(f'unsupported sample width {sw}')
        if nch > 1:
            arr = arr.reshape(-1, nch).mean(axis=1)
        return arr.astype(np.float32), int(sr)
    except Exception as e:
        raise RuntimeError(f'Failed to decode audio: {e}') from e


def decode_16k_mono(raw_bytes: bytes, declared_mime: str = '') -> Tuple[np.ndarray, int]:
    """Decode straight to 16 kHz mono float32 — the rate faster-whisper wants."""
    if _HAS_LIBROSA:
        try:
            with io.BytesIO(raw_bytes) as buf:
                samples, sr = librosa.load(buf, sr=16000, mono=True)
                return samples.astype(np.float32), int(sr)
        except Exception:
            pass
    samples, sr = decode_audio(raw_bytes, declared_mime)
    if sr != 16000 and len(samples):
        if _HAS_LIBROSA:
            samples = librosa.resample(samples, orig_sr=sr, target_sr=16000)
        else:
            # cheap linear resample
            n_new = int(round(len(samples) * 16000 / sr))
            if n_new > 0:
                idx = np.linspace(0, len(samples) - 1, n_new)
                samples = np.interp(idx, np.arange(len(samples)), samples).astype(np.float32)
        sr = 16000
    return samples.astype(np.float32), sr


# ── Silence / VAD ─────────────────────────────────────────────────────────────

def _frame_rms(samples: np.ndarray, sr: int, win_ms: float = 25.0,
               hop_ms: float = 10.0) -> Tuple[np.ndarray, float]:
    """Per-frame RMS energy. Returns (rms[n_frames], hop_seconds)."""
    win = max(1, int(sr * win_ms / 1000.0))
    hop = max(1, int(sr * hop_ms / 1000.0))
    if len(samples) < win:
        samples = np.concatenate([samples, np.zeros(win - len(samples), dtype=samples.dtype)])
    n_frames = 1 + (len(samples) - win) // hop
    sig = np.ascontiguousarray(samples)
    stride = sig.strides[0]
    frames = np.lib.stride_tricks.as_strided(
        sig, shape=(n_frames, win), strides=(hop * stride, stride), writeable=False,
    )
    rms = np.sqrt(np.mean(frames.astype(np.float32) ** 2, axis=1) + 1e-12).astype(np.float32)
    return rms, hop / sr


def detect_silences(samples: np.ndarray, sr: int,
                    min_silence_s: float = 0.12) -> List[Tuple[float, float]]:
    """Adaptive-threshold VAD → list of (start, end) silent intervals (seconds).

    Threshold mirrors the editor's existing client VAD: a blend of low
    percentiles of the RMS distribution, so it adapts to recording level.
    """
    if samples is None or len(samples) == 0:
        return []
    rms, hop_s = _frame_rms(samples, sr)
    if len(rms) == 0:
        return []
    srt = np.sort(rms)
    p5 = srt[min(len(srt) - 1, int(0.05 * len(srt)))]
    p15 = srt[min(len(srt) - 1, int(0.15 * len(srt)))]
    p50 = srt[min(len(srt) - 1, int(0.50 * len(srt)))]
    thresh = max(p5 * 3.5, p15 * 1.5, p50 * 0.20, 1e-4)

    silent = rms < thresh
    silences: List[Tuple[float, float]] = []
    i = 0
    n = len(silent)
    min_frames = max(1, int(min_silence_s / max(1e-6, hop_s)))
    while i < n:
        if silent[i]:
            j = i
            while j < n and silent[j]:
                j += 1
            if (j - i) >= min_frames:
                silences.append((i * hop_s, j * hop_s))
            i = j
        else:
            i += 1
    return silences


def speech_span(samples: np.ndarray, sr: int,
                silences: List[Tuple[float, float]]) -> Tuple[float, float]:
    """First-to-last spoken time, trimming leading/trailing silence."""
    if samples is None or len(samples) == 0:
        return (0.0, 0.0)
    total = len(samples) / max(1, sr)
    start = 0.0
    end = total
    if silences:
        # leading silence
        if silences[0][0] <= 0.05:
            start = silences[0][1]
        # trailing silence
        if abs(silences[-1][1] - total) <= 0.05:
            end = silences[-1][0]
    if end <= start:
        return (0.0, total)
    return (start, end)


def snap_to_silence(t: float, silences: List[Tuple[float, float]],
                    max_dist: float = 0.35, edge: str = 'start') -> float:
    """Snap a boundary time to the nearest silence edge within max_dist.

    edge='start' snaps a region start to the END of a nearby silence (speech
    onset); edge='end' snaps a region end to the START of a nearby silence
    (speech offset).
    """
    best = t
    best_d = max_dist
    for s0, s1 in silences:
        cand = s1 if edge == 'start' else s0
        d = abs(cand - t)
        if d < best_d:
            best_d = d
            best = cand
    return best
