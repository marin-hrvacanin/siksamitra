"""
HIS PAGE AGAINST OURS, LINE BY LINE.

Two PDFs of one document — the one Word printed from his `.docx`, and the one
this program printed from the same `.docx` after importing it — read as lines
of text, aligned by their letters, and compared on everything a reader sees:
where a line starts, how big and in what face and colour it is, how far it is
from the line above, which page it is on, and where the lines break.

The two are compared by what they PRODUCE (rule 9): nothing here knows how
either page was made. A line is its letters with the marks taken off — his
svaras are glyphs of another face set over the letters, ours are drawn — so
the alignment is on the text a person reads, and the marks are compared by
`marks_of` separately.

    python tools/fidelity/compare_pdf.py HIS.pdf OURS.pdf [--json out.json] [--show 12]
"""
import argparse
import difflib
import json
import sys
import unicodedata

import pymupdf

# Positions are compared to the half point: Word and Chrome round differently,
# and a quarter of a point is not something an eye can see on paper.
TOLERANCE = 0.75


#: His Vedic anusvāra glyph, as his PDFs give it back: URW Palladio ITU's own
#: U+F141 in the newer, U+0001 in the older (`CANDRA_GLYPHS` in the reader).
CANDRA_CODES = {'\x01': ''}


def letters(text):
    """What a line says, for aligning: no marks, no spacing, no case."""
    out = []
    text = ''.join(CANDRA_CODES.get(c, c) for c in text)
    for ch in unicodedata.normalize('NFD', text):
        if unicodedata.category(ch) in ('Mn', 'Me', 'Cf'):
            continue
        if ch.isspace() or ch in ' ​':
            continue
        out.append(ch.lower())
    return unicodedata.normalize('NFC', ''.join(out))


#: How wide these letters are, in ems, in the faces his files are set in —
#: read once from the fonts themselves. A PDF printed through some drivers
#: renames every face (`18rdflvxtymmyol,Italic` is his Times New Roman Italic),
#: so a face is known by its letters when its name says nothing.
WIDTH_LETTERS = 'aeinorstuhlcdmp'
WIDTHS = {
    'sans': [
        (0.556, 0.556, 0.222, 0.556, 0.556, 0.333, 0.500, 0.278, 0.556, 0.556, 0.222, 0.500, 0.556, 0.833, 0.556),  # Arial
        (0.479, 0.498, 0.229, 0.525, 0.527, 0.349, 0.391, 0.335, 0.525, 0.525, 0.229, 0.423, 0.525, 0.799, 0.525),  # Calibri
        (0.471, 0.494, 0.221, 0.520, 0.521, 0.345, 0.387, 0.329, 0.520, 0.520, 0.221, 0.425, 0.520, 0.791, 0.520),  # Calibri Light
        (0.514, 0.478, 0.229, 0.514, 0.513, 0.343, 0.389, 0.335, 0.514, 0.514, 0.229, 0.416, 0.514, 0.791, 0.514),  # Calibri Italic
    ],
    'serif': [
        (0.444, 0.444, 0.278, 0.500, 0.500, 0.333, 0.389, 0.278, 0.500, 0.500, 0.278, 0.444, 0.500, 0.778, 0.500),  # Times
        (0.500, 0.444, 0.278, 0.500, 0.500, 0.389, 0.389, 0.278, 0.500, 0.500, 0.278, 0.444, 0.500, 0.722, 0.500),  # Times Italic
    ],
}


def face_by_name(font):
    """The family a face's name gives, or None when the name is not one."""
    f = font.lower()
    if 'times' in f or 'tinos' in f or 'serif' in f and 'sans' not in f or 'palladio' in f:
        return 'serif'
    if any(n in f for n in ('arial', 'arimo', 'calibri', 'carlito', 'sans', 'helvetica', 'mangal', 'noto')):
        return 'sans'
    return None


