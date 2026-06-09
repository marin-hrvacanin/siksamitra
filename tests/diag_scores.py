#!/usr/bin/env python
"""Raw MMS (with CTC scores) vs post-refine, for EVERY line incl. non-chant.

Shows what forced alignment force-fits (out-of-audio text getting a confident
placement), what refine reshuffles, and the boundaries around the problem spots
(shloka 11 tail line 49, shloka 12 line 59, gayatri 67-68, om/comments).

    PYTHONUTF8=1 python tests/diag_scores.py
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_import import convert_pdf_to_html
from align_audio import decode_16k_mono, detect_silences, speech_span as _span
from align_core import TargetSection, coarsen_text_events
import align_ctc
import align_fused

PDF = r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf"
MP3 = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'cache', 'youtube_test', 'u_FzN8wdHg0.mp3')
CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}
NON_CHANT = {'title', 'subtitle', 'comment', 'translation'}


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


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
    print(f"{len(lines)} lines, span={_fmt(span[0])}-{_fmt(span[1])}, {len(sil)} silences")

    chant = [TargetSection(index=i, text=t, level=lvl, iast_normalized=t)
             for i, (lvl, t) in enumerate(lines) if lvl not in NON_CHANT]
    raw_placed, diag = align_ctc.align(samples, sr, chant, sil, span)
    refined = align_fused.refine(raw_placed, chant, sil, span)
    rawmap = {p.target_index: p for p in raw_placed}
    refmap = {p.target_index: p for p in refined}

    print(f"\nidx lvl     | RAW MMS (ctc)            | REFINED                  | text")
    for i, (lvl, t) in enumerate(lines):
        snip = t[:34]
        if lvl in NON_CHANT:
            print(f"{i:3d} {lvl:<7} |  (skipped non-chant)     |  (skipped)               | {snip}")
            continue
        rp = rawmap.get(i)
        rf = refmap.get(i)
        raws = (f"[{_fmt(rp.start)}-{_fmt(rp.end)}]{rp.status[:1]} s={rp.confidence:.2f}"
                if rp and rp.status in ('matched', 'warn') else f"--{rp.status if rp else '?'}--")
        refs = (f"[{_fmt(rf.start)}-{_fmt(rf.end)}]{rf.status[:1]} c={rf.confidence:.2f}"
                if rf and rf.status in ('matched', 'warn') else f"--{rf.status if rf else '?'}--")
        star = '*' if (43 <= i <= 49 or 58 <= i <= 71 or 33 <= i <= 36) else ' '
        print(f"{i:3d} {lvl:<7} |{star}{raws:<24}|{star}{refs:<24}| {snip}")


if __name__ == '__main__':
    main()
