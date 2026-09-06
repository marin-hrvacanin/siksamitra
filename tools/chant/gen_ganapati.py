# -*- coding: utf-8 -*-
"""`gaNapatyatharvashIrSham v3.3 - IAST.pdf` -> `client/public/chants/ganapati-atharvashirsham.json`.

The Gaṇapati Atharvaśīrṣa — the Atharvavedic upaniṣad of Gaṇeśa — from the
owner's own v3.3 export: the śānti pāṭha, the fourteen numbered mantras of the
upaniṣad, and the closing śānti pāṭha.

Nothing here derives a mark. The PDF is a HAND-MARKED SOURCE — path A in
MARKING-RULES — so the owner's marking is the authority and this script only
transcribes it. The translations are HIS, verbatim, per AUTHORING-CHANTS §0.1.

    PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
    "$PY" gen_ganapati.py --pdf "C:/Users/marin/Downloads/gaNapatyatharvashIrSham v3.3 - IAST.pdf"
    "$PY" pack_chants.py

Output is byte-deterministic: run it twice and `cmp` the two files.

Why this export needs `pdf_marks_gana` and not `pdf_marks`
----------------------------------------------------------
It is an Arial/URWPalladioITU export, not the CalibriLight family the Rudram
belongs to: the transformation colour is replaced by ITALIC, the candrabindu
has a different private code, headings are told from notes by SIZE, and — the
one that actually loses data — **93 letters are flattened to vector outlines**
and are missing from the text layer entirely. All four differences, and how the
93 were read back, are documented in `pdf_marks_gana`.

Sectioning
----------
The source marks its own divisions in two ways and this file uses both:

* two 16pt headings — `śānti pāṭha` and `śrīgaṇapatyatharvaśīrṣopaniṣat`;
* five 11pt italic labels standing alone above a mantra — `svarūpa tattva`,
  `nirguṇopāsanā - gaṇeśa vidyā mantra`, `saguṇopāsanā - gaṇeśa gāyatrī`,
  `gaṇeśa rūpa`, `aṣṭa nāma gaṇapati`. `LABELS` is closed: an unlisted one
  raises rather than being silently swallowed as a translation.

One division is EDITORIAL and is declared as such: mantras 11-14 are the
phalaśruti and the source gives them no label of their own, so `SPLIT_AFTER`
opens a section there under the conventional name. That is the only heading in
the file the owner did not write.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gen_rudram import (apply_reading_aids, derive_scripts,  # noqa: E402
                        row_tokens, slug)
from pdf_marks_gana import anns, extract, plain  # noqa: E402

try:
    from ganapati_words import WORDS, OVERRIDES
except ImportError:                                   # first run, before §5C
    WORDS, OVERRIDES = {}, {}

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'client', 'public', 'chants',
                   'ganapati-atharvashirsham.json')

TITLE_IAST = 'gaṇapatyatharvaśīrṣam'

#: The 11pt italic labels that stand alone above a mantra. Closed set.
LABELS = {
    'svarūpa tattva': 'svarūpa tattva',
    'nirguṇopāsanā - gaṇeśa vidyā mantra': 'nirguṇopāsanā · gaṇeśa vidyā mantra',
    'saguṇopāsanā - gaṇeśa gāyatrī': 'saguṇopāsanā · gaṇeśa gāyatrī',
    'gaṇeśa rūpa': 'gaṇeśa rūpa',
    'aṣṭa nāma gaṇapati': 'aṣṭa nāma gaṇapati',
}

#: The one 11pt italic row that is a SOURCE, not a label or a translation. It
#: stands above both śānti pāṭhas.
SOURCE_ROWS = {
    'ṚV 1.089, Atharvaprāyaścittāni 6.1, Taittirīya Āraṇyaka, Māṇḍūkya '
    'Upaniṣad etc.':
        'Ṛgveda 1.89 · Atharvaprāyaścittāni 6.1 · Taittirīya Āraṇyaka · '
        'Māṇḍūkya Upaniṣad',
}

#: The EDITORIAL division (see the module docstring): after this mantra a new
#: section opens under a name the source does not print.
SPLIT_AFTER = {'10': 'phalaśruti'}

#: Every annotation the source sets inside a chant row, and what it becomes.
#: `None` = dropped. Closed — an unlisted annotation raises.
ANN: Dict[str, Optional[tuple]] = {
    # per-verse loci
    'ṚV 1.089.08': ('source', 'Ṛgveda 1.89.8'),
    'ṚV 1.089.06': ('source', 'Ṛgveda 1.89.6'),
    # the svarabhakti markers point AT the dot, and the dot is in the data
    'svarabhakti': None,
    # marking remarks
    'śuddhānusvāra': (
        'note',
        'The anusvāra here is the śuddha (pure) anusvāra — it is not '
        'assimilated to the following consonant.'),
    # pāṭhabheda — variant readings the owner records without adopting
    'p.b. ādīṁstada': (
        'note', 'Variant reading: <em>ādīṁstada</em>.'),
    'p.b. gaṇeśa': (
        'note', 'Variant reading: <em>gaṇeśa</em>.'),
    'p.b. cchandaḥ, no gemination after dīrgham!': (
        'note',
        'Variant reading: <em>cchandaḥ</em>. Not adopted — a stop is not '
        'geminated after a long vowel.'),
    'p.b. dantiḥ; dantī is nominative (prathmā vibhakti) of dantin': (
        'note',
        'Variant reading: <em>dantiḥ</em>. Not adopted — <em>dantī</em> is the '
        'nominative singular of <em>dantin</em>.'),
    'p.b. sarvatas': (
        'note', 'Variant reading: <em>sarvatas</em>.'),
}

MAX_LINE = 62          # AUTHORING-CHANTS §7: no rendered line may wrap


# ── Model ────────────────────────────────────────────────────────────────────
class Verse:
    def __init__(self, vid: str):
        self.id = vid
        self.n: Optional[str] = None
        self.tokens: List[Dict] = []
        self.translation: Optional[str] = None
        self.source: Optional[str] = None
        self.notes: List[str] = []
        self.words: List[Dict] = []

    def out(self) -> Dict:
        d: Dict = {'id': self.id, 'n': self.n, 'tokens': self.tokens}
        if self.translation:
            d['translation'] = {'en': self.translation}
        if self.source:
            d['source'] = self.source
        if self.notes:
            d['instructions'] = [{'kind': 'note', 'text': {'en': t}}
                                 for t in self.notes]
        if self.words:
            d['words'] = self.words
        return d


class Section:
    def __init__(self, sid: str, title: str, source: Optional[str] = None):
        self.id = sid
        self.title = title
        self.source = source
        self.verses: List[Verse] = []

    def out(self) -> Dict:
        d: Dict = {'id': self.id, 'label': self.title,
                   'verses': [v.out() for v in self.verses]}
        if self.source:
            d['source'] = self.source
        return d


def instruction(kind: str, text: str) -> Dict:
    return {'kind': kind, 'text': {'en': text}}


def join_prose(lines: List[str]) -> str:
    s = ' '.join(x.strip() for x in lines if x.strip())
    return re.sub(r'\s+', ' ', s).strip()


# ── Build ────────────────────────────────────────────────────────────────────
def build(pdf: str):
    paras, narrowed = extract(pdf)
    report = {'narrowed': collections.Counter(narrowed),
              'ann': collections.Counter(), 'dropped_ann': 0}

    sections: List[Section] = []
    seen_ids: Dict[str, int] = {}

    def new_section(title: str, source: Optional[str] = None) -> Section:
        base = slug(title)
        seen_ids[base] = seen_ids.get(base, 0) + 1
        sid = base if seen_ids[base] == 1 else '%s-%d' % (base, seen_ids[base])
        s = Section(sid, title, source)
        sections.append(s)
        return s

    cur: Optional[Section] = None
    rows: List[Dict] = []            # the shloka paragraphs of the open verse
    prose: List[str] = []            # translation lines after it
    pending_split: Optional[str] = None

    def close_verse() -> None:
        nonlocal rows, prose, cur, pending_split
        if not rows:
            return
        assert cur is not None, 'a mantra before any heading'
        v = Verse('%s-v%d' % (cur.id, len(cur.verses) + 1))
        hg = [0]
        for i, p in enumerate(rows):
            if i:
                v.tokens.append({'t': 'br'})
            v.tokens.extend(row_tokens(p['events'], hg))
            for a in anns(p['events']):
                report['ann'][a] += 1
                if a not in ANN:
                    raise KeyError('unlisted annotation %r — decide what it is '
                                   'and add it to ANN' % a)
                spec = ANN[a]
                if spec is None:
                    report['dropped_ann'] += 1
                    continue
                kind, text = spec
                if kind == 'source':
                    v.source = text
                else:
                    v.notes.append(text)
        for t in v.tokens:
            if t.get('t') == 'num':
                v.n = t['s']
        cur.verses.append(v)
        rows = []
        if v.n and v.n in SPLIT_AFTER:
            pending_split = SPLIT_AFTER[v.n]

    def flush_prose() -> None:
        nonlocal prose
        if prose and cur and cur.verses:
            cur.verses[-1].translation = join_prose(prose)
        prose = []

    for p in paras:
        cls, text = p['cls'], plain(p['events']).strip()
        if cls == 'title':
            continue
        if cls == 'shloka':
            flush_prose()
            if pending_split:
                cur = new_section(pending_split)
                pending_split = None
            rows.append(p)
            continue
        # not a chant row -> the open verse ends here
        close_verse()
        if cls == 'subtitle':
            flush_prose()
            cur = new_section(text)
            continue
        if text in SOURCE_ROWS:
            flush_prose()
            if cur is None or cur.verses:
                cur = new_section('śānti pāṭha')
            cur.source = SOURCE_ROWS[text]
            continue
        if text in LABELS:
            flush_prose()
            cur = new_section(LABELS[text])
            continue
        prose.append(text)
    close_verse()
    flush_prose()
    return sections, report


# ── Words ────────────────────────────────────────────────────────────────────
def word_surfaces(tokens: List[Dict]) -> List[str]:
    """The verse's words, in order: a run of syllables between separators."""
    out, cur = [], ''
    for t in tokens:
        if t.get('t') == 'syl':
            cur += t['iast']
        else:
            if cur:
                out.append(cur)
            cur = ''
    if cur:
        out.append(cur)
    return out