def faces_of(doc):
    """Every face of a PDF, named by its name or, failing that, by its letters."""
    adv = {}
    for page in doc:
        for block in page.get_text('rawdict')['blocks']:
            for line in block.get('lines', []):
                for s in line['spans']:
                    if face_by_name(s['font']) is not None or s['size'] <= 0:
                        continue
                    got = adv.setdefault(s['font'], {})
                    for a, b in zip(s['chars'], s['chars'][1:]):
                        if a['c'] in WIDTH_LETTERS:
                            got.setdefault(a['c'], []).append((b['origin'][0] - a['origin'][0]) / s['size'])
    out = {}
    for font, got in adv.items():
        widths = {c: sorted(v)[len(v) // 2] for c, v in got.items()}
        best = None
        for face, tables in WIDTHS.items():
            for t in tables:
                d = [abs(widths[c] - t[WIDTH_LETTERS.index(c)]) for c in widths]
                if d and (best is None or sum(d) / len(d) < best[0]):
                    best = (sum(d) / len(d), face)
        out[font] = best[1] if best is not None else 'sans'
    return out


def face_of(font, faces=None):
    """The family a span is set in, as a reader would name it."""
    named = face_by_name(font)
    if named is not None:
        return named
    return (faces or {}).get(font, 'sans')


def is_mark_span(span):
    """A span that is only marks — his svaras, set as combining glyphs."""
    t = span['text']
    return t.strip() != '' and all(unicodedata.category(c) in ('Mn', 'Me') or c.isspace() for c in t)


def lines_of(path):
    """Every visual line of every page: its letters, place, and dominant style."""
    doc = pymupdf.open(path)
    faces = faces_of(doc)
    out = []
    for pno, page in enumerate(doc):
        spans = []
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for s in line['spans']:
                    if s['text'].strip() == '' or is_mark_span(s):
                        continue
                    spans.append(s)
        # A visual line is the spans on one baseline; a superscript sits a
        # little above it and still belongs to it. The biggest spans make the
        # lines first, and each smaller one joins the NEAREST line within
        # reach: his superscripts stand 5.5 pt over a 16 pt line, which a
        # first-come test took for a line of their own.
        spans.sort(key=lambda s: (-round(s['size'], 1), round(s['origin'][1], 1), s['origin'][0]))
        rows = []
        for s in spans:
            y = s['origin'][1]
            near = [r for r in rows if abs(r['y'] - y) <= max(3.0, max(s['size'], r['size']) * 0.45)]
            row = min(near, key=lambda r: abs(r['y'] - y)) if near else None
            if row is None:
                row = {'y': y, 'size': s['size'], 'spans': []}
                rows.append(row)
            row['spans'].append(s)
        for r in rows:
            r['spans'].sort(key=lambda s: s['origin'][0])
            text = ''
            last_x1 = None
            for s in r['spans']:
                if last_x1 is not None and s['bbox'][0] - last_x1 > s['size'] * 0.2 and not text.endswith(' '):
                    text += ' '
                text += s['text']
                last_x1 = s['bbox'][2]
            weight = {}
            for s in r['spans']:
                key = (round(s['size'], 1), face_of(s['font'], faces), bool(s['flags'] & 2), f"#{s['color']:06x}")
                weight[key] = weight.get(key, 0) + len(s['text'].strip())
            size, face, italic, colour = max(weight.items(), key=lambda kv: kv[1])[0]
            out.append({
                'page': pno + 1,
                'y': round(r['y'], 2),
                'x0': round(min(s['bbox'][0] for s in r['spans']), 2),
                'x1': round(max(s['bbox'][2] for s in r['spans']), 2),
                'text': ' '.join(text.split()),
                'key': letters(text),
                'size': size, 'face': face, 'italic': italic, 'colour': colour,
            })
    out.sort(key=lambda l: (l['page'], l['y'], l['x0']))
    # Lines that share a baseline but stand apart — a running head's title and
    # its page number — are kept as two, in reading order.
    return [l for l in out if l['key'] != '']


def grey(colour):
    """Near-greys compared as one: #7f7f7f and #808080 are the same ink."""
    c = int(colour[1:], 16)
    return (c >> 16) & 255, (c >> 8) & 255, c & 255


def same_colour(a, b):
    return all(abs(x - y) <= 6 for x, y in zip(grey(a), grey(b)))


def compare(his, ours):
    """Align the two and say what differs, by kind."""
    found = {k: [] for k in ('missing', 'extra', 'breaks', 'indent', 'size', 'face', 'italic', 'colour', 'gap', 'page')}
    matched = []
    sm = difflib.SequenceMatcher(a=[l['key'] for l in his], b=[l['key'] for l in ours], autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == 'equal':
            matched.extend(zip(his[a0:a1], ours[b0:b1]))
            continue
        a, b = his[a0:a1], ours[b0:b1]
        if ''.join(l['key'] for l in a) == ''.join(l['key'] for l in b) and a and b:
            found['breaks'].append({'his': [l['text'] for l in a], 'ours': [l['text'] for l in b], 'page': a[0]['page']})
            continue
        for l in a:
            found['missing'].append({'text': l['text'], 'page': l['page']})
        for l in b:
            found['extra'].append({'text': l['text'], 'page': l['page']})

    # Spacing is the distance from the line before, when both are on the same
    # page in both documents — the first line of a page has nothing above it.
    perfect = 0
    # A line whose only fault is the page it fell on: everything a reader sees
    # of the line itself is his — counted apart, so a pagination still to be
    # done does not hide how close the lines are.
    found['but_page'] = 0
    for i, (h, o) in enumerate(matched):
        bad = False
        paged = False
        if abs((h['x0'] - 70.87) - (o['x0'] - 70.87)) > TOLERANCE:
            found['indent'].append({'text': h['text'], 'page': h['page'], 'his': h['x0'], 'ours': o['x0']})
            bad = True
        for k in ('size', 'face', 'italic'):
            if h[k] != o[k]:
                found[k].append({'text': h['text'], 'page': h['page'], 'his': h[k], 'ours': o[k]})
                bad = True
        if not same_colour(h['colour'], o['colour']):
            found['colour'].append({'text': h['text'], 'page': h['page'], 'his': h['colour'], 'ours': o['colour']})
            bad = True
        if h['page'] != o['page']:
            found['page'].append({'text': h['text'], 'his': h['page'], 'ours': o['page']})
            paged = True
        if i > 0:
            ph, po = matched[i - 1]
            if ph['page'] == h['page'] and po['page'] == o['page']:
                gh, go = h['y'] - ph['y'], o['y'] - po['y']
                if abs(gh - go) > TOLERANCE:
                    found['gap'].append({'text': h['text'], 'page': h['page'], 'his': round(gh, 2), 'ours': round(go, 2)})
                    bad = True
        if not bad and not paged:
            perfect += 1
        elif not bad:
            found['but_page'] += 1
    return found, matched, perfect


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('his')
    ap.add_argument('ours')
    ap.add_argument('--json')
    ap.add_argument('--show', type=int, default=6)
    args = ap.parse_args()
    his, ours = lines_of(args.his), lines_of(args.ours)
    found, matched, perfect = compare(his, ours)
    pages = (pymupdf.open(args.his).page_count, pymupdf.open(args.ours).page_count)
    summary = {
        'lines': len(his), 'ours': len(ours), 'matched': len(matched), 'perfect': perfect,
        'pages': {'his': pages[0], 'ours': pages[1]},
        **{k: (v if isinstance(v, int) else len(v)) for k, v in found.items()},
    }
    print(f"lines: his {len(his)}, ours {len(ours)}; matched {len(matched)}; PERFECT {perfect} "
          f"({100 * perfect / max(1, len(his)):.1f}%), and {found['but_page']} more perfect but for their page; "
          f"pages his {pages[0]}, ours {pages[1]}")
    for k, v in found.items():
        if isinstance(v, int) or not v:
            continue
        print(f"\n{k}: {len(v)}")
        for e in v[:args.show]:
            print('   ', json.dumps(e, ensure_ascii=False)[:220])
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump({'summary': summary, 'found': found}, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
