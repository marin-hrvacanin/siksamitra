# -*- coding: utf-8 -*-
"""VU-styled IAST PDF, *Palatino/Arial* export -> rows of MARKED EVENTS.

The sibling of `pdf_marks.py`. That module is calibrated for the owner's
CalibriLight exports (`rudram v1.6 - IAST.pdf`); this one is calibrated for the
Arial + URWPalladioITU family that `gaNapatyatharvashIrSham v3.3 - IAST.pdf`
belongs to. Four things differ, and every one of them changes the DATA:

1.  **The grammar-engine transformation is set in ITALIC, not blue.** In the
    Rudram export a changed glyph is `#0070C0`; here it is `Arial,Italic` at the
    body size, in black. The pause pipes are italic too, so the `|` glyph
    itself is what separates them (same disambiguation the other module makes
    for its two blues).

2.  **93 letters are not in the text layer at all.** Every letter wearing a
    LONG holding box was flattened to vector outlines by the exporter, so the
    text layer skips it — `tār[k]ṣyo`, `oṁ [ś]ān[t]iḥ`, `vāṅ[m]ayas`. They are
    still perfectly legible as paths, and `OUTLINED` below is the transcription:
    each entry is keyed by (page, round(y0), round(x0)) -> the letter, and
    `extract()` asserts every one of them fires, so a re-exported PDF raises
    instead of silently shifting a letter into the wrong word. See
    `docs/AUTHORING-CHANTS.md` §5L for how the table was read off the paths.

    The count is its own check: the 93 are exactly the letters wearing a LONG
    holding box, so the finished JSON must carry `hold: "long"` on 93 units.

3.  **The candrabindu is `U+0001` in URWPalladioITU,Italic**, not the private
    code the Calibri export uses; the raised gum that follows it is `Arial,
    Italic` at ~10.3pt, which is also how every other raised reading aid is set.
    Size, not colour, is the discriminator here.

4.  **Section headings are TimesNewRoman,Italic 16pt** and translations the
    same face at 11pt — the Rudram export distinguishes them by gray. So the
    split is by size, and a heading is never gray in this file.

Everything else follows `pdf_marks`: document order is kept and never sorted,
holdings come out of the vector layer, and a box that covers a same-point pair
is narrowed to its first consonant.

Output shape is identical to `pdf_marks.extract`, so a generator written
against one reads the other.
"""

from __future__ import annotations

import unicodedata
from typing import Dict, List, Optional

import pymupdf

from pdf_marks import DIGRAPHS, letters, is_mark, same_point  # noqa: F401

# ── Calibration, measured off `gaNapatyatharvashIrSham v3.3 - IAST.pdf` ──────
BODY_SIZE = 15.8            # the chant rows (Arial)
SUP_SIZE = 10.4             # raised reading aids / the gum (Arial,Italic)
HEAD_SIZE = 16.0            # section headings (TimesNewRoman,Italic)
NOTE_SIZE = 11.0            # translations and loci (TimesNewRoman,Italic)
TITLE_SIZE = 21.9           # the document title
SIZE_TOL = 0.6

HOLDING_GREEN = (0.324, 0.508, 0.207)
HOLDING_COLOR_TOL = 0.05
HOLDING_EDGE_THRESHOLD = 0.5
HOLDING_X_PAD = 1.0

#: A blank starting at least this far left of a holding box carries a real word
#: space as well as the flattened letter's slot; anything tighter is slot only.
SPACE_KEEP = 2.0

HEADER_BAND = 60.0
FOOTER_BAND = 40.0
ROW_TOL = 10.0

SVARA_GLYPHS = {'̱', '̍', '̎', '̅'}
CANDRA_GLYPH = ''

