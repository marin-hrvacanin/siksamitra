#!/usr/bin/env python
"""Dump the Whisper transcript (tiny) with timestamps — to judge whether
recognition is usable as an anchor signal for fusion on Vedic chant.

    PYTHONUTF8=1 python tests/diag_recognize.py [tiny|small]
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from align_audio import decode_16k_mono
from align_recognize import recognize

MP3 = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'cache', 'youtube_test', 'u_FzN8wdHg0.mp3')


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else 'tiny'
    raw = open(MP3, 'rb').read()
    samples, sr = decode_16k_mono(raw, 'audio/mpeg')
    t0 = time.perf_counter()
    tokens, span, diag = recognize(samples, sr, model)
    dt = time.perf_counter() - t0
    print(f"model={model} wall={dt:.0f}s tokens={len(tokens)} span={_fmt(span[0])}-{_fmt(span[1])}")
    print(f"diag={diag}")
    # Group tokens into ~5s lines for readability.
    bucket = None
    line = []
    for tk in tokens:
        b = int(tk.start // 5)
        if bucket is None:
            bucket = b
        if b != bucket:
            print(f"  [{_fmt(bucket*5)}] {' '.join(line)}")
            line = []
            bucket = b
        line.append(tk.text)
    if line:
        print(f"  [{_fmt(bucket*5)}] {' '.join(line)}")
    # Focus window 02:54-03:09 (where line 59/68 confusion is).
    print("\n--- window 02:54-03:09 (shloka12 end / gayatri / shanti) ---")
    for tk in tokens:
        if 174 <= tk.start <= 189:
            print(f"  [{_fmt(tk.start)}-{_fmt(tk.end)}] {tk.text!r} (p={tk.prob:.2f})")


if __name__ == '__main__':
    main()
