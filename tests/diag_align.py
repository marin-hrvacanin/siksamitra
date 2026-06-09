#!/usr/bin/env python
"""Diagnostic: why are pada boundaries landing mid-word? Dumps silences (with
durations), raw MMS coarse spans, and refined boundaries, and flags whether each
inter-pada boundary lands in a real pause or inside speech.

    python tests/diag_align.py "<pdf>" "<youtube url>"
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pdf_import import convert_pdf_to_html
from youtube_audio import download_audio
from align_audio import decode_16k_mono, detect_silences, speech_span
from align_core import TargetSection, TextEvent
from align_ctc import ctc_available, align as ctc_align
from align_fused import refine

CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}
NON_CHANT = {'title', 'subtitle', 'comment', 'translation'}


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def main():
    pdf, url = sys.argv[1], sys.argv[2]
    doc_html = convert_pdf_to_html(pdf)
    lines = []
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', doc_html, re.S):
        cls = m.group(1) or ''
        txt = html.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if txt:
            lines.append((CLS2LVL.get(cls, 'line'), txt))
    meta = download_audio(url)
    raw = open(meta['path'], 'rb').read()
    samples, sr = decode_16k_mono(raw, 'audio/mpeg')
    silences = detect_silences(samples, sr)
    span = speech_span(samples, sr, silences)
    print(f'audio {len(samples)/sr:.1f}s, speech_span={_fmt(span[0])}-{_fmt(span[1])}, '
          f'{len(silences)} silences')

    # Silence duration histogram
    durs = sorted((s1 - s0) for s0, s1 in silences)
    if durs:
        import statistics
        print(f'silence durations: min={durs[0]:.03f} med={statistics.median(durs):.03f} '
              f'max={durs[-1]:.03f}; >=0.20s: {sum(1 for d in durs if d>=0.20)}, '
              f'>=0.25s: {sum(1 for d in durs if d>=0.25)}, '
              f'0.10-0.20s: {sum(1 for d in durs if 0.10<=d<0.20)}')

    targets = []
    for i, (lvl, t) in enumerate(lines):
        ev = [TextEvent(type='VOW_L' if c in 'āīūṝeaiou' else 'VOW_S', matras=1.0, char=c)
              for c in t if c.isalpha()]
        targets.append(TargetSection(index=i, text=t, level=lvl, syllables=max(1, len(ev)),
                                     events=ev, iast_normalized=t))
    chant = [t for t in targets if (t.level or 'line') not in NON_CHANT]

    if not ctc_available():
        print('CTC not available'); return
    coarse, diag = ctc_align(samples, sr, chant, silences, span)
    refined = refine(coarse, chant, silences, span)

    cby = {p.target_index: p for p in coarse}
    rby = {p.target_index: p for p in refined}

    def in_silence(t):
        for s0, s1 in silences:
            if s0 - 0.03 <= t <= s1 + 0.03:
                return (s0, s1)
        return None

    print('\nidx  MMS[start-end]        REFINED[start-end]     end_in_pause?  next_gap')
    placed_idx = [t.index for t in chant]
    for k, ti in enumerate(placed_idx):
        c = cby.get(ti); r = rby.get(ti)
        if not r or r.status == 'unassigned':
            print(f'{ti:>3}  UNASSIGNED   {targets[ti].text[:30]}')
            continue
        sil = in_silence(r.end)
        nxt = rby.get(placed_idx[k+1]) if k+1 < len(placed_idx) else None
        gap = (nxt.start - r.end) if (nxt and nxt.status != 'unassigned') else 0.0
        flag = f'PAUSE({sil[0]:.02f}-{sil[1]:.02f},{sil[1]-sil[0]:.02f}s)' if sil else 'IN-SPEECH!!'
        print(f'{ti:>3}  {_fmt(c.start)}-{_fmt(c.end)}   {_fmt(r.start)}-{_fmt(r.end)}   '
              f'{flag:<26} gap={gap:.02f}  {targets[ti].text[:24]}')


if __name__ == '__main__':
    main()
