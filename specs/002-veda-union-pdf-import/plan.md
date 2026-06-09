# Implementation Plan: Veda Union PDF Import

**Branch**: `main` (no git ops per user) | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

## Summary

Add local PDF import that converts a Veda Union–styled PDF into the editor's existing Quill HTML (the same `<p class="ql-…">` contract DOCX import already produces). A new `pdf_import.py` uses **PyMuPDF** to read spans (text + font + size + color + position + flags), reconstructs logical rows with a **two-pass clusterer** (the validated fix for accent leakage), classifies each row into title / subtitle / comment / shloka / translation (dropping headers/footers), and reattaches Vedic accent glyphs to the correct base characters. A new `/api/file/import-pdf` endpoint + open-file wiring expose it. Audio mapping is updated to skip non-chant levels.

This plan was preceded by a working prototype against the real file: reconstruction already produces `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।` correctly; the prototype exposed exactly one bug (top-y clustering leaks a shloka's accents into the preceding 11pt line) which the two-pass clusterer fixes.

## Technical Context

**Language**: Python 3.14 (backend) + JS (frontend wiring).
**New dependency**: `PyMuPDF` (fitz) 1.27 — installed. Rich per-span font/size/color/bbox/flags; best fit for structure + accent-position reconstruction. Pure-wheel, offline.
**Reused**: the DOCX-import HTML contract & open-file flow (`convert_docx_to_html`, `/api/file/import-docx`, file-operations open dialog), the editor paragraph CSS classes, the unified alignment engine (feature 001).
**Calibration constants** (from analyzing the real PDF):
- Colors: accent red `0x943634`; change-style blue `0x0070c0`; gray subtitle `0x7e7f7e`; gray italic comment/translation `0x7f807f`.
- Sizes: title ≈22, subtitle ≈18 (gray), shloka ≈16 (black), accents ≈18 (red, combining), comment/translation ≈11 (gray italic), superscripts ≈10.6.
- Header band: top y < ~35; footer band: y > pageHeight−35.
- PUA glyphs (e.g. `` candrabindu) → map to Unicode (`ṁ`/`m̐`) or drop.

## Constitution Check

Constitution is the unfilled template → no gates. Adheres to de-facto rules: offline, reuse over rewrite (mirrors DOCX import; reuses HTML contract & alignment), graceful degradation. One new dependency (PyMuPDF) justified — no stdlib/PyPDF2 path exposes per-span position/color needed for accent reattachment and header detection. **PASS.**

## Project Structure

```text
pdf_import.py            # NEW: PyMuPDF extraction → rows → classify → Quill HTML
  convert_pdf_to_html(path) -> str           # public entry (mirrors convert_docx_to_html)
  _extract_spans(page)                        # spans with text/font/size/color/bbox/flags
  _cluster_rows(spans, page_h)                # TWO-PASS: primary rows, then attach marks
  _classify_row(row) -> ('title'|'subtitle'|'comment'|'shloka'|'translation'|None)
  _row_to_html(row, style)                    # accents inline; blue→ql-change-style; sup→<sup>; PUA map
  _PUA_MAP, color/size constants

editor.py                # MODIFIED: HAS_PYMUPDF guard; /api/file/import-pdf endpoint;
                         #           open-file dialog accepts .pdf
file-operations.js       # MODIFIED: route .pdf through import (like .docx)
editor-quill.js / file-operations: open dialog filter add *.pdf

align_service.py         # MODIFIED: skip non-chant levels {title,subtitle,comment,translation}
                         #           → status 'skipped' (not 'unassigned'); excluded from fuse

tests/
  test_pdf_import.py      # reconstruct from the real PDF: line-1 exact match, classification
                          # counts, no stranded accents, no PUA tofu, headers dropped
```

**Structure Decision**: PDF logic in its own importable `pdf_import.py` (testable without Flask), exposed via an endpoint mirroring DOCX. Frontend reuses the existing import/open path. Alignment gains a small level filter.

### Reconstruction algorithm (the core, validated)
1. Extract spans; drop header/footer by y-band.
2. **Pass 1** — cluster *primary* spans (non-combining, non-superscript) into rows by baseline (≈ font rows 24px apart).
3. **Pass 2** — assign each combining-accent / superscript span to the *nearest primary row baseline* (fixes the leak: an accent at y≈128 binds to base row y≈135, not the comment at y≈115).
4. Within a row, sort by x; at equal x a combining mark sorts **before** the following base span so it attaches to the preceding base char → correct Unicode.
5. Classify by size+color+position (+ "before first shloka / citation-pattern" → comment vs translation).
6. Emit `<p class>`: accents stay inline as combining chars; blue runs → `ql-change-style`; superscripts → `<sup>`; map PUA glyphs.

## Complexity Tracking

No violations. One new dependency (PyMuPDF) recorded above with justification.
