# -*- coding: utf-8 -*-
"""VU-styled IAST PDF -> paragraphs of MARKED EVENTS (no HTML in between).

The input is one of the owner's own exported documents (`rudram v1.6 - IAST.pdf`
and its siblings): Gentium IAST with the recitation marks drawn as real glyphs,
the saṁyukta holdings as green boxes in the VECTOR layer, and the pauses as
coloured `|` pipes. Everything this module knows about that export was measured
off it; the constants below are the calibration.

Why this exists next to Śikṣāmitra's `pdf_import.convert_pdf_to_html`
-------------------------------------------------------------------
That importer targets the Quill editor, so it emits HTML and a chant generator
has to parse it back. Two things it does are wrong for our purpose, and both
change the DATA, not the looks:

1.  **Combining marks are re-ordered by x-coordinate.** `_cluster_rows` sorts
    each row by `round(x0, 1)` with marks before the base at the same x. In this
    export the accent glyph is drawn a hair to the RIGHT of the letter that
    follows it, so `śuklā̍m` (accent on the `ā`) comes out as `śuklām̍` — the
    accent moved one letter. Measured on p.3: the `U+030D` sits at x0=108.8 and
    the `m` at x0=108.7. The PDF's own content-stream order is correct, and
    PyMuPDF hands it to us in that order, so **we keep document order and never
    sort**. (Row assignment still needs the y-band, which is what the sort was
    really there for.)

2.  **A holding box may cover two consonants.** In `rudram v1.6` 71 of the 2081
    boxes wrap a same-point pair — `nn`, `tt`, `cc`, `jj`, `ll`, `yy`, `ddh`,
    `cch`, `kkh`, and one cross-word `n n`. Every box in every shipped VU chant
    covers exactly ONE letter, and MARKING-RULES §2.1 step 4.1 names the host
    outright for this case: *same point of articulation -> the FIRST of the
    pair*. So a multi-consonant box is narrowed to its first consonant here, at
    the import boundary, and `same_point()` asserts the pair really is one —
    anything else raises rather than being silently re-hosted.

Output shape (one dict per logical row):

    {'page': int, 'baseline': float,
     'cls': 'title'|'subtitle'|'shloka'|'small'|'body',
     'events': [ {'kind': 'text',  'text': str, 'hold': None|'short'|'long',
                                   'box': None|int, 'change': bool},
                 {'kind': 'svara', 'mark': '\\u0331'|'\\u030d'|'\\u030e'|'\\u0305'},
                 {'kind': 'sup',   'text': str},
                 {'kind': 'candra'},
                 {'kind': 'pause', 'len': 'short'|'long'},
                 {'kind': 'ann',   'text': str} ]}

`box` is the logical holding id, so a generator can group adjacent held letters
into one drawn box (`hg` in the chant format) without re-deriving anything.

`ann` is an EDITORIAL ANNOTATION physically inside a chant row: the mudrā and
body-part directions of the nyāsa (`… namaḥ ।` + *thumbs*), the per-verse Ṛgveda
citations of the tenth anuvāka, notes like *svarabhakti* or *systematic
indices*. They are not a guess — the owner sets them in the same 11pt gray
italic he uses for the translations, inside a 16pt chant line, so the split is
structural. What each one MEANS is the generator's business, not this module's.

`cls` deliberately does NOT try to tell a citation from a translation: both are
that same 11pt gray italic, so any such split is content, not typography, and
belongs to whoever knows the document.
"""

from __future__ import annotations

import itertools
import unicodedata
from typing import Dict, List, Optional

import pymupdf

# ── Calibration, measured off the Veda Union export (PDFCreator/Ghostscript) ──
CHANGE_BLUE = 0x0070C0      # grammar-engine transformation glyphs (anusvāra/visarga/aids)
GRAY_SUBTITLE = 0x7E7F7E
GRAY_ITALIC = 0x7F807F
PAUSE_LONG_RED = 0xC00000
PAUSE_SHORT_BLUE = 0x0070C0  # == CHANGE_BLUE; the '|' glyph disambiguates

