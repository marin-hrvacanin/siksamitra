# Implementation Plan: Faithful (1-to-1) Veda Union PDF Import

**Branch**: `main` (no git operations) | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-faithful-pdf-import/spec.md`

## Summary

Rework `pdf_import.py` from **span-aware** to **character-aware** reconstruction so the
importer can overlay the PDF's vector **holding boxes** and colored **pause pipes** onto the
exact characters they belong to, emitting the editor's native inline markup. Holdings come
from the green vector layer (`page.get_drawings()`), classified short/long by border edge
thickness, and matched to the base character(s) whose horizontal extent falls inside the box.
Pause pipes are classified by glyph color in the text layer. Everything feature 002 already
produces (structure, accents, change-style, superscripts, verse grouping, header/footer
removal) is preserved through the rewrite. The result is a document indistinguishable from one
authored in the editor, ready for audio mapping (chant-only) and `.smdoc` round-trip.

## Technical Context

**Language/Version**: Python 3.14 (CPython); JS (ES2020+) only for the already-wired open flow.

**Primary Dependencies**: PyMuPDF (`fitz`) — already in `requirements.txt`, guarded by
`HAS_PYMUPDF`. Stdlib `html`, `re`, `unicodedata`. No new dependencies.

**Storage**: Output is Quill-compatible HTML consumed by `/api/file/import-pdf` (already
wired in `editor.py` and `document-manager.js`); persisted as `.smdoc` by the existing path.

**Testing**: pytest (`tests/test_pdf_import.py`), extended; existing `tests/manual_e2e.py`
for the PDF→YouTube→map visual run.

**Target Platform**: Windows 11 desktop (PyQt6 + Flask), fully offline.

**Project Type**: Desktop app — single Python module (`pdf_import.py`) feeding the existing
editor import contract. No new architecture.

**Performance Goals**: Import of a 2-page PDF in well under a second; not a hot path.

**Constraints**: Local/offline; never crash; degrade gracefully on PDFs lacking holdings,
pauses, or a text layer. No git commits/branches/pushes.

**Scale/Scope**: One module rewrite (~250–350 lines) + test extension + a one-line doc note.
No changes to the Flask endpoint signature, the JS open flow, or the alignment engine.

## Constitution Check

The project constitution is an unfilled template (no ratified principles), so there are no
formal gates. The de-facto project rules from `CLAUDE.md` and the handoff are honored:

- **Faithful import** — reproduce the source exactly (this feature's entire purpose). ✅
- **Local/offline, no cloud.** ✅ (PyMuPDF only)
- **No git side-effects.** ✅ (work in tree on `main`)
- **Reuse the existing import contract** (Quill `<p class="ql-…">` like DOCX). ✅
- **Match native editor markup** (verified against saved `.smdoc`). ✅
- **Tests included.** ✅

No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-faithful-pdf-import/
├── plan.md              # This file
├── research.md          # Phase 0: measured PDF facts + algorithm decisions
├── data-model.md        # Phase 1: Char / HoldingBox / Row entities
├── quickstart.md        # Phase 1: how to run/verify
├── contracts/
│   └── pdf_import_api.md # Phase 1: convert_pdf_to_html contract + markup contract
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
pdf_import.py                 # REWRITTEN char-aware + holding/pause extraction (the feature)
editor.py                     # UNCHANGED — /api/file/import-pdf already calls convert_pdf_to_html
document-manager.js           # UNCHANGED — .pdf open flow already routes here
align_service.py              # UNCHANGED — already skips title/subtitle/comment/translation
tests/test_pdf_import.py      # EXTENDED — holdings count/type/nesting, pauses, line-1 regression
tests/manual_e2e.py           # UNCHANGED — used for the visual PDF→audio verification
CLAUDE.md                     # one-line note: PDF import now imports holdings/pauses faithfully
documents/audio-editing-and-matching.md  # update the "Relation to … Import" note
```

**Structure Decision**: Single-module change. `convert_pdf_to_html(filepath) -> str` keeps its
signature and return contract (Quill HTML), so all wiring (endpoint, JS, tests) is untouched.
All new logic lives inside `pdf_import.py` as private helpers.

## Approach (phased build)

### Phase A — Character-aware reconstruction (replaces span-aware)
1. `_extract_chars(page)` via `page.get_text("rawdict")` → per-character records
   `{c, font, size, color, sup, italic, x0, x1, y0, y1, comb}` (drop whitespace-only).
2. `_cluster_rows(chars, page_h)` — same two-pass idea as today but at char granularity:
   drop header/footer y-bands; cluster non-combining/non-superscript base chars into rows by
   baseline (y1, ≤10pt gap); attach each combining/superscript char to the nearest row; sort
   each row by (x, combining-before-base).
3. `_classify_row(row, seen_shloka)` — unchanged logic, now over chars (largest base char's
   size+color; gray/italic detection; citation heuristics).

### Phase B — Holding extraction & overlay
4. `_extract_holdings(page)` — `page.get_drawings()`, keep fills ≈ (0.324,0.508,0.207);
   union-find cluster the edge rectangles into logical boxes by bbox adjacency/overlap;
   per box compute bounds + min edge thickness → `kind = 'long' if thick ≥ 0.5 else 'short'`.
5. Overlay: for each row, for each box on that row's baseline, select the contiguous run of
   **base** chars whose center-x ∈ [box.x0, box.x1] (small tolerance); tag those chars with
   `holding=kind` and run start/end flags.

### Phase C — Pause classification
6. In `_extract_chars`, tag pipe glyphs: `c == '|'` and color≈`c00000` → `pause='long'`;
   `c == '|'` and color≈`0070c0` → `pause='short'`. (Checked before change-style so a blue
   pipe is never treated as change-style.)

### Phase D — HTML emission with correct nesting
7. `_row_to_html(row)` walks chars in order and emits, with holding as the **outer** wrapper:
   - open `<span class="ql-holding-short|long">` at a holding-run start, close at its end;
   - inside: combining → `<span class="ql-svara-true">◌</span>`; pause → the pause span;
     blue (non-pipe) → `ql-change-style`; superscript → `<sup>` (composing with change-style);
   - PUA→Unicode map; NFC-normalize per emitted unit; never emit tofu.
8. `convert_pdf_to_html` — unchanged outer loop (per page: rows → classify → emit `<p>`,
   verse grouping with empty-paragraph separators, `ValueError` if no text).

### Phase E — Tests & docs
9. Extend `tests/test_pdf_import.py`: holding count == green-box count (83 p1) with correct
   short/long; nesting cases (bh/tt/ddh; held+accent); pauses (red→long, blue→short, daṇḍa
   untouched, no blue-pipe-as-change); line-1 regression + all 002 assertions still pass.
10. Update `CLAUDE.md` + `documents/audio-editing-and-matching.md` notes.

## Risks & Mitigations

- **Box→char tolerance**: too tight misses chars, too loose grabs vowels. *Mitigation*:
  center-based containment with ±1pt; measured boxes are tight around consonants (validated).
- **Edge-thickness threshold**: observed clusters are {0.12,0.24} vs {0.96}. *Mitigation*:
  threshold 0.5 sits in the wide gap; assert the two clusters in a test.
- **NFC + span boundaries**: combining marks must stay attached. *Mitigation*: keep accents in
  their own `ql-svara-true` span exactly as feature 002 and saved docs do; normalize per unit.
- **Regression on 002 behavior**: the rewrite shares the path. *Mitigation*: keep all 002
  assertions in the test file; line-1 byte-exact gate.

## Complexity Tracking

No constitution violations; section intentionally empty.
