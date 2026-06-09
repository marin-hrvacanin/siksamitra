"""
pdf_import.py — import a Veda Union–styled PDF into editor-ready Quill HTML, faithfully.

Mirrors the role of convert_docx_to_html: produces `<p class="ql-…">` paragraphs the
editor consumes directly. "Import" here means *reproduce the source exactly* — not only the
structure and accents, but every visible marking the PDF physically carries:

  • the green samyukta HOLDING boxes (short vs long), read from the PDF vector layer; and
  • the colored PAUSE pipes (short = blue, long = red), read from the text layer,

in addition to title / subtitle / source-comment / translation classification, Vedic accents,
change-style transformation glyphs, superscripts, verse grouping, and header/footer removal.

To pin a holding box to the exact consonant(s) it surrounds, reconstruction is **character
aware**: PyMuPDF (fitz) is read at per-character granularity (`get_text("rawdict")`), and:

  1. running headers/footers (top/bottom margin bands) are dropped;
  2. logical rows are rebuilt with a TWO-PASS clusterer — base characters first (by baseline),
     then each Vedic-accent / superscript glyph is attached to the NEAREST base-row baseline
     (the fix for accent marks leaking into the wrong line);
  3. each row is ordered left→right, a combining mark placed just before the base char at the
     same x so it attaches to the correct base character;
  4. green holding boxes (vector layer) are clustered from their edge rectangles and overlaid
     onto the characters whose horizontal centre falls inside the box on the same baseline —
     thin border → short holding, thick border → long holding;
  5. each row is classified (title / subtitle / comment / shloka / translation) by size +
     color + position;
  6. HTML is emitted using the editor's native save markup — holdings as the outer wrapper,
     with accents (ql-svara-true), change-style (ql-change-style), superscripts (<sup>) and
     pause pipes (ql-short/long-pause) nested correctly inside.

Calibrated to the Veda Union export (PDFCreator/Ghostscript) with size/color fallbacks so
generic PDFs still import as best-effort body text (and with no false holding/pause spans).
"""

from __future__ import annotations

import html
import itertools
import re
import unicodedata
from typing import Dict, List, Optional

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:  # pragma: no cover
    fitz = None
    HAS_PYMUPDF = False

# ── Calibration constants (measured from the Veda Union export) ──────────────
ACCENT_RED = 0x943634     # svarita/anudātta/udātta/tick glyphs (combining, drawn red)
CHANGE_BLUE = 0x0070c0    # grammar-engine transformation glyphs (ql-change-style)
GRAY_SUBTITLE = 0x7e7f7e
GRAY_ITALIC = 0x7f807f
PAUSE_LONG_RED = 0xc00000    # long-pause pipe ('|') color
PAUSE_SHORT_BLUE = 0x0070c0  # short-pause pipe ('|') color (== CHANGE_BLUE; '|' disambiguates)

# Green samyukta holding-box fill in the vector layer, and the border-thickness split.
HOLDING_GREEN = (0.324, 0.508, 0.207)
HOLDING_COLOR_TOL = 0.05          # per-channel tolerance for the green fill match
HOLDING_EDGE_THRESHOLD = 0.5      # border stroke < 0.5pt → short; ≥ 0.5pt → long
_HOLDING_X_PAD = 1.0              # px slack when testing char-centre inside a box

# Private-use-area range and known glyph mappings from the embedded font → Unicode.
# U+F141 is the candrabindu m̐ (yajurveda anusvāra transform: "triṃśat" → m̐ + g + ṁ),
# drawn as a change-style PUA glyph; the editor encodes it as the anusvāra ṁ.
_PUA_LO = ''
_PUA_HI = ''
_PUA_MAP = {
    '': 'ṁ',
}

STYLE_CLASS = {
    'title': 'ql-doc-title',
    'subtitle': 'ql-doc-subtitle',
    # Source/citation lines use the BLOCK class `ql-doc-comment` (a registered paragraph
    # format) — NOT the inline `ql-comment-style`, whose <p> class Quill drops on load,
    # leaving the line unclassified and wrongly treated as chant (audio mapped onto it).
    'comment': 'ql-doc-comment',
    'translation': 'ql-doc-translation',
    'shloka': '',
    'body': '',
}

