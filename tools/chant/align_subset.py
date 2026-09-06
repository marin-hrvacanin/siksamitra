# -*- coding: utf-8 -*-
"""Carve the part of a chant document that a given recording actually contains.

A recitation covers a document only approximately: the Challakere Brothers'
Namakam is the eleven anuvākas and the upasaṁhāra, not the anukramaṇi index and
not the nyāsa; and inside that, two passages of the owner's text are not sung at
all. **Forced alignment cannot skip.** Text that is not in the audio does not
merely get a bad clip — it is squeezed to nothing and STEALS time from the
verses on either side, so leaving it in corrupts its neighbours. Excluding it is
therefore not tidying, it is a correctness requirement.

Verse ids survive into the subset unchanged, so `merge_recording.py` can put the
result back by id, and a verse left out simply carries no audio.

    python align_subset.py --chant client/public/chants/sri-rudram.json \
        --out namakam.json --sections srirudraprasnah-01 … \
        --drop srirudraprasnah-08-v1 …
"""

from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--chant', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--sections', nargs='+', required=True)
    ap.add_argument('--drop', nargs='*', default=[],
                    help='verse ids the reciter does not chant')
    a = ap.parse_args()

    doc = json.load(open(a.chant, encoding='utf-8'))
    keep = list(a.sections)
    by_id = {s['id']: s for s in doc['sections']}
    missing = [s for s in keep if s not in by_id]
    if missing:
        raise SystemExit('no such section(s): %r' % missing)

    drop = set(a.drop)
    doc['sections'] = [by_id[s] for s in keep]
    seen = set()
    for s in doc['sections']:
        seen |= {v['id'] for v in s['verses']}
        s['verses'] = [v for v in s['verses'] if v['id'] not in drop]
        if 'items' in s:
            s['items'] = [i for i in s['items']
                          if not (i.get('t') == 'verse' and i.get('id') in drop)]
    unknown = sorted(drop - seen)
    if unknown:
        raise SystemExit('--drop names verses that are not in these sections: %r'
                         % unknown)

    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)

    nv = sum(len(s['verses']) for s in doc['sections'])
    ns = sum(1 for s in doc['sections'] for v in s['verses']
             for t in v['tokens'] if t['t'] == 'syl')
    print('%s: %d sections, %d verses, %d syllables (dropped %d)'
          % (a.out, len(doc['sections']), nv, ns, len(drop)))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