HOLDING_GREEN = (0.324, 0.508, 0.207)
HOLDING_COLOR_TOL = 0.05
HOLDING_EDGE_THRESHOLD = 0.5   # border stroke < 0.5pt -> short, >= -> long
HOLDING_X_PAD = 1.0

HEADER_BAND = 35.0
FOOTER_BAND = 35.0
ROW_TOL = 10.0

#: The four accent glyphs this export uses. `U+0305` is the dīrgha-svarita's
#: blue overline, which Śikṣāmitra draws on a SHORT vowel where a long vowel
#: would have taken `U+030E` (documents/veda-union-markings.md, "Dīrgha
#: Svarita"); it always immediately precedes the `U+030D` it belongs with, and
#: the generator folds the pair into one mark.
SVARA_GLYPHS = {'̱', '̍', '̎', '̅'}

#: The candrabindu glyph. The Veda Union export draws it with a font-private
#: code that PyMuPDF hands back as **U+0001** (43 of them here) — not as a
#: Unicode candrabindu and not in the private-use plane, which is why looking for
#: either finds nothing. Kept as its own event because the chant format stores it
#: as `candra` on the nasal, with the gum in `sup` (`g` / `gg` / `gṁ`).
CANDRA_GLYPH = ''
PUA_CANDRA = CANDRA_GLYPH      # kept: the round-trip verifier reads this name

#: IAST digraphs that are ONE consonant. Needed to count a box's consonants.
DIGRAPHS = ('kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh')

#: Aspiration partners — `t`/`th` and `c`/`ch` count as the SAME point of
#: articulation for the holding rule (MARKING-RULES §2.1 step 4.1).
_ASPIRATE = {'kh': 'k', 'gh': 'g', 'ch': 'c', 'jh': 'j', 'ṭh': 'ṭ',
             'ḍh': 'ḍ', 'th': 't', 'dh': 'd', 'ph': 'p', 'bh': 'b'}


def _unaspirated(c: str) -> str:
    return _ASPIRATE.get(c, c)


def same_point(a: str, b: str) -> bool:
    """The §2.1 step-4.1 test: identical, or differing only by aspiration."""
    return _unaspirated(a) == _unaspirated(b)


def letters(s: str) -> List[str]:
    """Split IAST into letters, keeping the ten aspirate digraphs together."""
    out: List[str] = []
    i = 0
    while i < len(s):
        two = s[i:i + 2]
        if two in DIGRAPHS:
            out.append(two)
            i += 2
        else:
            out.append(s[i])
            i += 1
    return out


def is_mark(c: str) -> bool:
    return bool(c) and (unicodedata.combining(c) != 0
                        or unicodedata.category(c) == 'Mn')


def _is_gray(color: int) -> bool:
    return color in (GRAY_SUBTITLE, GRAY_ITALIC)


# ── Characters, in DOCUMENT order ────────────────────────────────────────────
def _chars(page) -> List[Dict]:
    out: List[Dict] = []
    for b in page.get_text('rawdict')['blocks']:
        if b.get('type') != 0:
            continue
        for ln in b['lines']:
            for sp in ln['spans']:
                color = sp.get('color', 0)
                size = round(sp.get('size', 0.0), 1)
                flags = sp.get('flags', 0)
                sup = bool(flags & 1)
                italic = bool(flags & 2)
                for ch in sp.get('chars', []):
                    c = ch.get('c', '')
                    if not c or (not c.strip() and c != ' '):
                        continue
                    x0, y0, x1, y1 = ch['bbox']
                    rec = {
                        'c': c, 'size': size, 'color': color,
                        'sup': sup, 'italic': italic,
                        'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
                        'mark': is_mark(c),
                        'hold': None, 'box': None, 'pause': None,
                    }
                    if c == '|':
                        if color == PAUSE_LONG_RED:
                            rec['pause'] = 'long'
                        elif color == PAUSE_SHORT_BLUE:
                            rec['pause'] = 'short'
                    out.append(rec)
    return out


# ── Holding boxes from the vector layer ──────────────────────────────────────
def _green(fill) -> bool:
    return (fill is not None and len(fill) >= 3
            and all(abs(fill[i] - HOLDING_GREEN[i]) < HOLDING_COLOR_TOL
                    for i in range(3)))