_CITATION_RE = re.compile(r'\d+\.\d+')
_CITATION_WORDS = ('also', 'optional', 'saṁhitā', 'saṃhitā', 'brāhmaṇam',
                   'maitrāyaṇī', 'taittirīya')


def _is_combining(text: str) -> bool:
    return bool(text) and all(
        unicodedata.combining(c) or unicodedata.category(c) == 'Mn' for c in text)


def _is_gray(color: int) -> bool:
    return color in (GRAY_SUBTITLE, GRAY_ITALIC)


def _map_pua(text: str) -> str:
    out = []
    for c in text:
        if c in _PUA_MAP:
            out.append(_PUA_MAP[c])
        elif _PUA_LO <= c <= _PUA_HI:
            continue  # unknown private-use glyph → drop (never emit tofu)
        else:
            out.append(c)
    return ''.join(out)


# ── Extraction ───────────────────────────────────────────────────────────────
def _extract_chars(page) -> List[Dict]:
    """Per-character records from the text layer (character-aware reconstruction).

    Regular word spaces are KEPT (they separate words); other whitespace is dropped."""
    chars: List[Dict] = []
    for b in page.get_text('rawdict')['blocks']:
        if b.get('type') != 0:
            continue
        for ln in b['lines']:
            for sp in ln['spans']:
                color = sp.get('color', 0)
                size = round(sp.get('size', 0.0), 1)
                font = sp.get('font', '')
                flags = sp.get('flags', 0)
                sup = bool(flags & 1)
                italic = bool(flags & 2)
                for ch in sp.get('chars', []):
                    c = ch.get('c', '')
                    if not c or (not c.strip() and c != ' '):
                        continue
                    bb = ch['bbox']
                    rec = {
                        'c': c,
                        'font': font,
                        'size': size,
                        'color': color,
                        'sup': sup,
                        'italic': italic,
                        'x0': bb[0], 'x1': bb[2], 'y0': bb[1], 'y1': bb[3],
                        'comb': _is_combining(c),
                        'holding': None,   # 'short' | 'long', assigned by overlay
                        'box_id': None,    # which logical box this char belongs to
                        'pause': None,     # 'short' | 'long', for colored '|' glyphs
                    }
                    # Pause pipe: classify by color (checked before change-style downstream).
                    if c == '|':
                        if color == PAUSE_LONG_RED:
                            rec['pause'] = 'long'
                        elif color == PAUSE_SHORT_BLUE:
                            rec['pause'] = 'short'
                    chars.append(rec)
    return chars


def _is_green(fill) -> bool:
    return (fill is not None and len(fill) >= 3
            and abs(fill[0] - HOLDING_GREEN[0]) < HOLDING_COLOR_TOL
            and abs(fill[1] - HOLDING_GREEN[1]) < HOLDING_COLOR_TOL
            and abs(fill[2] - HOLDING_GREEN[2]) < HOLDING_COLOR_TOL)


def _extract_holdings(page) -> List[Dict]:
    """Reconstruct logical holding boxes from the green edge rectangles in the vector layer.

    Each holding is drawn as several thin green filled rectangles (the four borders + a
    corner). Union-find clusters overlapping/adjacent rects into one logical box; the box's
    minimum edge stroke thickness selects short vs long.
    """
    rects: List[List[float]] = []
    try:
        drawings = page.get_drawings()
    except Exception:  # pragma: no cover - defensive
        return []
    for d in drawings:
        if _is_green(d.get('fill')):
            r = d.get('rect')
            if r is not None:
                rects.append([r[0], r[1], r[2], r[3]])
    if not rects:
        return []

    parent = list(range(len(rects)))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def overlap(a, b) -> bool:
        return not (a[2] < b[0] - 1 or b[2] < a[0] - 1 or a[3] < b[1] - 1 or b[3] < a[1] - 1)

    for i, j in itertools.combinations(range(len(rects)), 2):
        if overlap(rects[i], rects[j]):
            parent[find(i)] = find(j)

    groups: Dict[int, List[List[float]]] = {}
    for i in range(len(rects)):
        groups.setdefault(find(i), []).append(rects[i])

    boxes: List[Dict] = []
    for g in groups.values():
        x0 = min(r[0] for r in g); y0 = min(r[1] for r in g)
        x1 = max(r[2] for r in g); y1 = max(r[3] for r in g)
        thick = min(min(r[2] - r[0], r[3] - r[1]) for r in g)
        boxes.append({
            'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
            'thick': thick,
            'kind': 'long' if thick >= HOLDING_EDGE_THRESHOLD else 'short',
        })
    return boxes


