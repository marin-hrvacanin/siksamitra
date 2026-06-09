"""
align_ctc.py — high-accuracy forced alignment via Meta MMS (wav2vec2 + CTC).

This is the PRIMARY mapping engine. Unlike the Whisper path (recognize → fuzzy
phonetic match), forced alignment does not try to recognize the audio: it takes
the KNOWN text, tokenizes it into the model's roman alphabet, and finds the
single monotonic path of those tokens through the acoustic CTC emissions. That
is the correct, robust tool for "align this exact text to this recording", and
it places even hard-to-recognize passages (e.g. the opening verses Whisper
missed) because it is driven by the text, not by transcription.

Model: torchaudio.pipelines.MMS_FA (Wav2Vec2FABundle, 16 kHz, 29-token roman
dict + '*' star). ~1.2 GB, downloaded once into cache/models (gitignored). CPU.
Romanization reuses align_roman.to_phones, whose alphabet is a subset of the
MMS dictionary — no remapping needed.

Heavy: loads a ~300M-param model and runs a forward pass over the whole clip.
On low-RAM machines emissions are computed in overlapping chunks to bound peak
memory. If torch/torchaudio is unavailable or the model can't load/run, callers
fall back to the Whisper engine.
"""

from __future__ import annotations

import os
import threading
from typing import List, Sequence, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'cache', 'models')
os.makedirs(MODEL_DIR, exist_ok=True)
# Keep the ~1.2 GB MMS weights inside the (gitignored) project cache.
os.environ.setdefault('TORCH_HOME', MODEL_DIR)

_model = None
_tokenizer = None
_aligner = None
_lock = threading.Lock()

# Score thresholds for CTC mean token probability (calibrated empirically).
_MATCH = 0.45
_WARN = 0.20


def ctc_available() -> bool:
    try:
        import torch  # noqa: F401
        import torchaudio  # noqa: F401
        from torchaudio.pipelines import MMS_FA  # noqa: F401
        return True
    except Exception:
        return False


def model_status() -> dict:
    avail = ctc_available()
    # MMS weights cache under TORCH_HOME/hub/checkpoints
    cached = False
    size_mb = 0.0
    hub = os.path.join(MODEL_DIR, 'hub', 'checkpoints')
    if os.path.isdir(hub):
        for root, _, files in os.walk(hub):
            for f in files:
                if 'mms' in f.lower() or 'fa' in f.lower():
                    cached = True
                try:
                    size_mb += os.path.getsize(os.path.join(root, f))
                except OSError:
                    pass
    return {'engine': 'mms_fa', 'available': avail, 'downloaded': cached,
            'size_mb': round(size_mb / (1024 * 1024), 1), 'cache_dir': MODEL_DIR}


def _load():
    global _model, _tokenizer, _aligner
    with _lock:
        if _model is None:
            import torch
            from torchaudio.pipelines import MMS_FA
            m = MMS_FA.get_model()        # downloads ~1.2 GB on first use
            m.eval()
            torch.set_num_threads(max(1, (os.cpu_count() or 2)))
            _model = m
            _tokenizer = MMS_FA.get_tokenizer()
            _aligner = MMS_FA.get_aligner()
    return _model, _tokenizer, _aligner


def _emissions(model, waveform, sr: int, chunk_s: float = 15.0):
    """Compute CTC log-prob emissions in fixed time chunks, concatenated along
    time. ALWAYS chunked: a single forward pass over a multi-minute clip can
    exhaust memory and segfault the native backend on low-RAM machines. Small
    fixed chunks bound peak memory; minor frame-boundary effects are harmless
    for forced alignment."""
    import torch
    n = waveform.size(1)
    step = int(chunk_s * sr)
    if n <= step:
        with torch.inference_mode():
            emission, _ = model(waveform)
        return emission
    parts = []
    with torch.inference_mode():
        for s in range(0, n, step):
            seg = waveform[:, s:min(n, s + step)].contiguous()
            if seg.size(1) < int(0.1 * sr):
                continue
            em, _ = model(seg)
            parts.append(em.detach().clone())
            del em
    return torch.cat(parts, dim=1)


def align(samples_16k, sr: int, chant_targets: Sequence,
          silences: List[Tuple[float, float]],
          speech_span: Tuple[float, float]):
    """Forced-align chant_targets (in document order) to the audio.
    Returns (List[PlacedRegion], diagnostics)."""
    import torch
    from align_roman import to_phones
    from align_audio import snap_to_silence
    from align_core import PlacedRegion

    model, tokenizer, aligner = _load()

    words: List[str] = []
    idx_map: List[int] = []
    for t in chant_targets:
        roman = ''.join(to_phones(getattr(t, 'iast_normalized', '') or getattr(t, 'text', '') or ''))
        if roman:
            words.append(roman)
            idx_map.append(t.index)

    if not words:
        return [PlacedRegion(t.index, 0.0, 0.0, 0.0, 'unassigned') for t in chant_targets], \
               {'engine': 'mms_fa', 'error': 'no romanizable text'}

    waveform = torch.tensor(samples_16k, dtype=torch.float32).unsqueeze(0)
    emission = _emissions(model, waveform, sr)
    tokens = tokenizer(words)
    with torch.inference_mode():
        token_spans = aligner(emission[0], tokens)
    ratio = waveform.size(1) / emission.size(1) / sr  # seconds per emission frame

    speech_start, speech_end = speech_span
    by_index = {}
    for w_i, spans in enumerate(token_spans):
        ti = idx_map[w_i]
        if not spans:
            by_index[ti] = PlacedRegion(ti, 0.0, 0.0, 0.0, 'unassigned')
            continue
        start = spans[0].start * ratio
        end = spans[-1].end * ratio
        score = sum(float(s.score) for s in spans) / max(1, len(spans))
        if score < _WARN or end <= start:
            by_index[ti] = PlacedRegion(ti, 0.0, 0.0, round(score, 3), 'unassigned',
                                        channel_breakdown={'ctc_score': round(score, 3)})
            continue
        ss = snap_to_silence(start, silences, edge='start')
        se = snap_to_silence(end, silences, edge='end')
        if se - ss < max(0.2, 0.5 * (end - start)):
            ss, se = start, end
        status = 'matched' if score >= _MATCH else 'warn'
        by_index[ti] = PlacedRegion(
            target_index=ti,
            start=round(max(speech_start, ss), 3),
            end=round(se, 3),
            confidence=round(score, 3),
            status=status,
            channel_breakdown={'ctc_score': round(score, 3)},
        )

    placed = [by_index.get(t.index, PlacedRegion(t.index, 0.0, 0.0, 0.0, 'unassigned'))
              for t in chant_targets]
    placed.sort(key=lambda p: p.target_index)
    diag = {'engine': 'mms_fa', 'words': len(words),
            'emission_frames': int(emission.size(1)), 'sec_per_frame': round(ratio, 4)}
    return placed, diag
