# Data Model: Faithful PDF Import

In-memory entities inside `pdf_import.py` (no persistence schema; output is HTML).

## Char (per-character record)

Produced by `_extract_chars(page)` from `page.get_text("rawdict")`.

| Field | Type | Source / meaning |
|-------|------|------------------|
| `c` | str | the glyph (single char; PUA-mapped later) |
| `font` | str | span font name |
| `size` | float | span size, rounded 0.1 |
| `color` | int | span color (0xRRGGBB) |
| `sup` | bool | span flags & 1 (superscript) |
| `italic` | bool | span flags & 2 (italic) |
| `x0,x1` | float | char bbox horizontal extent |
| `y0,y1` | float | char bbox vertical extent (y1 = baseline-ish bottom) |
| `comb` | bool | `unicodedata.combining(c)` or category 'Mn' |
| `holding` | 'short'|'long'|None | assigned during overlay (Phase B) |
| `hold_start`/`hold_end` | bool | first/last char of a holding run (span open/close) |
| `pause` | 'short'|'long'|None | assigned for colored `\|` glyphs (Phase C) |

Derived: `xc = (x0+x1)/2`, `yc = (y0+y1)/2`.

## HoldingBox

Produced by `_extract_holdings(page)` from `page.get_drawings()`.

| Field | Type | Meaning |
|-------|------|---------|
| `x0,y0,x1,y1` | float | union bounds of the box's edge rectangles |
| `thick` | float | min over edge rects of `min(width,height)` (border stroke width) |
| `kind` | 'short'|'long' | `'long' if thick >= 0.5 else 'short'` |

Derived: `xc,yc` box center, used to bind the box to a row baseline.

Construction: filter green fills (≈ (0.324,0.508,0.207), per-channel tol 0.05) → union-find
cluster member rects by bbox overlap (±1pt) → one HoldingBox per cluster.

## Row (logical line)

Produced by `_cluster_rows(chars, page_h)`: a list of `Char` (base chars + attached
combining/superscript chars), sorted left→right with combining marks placed just before their
base. Classified by `_classify_row(row, seen_shloka)` into one of:
`title | subtitle | comment | shloka | translation | body`.

`STYLE_CLASS` maps style → paragraph class (unchanged from 002):
`title→ql-doc-title, subtitle→ql-doc-subtitle, comment→ql-comment-style,
translation→ql-doc-translation, shloka→'' , body→''`.

## Overlay relation (HoldingBox → Char)

For each row R and each box B with `|B.yc − R_baseline| < 10`:
the matched chars = contiguous base chars `ch ∈ R` with `B.x0−1 ≤ ch.xc ≤ B.x1+1`.
Set `ch.holding = B.kind` for all matched; `hold_start` on the first, `hold_end` on the last.
(One box → one contiguous run → one holding span.)

## Output: Imported document

`convert_pdf_to_html(filepath) -> str` — newline-joined `<p>` paragraphs (Quill-compatible),
identical contract to `convert_docx_to_html`. Verse grouping: shloka pādas are consecutive
`<p>`; a shloka line ending on `॥` is followed by `<p class=""><br></p>`. Raises `ImportError`
if PyMuPDF missing, `ValueError` if no extractable text.

### Inline markup emitted (the 1-to-1 contract)

| Source feature | Emitted HTML |
|----------------|--------------|
| short holding box | `<span class="ql-holding-short">…</span>` (outer) |
| long holding box | `<span class="ql-holding-long">…</span>` (outer) |
| Vedic accent (combining, red) | `<span class="ql-svara-true">◌̍</span>` (inside holding if held) |
| change-style glyph (blue, non-pipe) | `<span class="ql-change-style">…</span>` |
| superscript flag | `<sup>…</sup>` (composes: `<sup><span class="ql-change-style">…</span></sup>`) |
| short-pause pipe (blue `\|`) | `<span class="ql-short-pause">\|</span>` |
| long-pause pipe (red `\|`) | `<span class="ql-long-pause">\|</span>` |
| daṇḍa `।` / `॥` (black) | plain text |
| PUA glyph | mapped via `_PUA_MAP` or dropped (never tofu) |
