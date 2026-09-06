# -*- coding: utf-8 -*-
"""
Emit `shared/src/sankalpa-marks.ts` — the śikṣā marks (holdings + anusvāra +
visarga; NO svara) for every saṅkalpa fixed clause and option vocabulary, each
marked as a PIECE OF A LINE, plus the boundary tokens that change when two
adjacent fragments are recited together (SANKALPA_JOINS).

The output is the SAME token shape a chant JSON carries (`shared/src/chant.ts`),
including the Devanāgarī / Telugu / Tamil forms of every syllable — so the
saṅkalpa is rendered by the one chant reader, in any of the four scripts, and
looks identical to every other Veda Union text.

Also validates the holding derivation against the owner's own chants before
writing, as a standing check that the ported algorithm still matches.

Run with the Śikṣāmitra venv python (needs `indic_transliteration`):

    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/emit.py
"""
import json, os
import gen_marks
from gen_marks import mark
from tokens import compact, line_tokens

# A saṅkalpa fragment is a PIECE OF A LINE, never a line: `prīty-arthaṃ` sits in
# the middle of its clause. The never-box-a-line-initial-cluster rule therefore
# must NOT fire while marking one in isolation — the composer applies it once,
# to whichever fragment actually opens the rendered line.
gen_marks.RULES['no_initial_box'] = False

HERE = os.path.dirname(os.path.abspath(__file__))
CHANTS = os.path.join(HERE, "..", "..", "client", "public", "chants")
OUT_TS = os.path.join(HERE, "..", "..", "shared", "src", "sankalpa-marks.ts")

# ---------- validation: holdings vs ground truth ----------
def verse_iast(v):
    out=[]
    for tk in v['tokens']:
        t=tk['t']
        if t=='syl': out.append(tk['iast'])
        elif t=='sp': out.append(' ')
        elif t in ('bar','danda','pause'): out.append(' | ')
        elif t=='br': out.append(' ')
    return ''.join(out)

def gt_holdcount(v):
    n=0
    for tk in v['tokens']:
        if tk['t']!='syl': continue
        for u in tk['units']:
            if u.get('hold'): n+=1
    return n

def my_holdcount(iast):
    n=0
    for tk in mark(iast):
        if tk['t']!='syl': continue
        for u in tk['units']:
            if u.get('hold'): n+=1
    return n

def validate(path,label):
    data=json.load(open(path,encoding='utf-8'))
    gtot=mtot=0; verses=0; close=0
    for sec in data['sections']:
        for v in sec['verses']:
            iast=verse_iast(v)
            g=gt_holdcount(v); m=my_holdcount(iast)
            gtot+=g; mtot+=m; verses+=1
            if abs(g-m)<=max(1,int(0.2*g)+1): close+=1
    print(f"{label}: {verses} verses | GT holdings={gtot} mine={mtot} "
          f"| per-verse within-tolerance {close}/{verses} ({100*close//verses}%)")