#: The letters the exporter flattened to outlines, read off the paths.
#: Keyed by (page, round(y0), round(x0)) -> the letter, so a stale or
#: mis-keyed entry raises instead of silently shifting a letter into the
#: wrong word. 93 entries; `extract` asserts every one of them fires.
OUTLINED = {
    # page 1
    (0, 172, 225): 'k',
    (0, 197, 191): 't',
    (0, 199, 275): 's',
    (0, 346, 181): 'k',
    (0, 447, 99): 'ś',
    (0, 448, 126): 't',
    (0, 448, 174): 't',
    (0, 448, 222): 't',
    (0, 667, 143): 'k',
    (0, 668, 192): 't',
    # page 2
    (1, 193, 159): 't',
    (1, 193, 344): 't',
    (1, 193, 378): 't',
    (1, 217, 171): 't',
    (1, 217, 274): 'dh',
    (1, 217, 310): 't',
    (1, 217, 426): 't',
    (1, 244, 183): 'p',
    (1, 360, 143): 'm',
    (1, 405, 215): 'd',
    (1, 609, 305): 'y',
    (1, 681, 188): 'p',
    # page 3
    (2, 89, 181): 't',
    (2, 163, 205): 's',
    (2, 185, 200): 't',
    (2, 212, 127): 'y',
    (2, 208, 180): 'dh',
    (2, 233, 170): 't',
    (2, 260, 460): 'y',
    (2, 281, 170): 't',
    (2, 280, 302): 'bh',
    (2, 470, 166): 'v',
    (2, 470, 242): 'y',
    (2, 491, 302): 'd',
    (2, 542, 160): 'v',
    (2, 563, 195): 't',
    # page 4
    (3, 134, 176): 'p',
    (3, 250, 258): 'b',
    (3, 277, 250): 'p',
    (3, 301, 232): 'g',
    (3, 301, 369): 's',
    (3, 349, 252): 'p',
    (3, 349, 319): 'p',
    (3, 349, 379): 'p',
    (3, 549, 116): 'v',
    (3, 594, 144): 't',
    (3, 618, 264): 't',
    # page 5
    (4, 87, 184): 'ṣ',
    (4, 132, 239): 'dh',
    (4, 135, 198): 'n',
    (4, 183, 226): 'p',
    (4, 229, 202): 't',
    (4, 300, 137): 'th',
    (4, 300, 231): 'k',
    (4, 327, 188): 'ṣ',
    (4, 348, 167): 'd',
    (4, 352, 207): 'y',
    (4, 348, 321): 'bh',
    (4, 376, 201): 'y',
    (4, 605, 318): 'g',
    (4, 626, 354): 'bh',
    (4, 650, 186): 'k',
    (4, 674, 132): 'd',
    (4, 677, 275): 'n',
    # page 6
    (5, 64, 150): 'k',
    (5, 68, 116): 'v',
    (5, 68, 195): 'y',
    (5, 67, 288): 'r',
    (5, 92, 131): 'y',
    (5, 88, 260): 'bh',
    (5, 88, 427): 'bh',
    (5, 112, 321): 'ch',
    (5, 115, 444): 'p',
    (5, 136, 117): 'j',
    (5, 274, 117): 'b',
    (5, 274, 141): 'h',
    (5, 277, 204): 's',
    (5, 277, 366): 'y',
    (5, 301, 94): 'y',
    (5, 301, 264): 'p',
    (5, 349, 183): 'p',
    (5, 373, 170): 'p',
    (5, 397, 171): 'p',
    (5, 421, 127): 'p',
    (5, 421, 215): 'p',
    # page 7
    (6, 132, 225): 'k',
    (6, 157, 191): 't',
    (6, 159, 275): 's',
    (6, 306, 181): 'k',
    (6, 408, 99): 'ś',
    (6, 408, 126): 't',
    (6, 408, 174): 't',
    (6, 408, 222): 't',
}


def _near(a: float, b: float) -> bool:
    return abs(a - b) <= SIZE_TOL


def _green(fill) -> bool:
    return (fill is not None and len(fill) >= 3
            and all(abs(fill[i] - HOLDING_GREEN[i]) < HOLDING_COLOR_TOL
                    for i in range(3)))


# ── Outlined letters, recovered from the vector layer ────────────────────────
def outlined_glyphs(page) -> List[Dict]:
    """The flattened letters of this page, as {x0,x1,y0,y1} ink rects."""
    inks = []
    for x in page.get_drawings():
        f = x.get('fill')
        if f is None or _green(f):
            continue
        r = x['rect']
        if not (0 < r[2] - r[0] < 40 and 0 < r[3] - r[1] < 40):
            continue
        if r[1] < HEADER_BAND or r[3] > page.rect.height - FOOTER_BAND:
            continue
        inks.append(list(r))
    out: List[Dict] = []
    used = [False] * len(inks)
    for i, a in enumerate(inks):
        if used[i]:
            continue
        used[i] = True
        gx0, gy0, gx1, gy1 = a
        changed = True
        while changed:
            changed = False
            for j, b in enumerate(inks):
                if used[j]:
                    continue
                if (b[0] <= gx1 + 1.0 and b[2] >= gx0 - 1.0
                        and b[1] <= gy1 + 4 and b[3] >= gy0 - 4):
                    gx0, gy0 = min(gx0, b[0]), min(gy0, b[1])
                    gx1, gy1 = max(gx1, b[2]), max(gy1, b[3])
                    used[j] = True
                    changed = True
        out.append({'x0': gx0, 'y0': gy0, 'x1': gx1, 'y1': gy1})
    out.sort(key=lambda g: (round(g['y0'] / ROW_TOL), g['x0']))
    return out


