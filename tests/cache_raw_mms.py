#!/usr/bin/env python
"""Run MMS forced alignment ONCE and cache its raw output (placements + silences +
span + targets) to JSON, so the boundary/refine algorithm can be iterated in ms
without re-running the ~97 s MMS pass.

    PYTHONUTF8=1 python tests/cache_raw_mms.py
writes cache/_raw_mms.json
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_import import convert_pdf_to_html
from align_audio import decode_16k_mono, detect_silences, speech_span as _span
from align_core import TargetSection
import align_ctc

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf"
MP3 = os.path.join(BASE, 'cache', 'youtube_test', 'u_FzN8wdHg0.mp3')
OUT = os.path.join(BASE, 'cache', '_raw_mms.json')
CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}
NON_CHANT = {'title', 'subtitle', 'comment', 'translation'}


def main():
    doc_html = convert_pdf_to_html(PDF)
    lines = []
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', doc_html, re.S):
        cls = m.group(1) or ''
        txt = html.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if txt:
            lines.append((CLS2LVL.get(cls, 'line'), txt))

    raw = open(MP3, 'rb').read()
    samples, sr = decode_16k_mono(raw, 'audio/mpeg')
    sil = detect_silences(samples, sr)
    span = _span(samples, sr, sil)
    chant = [TargetSection(index=i, text=t, level=lvl, iast_normalized=t)
             for i, (lvl, t) in enumerate(lines) if lvl not in NON_CHANT]
    placed, diag = align_ctc.align(samples, sr, chant, sil, span)
    data = {
        'lines': lines,
        'span': list(span),
        'silences': [[round(a, 4), round(b, 4)] for a, b in sil],
        'chant': [{'index': t.index, 'text': t.text, 'level': t.level,
                   'syllables': t.syllables} for t in chant],
        'placed': [{'index': p.target_index, 'start': p.start, 'end': p.end,
                    'confidence': p.confidence, 'status': p.status} for p in placed],
        'diag': {k: diag[k] for k in diag if isinstance(diag[k], (int, float, str))},
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"wrote {OUT}: {len(chant)} chant, {len(sil)} silences, span={span}")


if __name__ == '__main__':
    main()
