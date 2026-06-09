---
description: "Tasks for fused, bleed-free alignment"
---

# Tasks: Fused, bleed-free alignment

**Branch**: `main` — no git. New module `align_fused.py`; wiring in `align_service.py`; small JS in
`dialog-audio-editor.js`/`editor-quill.js` for fades; tests in `tests/`.

## Phase 1: Core refinement (Foundational)
- [ ] T001 `align_fused.refine(placed, targets, silences, speech_span, opts)` — order+anchors;
  rhythm-fill between anchors (mātrā weights); bleed-free boundary snapping (silence gap → neither,
  else inward trim); edge snap; fades; confidence recompute; keep unassigned honest. Pure function.
- [ ] T002 Boundary-strategy switch in opts: `'silence_gap'` (default) vs `'inward_only'` (A/B).
- [ ] T003 Anchor selection: cross-signal agreement (MMS↔phonetic within tol) OR high single-signal
  confidence; enforce monotonic order (drop order-violating lower-confidence anchors).

## Phase 2: Fuse the two drivers
- [ ] T004 In `align_service.run`, when MMS succeeds also (cheaply) get phonetic spans if recognition
  ran, OR pass MMS confidences; build anchor set from agreement. (If only one driver available, it is
  the sole anchor source.)
- [ ] T005 Call `align_fused.refine(...)` as the final stage for the chant regions; emit
  `fadeIn`/`fadeOut` per region in the response dict.

## Phase 3: Apply fades in the UI
- [ ] T006 JS `installRegionsFromMapped` (dialog-audio-editor.js) reads optional `fadeIn`/`fadeOut`
  from mapped regions; `_applyAudioEditorResult` / region apply carries them through (already supports
  fades) so the suggested small fades persist.

## Phase 4: Test + A/B (the deliverable proof)
- [ ] T007 [TEST] Unit-test `refine` with synthetic placed regions + silences: asserts 0 overlaps,
  boundaries on silence when present, inward-trim when not, edges snapped, fades set. (`tests/`)
- [ ] T008 [TEST] Extend `tests/manual_e2e.py`: print overlap count, %boundaries-on-silence, duration
  spread, in-order, coverage — for the raw engine vs refined, and for both boundary strategies.
- [ ] T009 Run the sample (bhū sūktam + `u_FzN8wdHg0`); confirm SC-001 (0 overlaps, ≥90% on silence),
  SC-002 (≥31 placed, in-order), SC-003 (duration sane); pick the winning strategy; record results.
- [ ] T010 [TEST] svara-off variant: strip svaras from targets, re-run, confirm placement count
  changes ≤1 (SC-004).

## Phase 5: Polish
- [ ] T011 Update `documents/audio-editing-and-matching.md` + CLAUDE.md mapping section to describe
  the fused engine and bleed-free boundaries.
- [ ] T012 `python -m pytest tests/ -q` green; `node --check` changed JS.

## Dependencies
T001→T002/T003 → T004→T005 → T006 ; T007 after T001 ; T008/T009/T010 after T005 ; T011/T012 last.

## Notes
No git. Refinement is additive/engine-agnostic. GUI not testable here → structural metrics + unit
tests + user listening UAT. Keep word-splittable (boundaries computed per adjacent pair → extensible).
