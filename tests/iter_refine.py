#!/usr/bin/env python
"""Fast (ms) iteration on align_fused.refine using cached raw MMS output.
Run tests/cache_raw_mms.py once first to produce cache/_raw_mms.json.

    PYTHONUTF8=1 python tests/iter_refine.py
"""
import importlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from align_core import PlacedRegion, TargetSection
import align_fused
importlib.reload(align_fused)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, 'cache', '_raw_mms.json')


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def main():
    d = json.load(open(RAW, encoding='utf-8'))
    lines = d['lines']
    span = tuple(d['span'])
    silences = [(a, b) for a, b in d['silences']]
    chant = [TargetSection(index=c['index'], text=c['text'], level=c['level'],
                           syllables=c.get('syllables', 0), iast_normalized=c['text'])
             for c in d['chant']]
    placed = [PlacedRegion(p['index'], p['start'], p['end'], p['confidence'], p['status'])
              for p in d['placed']]
    rawmap = {p.target_index: p for p in placed}

    refined = align_fused.refine(placed, chant, silences, span)
    refmap = {p.target_index: p for p in refined}

    # breaths (real pauses) for reference
    breaths = [(a, b) for a, b in silences if b - a >= 0.22]
    print(f"span {_fmt(span[0])}-{_fmt(span[1])}  silences={len(silences)} breaths(>=0.22s)={len(breaths)}")
    chant_idx = {c.index for c in chant}
    textmap = {i: t for i, (lvl, t) in enumerate(lines)}
    prev = -1.0
    ooo = 0
    overlaps = 0
    last_end = -1.0
    for i in sorted(chant_idx):
        rp = rawmap.get(i)
        rf = refmap.get(i)
        raws = (f"[{_fmt(rp.start)}-{_fmt(rp.end)}]{rp.status[:1]}{rp.confidence:.2f}"
                if rp and rp.status in ('matched', 'warn') else f"--{rp.status if rp else '?'}--")
        if rf and rf.status in ('matched', 'warn'):
            refs = f"[{_fmt(rf.start)}-{_fmt(rf.end)}]{rf.status[:1]}{rf.confidence:.2f}"
            if rf.start < prev - 0.5:
                ooo += 1
                refs += ' OOO'
            if rf.start < last_end - 0.02:
                overlaps += 1
                refs += ' OVERLAP'
            prev = rf.start
            last_end = rf.end
        else:
            refs = f"--{rf.status if rf else '?'}--"
        star = '*' if (i in (49, 58, 59, 67, 68, 71)) else ' '
        print(f"{star}{i:3d} raw {raws:<22} ref {refs:<26} {textmap[i][:40]}")
    print(f"\noverlaps={overlaps} out-of-order={ooo}")


if __name__ == '__main__':
    main()
