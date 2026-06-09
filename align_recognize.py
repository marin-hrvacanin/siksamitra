"""
align_recognize.py — approximate speech recognition via faster-whisper.

Unlike the old align_whisper.py (which threw the transcript away and kept only
word boundaries), this module RETURNS the transcript content: per-word
(text, start, end, prob) tuples. The unified aligner (align_fuse.py) then
phonetically aligns the KNOWN text against this noisy transcript — which is
what makes confident, partial- and out-of-order-tolerant mapping possible.

Engine: faster-whisper (CTranslate2, int8, CPU, no torch). Models tiny/small
are already cached under cache/models/. Default 'tiny' for the modest target
laptop; 'small' optional for better recognition at higher RAM/time cost.

Sanskrit is a supported Whisper language ('sa'); recognition is imperfect but
sufficient as one evidence stream. We fall back to 'hi' if 'sa' is rejected.
"""

from __future__ import annotations

import os
import threading
from typing import Dict, List, Optional, Tuple

from align_roman import to_phones

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'cache', 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

_VALID_MODELS = ('tiny', 'small')
_model_cache: Dict[str, object] = {}
_model_lock = threading.Lock()


class TranscriptToken:
    """One recognized word with timing + folded phones."""
    __slots__ = ('text', 'start', 'end', 'prob', 'phones')

    def __init__(self, text: str, start: float, end: float, prob: float = 0.0):
        self.text = text
        self.start = float(start)
        self.end = float(end)
        self.prob = float(prob)
        self.phones = to_phones(text)

    def to_dict(self) -> Dict:
        return {'text': self.text, 'start': round(self.start, 3),
                'end': round(self.end, 3), 'prob': round(self.prob, 3),
                'phones': self.phones}


def _normalize_model(name: Optional[str]) -> str:
    n = (name or 'tiny').lower()
    return n if n in _VALID_MODELS else 'tiny'


def get_model(model_size: str):
    """Lazy-load + cache a WhisperModel. Raises ImportError if faster-whisper
    is absent (caller degrades to the proportional path)."""
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError as e:
        raise ImportError('faster-whisper is not installed') from e

    size = _normalize_model(model_size)
    with _model_lock:
        cached = _model_cache.get(size)
        if cached is not None:
            return cached
        model = WhisperModel(
            size,
            device='cpu',
            compute_type='int8',
            download_root=MODEL_DIR,
            cpu_threads=max(1, (os.cpu_count() or 2) - 1),
        )
        _model_cache[size] = model
        return model


def model_status(model: str) -> Dict:
    size = _normalize_model(model)
    candidates = [
        os.path.join(MODEL_DIR, f'models--Systran--faster-whisper-{size}'),
        os.path.join(MODEL_DIR, f'faster-whisper-{size}'),
    ]
    present = any(os.path.isdir(c) for c in candidates)
    size_mb = 0.0
    for c in candidates:
        if os.path.isdir(c):
            for root, _, files in os.walk(c):
                for f in files:
                    try:
                        size_mb += os.path.getsize(os.path.join(root, f))
                    except OSError:
                        pass
            break
    try:
        import faster_whisper  # noqa: F401
        engine_available = True
    except ImportError:
        engine_available = False
    return {
        'model': size,
        'downloaded': present,
        'size_mb': round(size_mb / (1024 * 1024), 1),
        'cache_dir': MODEL_DIR,
        'engine_available': engine_available,
    }


def ensure_downloaded(model: str) -> Dict:
    get_model(model)
    return model_status(model)


def recognize(samples_16k, sr: int, model_size: str = 'small'
              ) -> Tuple[List[TranscriptToken], Tuple[float, float], Dict]:
    """Transcribe 16 kHz mono float32 audio → (tokens, span, diagnostics).

    Word timestamps on; VAD filter off (chant can read as non-speech to
    Whisper's VAD); greedy decoding (content accuracy is not the goal).

    Loads the requested model, auto-downloading it if missing; on failure
    (download/load error) falls back to the smaller 'tiny' model so mapping
    still runs. Only if every model fails does it raise (→ proportional path).
    """
    diag: Dict = {'model': _normalize_model(model_size)}
    model = None
    chain = [model_size] + [m for m in ('tiny',) if _normalize_model(m) != _normalize_model(model_size)]
    for cand in chain:
        try:
            model = get_model(cand)
            diag['model'] = _normalize_model(cand)
            if cand != model_size:
                diag['model_fallback_from'] = _normalize_model(model_size)
            break
        except Exception as e:
            diag['model_load_error'] = f'{cand}: {e!r}'
    if model is None:
        raise ImportError(diag.get('model_load_error', 'no recognition model available'))

    def _run(lang: str):
        return model.transcribe(
            samples_16k,
            language=lang,
            task='transcribe',
            word_timestamps=True,
            vad_filter=False,
            beam_size=1,
            no_speech_threshold=0.2,
            compression_ratio_threshold=3.0,
            condition_on_previous_text=False,
        )

    try:
        segments, info = _run('sa')
        used_lang = 'sa'
    except Exception:
        segments, info = _run('hi')
        used_lang = 'hi'

    tokens: List[TranscriptToken] = []
    seg_count = 0
    for seg in segments:
        seg_count += 1
        words = getattr(seg, 'words', None)
        if words:
            for w in words:
                if w.start is None or w.end is None or w.end <= w.start:
                    continue
                tokens.append(TranscriptToken(
                    w.word or '', w.start, w.end,
                    getattr(w, 'probability', 0.0) or 0.0,
                ))
        else:
            # No word timing — fall back to the segment as one token.
            if seg.end > seg.start:
                tokens.append(TranscriptToken(seg.text or '', seg.start, seg.end, 0.3))

    tokens.sort(key=lambda t: t.start)
    if tokens:
        span = (tokens[0].start, tokens[-1].end)
    else:
        span = (0.0, round(float(getattr(info, 'duration', 0.0)), 3))

    diag.update({
        'language': used_lang,
        'segments': seg_count,
        'tokens': len(tokens),
        'duration': round(float(getattr(info, 'duration', 0.0)), 2),
    })
    return tokens, span, diag