def _assign_holdings(chars: List[Dict], boxes: List[Dict]) -> None:
    """Tag each base character with the holding box that surrounds it (centre-in-box, on the
    box's vertical band). Mutates char records in place."""
    if not boxes:
        return
    for ch in chars:
        if ch['comb'] or ch['sup'] or ch['c'] == ' ':
            continue  # accents/superscripts/spaces ride along, not matched to a box directly
        xc = (ch['x0'] + ch['x1']) / 2.0
        yc = (ch['y0'] + ch['y1']) / 2.0
        for bid, bx in enumerate(boxes):
            if (bx['x0'] - _HOLDING_X_PAD <= xc <= bx['x1'] + _HOLDING_X_PAD
                    and bx['y0'] <= yc <= bx['y1']):
                ch['holding'] = bx['kind']
                ch['box_id'] = bid
                break


# ── Row clustering / classification ──────────────────────────────────────────
def _cluster_rows(chars: List[Dict], page_h: float,
                  header: float = 35.0, footer: float = 35.0) -> List[List[Dict]]:
    chars = [c for c in chars if header < c['y0'] < (page_h - footer)]
    if not chars:
        return []
    is_mark = lambda c: c['comb'] or c['sup']
    primaries = sorted((c for c in chars if not is_mark(c)), key=lambda c: c['y1'])
    marks = [c for c in chars if is_mark(c)]

    rows: List[Dict] = []
    for c in primaries:
        if rows and (c['y1'] - rows[-1]['anchor']) <= 10.0:
            rows[-1]['chars'].append(c)
        else:
            rows.append({'anchor': c['y1'], 'chars': [c]})

    if not rows:  # only marks (degenerate) — keep them as one row
        rows = [{'anchor': marks[0]['y1'], 'chars': []}] if marks else []

    for m in marks:
        nearest = min(rows, key=lambda r: abs(r['anchor'] - m['y1']))
        nearest['chars'].append(m)

    out = []
    for r in rows:
        r['chars'].sort(key=lambda c: (round(c['x0'], 1), 0 if c['comb'] else 1))
        _fill_holding_runs(r['chars'])
        out.append(r['chars'])
    return out


def _fill_holding_runs(row: List[Dict]) -> None:
    """Ensure one logical box maps to one contiguous holding span: fill any base char that
    sits between a box's first and last matched character (a wide glyph whose centre fell just
    outside the box, or an intervening space) with that box, so emission yields a single span
    per box rather than splitting it."""
    extents: Dict[int, list] = {}
    for idx, ch in enumerate(row):
        bid = ch['box_id']
        if bid is not None:
            if bid not in extents:
                extents[bid] = [idx, idx, ch['holding']]
            else:
                extents[bid][1] = idx
    for bid, (lo, hi, kind) in extents.items():
        for idx in range(lo, hi + 1):
            ch = row[idx]
            if not (ch['comb'] or ch['sup']):
                ch['box_id'] = bid
                ch['holding'] = kind


def _classify_row(row: List[Dict], seen_shloka: bool) -> str:
    primaries = [c for c in row if not c['comb'] and not c['sup']]
    if not primaries:
        primaries = row
    big = max(primaries, key=lambda c: c['size'])
    sz, col = big['size'], big['color']
    text = ''.join(c['c'] for c in primaries).strip()
    gray = _is_gray(col)
    italic = any(c['italic'] for c in primaries)

    if sz >= 21:
        return 'title'
    if sz >= 17 and gray:
        return 'subtitle'
    if sz >= 15:
        return 'shloka'
    # small text (≈11pt): comment/source vs translation
    if gray or italic:
        is_citation = bool(_CITATION_RE.search(text)) or \
            any(w in text.lower() for w in _CITATION_WORDS)
        if is_citation or not seen_shloka:
            return 'comment'
        return 'translation'
    return 'body'