# ---------- fragments ----------
# These MUST mirror the IAST in shared/src/sankalpa.ts. See
# docs/AUTHORING-SANKALPA.md §5.
FIXED = {
 'MANGALA':'oṃ',
 'MUHURTA':'śubhe śobhane muhūrte',
 'PREAMBLE':'ādya brahmaṇo dvitīya-parārdhe śrī-śveta-varāha-kalpe vaivasvata-manvantare aṣṭāviṃśatitame kali-yuge kali-prathama-caraṇe',
 'BHARATA':'jambū-dvīpe bharata-varṣe bharata-khaṇḍe meroḥ dakṣiṇe pārśve',
 'JAMBU':'jambū-dvīpe',
 'EVAM':'evaṃ guṇa-viśeṣaṇa-viśiṣṭāyāṃ asyāṃ śubha-puṇya-tithau',
 'RESOLVE_PRE':'mama upātta-samasta-durita-kṣaya-dvārā',
 'KARISHYE':'kariṣye',
 'SRI':'śrī',
 'PRITY_ARTHAM':'prīty-arthaṃ',
 'GOTROTPANNAH':'gotrotpannaḥ',
 'NAMA':'nāmā',
 'AHAM':'ahaṃ',
 'PLACE_PRE':'jambū-dvīpe asmin vartamāne vyāvahārike',
 'PLACE_POST':'iti prasiddhe deśe',
}
TRAD = {
 'trad:smarta:opening':'śrī-gurubhyo namaḥ | hariḥ oṃ |',
 'trad:vaishnava:opening':'śrīmate nārāyaṇāya namaḥ |',
 'trad:vaishnava:frame':'bhagavad-ājñayā bhagavat-kaiṅkarya-rūpaṃ',
 'trad:shaiva:opening':'śrī-gurubhyo namaḥ | oṃ namaḥ śivāya |',
 'trad:shakta:opening':'oṃ aiṃ hrīṃ klīṃ |',
}
# Iṣṭa-devatā. `DEITIES` is the compound STEM (devatā-prīty-arthaṃ); DEITIES_ACC
# is the ACCUSATIVE singular that fills the `deva` slot in the pūjā mantras
# ("asmin bimbe śrī devaṁ āvāhayāmi"). Declension is AUTHORED, never derived —
# these must mirror `DEITIES[k].acc.iast` in shared/src/sankalpa.ts.
DEITIES = {
 'parameshvara':'parameśvara','ganesha':'gaṇeśa','shiva':'sāmba-sadāśiva',
 'vishnu':'viṣṇu','devi':'jagad-ambā','surya':'sūrya','hanuman':'hanumat',
 'lakshmi':'mahā-lakṣmī','sarasvati':'sarasvatī','durga':'durgā','krishna':'kṛṣṇa',
 'rama':'rāma','subrahmanya':'subrahmaṇya','dattatreya':'dattātreya','gayatri':'gāyatrī',
}
DEITIES_ACC = {
 'parameshvara':'parameśvaraṃ','ganesha':'gaṇeśaṃ','shiva':'sāmba-sadāśivaṃ',
 'vishnu':'viṣṇuṃ','devi':'jagad-ambāṃ','surya':'sūryaṃ','hanuman':'hanumantaṃ',
 'lakshmi':'mahā-lakṣmīṃ','sarasvati':'sarasvatīṃ','durga':'durgāṃ','krishna':'kṛṣṇaṃ',
 'rama':'rāmaṃ','subrahmanya':'subrahmaṇyaṃ','dattatreya':'dattātreyaṃ','gayatri':'gāyatrīṃ',
}
KARMAS = {
 'puja':'pūjāṃ','japa':'japaṃ','homa':'homaṃ','vrata':'vrataṃ','dana':'dānaṃ',
 'snana':'snānaṃ','parayana':'pārāyaṇaṃ','archana':'arcanāṃ','abhisheka':'abhiṣekaṃ','dhyana':'dhyānaṃ',
}
KAMANAS = {
 'dharmic':'dharmārtha-kāma-mokṣa-catur-vidha-phala-puruṣārtha-siddhy-arthaṃ',
 'health':'ārogya-prāptyarthaṃ','peace':'sarva-śānti-prāptyarthaṃ','knowledge':'vidyā-prāptyarthaṃ',
 'obstacles':'sarva-vighna-nivṛtty-arthaṃ','prosperity':'dhana-dhānya-samṛddhy-arthaṃ',
 'progeny':'santāna-prāptyarthaṃ','longevity':'āyur-ārogya-aiśvarya-abhivṛddhy-arthaṃ',
 'liberation':'ātma-jñāna-mokṣa-siddhy-arthaṃ','protection':'sarvāriṣṭa-śānti-rakṣā-prāptyarthaṃ',
 'allbeings':'sarva-loka-kṣema-arthaṃ',
}

# ---------- the joins between adjacent fragments ----------
# Marking a fragment in isolation cannot see across its own edges, so a join
# loses the sandhi AND the holding that straddles it: `pūjāṃ` + `kariṣye` must
# recite `pūjāṅ kariṣye`, with the box on the `k`. The joins are PRECOMPUTED
# here — the composer stays a pure token-assembler with no marking engine.
#
# ADJACENCY must mirror `composeSankalpa` in shared/src/sankalpa.ts: every pair
# of MARKED terms that can end up next to each other on one line. (A free-text
# fill between two terms breaks the join; so does a daṇḍa.)
def adjacency(deities, karmas):
    pairs = [
        ('MANGALA','MUHURTA'),
        ('GOTROTPANNAH','AHAM'), ('NAMA','AHAM'),
        ('RESOLVE_PRE','SRI'), ('trad:vaishnava:frame','SRI'),
        ('PLACE_PRE','PLACE_POST'),
    ]
    for d in deities:
        pairs.append(('SRI', d))
        pairs.append((d, 'PRITY_ARTHAM'))
        for k in karmas:
            pairs.append((d, k))
    for k in karmas:
        pairs.append((k, 'KARISHYE'))
    return pairs


def _nohg(tokens):
    """Tokens with the `hg` box-group numbers dropped.

    `hg` is numbered per marked RUN, so marking two fragments together renumbers
    every box in the right-hand one. It only ever groups CONSECUTIVE units
    inside one syllable (ChantReader), so the renumbering is cosmetic — but it
    would otherwise swamp the real boundary diff.
    """
    return [
        {k: ([{ku: uv for ku, uv in u.items() if ku != 'hg'} for u in v] if k == 'units' else v)
         for k, v in tk.items()}
        for tk in tokens
    ]