def _boxes(page) -> List[Dict]:
    """Each holding is drawn as several thin green rects (its borders). Cluster
    the overlapping ones into one logical box; the thinnest edge says short/long."""
    rects = []
    for d in page.get_drawings():
        if _green(d.get('fill')) and d.get('rect') is not None:
            r = d['rect']
            rects.append([r[0], r[1], r[2], r[3]])
    if not rects:
        return []

    parent = list(range(len(rects)))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def touches(a, b) -> bool:
        return not (a[2] < b[0] - 1 or b[2] < a[0] - 1
                    or a[3] < b[1] - 1 or b[3] < a[1] - 1)

    for i, j in itertools.combinations(range(len(rects)), 2):
        if touches(rects[i], rects[j]):
            parent[find(i)] = find(j)

    groups: Dict[int, List[List[float]]] = {}
    for i in range(len(rects)):
        groups.setdefault(find(i), []).append(rects[i])

    out = []
    for g in groups.values():
        thick = min(min(r[2] - r[0], r[3] - r[1]) for r in g)
        out.append({
            'x0': min(r[0] for r in g), 'y0': min(r[1] for r in g),
            'x1': max(r[2] for r in g), 'y1': max(r[3] for r in g),
            'kind': 'long' if thick >= HOLDING_EDGE_THRESHOLD else 'short',
        })
    return out


def _assign(chars: List[Dict], boxes: List[Dict], page_no: int) -> None:
    """Tag each base character with the box whose band its centre falls in."""
    for ch in chars:
        if ch['mark'] or ch['sup'] or ch['c'] == ' ':
            continue
        xc = (ch['x0'] + ch['x1']) / 2.0
        yc = (ch['y0'] + ch['y1']) / 2.0
        for bid, bx in enumerate(boxes):
            if (bx['x0'] - HOLDING_X_PAD <= xc <= bx['x1'] + HOLDING_X_PAD
                    and bx['y0'] <= yc <= bx['y1']):
                ch['hold'] = bx['kind']
                ch['box'] = (page_no, bid)
                break


# ── Rows, in document order ──────────────────────────────────────────────────
def _rows(chars: List[Dict], page_h: float) -> List[List[Dict]]:
    """Group into logical rows WITHOUT sorting: document order is reading order,
    and a mark always follows the letter it belongs to. A new row starts when a
    base character's baseline leaves the current row's band."""
    keep = [c for c in chars
            if HEADER_BAND < c['y0'] < (page_h - FOOTER_BAND)]
    rows: List[List[Dict]] = []
    anchor: Optional[float] = None
    for c in keep:
        if c['mark'] or c['sup']:
            if rows:
                rows[-1].append(c)
            continue
        if anchor is None or abs(c['y1'] - anchor) > ROW_TOL:
            rows.append([])
            anchor = c['y1']
        rows[-1].append(c)
    return [r for r in rows if r]


def _narrow_boxes(row: List[Dict], report: List[str]) -> None:
    """One box -> ONE letter (see the module docstring, point 2).

    A box that covers a same-point pair keeps the box on the FIRST consonant and
    drops it from the rest. Anything else — a box over two consonants that are
    NOT a same-point pair — raises, because re-hosting it would be a guess.
    """
    spans: Dict[object, List[int]] = {}
    for i, ch in enumerate(row):
        if ch['box'] is not None:
            spans.setdefault(ch['box'], []).append(i)
    for bid, idxs in spans.items():
        text = ''.join(row[i]['c'] for i in idxs)
        cons = letters(text.replace(' ', ''))
        if len(cons) <= 1:
            continue
        for a, b in zip(cons, cons[1:]):
            if not same_point(a, b):
                raise ValueError(
                    'holding box over a non-same-point cluster %r — '
                    'MARKING-RULES §2.1 step 4 does not name a host for this '
                    'without re-deriving the whole cluster' % (text,))
        # Keep the first LETTER (which may be a digraph: `ddh` -> `d`).
        keep = len(cons[0])
        for k, i in enumerate(idxs):
            if k >= keep:
                row[i]['hold'] = None
                row[i]['box'] = None
        report.append(text)