def attach_words(sections: List[Section], report: Dict) -> None:
    missing = collections.Counter()
    used = set()
    for sec in sections:
        for v in sec.verses:
            for i, w in enumerate(word_surfaces(v.tokens)):
                key = (v.id, i, w)
                entries = OVERRIDES.get(key) or WORDS.get(w)
                if entries is None:
                    missing[w] += 1
                    continue
                if key in OVERRIDES:
                    used.add(key)
                v.words.append({'surface': w, 'entries': entries})
    stale = set(OVERRIDES) - used
    if stale:
        raise AssertionError('OVERRIDES never fired: %s' % sorted(stale))
    report['missing_words'] = missing


# ── Checks ───────────────────────────────────────────────────────────────────
def check(sections: List[Section], report: Dict) -> None:
    for sec in sections:
        assert sec.title, 'section without a label'
        for v in sec.verses:
            # every rendered line short enough not to wrap
            line = ''
            for t in v.tokens:
                if t.get('t') == 'br':
                    assert len(line) <= MAX_LINE, \
                        '%s: rendered line %d chars > %d: %r' % (
                            v.id, len(line), MAX_LINE, line)
                    line = ''
                elif t.get('t') == 'syl':
                    line += t['iast']
                elif t.get('t') == 'sp':
                    line += ' '
                elif t.get('t') in ('danda', 'num', 'text'):
                    line += t.get('s', '')
            assert len(line) <= MAX_LINE, \
                '%s: rendered line %d chars > %d: %r' % (
                    v.id, len(line), MAX_LINE, line)
            assert v.translation, '%s has no translation' % v.id
            if v.words:
                assert len(v.words) == len(word_surfaces(v.tokens)), \
                    '%s: %d words vs %d syllable runs' % (
                        v.id, len(v.words), len(word_surfaces(v.tokens)))
    nums = [v.n for s in sections for v in s.verses if v.n]
    assert nums == [str(i) for i in range(1, 15)], \
        'the fourteen mantras are not numbered 1..14: %s' % nums


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf', required=True)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--surfaces', action='store_true',
                    help='list every distinct word surface and exit')
    a = ap.parse_args()

    sections, report = build(a.pdf)

    if a.surfaces:
        c = collections.Counter(w for s in sections for v in s.verses
                                for w in word_surfaces(v.tokens))
        for w, n in sorted(c.items()):
            print('%-28s %d' % (w, n))
        print('\n%d distinct surfaces, %d words' % (len(c), sum(c.values())))
        return

    attach_words(sections, report)
    check(sections, report)

    deva, tel, tam = derive_scripts(TITLE_IAST)
    doc = {
        'format': 'vedaunion.chant',
        'version': 3,
        'id': 'ganapati-atharvashirsham',
        'title': TITLE_IAST,
        'subtitle': 'The Atharvavedic upaniṣad of Gaṇeśa',
        'source': 'atharvaveda · Gaṇapati Atharvaśīrṣa Upaniṣad',
        'primaryScript': 'iast',
        'scripts': ['iast', 'devanagari', 'telugu', 'tamil'],
        'titleForms': {'iast': TITLE_IAST, 'devanagari': deva,
                       'telugu': tel, 'tamil': tam},
        'lineBreak': 'source',
        'features': {'audio': False, 'grammar': bool(WORDS)},
        'instructions': [
            instruction('note',
                        'Transcribed from the Veda Union Gaṇapati '
                        'Atharvaśīrṣam (IAST, v3.3). The recitation marks are '
                        'the owner\u2019s own: holdings, svara, the anusvāra '
                        'and visarga forms, svarabhakti and the pauses are '
                        'carried as data, not redrawn.'),
        ],
        'sections': [s.out() for s in sections],
        'recording': {'byVerse': {}},
    }

    aids = sum(apply_reading_aids(v['tokens'])
               for sec in doc['sections'] for v in sec['verses'])

    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')

    nver = sum(len(s.verses) for s in sections)
    nsyl = sum(1 for s in sections for v in s.verses for t in v.tokens
               if t['t'] == 'syl')
    nbox = sum(1 for s in sections for v in s.verses for t in v.tokens
               if t['t'] == 'syl' for u in t['units'] if u.get('hold'))
    nsv = sum(1 for s in sections for v in s.verses for t in v.tokens
              if t['t'] == 'syl' for u in t['units'] if u.get('svara'))
    print('WROTE', os.path.normpath(a.out))
    print('  sections %d · verses %d · syllables %d · holdings %d · svara %d'
          % (len(sections), nver, nsyl, nbox, nsv))
    print('  reading aids added (jñ -> g, vy -> u): %d' % aids)
    print('  annotations kept %d · dropped %d'
          % (sum(report['ann'].values()) - report['dropped_ann'],
             report['dropped_ann']))
    miss = report.get('missing_words') or {}
    if miss:
        print('  MISSING GRAMMAR for %d surfaces (%d occurrences)'
              % (len(miss), sum(miss.values())))
    for s in sections:
        print('    [%s] %s — %d verse(s)' % (s.id, s.title, len(s.verses)))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
