#!/usr/bin/env python
"""Manual end-to-end harness: PDF import → YouTube fetch → map (via align_service).

    python tests/manual_e2e.py "<pdf path>" "<youtube url>"

Prints the per-line timeline so mapping quality can be eyeballed. Uses the real
align_service.run (MMS forced alignment primary, Whisper fallback).
"""
import html
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pdf_import import convert_pdf_to_html
from youtube_audio import download_audio
from align_service import run

CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-doc-comment': 'comment', 'ql-comment-style': 'comment',
           'ql-doc-translation': 'translation'}


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
    print(f'Imported {len(lines)} lines. Fetching audio …', flush=True)
    meta = download_audio(url)
    raw = open(meta['path'], 'rb').read()
    targets = [{'index': i, 'text': t, 'level': lvl, 'iastNormalized': t, 'events': []}
               for i, (lvl, t) in enumerate(lines)]
    print(f'"{meta["title"]}" {meta["duration"]:.0f}s — mapping …', flush=True)
    t0 = time.perf_counter()
    res = run({'audio': raw, 'mime': 'audio/mpeg', 'targets': targets})
    dt = time.perf_counter() - t0
    d = res['diagnostics']
    print(f"\nengine={res['engine']} summary={res['summary']} wall={dt:.0f}s")
    print(f"diag: {dict((k, d[k]) for k in d if k in ('words','emission_frames','ctc_ms','recognize_ms','skipped_levels','ctc_error','whisper_error'))}")
    by = {r['targetIndex']: r for r in res['regions']}
    prev = 0.0
    mono_ok = mono_bad = 0
    placed_regions = []  # (start, end) in document order, for bleed/overlap analysis
    for i, (lvl, t) in enumerate(lines):
        if lvl != 'line':
            continue
        r = by.get(i, {})
        st = r.get('status', '?')
        snip = (t[:42] + '…') if len(t) > 43 else t
        if st in ('matched', 'warn'):
            if r['start'] >= prev - 1:
                mono_ok += 1
            else:
                mono_bad += 1
            prev = r['start']
            placed_regions.append((r['start'], r['end']))
            fi = r.get('fadeIn', 0)
            fade = f' fade={fi:.02f}' if fi else ''
            print(f'  [{_fmt(r["start"])}-{_fmt(r["end"])}] {st:>7} {r["confidence"]:.2f}{fade}  {snip}')
        else:
            print(f'  UNMATCHED          {snip}')
    print(f"\nMONOTONIC: {mono_ok} in-order, {mono_bad} out-of-order")

    # Bleed / overlap analysis (SC-001): adjacent placed regions must not overlap.
    overlaps = 0
    worst = 0.0
    chrono = sorted(placed_regions, key=lambda x: x[0])
    for (s0, e0), (s1, e1) in zip(chrono, chrono[1:]):
        ov = e0 - s1
        if ov > 1e-3:
            overlaps += 1
            worst = max(worst, ov)
    print(f"BLEED: {overlaps} overlapping region pairs (worst {worst:.02f}s) — want 0")


if __name__ == '__main__':
    main()