#: An annotation is small AND gray-italic; a chant row is 15pt+. Both live in
#: the same row in the nyāsa sections, which is what `ANN_MAX_SIZE` separates.
ANN_MAX_SIZE = 13.0


def _is_ann(ch: Dict) -> bool:
    return (ch['size'] < ANN_MAX_SIZE
            and (_is_gray(ch['color']) or ch['italic'])
            and not ch['mark'] and not ch['sup'])


def _classify(row: List[Dict]) -> str:
    base = [c for c in row if not c['mark'] and not c['sup']] or row
    big = max(base, key=lambda c: c['size'])
    sz, col = big['size'], big['color']
    if sz >= 21:
        return 'title'
    if sz >= 17 and _is_gray(col):
        return 'subtitle'
    if sz >= 15:
        return 'shloka'
    if _is_gray(col) or any(c['italic'] for c in base):
        return 'small'
    return 'body'


# ── Events ───────────────────────────────────────────────────────────────────
def _events(row: List[Dict], cls: str) -> List[Dict]:
    ev: List[Dict] = []
    for ch in row:
        c = ch['c']
        if cls == 'shloka' and _is_ann(ch):
            if ev and ev[-1]['kind'] == 'ann':
                ev[-1]['text'] += c
            else:
                ev.append({'kind': 'ann', 'text': c})
            continue
        if ch['pause']:
            ev.append({'kind': 'pause', 'len': ch['pause']})
            continue
        if c == CANDRA_GLYPH:
            ev.append({'kind': 'candra'})
            continue
        if ch['mark']:
            if c in SVARA_GLYPHS:
                ev.append({'kind': 'svara', 'mark': c})
            continue
        if ch['sup']:
            ev.append({'kind': 'sup', 'text': c})
            continue
        rec = {'kind': 'text', 'text': c, 'hold': ch['hold'],
               'box': ch['box'], 'change': ch['color'] == CHANGE_BLUE}
        # Coalesce a run of characters carrying the SAME marks into one text
        # event, so a generator can see the aspirate digraphs (`bh`, `dh`, `ṭh`)
        # as letters. Per-character events would split every one of them.
        if (ev and ev[-1]['kind'] == 'text'
                and ev[-1]['hold'] == rec['hold']
                and ev[-1]['box'] == rec['box']
                and ev[-1]['change'] == rec['change']):
            ev[-1]['text'] += c
        else:
            ev.append(rec)
    return ev


def extract(path: str):
    """-> (paragraphs, narrowed) where `narrowed` lists every multi-consonant
    holding box that was collapsed onto its first consonant."""
    doc = pymupdf.open(path)
    paras: List[Dict] = []
    narrowed: List[str] = []
    try:
        for pno in range(doc.page_count):
            page = doc[pno]
            chars = _chars(page)
            _assign(chars, _boxes(page), pno)
            for row in _rows(chars, page.rect.height):
                _narrow_boxes(row, narrowed)
                cls = _classify(row)
                ev = _events(row, cls)
                if not ''.join(e.get('text', '') for e in ev).strip() \
                        and not any(e['kind'] == 'pause' for e in ev):
                    continue
                base = [c for c in row if not c['mark'] and not c['sup']] or row
                paras.append({'page': pno,
                              'baseline': max(c['y1'] for c in base),
                              'cls': cls, 'events': ev})
    finally:
        doc.close()
    return paras, narrowed


def plain(events: List[Dict]) -> str:
    return ''.join(e['text'] for e in events if e['kind'] == 'text')


def anns(events: List[Dict]) -> List[str]:
    return [e['text'].strip() for e in events
            if e['kind'] == 'ann' and e['text'].strip()]


if __name__ == '__main__':
    import collections
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    paras, narrowed = extract(sys.argv[1])
    print('paragraphs:', len(paras), collections.Counter(p['cls'] for p in paras))
    print('narrowed boxes:', len(narrowed),
          collections.Counter(narrowed).most_common())
    for p in paras[:8]:
        print(p['cls'], '|', plain(p['events'])[:120])