def _resolve_outlined(pno: int, g: Dict, seen: set) -> str:
    """The letter this flattened path is, from the transcription table."""
    y, x = round(g['y0']), round(g['x0'])
    for dy in (0, -1, 1):
        for dx in (0, -1, 1):
            key = (pno, y + dy, x + dx)
            if key in OUTLINED:
                seen.add(key)
                return OUTLINED[key]
    raise KeyError('no OUTLINED entry for page %d at y0=%.1f x0=%.1f (w=%.1f) — '
                   'the export changed; re-read the contact sheet'
                   % (pno, g['y0'], g['x0'], g['x1'] - g['x0']))


# ── Characters, in DOCUMENT order ────────────────────────────────────────────
def _fam(font: str) -> str:
    return font.split('+')[-1]


def _chars(page) -> List[Dict]:
    out: List[Dict] = []
    for b in page.get_text('rawdict')['blocks']:
        if b.get('type') != 0:
            continue
        for ln in b['lines']:
            for sp in ln['spans']:
                fam = _fam(sp.get('font', ''))
                size = round(sp.get('size', 0.0), 1)
                for ch in sp.get('chars', []):
                    c = ch.get('c', '')
                    if not c or (not c.strip() and c != ' '):
                        continue
                    x0, y0, x1, y1 = ch['bbox']
                    italic = 'Italic' in fam
                    is_sup = fam == 'Arial,Italic' and _near(size, SUP_SIZE)
                    rec = {
                        'c': c, 'fam': fam, 'size': size,
                        'italic': italic, 'sup': is_sup,
                        'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
                        'mark': is_mark(c), 'hold': None, 'box': None,
                        'pause': None, 'outlined': False,
                        'change': (fam == 'Arial,Italic'
                                   and _near(size, BODY_SIZE) and c != '|'),
                    }
                    if c == '|' and italic:
                        rec['pause'] = 'short'
                    out.append(rec)
    return out


# ── Holding boxes from the vector layer ──────────────────────────────────────
def _boxes(page) -> List[Dict]:
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

    for i in range(len(rects)):
        for j in range(i + 1, len(rects)):
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
    out.sort(key=lambda b: (round(b['y0'] / ROW_TOL), b['x0']))
    return out


def _assign(items: List[Dict], boxes: List[Dict], page_no: int) -> None:
    for ch in items:
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


# ── Rows, in document order, with the flattened letters put back ─────────────
def _rows(chars: List[Dict], page_h: float) -> List[List[Dict]]:
    keep = [c for c in chars if HEADER_BAND < c['y0'] < (page_h - FOOTER_BAND)]
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


def _base_y(row: List[Dict]) -> float:
    base = [c for c in row if not c['mark'] and not c['sup']] or row
    return max(c['y1'] for c in base)