# ── HTML emission ────────────────────────────────────────────────────────────
def _char_inner_html(ch: Dict) -> str:
    """Inline markup for a single character, WITHOUT the holding wrapper (handled by the
    caller so accents/change/superscripts nest inside the holding span)."""
    t = unicodedata.normalize('NFC', _map_pua(ch['c']))
    if not t:
        return ''
    esc = html.escape(t)
    # Pause pipe first, so a blue '|' is a short-pause, never a change-style glyph.
    if ch['pause'] == 'long':
        return f'<span class="ql-long-pause">{esc}</span>'
    if ch['pause'] == 'short':
        return f'<span class="ql-short-pause">{esc}</span>'
    if ch['comb']:
        # Vedic accent glyph (svarita/anudātta/udātta/tick) → styled svara span,
        # exactly as the editor encodes it (renders red, positioned).
        return f'<span class="ql-svara-true">{esc}</span>'
    # Change-style and superscript COMPOSE: a superscript transformation glyph (e.g. the
    # visarga ḥ→ḥᶠ annotation) is both blue change-style AND superscript — native form is
    # <sup><span class="ql-change-style">…</span></sup>.
    if ch['color'] == CHANGE_BLUE:
        esc = f'<span class="ql-change-style">{esc}</span>'
    if ch['sup']:
        esc = f'<sup>{esc}</sup>'
    return esc


def _row_to_html(row: List[Dict]) -> str:
    # Holding box per character: base chars carry their own; accents/superscripts inherit the
    # box of the preceding base char (so a held, accented consonant keeps its accent inside
    # the holding span). One contiguous box id → one holding span.
    parts: List[str] = []
    cur_box: Optional[int] = None
    open_holding = False
    last_base_box: Optional[int] = None
    last_base_kind: Optional[str] = None

    for ch in row:
        if ch['comb'] or ch['sup']:
            box = last_base_box
            kind = last_base_kind
        else:
            box = ch['box_id']
            kind = ch['holding']
            last_base_box = box
            last_base_kind = kind

        if box != cur_box:
            if open_holding:
                parts.append('</span>')
                open_holding = False
            cur_box = box
            if box is not None:
                cls = 'ql-holding-long' if kind == 'long' else 'ql-holding-short'
                parts.append(f'<span class="{cls}">')
                open_holding = True

        parts.append(_char_inner_html(ch))

    if open_holding:
        parts.append('</span>')
    return ''.join(parts).strip()


def convert_pdf_to_html(filepath: str) -> str:
    """Convert a Veda Union PDF to Quill-compatible HTML, faithfully (structure + accents +
    holdings + pauses). Raises ImportError if PyMuPDF is missing, ValueError if the PDF has no
    extractable text layer."""
    if not HAS_PYMUPDF:
        raise ImportError('PyMuPDF (pip install pymupdf) is required for PDF import')

    doc = fitz.open(filepath)
    try:
        html_parts: List[str] = []
        seen_shloka = False
        any_text = False
        for pno in range(doc.page_count):
            page = doc[pno]
            chars = _extract_chars(page)
            boxes = _extract_holdings(page)
            _assign_holdings(chars, boxes)
            rows = _cluster_rows(chars, page.rect.height)
            for row in rows:
                style = _classify_row(row, seen_shloka)
                inner = _row_to_html(row)
                if not inner:
                    continue
                if style == 'shloka':
                    seen_shloka = True
                any_text = True
                cls = STYLE_CLASS.get(style, '')
                if cls:
                    html_parts.append(f'<p class="{cls}">{inner}</p>')
                else:
                    html_parts.append(f'<p>{inner}</p>')
                # Group a verse's pādas together and separate verses with an empty
                # paragraph (the editor's native spacer), exactly like saved docs.
                # A verse ends on '॥'; pāda-internal lines end on the single daṇḍa '।'.
                if style == 'shloka':
                    plain = ''.join(c['c'] for c in row).rstrip()
                    if plain.endswith('॥'):
                        html_parts.append('<p class=""><br></p>')
    finally:
        doc.close()

    if not any_text:
        raise ValueError('No extractable text found in PDF (image-only or scanned?)')
    return '\n'.join(html_parts)


def pdf_title(filepath: str) -> str:
    """Best-effort document title: PDF metadata title, else filename stem."""
    import os
    stem = os.path.splitext(os.path.basename(filepath))[0]
    if HAS_PYMUPDF:
        try:
            doc = fitz.open(filepath)
            t = (doc.metadata or {}).get('title') or ''
            doc.close()
            if t.strip():
                return t.strip()
        except Exception:
            pass
    return stem
