# -*- coding: utf-8 -*-
"""Divergence harness: gen_marks.py vs the owner's three marked chants.

Reconstructs each verse's PRE-SANDHI IAST from the stored tokens — inverting
every `change` unit first, because the stored letter is the POST-sandhi form
(`ṁ`→ṅ/ñ/ṇ/n/m, `ḥ`→ś/ṣ/s/r). Feeding the post-sandhi letters back into the
engine invents geminates (`tan no` for `taṁ no`) and the measurement lies.

Then runs `mark()` over that IAST and compares unit-by-unit against the stored
holdings.

  one-directional : how many of HIS boxes the engine reproduces  (the metric)
  two-directional : letters where BOTH sides agree on box / no-box

Usage:
    python tools/chant/diverge.py                 # current RULES
    python tools/chant/diverge.py --modes         # table over all crossword modes
    python tools/chant/diverge.py --detail        # list every divergence
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_marks as gm

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CHANTS = [os.path.join(ROOT, 'client', 'public', 'chants', n + '.json')
          for n in ('purusha-suktam', 'durga-suktam', 'bhagya-suktam')]

# invert the sandhi substitutions gen_marks applies, to recover what was typed
UNCHANGE = {'ṅ': 'ṁ', 'ñ': 'ṁ', 'ṇ': 'ṁ', 'n': 'ṁ', 'm': 'ṁ',
            'ś': 'ḥ', 'ṣ': 'ḥ', 's': 'ḥ', 'r': 'ḥ'}


def verse_source(verse):
    """(pre-sandhi IAST, [(letter, hold|None)]) for one verse."""
    src = []
    gt = []
    for tk in verse['tokens']:
        t = tk['t']
        if t == 'syl':
            for u in tk['units']:
                c = u['c']
                if c == '-':          # soft hyphen inside a word — not a letter
                    continue
                gt.append((c, u.get('hold')))
                if u.get('change'):
                    c = UNCHANGE.get(c, c)
                src.append(c)
        elif t == 'sp':
            src.append(' ')
        elif t in ('pause', 'bar'):
            src.append(' | ')
        elif t == 'danda':
            src.append(' || ')
        elif t == 'br':
            src.append(' // ')
        # 'num' (verse number) contributes nothing
    return ''.join(src), gt


def engine_units(iast):
    out = []
    for tk in gm.mark(iast):
        if tk['t'] != 'syl':
            continue
        for u in tk['units']:
            out.append((u['c'], u.get('hold')))
    return out


def measure(detail=False):
    his = mine = both_box = agree = letters = 0
    skew = []
    diffs = []
    for path in CHANTS:
        data = json.load(open(path, encoding='utf-8'))
        cid = data['id']
        for sec in data['sections']:
            for v in sec['verses']:
                iast, gt = verse_source(v)
                mv = engine_units(iast)
                if len(mv) != len(gt):
                    skew.append((cid, sec['id'], v['id'], len(gt), len(mv)))
                    his += sum(1 for _, h in gt if h)
                    continue
                words = iast.split()
                for k, ((gc, gh), (mc, mh)) in enumerate(zip(gt, mv)):
                    letters += 1
                    if gh:
                        his += 1
                    if mh:
                        mine += 1
                    if gh and mh:
                        both_box += 1
                    if bool(gh) == bool(mh):
                        agree += 1
                    elif detail:
                        ctx = ''.join(c for c, _ in gt[max(0, k - 6):k + 7])
                        diffs.append((cid, v['id'],
                                      'HIS-only' if gh else 'ENGINE-only',
                                      gc, ctx))
    return dict(his=his, mine=mine, both=both_box, agree=agree,
                letters=letters, skew=skew, diffs=diffs)


def main():
    detail = '--detail' in sys.argv
    if '--modes' in sys.argv:
        print(f"{'crossword_host':<14} {'his boxes':>12}  {'engine boxes':>12}  {'2-way agree':>14}")
        for mode in (False, 'aspirate', 'homorganic', 'all'):
            gm.RULES['crossword_host'] = mode
            r = measure()
            print(f"{str(mode):<14} {r['both']:>7}/{r['his']:<4}  "
                  f"{r['both']:>7}/{r['mine']:<4}  {r['agree']:>7}/{r['letters']:<6}"
                  + ('   SKEW ' + str(r['skew']) if r['skew'] else ''))
        return
    r = measure(detail)
    print(f"crossword_host = {RULES_repr()}")
    print(f"one-directional (his boxes reproduced): {r['both']}/{r['his']}")
    print(f"engine boxes                          : {r['both']}/{r['mine']}")
    print(f"two-directional (letters agreeing)    : {r['agree']}/{r['letters']}")
    if r['skew']:
        print('LENGTH SKEW (verse not comparable):', r['skew'])
    for d in r['diffs']:
        print('  %-16s %-6s %-11s %-3s  …%s…' % d)


def RULES_repr():
    return repr(gm.RULES['crossword_host'])


if __name__ == '__main__':
    main()