def _inject(rows: List[List[Dict]], glyphs: List[Dict], pno: int,
            boxes: List[Dict], seen: set) -> None:
    """Put each flattened letter back where its ink sits.

    Position is decided by x, never by document order: the letter is missing
    from the stream entirely, and the combining mark belonging to the letter
    BEFORE the gap sits at that letter's right edge — i.e. inside the gap's own
    x-span. So the insertion point is the first character starting at or after
    the gap's RIGHT edge, which leaves such a mark on its own base.
    """
    for g in glyphs:
        ch = _resolve_outlined(pno, g, seen)
        row = min(rows, key=lambda r: abs(_base_y(r) - g['y1']))
        rec = {
            'c': ch, 'fam': 'Arial', 'size': BODY_SIZE,
            'italic': False, 'sup': False,
            'x0': g['x0'], 'y0': g['y0'], 'x1': g['x1'], 'y1': g['y1'],
            'mark': False, 'hold': None, 'box': None, 'pause': None,
            'outlined': True, 'change': False,
        }
        _assign([rec], boxes, pno)
        if rec['hold'] != 'long':
            raise ValueError(
                'flattened letter %r on page %d at x0=%.1f is not inside a long '
                'holding box (got %r) — the calibration is wrong'
                % (ch, pno, g['x0'], rec['hold']))

        # The exporter left a blank of the letter's own advance where the glyph
        # should be, so the text layer reads `paśyemā- kṣabhir`. The holding box
        # wraps exactly that advance, which is what identifies the placeholder:
        # a blank lying inside the box is the missing letter's slot and goes.
        # One that starts clearly BEFORE the box is a real word space that the
        # exporter merged with the slot, so it is kept and truncated.
        bx = boxes[rec['box'][1]]
        for c in list(row):
            if c['c'] != ' ' or c['x1'] <= bx['x0'] + 0.5 or c['x0'] >= bx['x1'] - 0.5:
                continue
            if c['x0'] < bx['x0'] - SPACE_KEEP:
                c['x1'] = bx['x0']
            else:
                row.remove(c)

        at = len(row)
        for i, c in enumerate(row):
            if c['x0'] >= g['x1'] - 1.5:
                at = i
                break
        row.insert(at, rec)


def _narrow_boxes(row: List[Dict], report: List[str]) -> None:
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
        keep = len(cons[0])
        for k, i in enumerate(idxs):
            if k >= keep:
                row[i]['hold'] = None
                row[i]['box'] = None
        report.append(text)


ANN_MAX_SIZE = 13.0


def _is_ann(ch: Dict) -> bool:
    return (ch['size'] < ANN_MAX_SIZE and not ch['sup']
            and not ch['mark'] and ch['fam'].startswith('TimesNewRoman'))


def _classify(row: List[Dict]) -> str:
    base = [c for c in row if not c['mark'] and not c['sup']] or row
    big = max(base, key=lambda c: c['size'])
    sz, fam = big['size'], big['fam']
    if sz >= 21:
        return 'title'
    if sz >= 15 and fam.startswith('TimesNewRoman'):
        return 'subtitle'
    if sz >= 15:
        return 'shloka'
    return 'small'


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
            if ev and ev[-1]['kind'] == 'sup':
                ev[-1]['text'] += c
            else:
                ev.append({'kind': 'sup', 'text': c})
            continue
        rec = {'kind': 'text', 'text': c, 'hold': ch['hold'],
               'box': ch['box'], 'change': ch['change']}
        if (ev and ev[-1]['kind'] == 'text'
                and ev[-1]['hold'] == rec['hold']
                and ev[-1]['box'] == rec['box']
                and ev[-1]['change'] == rec['change']):
            ev[-1]['text'] += c
        else:
            ev.append(rec)
    return ev


def extract(path: str):
    """-> (paragraphs, narrowed). Same shape as `pdf_marks.extract`."""
    doc = pymupdf.open(path)
    paras: List[Dict] = []
    narrowed: List[str] = []
    seen: set = set()
    try:
        for pno in range(doc.page_count):
            page = doc[pno]
            boxes = _boxes(page)
            chars = _chars(page)
            _assign(chars, boxes, pno)
            rows = _rows(chars, page.rect.height)
            _inject(rows, outlined_glyphs(page), pno, boxes, seen)
            for row in rows:
                _narrow_boxes(row, narrowed)
                cls = _classify(row)
                ev = _events(row, cls)
                if not ''.join(e.get('text', '') for e in ev).strip() \
                        and not any(e['kind'] == 'pause' for e in ev):
                    continue
                paras.append({'page': pno, 'baseline': _base_y(row),
                              'cls': cls, 'events': ev})
    finally:
        doc.close()
    stale = set(OUTLINED) - seen
    if stale:
        raise AssertionError('OUTLINED entries never fired: %s' % sorted(stale))
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
    print('narrowed boxes:', len(narrowed), collections.Counter(narrowed))
    for p in paras:
        line = plain(p['events'])
        a = anns(p['events'])
        print('%-8s | %s%s' % (p['cls'], line,
                               ('   << ' + ' ; '.join(a)) if a else ''))
