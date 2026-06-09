---
description: "Task list for Faithful (1-to-1) Veda Union PDF Import"
---

# Tasks: Faithful (1-to-1) Veda Union PDF Import

**Branch**: `main` — no git operations. **Tests**: included (explicitly requested: "test it").

All implementation lives in `pdf_import.py` (single module). Since it's one file, most tasks are
sequential (same-file), not `[P]`. Story labels: US1 holdings, US2 pauses, US3 002-regression,
US4 audio round-trip.

## Phase 1: Setup
- [ ] T001 Confirm `PyMuPDF` present in `requirements.txt` (already there) and sample PDF resolves
  via the existing `_CANDIDATES` list in `tests/test_pdf_import.py`. No new deps.

## Phase 2: Foundational — char-aware reconstruction (BLOCKS all stories)
- [ ] T002 `_extract_chars(page)` in `pdf_import.py` — `page.get_text("rawdict")` → per-char
  records `{c,font,size,color,sup,italic,x0,x1,y0,y1,comb}`; skip whitespace-only. Replaces
  `_extract_spans` as the reconstruction source.
- [ ] T003 `_cluster_rows(chars, page_h)` — char-granularity two-pass: drop header/footer
  y-bands; cluster base (non-comb, non-sup) chars into rows by baseline (≤10pt); attach each
  combining/superscript char to the nearest row; sort each row by (x, combining-before-base).
- [ ] T004 `_classify_row(row, seen_shloka)` — port existing size/color/gray/italic/citation
  logic to char records (largest base char drives size+color). Same thresholds as 002.
- [ ] T005 `_row_to_html(row)` baseline rewrite over chars (no holdings/pauses yet): combining →
  `ql-svara-true`; blue (`CHANGE_BLUE`, non-pipe) → `ql-change-style`; `sup` → `<sup>`
  (compose); PUA map; NFC per unit; escape. Must keep line-1 byte-exact.
- [ ] T006 Rewire `convert_pdf_to_html` to call the new char path; keep page loop, verse
  grouping (empty `<p>` after `॥`), `ValueError` on no text, `ImportError` on no PyMuPDF.
- **Checkpoint**: existing `tests/test_pdf_import.py` (002 assertions) passes on the char engine.

## Phase 3: US1 — Holdings imported exactly (Priority: P1) 🎯
- [ ] T007 [US1] Add constants `HOLDING_GREEN=(0.324,0.508,0.207)`, `HOLDING_EDGE_THRESHOLD=0.5`.
- [ ] T008 [US1] `_extract_holdings(page)` — `page.get_drawings()`, filter green fills
  (per-channel tol 0.05), union-find cluster edge rects by bbox overlap (±1pt) → logical boxes
  with bounds + `thick=min(min(w,h))` + `kind='long' if thick>=0.5 else 'short'`.
- [ ] T009 [US1] Overlay in `_cluster_rows` (or a post-pass): for each row baseline, for each box
  with `|box.yc−baseline|<10`, tag the contiguous base chars with center-x ∈ [x0−1,x1+1] as
  `holding=kind`, set `hold_start`/`hold_end`.
- [ ] T010 [US1] In `_row_to_html`, open `ql-holding-short|long` at `hold_start`, close at
  `hold_end`, emitting inner accent/change/sup markup **inside** the holding span (correct
  nesting for held+accented chars).
- [ ] T011 [US1] [TEST] holdings: count of `ql-holding-short`+`ql-holding-long` spans (p1) == 83;
  short/long split matches edge clusters; ≥1 multi-char run (bh/tt/ddh); ≥1 holding containing a
  `ql-svara-true`; no accent/change lost under a holding.

## Phase 4: US2 — Pause marks (Priority: P1)
- [ ] T012 [US2] Add `PAUSE_LONG_RED=0xc00000`, `PAUSE_SHORT_BLUE=0x0070c0`; in `_extract_chars`
  tag `c=='|'` with color≈red→`pause='long'`, color≈blue→`pause='short'`.
- [ ] T013 [US2] In `_row_to_html`, emit `ql-long-pause`/`ql-short-pause` for tagged pipes
  (checked before change-style so a blue pipe is never change-style); leave black `।`/`॥` plain.
- [ ] T014 [US2] [TEST] pauses: each red `|`→`ql-long-pause`, blue `|`→`ql-short-pause`; no blue
  pipe as `ql-change-style`; daṇḍas not wrapped in a pause span.

## Phase 5: US3 — 002 regression gate (Priority: P1)
- [ ] T015 [US3] [TEST] Keep ALL feature-002 assertions in the test file and confirm green:
  line-1 exact, title/subtitle/comment/translation counts, no header, no PUA/tofu, no stranded
  accents on gray lines. (This is the safety net for the char rewrite.)
- [ ] T016 [US3] [TEST] edge-thickness clusters straddle 0.5 (thin<0.5 cluster + thick≥0.5
  cluster both present); graceful: a no-green / plain PDF yields zero holding/pause spans.

## Phase 6: US4 — Audio round-trip (Priority: P2)
- [ ] T017 [US4] Confirm `align_service.py` still builds chant targets correctly from the new
  markup (it strips HTML to text for alignment; verify holding/pause spans don't corrupt the
  target text). No code change expected — verification + a guard test if needed.
- [ ] T018 [US4] [TEST/VERIFY] `tests/manual_e2e.py` against the real PDF + cached YouTube mp3:
  shloka lines placed, translation/title/subtitle/comment skipped. (Manual run; capture output.)
- [ ] T019 [US4] [VERIFY] `.smdoc` round-trip: import → save → reload preserves holding/pause/
  accent markup byte-identically (quick script using `smdoc` read/write path).

## Phase 7: Polish
- [ ] T020 Update `CLAUDE.md` (PDF import now imports holdings/pauses faithfully) and the
  "Relation to … Import" note in `documents/audio-editing-and-matching.md`.
- [ ] T021 Run full suite `python -m pytest tests/ -q`; confirm all green (was 13).

## Dependencies
Setup(T001) → Foundational(T002→T003→T004→T005→T006) → US1(T007→T008→T009→T010→T011) →
US2(T012→T013→T014) → US3(T015,T016) → US4(T017→T018→T019) → Polish(T020,T021).
US1 and US2 both edit `_row_to_html`/`_extract_*` so run sequentially (same file).

## Notes
- No git commits/branches/pushes.
- The box→char overlay, edge-thickness threshold, and color map are all pre-measured in
  `research.md`; implementation is wiring measured facts, not re-discovery.
- Faithfulness beats the grammar "first consonant only" heuristic: wrap exactly the boxed chars.