def join_entry(a_txt, b_txt):
    """The boundary tokens that change when the two fragments are marked
    TOGETHER. Returns None when nothing changes."""
    ta, tb = line_tokens(a_txt), line_tokens(b_txt)
    if not ta or not tb:
        return None
    # a pause or daṇḍa is a hard saṁyukta barrier (MARKING-RULES §2.1): nothing
    # can cross it, so there is no join to precompute (`oṃ |` + `śubhe …`)
    if ta[-1]['t'] in ('pause','danda') or tb[0]['t'] in ('pause','danda'):
        return None
    tj = line_tokens(a_txt + ' ' + b_txt)
    n = len(ta)
    if len(tj) != n + 1 + len(tb) or tj[n]['t'] != 'sp':
        raise SystemExit(f"join {a_txt!r} + {b_txt!r}: unexpected joined shape")
    ja, jb, jt = _nohg(ta), _nohg(tb), _nohg(tj)
    if jt[:n] == ja and jt[n+1:] == jb:
        return None
    # every difference must sit on the two tokens either side of the join —
    # otherwise a pairwise patch is not enough and this needs rethinking
    if jt[:n-1] != ja[:-1] or jt[n+2:] != jb[1:]:
        raise SystemExit(f"join {a_txt!r} + {b_txt!r}: change spreads past the boundary")
    e = {}
    if jt[n-1] != ja[-1]: e['l'] = tj[n-1]
    if jt[n+1] != jb[0]: e['r'] = tj[n+1]
    return e or None


def emit():
    all_frag={}
    all_frag.update(FIXED)
    all_frag.update(TRAD)
    for k,v in DEITIES.items(): all_frag[f'deity:{k}']=v
    for k,v in DEITIES_ACC.items(): all_frag[f'deity-acc:{k}']=v
    for k,v in KARMAS.items(): all_frag[f'karma:{k}']=v
    for k,v in KAMANAS.items(): all_frag[f'kamana:{k}']=v

    data={key: line_tokens(frag) for key,frag in all_frag.items()}
    holds=sum(1 for toks in data.values() for tk in toks
              if tk['t']=='syl' for u in tk['units'] if u.get('hold'))

    joins={}
    for a,b in adjacency([f'deity:{k}' for k in DEITIES],
                         [f'karma:{k}' for k in KARMAS]):
        e = join_entry(all_frag[a], all_frag[b])
        if e is not None:
            joins[f'{a}|{b}'] = e

    lines=[
      "// AUTO-GENERATED by tools/chant/emit.py — do not edit by hand.",
      "// Śikṣā marks (holdings + anusvāra + visarga; NO svara) for the saṅkalpa",
      "// fixed clauses + option vocabularies, in the same token shape a chant",
      "// JSON carries (shared/src/chant.ts). Each fragment is marked as a PIECE",
      "// OF A LINE; SANKALPA_JOINS below carries the boundary tokens that change",
      "// when two of them are recited together (`pūjāṃ` + `kariṣye` →",
      "// `pūjāṅ kariṣye`, box on the `k`). See docs/AUTHORING-SANKALPA.md §2.",
      "import type { ChantToken } from './chant.js';",
      "",
      "export const SANKALPA_MARKS: Record<string, ChantToken[]> = {",
    ]
    for key in data:
        lines.append(f"  {json.dumps(key, ensure_ascii=False)}: {compact(data[key])},")
    lines += ["};", ""]
    lines += [
      "/** Boundary tokens for a `left|right` fragment join: `l` replaces the last",
      " *  syllable of the left fragment, `r` the first syllable of the right. */",
      "export interface SankalpaJoin { l?: ChantToken; r?: ChantToken }",
      "",
      "export const SANKALPA_JOINS: Record<string, SankalpaJoin> = {",
    ]
    for key in joins:
        lines.append(f"  {json.dumps(key, ensure_ascii=False)}: {compact(joins[key])},")
    lines += ["};", ""]
    open(OUT_TS,'w',encoding='utf-8').write("\n".join(lines))
    print(f"wrote {OUT_TS}")
    print(f"  {len(data)} fragment token-arrays | {holds} holdings | {len(joins)} joins")

if __name__=='__main__':
    validate(os.path.join(CHANTS,'durga-suktam.json'),'durga')
    validate(os.path.join(CHANTS,'purusha-suktam.json'),'purusha')
    emit()
