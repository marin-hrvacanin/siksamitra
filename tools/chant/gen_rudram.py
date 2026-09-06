# -*- coding: utf-8 -*-
"""`rudram v1.6 - IAST.pdf` -> `client/public/chants/sri-rudram.json` (chant v3).

The Śrī Rudram was on the site as a PDF only. This turns the owner's own v1.6
export into the interactive document: 40 pages, ~40 sections across six parts,
the eleven anuvākas of the Namakam and the eleven of the Camakam, with the
recitation marks carried as DATA (holdings, svara, anusvāra/gum, visarga,
svarabhakti, pauses) rather than redrawn.

Nothing here derives a mark. The PDF is a HAND-MARKED SOURCE — path A in
MARKING-RULES, "The Vedic anusvāra (the gum) — and when it applies" — so the
owner's marking is the authority and this script only transcribes it. The one
exception is the holding NARROWING, which is not a re-derivation but the
application of a rule the source itself follows everywhere else; see
`pdf_marks._narrow_boxes`.

    PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
    "$PY" gen_rudram.py --pdf "C:/Users/marin/Downloads/rudram v1.6 - IAST.pdf"
    "$PY" pack_chants.py            # minify, like every other chant

Output is byte-deterministic: run it twice and `cmp` the two files.

What the source carries that this does NOT store
------------------------------------------------
* **The footnote asterisk** on `jambhayant*` — the note it points at is kept, as
  a `note` instruction on that verse, so nothing is lost but the marker.
* **The bare `svarabhakti` / `(svarabhakti)` annotations**, 10 of them. They
  point AT the svarabhakti dot, and the dot itself is in the data (`sbhakti`) and
  drawn by the reader. Any other annotation is kept.

The virāma tick is KEPT
----------------------
`ˎ` (U+02CE), 47 of them — the clipped final stop at the end of a pāda
(`caturbhujamˎ।`). MARKING-RULES §6 is explicit that it "is part of the text",
and the owner's ruling is to keep it, so it is stored as a **unit of the
syllable it closes** (a coda, like the anusvāra and the visarga): the IAST
renders `caturbhujamˎ` exactly as the source sets it. It is stripped before
transliteration only — Devanāgarī already writes that final consonant with its
own halanta (`चतुर्भुजम्`), so there is nothing for the tick to add there and no
codepoint that would carry it. The other eight shipped chants drop it
(`parse_chant.DROP_CHARS`); they are the ones that are wrong.

One correction to the source
----------------------------
The eleventh anuvāka of the Namakam prints `॥ 11.11॥` TWICE. Its mantras run
11.1 … 11.9 and then two more, so the first of the pair is the tenth. Fixed
here, and asserted: if the source is ever corrected this raises rather than
quietly renumbering something else.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys
import unicodedata
from typing import Dict, List, Optional

from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_marks import extract, plain, anns  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', '..', 'client', 'public', 'chants', 'sri-rudram.json')

#: Page 0 is the cover, page 1 the table of contents. The document starts at 2.
FIRST_PAGE = 2

# ── Marks ────────────────────────────────────────────────────────────────────
SVARA_NAME = {'̱': 'anudatta', '̍': 'svarita', '̎': 'dirgha-svarita'}
#: `U+0305` (the blue overline) always immediately precedes the `U+030D` it
#: belongs with: together they are the dīrgha-svarita on a SHORT vowel, where a
#: long vowel would have taken `U+030E`. Ten of them, all in the Ṛgvedic Samāna
#: Sūktam — which is exactly where the Ṛgveda svarita rules apply.
DIRGHA_OVERLINE = '̅'

# ── Letters ──────────────────────────────────────────────────────────────────
DIGRAPHS = ('kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh',
            'ai', 'au')
VOWELS = set('aāiīuūṛṝḷḹeoēōḻ') | {'ai', 'au'}
#: The virāma tick: part of the TEXT (MARKING-RULES §6), stored as a unit, and
#: removed only for the script derivation.
VIRAMA = 'ˎ'
#: Characters that close a syllable rather than opening the next one.
CODA = set('ṁṃḥ-ḫḥ̱') | {':', VIRAMA}
#: Removed outright: the footnote marker, whose note is kept as an instruction.
DROP = {'*'}
#: Kept in the text, but never handed to `indic_transliteration`.
TRANSLIT_STRIP = DROP | {VIRAMA, ':'}

DEVA_OM, TEL_OM, TAM_OM = 'ॐ', 'ఓం', 'ௐ'


def norm_translit(iast: str) -> str:
    """Strip what `indic_transliteration` must not see: the accents (svara is a
    data field, never a character), the jihvāmūlīya colon, the footnote marker,
    and the capital of a proper name. Fold the dot-above anusvāra to dot-below,
    which is the form `sanscript` knows."""
    s = ''.join(c for c in iast
                if not unicodedata.combining(c) and c not in TRANSLIT_STRIP)
    s = s.replace('ṁ', 'ṃ')
    # `ḻ` (l with line below) is the Ṛgvedic retroflex ḷ of `iḻas`; sanscript
    # has no mapping for it, and `ḷ` is the sound.
    s = s.replace('ḻ', 'ḷ')
    return s.lower()


_SCRIPTS = {'deva': sanscript.DEVANAGARI, 'tel': sanscript.TELUGU,
            'tam': sanscript.TAMIL}


def derive_scripts(iast: str):
    if iast in ('oṁ', 'oṃ'):
        return DEVA_OM, TEL_OM, TAM_OM
    if iast == "'":
        return 'ऽ', 'ఽ', 'ऽ'
    b = norm_translit(iast)
    if not b:
        return '', '', ''
    return (transliterate(b, sanscript.IAST, _SCRIPTS['deva']),
            transliterate(b, sanscript.IAST, _SCRIPTS['tel']),
            transliterate(b, sanscript.IAST, _SCRIPTS['tam']))


def tokenize(text: str):
    out = []
    i, n = 0, len(text)
    while i < n:
        two = text[i:i + 2]
        if two in DIGRAPHS:
            out.append(('letter', two)); i += 2; continue
        c = text[i]
        if c in DROP:
            i += 1; continue
        if c == ' ':
            out.append(('space',)); i += 1; continue
        if c in ('।', '॥'):
            out.append(('danda', c)); i += 1; continue
        if c.isdigit():
            out.append(('digit', c)); i += 1; continue
        if c == '.':
            out.append(('dot',)); i += 1; continue
        if c == '·':
            out.append(('sbhakti',)); i += 1; continue
        if c in ('(', ')'):
            out.append(('paren', c)); i += 1; continue
        if c in ('’', '‘'):
            out.append(('letter', "'")); i += 1; continue
        out.append(('letter', c)); i += 1
    return out


def is_vowel(c: str) -> bool:
    return c in VOWELS


def syllabify(units: List[Dict]) -> List[List[Dict]]:
    """Split a run of letters into akṣaras: each vowel takes everything up to
    the next vowel's onset, with codas (anusvāra, visarga, hyphen) staying on
    the syllable they close."""
    if not units:
        return []
    vpos = [k for k, u in enumerate(units) if is_vowel(u['c'])]
    if not vpos:
        return [units]
    syls, start = [], 0
    for idx, vp in enumerate(vpos):
        last = idx == len(vpos) - 1
        j = vp + 1
        while j < len(units) and (units[j]['c'] in CODA or units[j].get('candra')):
            j += 1
        end = len(units) if last else j
        syls.append(units[start:end])
        start = end
    if start < len(units):
        syls[-1] = syls[-1] + units[start:]
    return syls


def make_syl(units: List[Dict]) -> Dict:
    iast = ''.join(u['c'] for u in units)
    deva, tel, tam = derive_scripts(iast)
    out = []
    for u in units:
        d = {'c': u['c']}
        if u.get('hold'):
            d['hold'] = u['hold']
            d['hg'] = u['hg']
        if u.get('change'):
            d['change'] = True
        if u.get('svara'):
            d['svara'] = u['svara']
        if u.get('sup'):
            d['sup'] = u['sup']
        if u.get('candra'):
            d['candra'] = True
        if u.get('sbhakti'):
            d['sbhakti'] = True
        out.append(d)
    return {'t': 'syl', 'units': out, 'iast': iast,
            'deva': deva, 'tel': tel, 'tam': tam}


# ── Reading aids (MARKING-RULES §7 step 2) ───────────────────────────────────
#: The `g` inside `jñ` and the `u` inside `vy`. This file is a TRANSCRIPTION of
#: a hand-marked source, so it normally adds nothing the owner did not draw —
#: but he ruled (2026-08) that the `jñ` aid "should always be", and his v1.6
#: PDF leaves all eighteen of its `jñ` bare while his Puruṣa Sūktam marks all
#: fourteen of its own. This pass closes that gap and is the SAME rule
#: `gen_marks.apply_reading_aids` derives, so the two files agree.
#:
#: `sv` is NOT here. The owner: "only sv is sometimes and sometimes not,
#: depending on the preference … that's a matter of preference and is only
#: sometimes applied." His source marks two of its thirty and those two are
#: kept — the pass only ever FILLS AN EMPTY `sup`, never overwrites one.
READING_AIDS = {('j', 'ñ'): 'g', ('v', 'y'): 'u'}


def apply_reading_aids(tokens: List[Dict]) -> int:
    """Set `sup` on the first letter of a `jñ` / `vy` pair inside one word.

    Walks the verse's units as one stream so a pair that straddles a syllable
    boundary is still seen (`ja | jñā | nam`), but stops at anything that ends
    a word — a space, a pause, a daṇḍa, a line break.
    """
    n = 0
    run: List[Dict] = []                 # the current word's units, in order

    def flush() -> int:
        m = 0
        for i, u in enumerate(run[:-1]):
            aid = READING_AIDS.get((u['c'], run[i + 1]['c']))
            if aid and not u.get('sup'):
                u['sup'] = aid
                m += 1
        return m

    for tk in tokens:
        if tk.get('t') == 'syl':
            run.extend(tk['units'])
            continue
        n += flush()
        run = []
    n += flush()
    return n


# ── One source row -> tokens ─────────────────────────────────────────────────
def row_tokens(events: List[Dict], hg: List[int]) -> List[Dict]:
    """`hg` is a one-element list used as a per-verse counter, so a holding
    group id is unique within the verse (what the reader groups on)."""
    items: List[Dict] = []          # {'kind': ..., ...}
    pending_sbhakti = False
    box_to_hg: Dict[object, int] = {}

    def last_letter():
        for it in reversed(items):
            if it['kind'] == 'letter':
                return it
        return None

    for ev in events:
        k = ev['kind']
        if k == 'ann':
            continue
        if k == 'pause':
            items.append({'kind': 'pause', 'len': ev['len']})
            continue
        if k == 'svara':
            it = last_letter()
            if it is None:
                continue
            m = ev['mark']
            if m == DIRGHA_OVERLINE:
                it['u']['svara'] = 'dirgha-svarita'
                it['u']['_overline'] = True
            elif it['u'].get('_overline') and m == '̍':
                pass            # already promoted by the overline
            else:
                it['u']['svara'] = SVARA_NAME[m]
            continue
        if k == 'sup':
            it = last_letter()
            if it is None:
                continue
            it['u']['sup'] = (it['u'].get('sup') or '') + ev['text']
            continue
        if k == 'candra':
            items.append({'kind': 'letter', 'u': {
                'c': 'm', 'change': True, 'candra': True,
                'sbhakti': pending_sbhakti}})
            pending_sbhakti = False
            continue
        # text
        for tok in tokenize(ev['text']):
            t = tok[0]
            if t == 'letter':
                u = {'c': tok[1], 'change': ev['change'],
                     'sbhakti': pending_sbhakti}
                pending_sbhakti = False
                if ev['hold']:
                    box = ev['box']
                    if box not in box_to_hg:
                        hg[0] += 1
                        box_to_hg[box] = hg[0]
                    u['hold'] = ev['hold']
                    u['hg'] = box_to_hg[box]
                items.append({'kind': 'letter', 'u': u})
            elif t == 'space':
                items.append({'kind': 'space'})
            elif t == 'danda':
                items.append({'kind': 'danda', 's': tok[1]})
            elif t == 'digit':
                items.append({'kind': 'digit', 'c': tok[1]})
            elif t == 'dot':
                items.append({'kind': 'dot'})
            elif t == 'sbhakti':
                pending_sbhakti = True
            elif t == 'paren':
                items.append({'kind': 'paren', 'c': tok[1]})

    return items_to_tokens(items)


def items_to_tokens(items: List[Dict]) -> List[Dict]:
    tokens: List[Dict] = []
    run: List[Dict] = []

    def flush():
        for syl in syllabify(run):
            for u in syl:
                u.pop('_overline', None)
            tokens.append(make_syl(syl))
        run.clear()

    i = 0
    while i < len(items):
        it = items[i]
        k = it['kind']
        if k == 'letter':
            run.append(it['u'])
            i += 1
            continue
        flush()
        if k == 'space':
            tokens.append({'t': 'sp'})
        elif k == 'pause':
            tokens.append({'t': 'pause', 'len': it['len']})
        elif k == 'paren':
            tokens.append({'t': 'text', 's': it['c']})
        elif k == 'danda':
            # `॥ 1.1॥` -> danda · num · danda
            if it['s'] == '॥':
                j, num, = i + 1, ''
                while j < len(items):
                    kj = items[j]['kind']
                    if kj == 'space' and not num:
                        j += 1; continue
                    if kj == 'digit':
                        num += items[j]['c']; j += 1; continue
                    if kj == 'dot' and num:
                        num += '.'; j += 1; continue
                    break
                if num and j < len(items) and items[j]['kind'] == 'danda' \
                        and items[j]['s'] == '॥':
                    tokens.append({'t': 'danda', 's': '॥'})
                    tokens.append({'t': 'num', 's': num})
                    tokens.append({'t': 'danda', 's': '॥'})
                    i = j + 1
                    continue
            tokens.append({'t': 'danda', 's': it['s']})
        elif k in ('digit', 'dot'):
            pass                # a stray digit that is not a verse number
        i += 1
    flush()
    return tokens


def verse_number(tokens: List[Dict]) -> Optional[str]:
    for t in tokens:
        if t['t'] == 'num':
            return t['s']
    return None


# ── The prose registers ──────────────────────────────────────────────────────
#: A citation names a locus. Closed set — `check_prose()` asserts the count, so
#: a changed source PDF fails loudly instead of silently reclassifying.
CITATION_RE = re.compile(
    r'^(?:\(optional verse\)\s*)?'
    r'(?:ṚV|TS|TA|TB|ṛgvedasaṁhitā|taittirīyopaniṣad)\b')
N_CITATIONS = 8

#: A metre / register note: a parenthesis naming the chandas or calling the
#: passage a yajus. `(sāyī: nominative of…)`, `(now follows) 1 (and) 90…` and
#: `(also) those in the trees…` are prose ABOUT the verse and stay translations.
def is_metre_note(t: str) -> bool:
    return t.startswith('(') and ('chanda' in t or 'yajus' in t)


#: The only prose in the document that is a DIRECTION rather than a description.
PROSE_DO = {
    'Place mṛgi mudrā assembled with both hands, with 3+3 fingers touching the '
    'top of the head,',
    'while the joined index fingers and joined little fingers are erect in the '
    'air.',
}

#: A prose paragraph that does not end in sentence punctuation is CONTINUED by
#: the next one — the owner's translations wrap mid-sentence across lines, and
#: joining them first is what makes a per-mantra 1:1 assignment countable.
SENTENCE_END = tuple('.,;:!?]»')


def join_prose(block: List[str]) -> List[str]:
    out: List[str] = []
    for t in block:
        if out and not out[-1].endswith(SENTENCE_END):
            out[-1] = out[-1] + ' ' + t
        else:
            out.append(t)
    return out


# ── The in-row annotations ───────────────────────────────────────────────────
#: Every distinct annotation the source carries inside a chant row, and what it
#: is. `do` is a direction for the body; `note` is a remark about the text;
#: `cite` names a locus; `drop` points at a mark the reader already draws.
#: Hand-built, because what an annotation MEANS is not derivable from its
#: typography — and closed, because `check_anns()` fails on anything unlisted.
ANN: Dict[str, tuple] = {
    # ── directions (nyāsa, mudrās, pañcopacāra) ──
    'añjali mudrā': ('do', 'in añjali mudrā'),
    'añjali': ('do', 'in añjali'),
    'right palm touching the top of the head': ('do', 'right palm touching the top of the head'),
    'right palm in front of the mouth': ('do', 'right palm in front of the mouth'),
    'right palm touching the heart': ('do', 'right palm touching the heart'),
    'touch right side lowermost rib': ('do', 'touch the lowermost rib on the right side'),
    'touch left side lowermost rib': ('do', 'touch the lowermost rib on the left side'),
    'touch middle above navel (underneath sternum)': ('do', 'touch the middle above the navel, underneath the sternum'),
    'thumbs': ('do', 'with both thumbs'),
    '(svarabhakti) index': ('do', 'with both index fingers'),
    'middle': ('do', 'with both middle fingers'),
    'ring': ('do', 'with both ring fingers'),
    'little': ('do', 'with both little fingers'),
    'palms': ('do', 'with both palms and the backs of the hands'),
    'heart': ('do', 'to the heart'),
    '(svarabhakti) head top, vertex': ('do', 'to the top of the head, the vertex'),
    'head back, nape': ('do', 'to the back of the head, the nape'),
    'shield': ('do', 'to the shield'),
    'third eye': ('do', 'to the third eye'),
    'slap!': ('do', 'and slap'),
    'snap clockwise': ('do', 'snap the fingers clockwise'),
    'roll thumbs over little fingers': ('do', 'roll the thumbs over the little fingers'),
    'roll index fingers over thumbs': ('do', 'roll the index fingers over the thumbs'),
    'roll thumbs over index fingers': ('do', 'roll the thumbs over the index fingers'),
    # ── notes about the text ──
    'systematic indices': ('note', 'Anukramaṇi — the systematic indices.'),
    'bramha': ('note', 'Also written and heard as “bramha”.'),
    'saha is with anudātta!': ('note', '“saha” takes the anudātta.'),
    'śuddhānusvāra': ('note', 'Śuddhānusvāra — the pure anusvāra.'),
    'iḻas - retroflex': ('note', '“iḻas” — the retroflex ḷ of the Ṛgvedic recitation.'),
    'abhinidhāna': ('note', 'Abhinidhāna — the inserted (āgama) letter.'),
    'kkh is geminated kh': ('note', '“kkh” is a geminated kh.'),
    '(svarabhakti) p. b. yaṁ': ('note', 'Pada-pāṭha reading: yaṁ.'),
    'yatidoṣa*': ('note', 'Yatidoṣa — see the note below.'),
    '☑ k-l-ptañ ☒ k-lr-ptañ': ('note', 'Read k-ḷ-ptañ, not k-lr-ptañ.'),
    '(anuṣṭup chandaḥ, 8 syllables per pāda, no yatis/pauses, 5th usually laghu, '
    '6th usually guru)': ('note', 'Anuṣṭup chandaḥ — 8 syllables per pāda, no yati, the 5th usually laghu and the 6th usually guru.'),
    # ── loci ──
    'required as per taittirīya āraṇyaka 2.11.': ('cite', 'required as per Taittirīya Āraṇyaka 2.11'),
    'ṚV 1.114.1': ('cite', 'Ṛgveda 1.114.1'),
    'ṚV 1.114.2': ('cite', 'Ṛgveda 1.114.2'),
    'ṚV 1.114.7': ('cite', 'Ṛgveda 1.114.7'),
    'ṚV 1.114.8': ('cite', 'Ṛgveda 1.114.8'),
    'svarabhakti, ṚV 1.114.10': ('cite', 'Ṛgveda 1.114.10'),
    'ṚV 2.33.11': ('cite', 'Ṛgveda 2.33.11'),
    'ṚV 2.33.14': ('cite', 'Ṛgveda 2.33.14'),
    'Namakam 10.3, ṚV 1.114.1': ('cite', 'Namakam 10.3 · Ṛgveda 1.114.1'),
    # ── points at a mark that is already in the data ──
    'svarabhakti': ('drop', None),
    '(svarabhakti)': ('drop', None),
}


# ── Structure ────────────────────────────────────────────────────────────────
#: The document begins at the Rudram itself. The owner's export opens with the
#: Prastāvanā — gaṇapati dhyānam, guru vandanam, the three gāyatrīs, saha
#: nāvavatu, the gaṇapati/sarasvatī prārthanā and the samāna sūktam — which are
#: the general opening prayers of any recitation, not part of the Rudram. They
#: are left out; the Rudram's OWN nyāsa at both ends is in, as is the closing
#: kṣamā prārthanā.
SKIP_PARTS = {'prastāvanā'}

PARTS = {
    'prastāvanā': 'Prastāvanā — the opening prayers',
    'śrī rudranyāsaḥ': 'Śrī Rudranyāsaḥ — the preparation',
    'śrīrudrapraśnaḥ': 'Śrīrudrapraśnaḥ — the Namakam',
    'camakapraśnaḥ': 'Camakapraśnaḥ — the Camakam',
    'samāpta śrī rudranyāsaḥ': 'Samāpta Śrī Rudranyāsaḥ — the closing nyāsa',
    'parameśvara kṣamā prārthana': 'Parameśvara Kṣamā Prārthanā — asking pardon',
}
DOC_TITLE_ROW = '॥ śrī rudram ॥'

ORDINALS = {'prathamo': '1', 'dvitīyo': '2', 'tṛtīyo': '3', 'caturtho': '4',
            'pañcamo': '5', 'ṣaṣṭo': '6', 'saptamo': '7', 'aṣṭamo': '8',
            'navamo': '9', 'daśamo': '10', 'ekādaśo': '11'}

#: Where each part's own text comes from. A section inherits it unless the
#: source prints a locus of its own.
PART_SOURCE = {
    'Śrīrudrapraśnaḥ — the Namakam':
        'kṛṣṇayajurveda · Taittirīya Saṁhitā 4.5 — the fifth prapāṭhaka of the '
        'fourth (Vaiśvadeva) kāṇḍa',
    'Camakapraśnaḥ — the Camakam':
        'kṛṣṇayajurveda · Taittirīya Saṁhitā 4.7 — the seventh prapāṭhaka of '
        'the fourth (Vaiśvadeva) kāṇḍa',
}

#: The anukramaṇi rows that stand between a part heading and its first anuvāka.
IMPLICIT_SECTION = 'Anukramaṇi'

UPPER = str.maketrans({'ś': 'Ś', 'ṣ': 'Ṣ', 'ṛ': 'Ṛ', 'ṝ': 'Ṝ', 'ā': 'Ā',
                       'ī': 'Ī', 'ū': 'Ū', 'ṇ': 'Ṇ', 'ṭ': 'Ṭ', 'ḍ': 'Ḍ',
                       'ñ': 'Ñ', 'ṅ': 'Ṅ', 'ḥ': 'Ḥ', 'ṁ': 'Ṁ', 'ḷ': 'Ḷ'})


#: Particles that stay lowercase inside a name ("Gaṇapati ca Sarasvatī …").
TITLE_LOWER = {'ca', 'iti', 'va'}

#: Where the source's subtitle is a GLOSS rather than the section's name.
SECTION_TITLE = {'Forgiveness request': 'Kṣamā Prārthanā'}


def titlecase(s: str) -> str:
    if s in SECTION_TITLE:
        return SECTION_TITLE[s]
    out = []
    for i, w in enumerate(s.split(' ')):
        if not w:
            continue
        if i and w in TITLE_LOWER:
            out.append(w)
        else:
            out.append(w[0].translate(UPPER).upper() + w[1:])
    return ' '.join(out)


def sentence(t: str) -> str:
    """The source sets its section descriptors as lowercase fragments
    ("dedication, artificial svaras"). Render them as sentences."""
    t = t.strip()
    if not t:
        return t
    t = t[0].translate(UPPER).upper() + t[1:]
    return t if t[-1] in '.!?)]' else t + '.'


#: The loci the source abbreviates. Expanded so a reader who does not know the
#: shorthand can still find the passage; the rest of the owner's wording stands.
CITE_EXPAND = (
    ('ṚV', 'Ṛgveda'),
    ('TS', 'Taittirīya Saṁhitā'),
    ('TB', 'Taittirīya Brāhmaṇa'),
    ('TA', 'Taittirīya Āraṇyaka'),
    ('ṛgvedasaṁhitā', 'Ṛgveda-saṁhitā'),
    ('taittirīyopaniṣad', 'Taittirīya Upaniṣad'),
)


def tidy_cite(t: str) -> str:
    for short, long in CITE_EXPAND:
        t = re.sub(r'(?<![^\s(])' + re.escape(short) + r'(?=[\s.]|$)', long, t)
    return re.sub(r'\s+-\s+', ' · ', t).replace('..', '.').strip()


def slug(s: str) -> str:
    s = norm_translit(s)
    s = (s.replace('ṃ', 'm').replace('ḥ', 'h').replace('ṛ', 'r')
          .replace('ś', 's').replace('ṣ', 's').replace('ṇ', 'n')
          .replace('ṭ', 't').replace('ḍ', 'd').replace('ñ', 'n')
          .replace('ṅ', 'n').replace('ḷ', 'l')
          .replace('ā', 'a').replace('ī', 'i').replace('ū', 'u'))
    s = re.sub(r"[^a-z0-9]+", '-', s).strip('-')
    return s


class Verse:
    def __init__(self, vid: str):
        self.id = vid
        self.tokens: List[Dict] = []
        self.n: Optional[str] = None
        self.translation: List[str] = []
        self.source: Optional[str] = None
        self.instructions: List[Dict] = []
        self.has_do = False

    def out(self) -> Dict:
        d: Dict = {'id': self.id, 'n': self.n, 'tokens': self.tokens}
        if self.translation:
            d['translation'] = {'en': ' '.join(self.translation)}
        if self.source:
            d['source'] = self.source
        if self.instructions:
            d['instructions'] = self.instructions
        return d


class Section:
    def __init__(self, sid: str, title: str, part: Optional[str],
                 n: Optional[str] = None):
        self.id = sid
        self.title = title
        self.part = part
        self.n = n
        self.source: Optional[str] = None
        self.notes: List[Dict] = []      # section-level instructions
        self.verses: List[Verse] = []

    def out(self) -> Dict:
        items: List[Dict] = [{'t': 'instruction', 'instruction': i}
                             for i in self.notes]
        verses = [v.out() for v in self.verses]
        items += [dict(t='verse', **v) for v in verses]
        d: Dict = {'id': self.id, 'title': self.title}
        if self.n:
            d['n'] = self.n
        if self.part:
            d['part'] = self.part
        if self.source:
            d['source'] = self.source
        d['items'] = items
        d['verses'] = verses
        return d


def instruction(kind: str, text: str) -> Dict:
    return {'kind': kind, 'text': {'en': text}}


BIG_GAP = 35.0      # pt — the one blank line between two chant rows (measured 45.6)


def build(pdf: str, verbose: bool = False):
    paras, narrowed = extract(pdf)
    paras = [p for p in paras if p['page'] >= FIRST_PAGE]

    report = {'narrowed': collections.Counter(narrowed), 'ann': collections.Counter(),
              'dropped_ann': 0, 'citations': 0, 'unknown_ann': []}

    sections: List[Section] = []
    skipping = False
    part: Optional[str] = None
    seen_doc_title = False
    cur: Optional[Section] = None
    # the run of verses since the last prose block, and the prose block itself
    run: List[Verse] = []
    prose: List[str] = []
    pending_note: List[Dict] = []      # a note/cite waiting for the NEXT verse
    pending_source: Optional[str] = None
    open_verse: Optional[Verse] = None
    prev_row = None                    # (page, baseline) of the last chant row

    def new_section(title: str, n: Optional[str] = None,
                    sid: Optional[str] = None) -> Section:
        nonlocal cur, open_verse, run, prose, prev_row
        flush_prose()
        s = Section(sid or slug(title), title, part, n)
        if part in PART_SOURCE:
            s.source = PART_SOURCE[part]
        sections.append(s)
        cur, open_verse, run, prose, prev_row = s, None, [], [], None
        return s

    def close_verse():
        nonlocal open_verse
        if open_verse is not None:
            open_verse.n = verse_number(open_verse.tokens)
            open_verse = None

    def flush_prose():
        """Assign the prose block that has just ended to the verses it belongs
        to, then clear the run."""
        nonlocal run, prose
        block = join_prose(prose)
        prose = []
        if not block:
            run = []
            return
        if len(run) > 1 and all(v.has_do for v in run) and len(block) == len(run):
            for v, t in zip(run, block):
                v.translation.append(t)
        elif run:
            run[-1].translation.extend(block)
        else:
            # prose with no verse before it in this section: a descriptor
            for t in block:
                target = cur.notes if cur is not None else None
                if target is None:
                    continue
                target.append(instruction(
                    'do' if t in PROSE_DO else 'note', sentence(t)))
        run = []

    def add_verse() -> Verse:
        nonlocal open_verse, pending_source, pending_note
        close_verse()
        v = Verse('%s-v%d' % (cur.id, len(cur.verses) + 1))
        cur.verses.append(v)
        run.append(v)
        if pending_source:
            v.source = pending_source
            pending_source = None
        if pending_note:
            v.instructions.extend(pending_note)
            pending_note = []
        open_verse = v
        return v

    hg = [0]
    for p in paras:
        cls, ev = p['cls'], p['events']
        text = plain(ev).strip()

        if cls == 'title':
            if text == DOC_TITLE_ROW and not seen_doc_title:
                seen_doc_title = True
                continue
            flush_prose()
            close_verse()
            part = PARTS[text]
            skipping = text in SKIP_PARTS
            cur = None
            continue

        if skipping:
            continue

        if cls == 'subtitle':
            close_verse()
            base = text.strip()
            n = None
            # `prathamaḥ + anuvākaḥ` elides to `prathamo'nuvākaḥ` — the `a`
            # is GONE, replaced by the avagraha. Matching `'anuvākaḥ` matches
            # nothing and silently leaves every anuvāka unnumbered.
            for k, num in ORDINALS.items():
                if base.startswith(k + "'nuvākaḥ"):
                    n = num
                    break
            pfx = slug(part.split('—')[0]) if part else 'sec'
            sid = '%s-%s' % (pfx, ('%02d' % int(n)) if n else slug(base))
            new_section(titlecase(base), n, sid)
            continue

        if cls == 'body':
            raise ValueError('unexpected body row past the contents: %r' % text)

        if cls == 'shloka':
            if cur is None:
                new_section(IMPLICIT_SECTION,
                            sid='%s-anukramani' % slug(part.split('—')[0]))
            row_anns = anns(ev)
            kinds = []
            for a in row_anns:
                if a not in ANN:
                    report['unknown_ann'].append(a)
                    continue
                report['ann'][a] += 1
                kinds.append(ANN[a])

            if not text:
                # a row that is nothing but an annotation (a metre note)
                for kind, msg in kinds:
                    if kind == 'drop':
                        report['dropped_ann'] += 1
                    elif kind == 'cite':
                        pending_source = msg
                    else:
                        pending_note.append(instruction(kind, msg))
                continue

            flush_prose_needed = bool(prose)
            if flush_prose_needed:
                flush_prose()

            gap = None
            if prev_row is not None and prev_row[0] == p['page']:
                gap = p['baseline'] - prev_row[1]
            if open_verse is None or (gap is not None and gap > BIG_GAP):
                hg[0] = 0
                add_verse()
            else:
                open_verse.tokens.append({'t': 'br'})
            prev_row = (p['page'], p['baseline'])

            open_verse.tokens.extend(row_tokens(ev, hg))

            for kind, msg in kinds:
                if kind == 'drop':
                    report['dropped_ann'] += 1
                elif kind == 'cite':
                    open_verse.source = msg
                    report['citations'] += 1
                elif kind == 'do':
                    open_verse.instructions.append(instruction('do', msg))
                    open_verse.has_do = True
                else:
                    open_verse.instructions.append(instruction(kind, msg))
            if open_verse.has_do:
                close_verse()
            continue

        # cls == 'small' — prose
        if cur is None:
            new_section(IMPLICIT_SECTION,
                        sid='%s-anukramani' % slug(part.split('—')[0]))
        if CITATION_RE.match(text):
            flush_prose()
            close_verse()
            cite = tidy_cite(re.sub(r'^\(optional verse\)\s*', '', text)
                             .rstrip('.'))
            if not cur.verses:
                cur.source = cite
            else:
                pending_source = cite
            if text.startswith('(optional verse)'):
                pending_note.append(instruction('option', 'An optional verse.'))
            report['citations'] += 1
            continue
        if is_metre_note(text):
            flush_prose()
            close_verse()
            note = instruction('note', text.strip('()').strip()
                               .capitalize().rstrip('.') + '.')
            if not cur.verses:
                cur.notes.append(note)
            else:
                pending_note.append(note)
            continue
        if text.startswith('*'):
            flush_prose()
            if cur.verses:
                cur.verses[-1].instructions.append(
                    instruction('note', text.lstrip('* ').strip()))
            continue
        prose.append(text)
        close_verse()

    flush_prose()
    close_verse()

    fix_duplicate_numbers(sections)
    return sections, report


def fix_duplicate_numbers(sections: List[Section]) -> None:
    """See the module docstring: `॥ 11.11॥` is printed twice in the eleventh
    anuvāka of the Namakam and the first of the pair is the tenth mantra."""
    dupes = [v for s in sections for v in s.verses if v.n == '11.11']
    if len(dupes) != 2:
        raise AssertionError(
            'expected the two `11.11` verses of the source; found %d — the PDF '
            'has changed, re-check the numbering by hand' % len(dupes))
    dupes[0].n = '11.10'
    for t in dupes[0].tokens:
        if t['t'] == 'num' and t['s'] == '11.11':
            t['s'] = '11.10'
            break


def check(sections: List[Section], report: Dict) -> None:
    if report['unknown_ann']:
        raise AssertionError('un-classified annotations: %r'
                             % sorted(set(report['unknown_ann'])))
    if report['citations'] < N_CITATIONS:
        raise AssertionError('expected at least %d loci, found %d'
                             % (N_CITATIONS, report['citations']))
    # every box covers exactly ONE letter
    for s in sections:
        for v in s.verses:
            flat = []
            for t in v.tokens:
                flat.extend(t['units'] if t['t'] == 'syl' else [None])
            i = 0
            while i < len(flat):
                u = flat[i]
                if u and u.get('hold'):
                    j = i + 1
                    while (j < len(flat) and flat[j]
                           and flat[j].get('hg') == u.get('hg')
                           and flat[j].get('hold') == u.get('hold')):
                        j += 1
                    if j - i > 1:
                        raise AssertionError(
                            'multi-letter holding survived in %s: %r'
                            % (v.id, ''.join(flat[k]['c'] for k in range(i, j))))
                    i = j
                else:
                    i += 1
    # numbering: no duplicate verse number inside a section
    for s in sections:
        ns = [v.n for v in s.verses if v.n]
        if len(ns) != len(set(ns)):
            raise AssertionError('duplicate verse number in %s: %r' % (s.id, ns))


TITLE_IAST = 'śrī rudram'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--report', action='store_true')
    a = ap.parse_args()

    sections, report = build(a.pdf)
    check(sections, report)

    deva, tel, tam = derive_scripts(TITLE_IAST)
    doc = {
        'format': 'vedaunion.chant',
        'version': 3,
        'id': 'sri-rudram',
        'title': TITLE_IAST,
        'subtitle': 'The Vedic litany to Rudra — the Namakam and the Camakam',
        'source': 'kṛṣṇayajurveda · Taittirīya Saṁhitā 4.5 (Namakam) & 4.7 '
                  '(Camakam)',
        'primaryScript': 'iast',
        'scripts': ['iast', 'devanagari', 'telugu', 'tamil'],
        'titleForms': {'iast': TITLE_IAST, 'devanagari': deva,
                       'telugu': tel, 'tamil': tam},
        'lineBreak': 'source',
        'features': {'audio': False, 'grammar': False},
        'instructions': [
            instruction('note',
                        'Transcribed from the Veda Union Śrī Rudram (IAST, '
                        'v1.6). The recitation marks are the owner\'s own: '
                        'holdings, svara, the Taittirīya gum, the visarga '
                        'forms, svarabhakti and the pauses are carried as data, '
                        'not redrawn.'),
            instruction('note',
                        'The nyāsa sections are marked with conventional '
                        '(“artificial”) svaras, as the source says — they are '
                        'not attested saṁhitā accents.'),
        ],
        'sections': [s.out() for s in sections],
        'recording': {'byVerse': {}},
    }

    aids = sum(apply_reading_aids(v['tokens'])

               for sec in doc['sections'] for v in sec['verses'])

    print(f'reading aids added (jñ -> g, vy -> u): {aids}')


    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')

    nver = sum(len(s.verses) for s in sections)
    nsyl = sum(1 for s in sections for v in s.verses for t in v.tokens
               if t['t'] == 'syl')
    nbox = sum(1 for s in sections for v in s.verses for t in v.tokens
               if t['t'] == 'syl' for u in t['units'] if u.get('hold'))
    print('WROTE', os.path.normpath(a.out))
    print('  sections %d · verses %d · syllables %d · holdings %d'
          % (len(sections), nver, nsyl, nbox))
    print('  holdings narrowed to one letter: %d %s'
          % (sum(report['narrowed'].values()),
             dict(report['narrowed'].most_common())))
    print('  annotations kept %d · dropped (svarabhakti markers) %d · loci %d'
          % (sum(report['ann'].values()) - report['dropped_ann'],
             report['dropped_ann'], report['citations']))
    if a.report:
        for s in sections:
            print('  [%s] %s%s — %d verse(s)'
                  % (s.part or '-', (s.n + ' · ') if s.n else '', s.title,
                     len(s.verses)))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
