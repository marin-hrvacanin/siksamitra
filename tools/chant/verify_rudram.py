# -*- coding: utf-8 -*-
"""Round-trip `sri-rudram.json` back to text and diff it against the PDF.

The point of a transcription is that nothing moved. So this reconstructs, from
the generated chant JSON alone, the exact character stream of every chant row in
the source — letters, accents in their original positions, superscript reading
aids, the candrabindu, pauses, daṇḍas and verse numbers — and compares it row by
row with what `pdf_marks` reads out of the PDF (which is itself verified equal to
PyMuPDF's own text layer, 1214/1214 rows).

Anything this reports is a real difference between the document on the site and
the document the owner exported.

    "$PY" verify_rudram.py --pdf "…/rudram v1.6 - IAST.pdf"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_marks import extract, plain, PUA_CANDRA          # noqa: E402
from gen_rudram import (FIRST_PAGE, DROP, DIRGHA_OVERLINE, PARTS,  # noqa: E402
                        SKIP_PARTS)

JSON_IN = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       '..', '..', 'client', 'public', 'chants', 'sri-rudram.json')

SVARA_CHAR = {'anudatta': '̱', 'svarita': '̍', 'dirgha-svarita': '̎'}
#: The two ways the source writes a dīrgha-svarita; fold to one before diffing.
OVERLINE_PAIR = DIRGHA_OVERLINE + '̍'


def fold(s: str) -> str:
    s = s.replace(OVERLINE_PAIR, '̎')
    for d in DROP:                      # the footnote marker (the tick is kept)
        s = s.replace(d, '')
    s = s.replace('’', "'").replace('‘', "'")
    # `॥ 1॥` — the verse number's leading space is layout, and the token stream
    # (`danda` · `num` · `danda`) carries no `sp`, exactly as every other chant.
    s = s.replace('॥ ', '॥')
    return re.sub(r'\s+', ' ', s).strip()


def from_pdf(events) -> str:
    out = []
    for e in events:
        k = e['kind']
        if k == 'ann':
            continue
        if k == 'text':
            out.append(e['text'])
        elif k == 'svara':
            out.append(e['mark'])
        elif k == 'sup':
            out.append(e['text'])
        elif k == 'candra':
            out.append(PUA_CANDRA)
        elif k == 'pause':
            out.append('|')
    return fold(''.join(out))


def from_json(tokens) -> list:
    """-> one string per source row (tokens split at `br`)."""
    rows, cur = [], []
    for t in tokens:
        k = t['t']
        if k == 'br':
            rows.append(''.join(cur)); cur = []
        elif k == 'syl':
            for u in t['units']:
                if u.get('sbhakti'):
                    cur.append('·')
                cur.append(PUA_CANDRA if u.get('candra') else u['c'])
                if u.get('svara'):
                    cur.append(SVARA_CHAR[u['svara']])
                if u.get('sup'):
                    cur.append(u['sup'])
        elif k == 'sp':
            cur.append(' ')
        elif k == 'pause':
            cur.append('|')
        elif k == 'danda':
            cur.append(t['s'])
        elif k == 'num':
            cur.append(t['s'])
        elif k == 'text':
            cur.append(t['s'])
    rows.append(''.join(cur))
    return [fold(r) for r in rows]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--json', default=JSON_IN)
    a = ap.parse_args()

    paras, _ = extract(a.pdf)
    want, skipping = [], False
    for p in paras:
        if p['page'] < FIRST_PAGE:
            continue
        if p['cls'] == 'title':
            t = plain(p['events']).strip()
            if t in PARTS:
                skipping = t in SKIP_PARTS
            continue
        if skipping or p['cls'] != 'shloka' or not plain(p['events']).strip():
            continue
        want.append(from_pdf(p['events']))

    doc = json.load(open(a.json, encoding='utf-8'))
    got = []
    for s in doc['sections']:
        for v in s['verses']:
            got.extend(from_json(v['tokens']))

    print('source rows %d · reconstructed rows %d' % (len(want), len(got)))
    bad = 0
    for i, (w, g) in enumerate(zip(want, got)):
        if w != g:
            bad += 1
            if bad <= 12:
                print('  row %d' % i)
                print('    PDF : %r' % w)
                print('    JSON: %r' % g)
    if len(want) != len(got):
        print('  ROW COUNT MISMATCH')
        lo = min(len(want), len(got))
        print('    first unmatched source row: %r' % (want[lo:lo + 1]))
        print('    first unmatched json  row: %r' % (got[lo:lo + 1]))
    print('rows identical: %d / %d  (1 expected: the `॥11.11॥` -> `॥11.10॥` '
          'correction)' % (len(want) - bad, len(want)))

    # marks: total counts must survive the transcription
    def count(pred):
        return sum(1 for s in doc['sections'] for v in s['verses']
                   for t in v['tokens'] if t['t'] == 'syl'
                   for u in t['units'] if pred(u))
    print('holdings %d · svara %d · change %d · candra %d · sup %d · sbhakti %d'
          % (count(lambda u: u.get('hold')), count(lambda u: u.get('svara')),
             count(lambda u: u.get('change')), count(lambda u: u.get('candra')),
             count(lambda u: u.get('sup')), count(lambda u: u.get('sbhakti'))))

    # digraph integrity: an aspirate must never have been split in two
    stops = set('kgcjṭḍtdpb')
    split = []
    for s in doc['sections']:
        for v in s['verses']:
            flat = [u['c'] for t in v['tokens'] if t['t'] == 'syl'
                    for u in t['units']]
            for x, y in zip(flat, flat[1:]):
                if x in stops and y == 'h':
                    split.append(x + y)
    print('split aspirates: %d %s' % (len(split), sorted(set(split))))

    # every syllable must have a derived form in all four scripts
    missing = [t['iast'] for s in doc['sections'] for v in s['verses']
               for t in v['tokens'] if t['t'] == 'syl'
               and not (t['deva'] and t['tel'] and t['tam'])]
    print('syllables with no derived script: %d %s'
          % (len(missing), sorted(set(missing))[:10]))
    return 0 if (bad <= 1 and len(want) == len(got)
                 and not split and not missing) else 1


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
