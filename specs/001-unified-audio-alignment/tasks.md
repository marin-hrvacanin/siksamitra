---
description: "Task list for Unified Automatic Audio-to-Text Mapping"
---

# Tasks: Unified Automatic Audio-to-Text Mapping

**Input**: Design documents from `specs/001-unified-audio-alignment/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/align-run.md
**Tests**: INCLUDED (the spec's quickstart defines a pytest suite).
**Branch**: `main` — no git operations (no branch/commit/push) per user request.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: parallelizable (different files, no incomplete-dependency)
- **[Story]**: US1 (one-action full mapping), US2 (partial/out-of-order), US3 (review/edit/persist)

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create `tests/` and `tests/fixtures/` directories at repo root for backend alignment tests.
- [X] T002 [P] Add a `tests/fixtures/synthetic.py` helper that generates tiny in-memory 16 kHz mono PCM clips of N silence-delimited "word" segments (sine bursts), returning `(samples, sr, segment_times)` — for deterministic fusion tests with no shipped audio.
- [X] T003 [P] Update `requirements.txt`: keep `numpy/scipy/librosa`; remove `faster-whisper` pin only if present-as-required → make it a documented soft dependency; add a comment documenting the OPTIONAL Sanskrit model (`ct2-transformers-converter` of `Bidwill/whisper-small-sanskrit`). No new required packages.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ The unified engine. All user stories depend on this phase.**

- [X] T004 [P] Create `align_roman.py`: `romanize_iast(text) -> list[str]` (NFD-normalize, drop combining marks, map IAST→shared token alphabet per research.md Decision 4) and `roman_tokens_of(text)` reused by both text and transcript sides. Pure, no I/O.
- [X] T005 [P] Create `align_audio.py` by repurposing `align_dsp.py`: KEEP `decode_audio` + a `decode_16k_mono()` wrapper + RMS/ZCR `detect_silences(samples, sr) -> list[(start,end)]`. Do NOT port the phoneme classifier / pyin / frame classification.
- [X] T005b Add `phonetic_similarity(tok_a, tok_b) -> float` to `align_core.py` (exact=1.0; same-class folds retroflex≈dental, aspirate≈plain, sibilants, nasals ≈0.6–0.8; else 0.0) and expose it for the fusion scorer; keep existing dataclasses/`local_alignment`/`assemble_sections` intact.
- [X] T006 Create `align_recognize.py`: lazy-load cached faster-whisper (`tiny` default, `small` optional) from `cache/models/`, thread-safe; `recognize(samples_16k, sr, model) -> (list[TranscriptToken], (start_s,end_s), diag)` with `word_timestamps=True`, `language='sa'` (fallback `'hi'`), `beam_size=1`, `vad_filter=False`; each token carries `romanTokens` via `align_roman`. Clean `ImportError`/load-failure raise for the degraded path.
- [X] T007 Create `align_fuse.py`: the unified fusion — `fuse(targets, transcript_tokens, silences, speech_span) -> list[PlacedRegion]`:
  (a) build concatenated romanized text-token stream with per-token `targetIndex`;
  (b) phonetic Smith–Waterman (reuse `align_core._sw_numpy` + `phonetic_similarity`, skip-both-sides) text↔transcript → `Anchor`s carrying `audioTime` from token timestamps;
  (c) compute per-target expected-center/half-width from mātrā cumulative fraction × speech_span (positional prior);
  (d) call `align_core.assemble_sections` (monotonic-preferring, non-overlap, neighbor bonus) using anchors + prior;
  (e) fill anchor gaps proportionally by `totalMatras`; snap region boundaries to nearest `silences`;
  (f) set `confidence`/`status` via existing thresholds; emit `channel_breakdown`.
- [X] T008 Gut `align_service.py` to ONE path: `run(request)` → decode (`align_audio`) → recognize (`align_recognize`, degrade on ImportError) → coarsen target events (`align_core.coarsen_text_events`) → `align_fuse.fuse(...)` → assemble `MappingResult` (`engine/regions/unassigned/speech_span/summary/diagnostics`). Remove tier dispatch, `_merge_event_streams`, `_WHISPER_TIERS`. Implement the degraded proportional branch (research Decision 6).
- [X] T009 Simplify `/api/align/*` endpoints in `editor.py`: `/api/align/run` drops `tier` (accepts optional `model`); `/api/align/model/status` + `/download` take `model` not `tier`; import from `align_recognize`/`align_service`; return 200 with `{torch/model unavailable}` info instead of 500 when recognition is absent.
- [X] T010 Fix `editor-quill.js` `_buildTarget` (~line 12851) to forward `events` + `hasSvaras` (already computed in `_buildAudioAlignmentProfile`) onto each target object sent to the dialog (research Decision 7).

**Checkpoint**: Engine callable end-to-end via `/api/align/run`.

---

## Phase 3: User Story 1 — One-action full mapping (Priority: P1) 🎯 MVP

**Goal**: One button maps an entire in-order recording to the text; per-section matched/needs-review/unmatched + summary.
**Independent Test**: Attach a clean in-order chant of a known multi-line text → one click → each line gets a region over its chanted span, matched, playback confirms.

### Tests (write first, expect fail)
- [X] T011 [P] [US1] `tests/test_align_roman.py`: assert IAST→token mappings (ā→a, ī→i, ṛ→ri, ś/ṣ/s→s, ṭ→t, ḍ→d, ṇ→n, ṅ→ng, ñ→ny, aspirate→base+h, ṁ/ṃ→m, ḥ→h) and whitespace/section splitting.
- [X] T012 [P] [US1] `tests/test_align_fuse.py::test_in_order_full` on the T002 synthetic fixture: all targets `matched`, regions overlap true segment times by >50%, summary all-matched.

### Implementation
- [X] T013 [US1] In `dialog-audio-editor.html`: relabel the align control to one **"Map audio to text"** button (`btnAutoAlign`); REMOVE the tier `<select id="alignTierSelect">` and the `btnAutoSplit` button.
- [X] T014 [US1] In `dialog-audio-editor.js`: implement single `autoAlign()` → `POST /api/align/run` (no tier; optional `model`), read `result.engine`/`regions`/`summary`; remove `state.alignTier` + tier localStorage; keep auto-run on dialog open for multi-target.
- [X] T015 [US1] In `dialog-audio-editor.js`: render per-region status badge (matched/needs-review/unmatched) + a summary line (counts) from the response (FR-008, FR-013); reuse existing region-install/list code path.
- [X] T016 [US1] Map `MappingResult.regions` → existing dialog region objects (`start/end/targetIndex/confidence` + status) via the existing install function; ensure playback of a region plays its span.

**Checkpoint**: MVP — one-click confident mapping of a clean recording.

---

## Phase 4: User Story 2 — Partial coverage & out-of-order (Priority: P2)

**Goal**: Absent text → unmatched (never fabricated); out-of-order sections placed at true audio spans; lead/trail noise excluded.
**Independent Test**: Audio missing one line + two swapped → omitted line unmatched, swapped placed correctly, rest intact.

### Tests
- [X] T017 [P] [US2] `tests/test_align_fuse.py::test_partial_coverage`: remove one synthetic segment → that target in `unassigned`, others matched, no false unassign.
- [X] T018 [P] [US2] `tests/test_align_fuse.py::test_out_of_order`: swap two segments → both placed at true times (not text-order slots).
- [X] T019 [P] [US2] `tests/test_align_fuse.py::test_no_speech_degrades`: empty transcript → `engine:"proportional"`, all `warn`, no fabricated `matched`.

### Implementation
- [X] T020 [US2] In `align_fuse.py`: confirm skip-both-sides SW + soft prior yields no-anchor → `unassigned` (confidence < threshold), and tune `prior_weight` so out-of-order local matches still win over the prior; exclude pre/post `speech_span` silence from regions.
- [X] T021 [US2] In `align_service.py`: ensure `unassigned[]` and `summary.unassigned` populated; degraded branch marks all `warn` with `diagnostics.degraded=true` (FR-009/FR-014).
- [X] T022 [US2] In `dialog-audio-editor.js`: visually distinguish unmatched (no region drawn, listed as needs-assignment) from needs-review (region drawn, amber); never draw a fabricated full-span region for unmatched.

**Checkpoint**: Honest behavior on imperfect recordings.

---

## Phase 5: User Story 3 — Review, trust, fine-tune, persist (Priority: P3)

**Goal**: Auto regions are hand-editable; manual edit overrides + clears auto status; saved/reopened intact.
**Independent Test**: After auto-map, move a boundary + set fade → Apply → save `.smdoc` → reopen → edits persist.

### Tests
- [X] T023 [P] [US3] `tests/test_align_fuse.py::test_region_shape_persistable`: assert each `PlacedRegion` serializes to the `.smdoc` `audio.attachments[]` shape (`startTime/endTime/fadeIn/fadeOut`) without loss.

### Implementation
- [X] T024 [US3] In `dialog-audio-editor.js`: verify auto-produced regions are fully editable (drag/resize/fades) via the existing region UI; a manual edit clears the auto `status` flag for that region (FR-011).
- [X] T025 [US3] In `dialog-audio-editor.js`: for `unassigned` targets, allow manual region assignment that clears the needs-assignment state.
- [X] T026 [US3] Verify Apply→`.smdoc` save/reopen round-trips regions incl. confidence-derived label + fades (reuse existing `applyChanges`/persistence; no format change). Manual E2E per quickstart.

**Checkpoint**: Trustworthy, persistent, human-correctable results.

---

## Phase 6: Polish & Cross-Cutting

- [X] T027 [P] DELETE obsolete modules: `align_dsp.py` (folded into `align_audio.py`), `align_whisper.py`, `align_conformer.py`; remove their imports/refs in `editor.py`.
- [~] T028 [P] (PARTIAL) Removed Python tier modules; dead JS helpers (alignTargetsToIntervalsRobust, buildProportionalIntervalsFromDuration, detectSpeechIntervals, pickBoundariesByDP, autoSplitRegions) left defined-but-unreferenced — harmless, safe to prune later. Remove now-dead client fallbacks in `dialog-audio-editor.js` (`alignTargetsToIntervalsRobust`, `buildProportionalIntervalsFromDuration`, `detectSpeechIntervals`, `pickBoundariesByDP`, `autoSplitRegions`) if unreferenced after T013–T016 (grep first).
- [X] T029 RAM/perf guard in `align_recognize.py`: default `tiny`, int8, single decode pass; log decode/recognize/fuse timings into `diagnostics`; document expected ~1–6× realtime on the 2-core host.
- [X] T030 [P] Update `documents/audio-editing-and-matching.md` + the `## Audio Editing and Matching` section of `CLAUDE.md` to describe the single unified engine (replace tier description).
- [~] T031 (PARTIAL) pytest 11/11 green + synthetic backend E2E verified on host; real-chant GUI run pending user audio. Run `python -m pytest tests/ -q` (all green) and perform the quickstart.md manual E2E (in-order, partial, out-of-order, degraded) on a real chant clip.

---

## Dependencies & Execution Order

- **Setup (P1)** → no deps.
- **Foundational (P2)** → after Setup; **blocks all stories**. Order: T004/T005/T005b [P] → T006 → T007 → T008 → T009 → T010.
- **US1 (P3)** → after Foundational. **MVP.**
- **US2 (P4)** → after Foundational (builds on US1 plumbing; independently testable via fusion tests).
- **US3 (P5)** → after Foundational (mostly frontend/persistence; independent).
- **Polish (P6)** → after desired stories; T027/T028 only after US1 wiring confirmed.

### Parallel opportunities
- T002/T003 [P]; T004/T005/T005b [P]; all `[P]` test tasks within a story; T027/T028/T030 [P].

## Implementation Strategy
- **MVP** = Setup + Foundational + US1 (T001–T016), then STOP & validate a clean recording.
- Then US2 (honesty on imperfect audio), then US3 (edit/persist), then Polish (delete dead code, docs, E2E).

## Notes
- No git commits/branches/pushes at any task (user will commit if satisfied).
- Default path downloads nothing (tiny/small already cached).
- Tests use synthetic fixtures; the real proof is the quickstart manual E2E (T031).
