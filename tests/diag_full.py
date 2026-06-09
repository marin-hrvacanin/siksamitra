#!/usr/bin/env python
"""Full per-line placement dump for BOTH engines, with out-of-order detection.

Answers the user's gross-misplacement report: does MMS forced alignment place the
repetitive 'lekas salekas' refrain (lines 47-49) correctly, or does it (or the
Whisper fallback) jump backward to shloka 10 (lines 43-44)?

Runs align_service.run twice on the SAME cached audio:
  * MMS:     normal (forced alignment primary)
  * WHISPER: ctc_available monkeypatched False → recognition + phonetic SW fallback

    PYTHONUTF8=1 python tests/diag_full.py
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_import import convert_pdf_to_html
import align_service
import align_ctc

PDF = r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf"
MP3 = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'cache', 'youtube_test', 'u_FzN8wdHg0.mp3')
CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def load_lines():
    doc_html = convert_pdf_to_html(PDF)
    lines = []
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', doc_html, re.S):
        cls = m.group(1) or ''
        txt = html.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if txt:
            lines.append((CLS2LVL.get(cls, 'line'), txt))
    return lines


def dump(label, lines, raw):
    targets = [{'index': i, 'text': t, 'level': lvl, 'iastNormalized': t, 'events': []}
               for i, (lvl, t) in enumerate(lines)]
    res = align_service.run({'audio': raw, 'mime': 'audio/mpeg', 'targets': targets})
    d = res['diagnostics']
    print(f"\n========== {label} ==========")
    print(f"engine={res['engine']} summary={res['summary']}")
    print(f"diag: words={d.get('words')} recognize_ms={d.get('recognize_ms')} "
          f"ctc_ms={d.get('ctc_ms')} ctc_error={d.get('ctc_error')} "
          f"whisper_error={d.get('whisper_error')} fused={d.get('fused')}")
    by = {r['targetIndex']: r for r in res['regions']}
    prev_start = -1.0
    ooo = 0
    for i, (lvl, t) in enumerate(lines):
        if lvl != 'line':
            continue
        r = by.get(i, {})
        st = r.get('status', '?')
        snip = t[:46]
        if st in ('matched', 'warn'):
            flag = ''
            if r['start'] < prev_start - 0.5:
                flag = '  <<< OUT-OF-ORDER (backward jump)'
                ooo += 1
            prev_start = r['start']
            mark = ' *' if 43 <= i <= 49 else '  '
            print(f"{mark}{i:3d} [{_fmt(r['start'])}-{_fmt(r['end'])}] {st:>5} {r['confidence']:.2f}  {snip}{flag}")
        else:
            mark = ' *' if 43 <= i <= 49 else '  '
            print(f"{mark}{i:3d}  ---unassigned/skip---             {snip}")
    print(f"OUT-OF-ORDER lines: {ooo}")
    return res


def main():
    lines = load_lines()
    raw = open(MP3, 'rb').read()
    print(f"{len(lines)} lines; audio {len(raw)} bytes. (* = lines 43-49: shloka 10 + lekas refrain)")

    # MMS (primary)
    dump("MMS forced alignment (primary)", lines, raw)

    # Force whisper fallback
    _orig = align_ctc.ctc_available
    align_ctc.ctc_available = lambda: False
    try:
        dump("WHISPER + phonetic SW (forced fallback)", lines, raw)
    finally:
        align_ctc.ctc_available = _orig


if __name__ == '__main__':
    main()
