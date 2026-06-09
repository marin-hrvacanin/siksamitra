#!/usr/bin/env python
"""Decisive A/B: does the APP-shaped payload (populated `events`) bleed where the
manual_e2e payload (events=[]) does not?

manual_e2e.py sends targets with `events: []` and reported CORRECT, bleed-free
boundaries. The real app sends targets with a populated `events` list (per-phoneme,
coarsened in align_service), which exercises `_weight()`/rhythm-fill paths the test
never touched. This script runs the REAL align_service.run on the SAME cached audio
with BOTH payload shapes and prints overlaps for each, so we can see if `events`
is what diverges in-app.

    PYTHONUTF8=1 python tests/diag_events.py
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pdf_import import convert_pdf_to_html
from align_service import run

PDF = r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf"
MP3 = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'cache', 'youtube_test', 'u_FzN8wdHg0.mp3')

CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}

SHORT_V = set('aiuṛḷ')
LONG_V = ['ā', 'ī', 'ū', 'ṝ', 'ḹ', 'ai', 'au', 'e', 'o']  # check 2-char first
SIB = set('śṣsh')
NAS = set('ṅñṇnmṁṃ')
APP = set('yrlvḻ')


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def synth_events(text):
    """Crude per-phoneme event list mimicking projectToEventSequence shape.

    Produces STOP/SIB/NAS/APP consonant events (matras 0.5) and VOW_S/VOW_L
    vowel nuclei (matras 1 / 2). Word gaps become SIL. coarsen_text_events
    collapses these to per-syllable in align_service — same as the app path."""
    ev = []
    i = 0
    s = text.lower()
    while i < len(s):
        ch = s[i]
        if ch.isspace() or ch in '।॥|':
            ev.append({'type': 'SIL', 'matras': 0.5, 'char': ' '})
            i += 1
            continue
        # long vowel digraph?
        two = s[i:i + 2]
        if two in ('ai', 'au'):
            ev.append({'type': 'VOW_L', 'matras': 2.0, 'char': two})
            i += 2
            continue
        if ch in LONG_V:
            ev.append({'type': 'VOW_L', 'matras': 2.0, 'char': ch})
            i += 1
            continue
        if ch in SHORT_V:
            ev.append({'type': 'VOW_S', 'matras': 1.0, 'char': ch})
            i += 1
            continue
        # consonant
        cls = ('SIB' if ch in SIB else 'NAS' if ch in NAS
               else 'APP' if ch in APP else 'STOP')
        ev.append({'type': cls, 'matras': 0.5, 'char': ch})
        i += 1
    return ev


def overlaps(regions, lines):
    placed = []
    for i, (lvl, _t) in enumerate(lines):
        if lvl != 'line':
            continue
        r = regions.get(i)
        if r and r.get('status') in ('matched', 'warn'):
            placed.append((r['start'], r['end'], i))
    placed.sort(key=lambda x: x[0])
    ov = 0
    worst = 0.0
    for (s0, e0, _i0), (s1, e1, _i1) in zip(placed, placed[1:]):
        d = e0 - s1
        if d > 1e-3:
            ov += 1
            worst = max(worst, d)
    return placed, ov, worst


def run_variant(label, lines, raw, with_events):
    targets = []
    for i, (lvl, t) in enumerate(lines):
        tgt = {'index': i, 'text': t, 'level': lvl, 'iastNormalized': t,
               'events': synth_events(t) if with_events else []}
        if with_events:
            tgt['syllables'] = sum(1 for e in tgt['events'] if e['type'].startswith('VOW'))
            tgt['hasSvaras'] = False
        targets.append(tgt)
    res = run({'audio': raw, 'mime': 'audio/mpeg', 'targets': targets})
    by = {r['targetIndex']: r for r in res['regions']}
    placed, ov, worst = overlaps(by, lines)
    print(f"\n===== {label} =====")
    print(f"engine={res['engine']} summary={res['summary']} "
          f"fused={res['diagnostics'].get('fused')} "
          f"ctc_error={res['diagnostics'].get('ctc_error')}")
    for s, e, idx in placed[:6]:
        snip = lines[idx][1][:40]
        print(f"  [{_fmt(s)}-{_fmt(e)}]  {snip}")
    print(f"  BLEED: {ov} overlapping pairs (worst {worst:.2f}s)")
    return ov, worst


def main():
    doc_html = convert_pdf_to_html(PDF)
    lines = []
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', doc_html, re.S):
        cls = m.group(1) or ''
        txt = html.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if txt:
            lines.append((CLS2LVL.get(cls, 'line'), txt))
    raw = open(MP3, 'rb').read()
    print(f"Imported {len(lines)} lines; audio {len(raw)} bytes")

    ov_a, _ = run_variant("A: events=[] (manual_e2e payload)", lines, raw, False)
    ov_b, _ = run_variant("B: events populated (APP payload)", lines, raw, True)

    print("\n================ VERDICT ================")
    if ov_b > ov_a:
        print(f"FOUND IT: app-shaped events introduce {ov_b - ov_a} extra overlaps "
              f"(A={ov_a}, B={ov_b}). The events path breaks refine.")
    elif ov_a == ov_b == 0:
        print("Both bleed-free. The `events` payload is NOT the divergence; "
              "the in-app bug is stale regions / engine fallback / JS apply.")
    else:
        print(f"Both have overlaps (A={ov_a}, B={ov_b}); not events-specific.")


if __name__ == '__main__':
    main()
