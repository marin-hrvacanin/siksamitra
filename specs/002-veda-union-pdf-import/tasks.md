---
description: "Task list for Veda Union PDF Import"
---

# Tasks: Veda Union PDF Import

**Branch**: `main` — no git operations. **Tests**: included.

## Phase 1: Setup
- [X] T001 Add `PyMuPDF` to `requirements.txt` (optional import, guarded; offline).
- [X] T002 Copy the test PDF into `tests/fixtures/` (or reference the Downloads path) for `test_pdf_import.py`.

## Phase 2: Foundational — `pdf_import.py` (the engine)
- [X] T003 `_extract_spans(page)` → list of {text, font, size, color, flags, x, y, x1, y1}; skip blank.
- [X] T004 `_cluster_rows(spans, page_h)` — drop header/footer by y-band; **two-pass**: (1) cluster primary (non-combining, non-superscript) spans into rows by baseline; (2) attach each combining/superscript span to the nearest primary-row baseline. Returns rows (lists of spans).
- [X] T005 `_row_text(row)` — sort spans by (x, combining-before-base); concatenate; NFC-normalize; map PUA glyphs via `_PUA_MAP`; return text.
- [X] T006 `_classify_row(row, seen_shloka)` — title(sz≥21) / subtitle(sz≥17 & gray) / shloka(sz≥15 black) / comment(gray-italic ≤12 & (citation-like or not seen_shloka)) / translation(gray-italic ≤12 after a shloka). Fallback → body.
- [X] T007 `_row_to_html(row, style)` — emit inner HTML: accents inline (combining chars); blue (`0x0070c0`) runs → `<span class="ql-change-style">…</span>`; superscript flag → `<sup>…</sup>`; escape.
- [X] T008 `convert_pdf_to_html(path)` — open doc; per page reconstruct+classify rows; map style→class (title→ql-doc-title, subtitle→ql-doc-subtitle, comment→ql-comment-style, translation→ql-doc-translation, shloka→''); join `<p>`; raise/sentinel if no text layer.

## Phase 3: US1 — Import wiring
- [X] T009 `editor.py`: `HAS_PYMUPDF` guard + import `pdf_import`; `POST /api/file/import-pdf` mirroring `/api/file/import-docx` (returns {content, title}); add `.pdf` to the open-file dialog filter.
- [X] T010 `file-operations.js` (+ open flow): route `.pdf` selection through the import endpoint like `.docx`.
- [X] T011 [TEST] `tests/test_pdf_import.py`: line-1 == `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।`; title/subtitle/comment counts; no header strings in output; no stranded accents on gray lines; no PUA/replacement chars.

## Phase 4: US2 — Mapping excludes non-chant
- [X] T012 `align_service.py`: levels in {title, subtitle, comment, translation} → response status `skipped`, excluded from `fuse`, not counted as `unassigned`.
- [X] T013 [TEST] extend fuse/service test: skipped levels get no region and are reported skipped.

## Phase 5: US3 + Polish
- [X] T014 Graceful degradation: non–Veda-Union PDF → body paragraphs; image-only → clear "no text" error (not a crash).
- [X] T015 [TEST] End-to-end: import the real PDF (HTML), then map the YouTube recording to the shloka lines via the engine; verify shlokas placed, translations skipped.
- [X] T016 Docs: note PDF import in CLAUDE.md (Key Files + an Import section).

## Dependencies
Setup → Foundational (T003→T004→T005/T006/T007→T008) → US1 wiring/test → US2 → US3/polish.

## Notes
- No git commits/branches/pushes.
- Reconstruction algorithm already prototyped against the real file (line-1 exact); main remaining work is the two-pass clusterer + classification + wiring.
