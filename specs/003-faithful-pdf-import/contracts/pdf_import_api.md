# Contract: pdf_import.py

## Public API (unchanged signatures)

```python
def convert_pdf_to_html(filepath: str) -> str
def pdf_title(filepath: str) -> str
HAS_PYMUPDF: bool
```

- `convert_pdf_to_html(filepath)`:
  - **Returns** newline-joined Quill-compatible `<p>` HTML (same contract as
    `convert_docx_to_html` in `editor.py`).
  - **Raises** `ImportError` if PyMuPDF absent; `ValueError` if the PDF has no extractable text.
  - **Side-effects**: none (read-only on the file; opens & closes the doc).
- `pdf_title(filepath)`: PDF metadata title or filename stem (unchanged).

Consumers (NONE require changes):
- `editor.py` → `POST /api/file/import-pdf` calls `convert_pdf_to_html` + `pdf_title`.
- `document-manager.js` routes `.pdf` opens to that endpoint.

## Output markup contract (the 1-to-1 guarantee)

Emitted inline classes — exactly the editor's native save format:

- `<span class="ql-holding-short">…</span>` / `<span class="ql-holding-long">…</span>`
- `<span class="ql-short-pause">|</span>` / `<span class="ql-long-pause">|</span>`
- `<span class="ql-svara-true">◌</span>` (combining accent on its base)
- `<span class="ql-change-style">…</span>`
- `<sup>…</sup>` (composes with change-style)

Paragraph classes (unchanged): `ql-doc-title`, `ql-doc-subtitle`, `ql-comment-style`,
`ql-doc-translation`, and `''` for shloka/body.

Nesting rule: **holding is the outermost inline wrapper**; accent / change-style / superscript
markup for the held characters is emitted inside it.

## Calibration constants

```python
ACCENT_RED      = 0x943634   # combining Vedic accent glyphs  (unchanged)
CHANGE_BLUE     = 0x0070c0   # change-style transformation glyphs (unchanged)
GRAY_SUBTITLE   = 0x7e7f7e   # subtitle gray (unchanged)
GRAY_ITALIC     = 0x7f807f   # comment/translation gray (unchanged)
PAUSE_LONG_RED  = 0xc00000   # NEW — long-pause pipe color
PAUSE_SHORT_BLUE= 0x0070c0   # NEW — short-pause pipe color (== CHANGE_BLUE; disambiguated by '|')
HOLDING_GREEN   = (0.324, 0.508, 0.207)  # NEW — green box fill (per-channel tol 0.05)
HOLDING_EDGE_THRESHOLD = 0.5             # NEW — border thickness short/long split
```

## Test contract (`tests/test_pdf_import.py`, extended)

Skips if PyMuPDF or the sample PDF is unavailable (suite stays green without them).

1. **Regression (002 preserved)**: line 1 == `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।`;
   title≥1, subtitle≥1, comment present, translations≥5; no header string; no PUA/tofu; no
   stranded accents on gray lines.
2. **Holdings count & type**: number of `ql-holding-short` + `ql-holding-long` spans on page 1
   == number of green boxes detected (83); short/long split matches edge-thickness clusters.
3. **Holding nesting**: at least one holding span contains a multi-char run (e.g. `bh`/`tt`/`ddh`);
   at least one holding span contains a `ql-svara-true` accent inside it; no accent or
   change-style mark is lost when wrapped by a holding.
4. **Pauses**: every red `|` → `ql-long-pause`; every blue `|` → `ql-short-pause`; no blue pipe
   emitted as `ql-change-style`; black `।`/`॥` not wrapped in any pause span.
5. **Edge-thickness clusters**: the observed per-box thickness set straddles the 0.5 threshold
   (thin cluster < 0.5, thick cluster ≥ 0.5).
6. **Graceful**: a text blob / non-Veda PDF (or absence of green boxes) yields zero holding/pause
   spans and does not raise.
