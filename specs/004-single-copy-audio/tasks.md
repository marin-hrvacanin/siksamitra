---
description: "Task list for Single-Copy Audio Storage (backwards compatible)"
---

# Tasks: Single-Copy Audio Storage

**Branch**: `main` — no git. All JS; no Python/schema change. Story labels: US1 memory/playback,
US2 open-old/dedupe, US3 save/export/viewer compat.

## Phase 1: Core store (Foundational — blocks the rest)
- [ ] T001 [US1] Add `resolveAudioSrc(audioId)` on `SiksamitraEditor` (editor-quill.js).
- [ ] T002 [US2] Add `_dedupeAudioInDOM()` — per `.ql-audio-attachment`: hoist `data-audio-src`/`<audio src>`
  into `audioLibrary` by id (if missing), then remove `data-audio-src` and clear `<audio>.src`. Idempotent.
- [ ] T003 [US3] Add `getSerializableHTML()` — clone `quill.root`, inject `data-audio-src` + `<audio src>`
  per attachment from `resolveAudioSrc(id)` only when the clone lacks them; return innerHTML. Live DOM untouched.
- [ ] T004 [US1/US2] Call `_dedupeAudioInDOM()` at the start of `refreshAudioAttachments()` (covers load,
  insert, apply, fetch).

## Phase 2: Blot resilience (US2/US3)
- [ ] T005 [US3] `AudioAttachmentBlot.value(node)` src fallback: `dataset.audioSrc || <audio src> ||
  window.siksamitraEditor.resolveAudioSrc(id)` (lossless internal round-trips on a de-duplicated DOM).
- [ ] T006 [US1] `AudioAttachmentBlot.create()` — stop setting the hidden `<audio>` element's `src`
  eagerly (playback/guard resolve by id); keep accepting `data-audio-src` from a value (dedupe strips it).

## Phase 3: Playback by id (US1)
- [ ] T007 [US1] `toggleAudioPlayback()` guard: `if (!resolveAudioSrc(id) && !audio.src && !dataset.audioSrc)`
  show "no source"; else proceed.
- [ ] T008 [US1] `_playPreciseAttachmentRange()` src = `resolveAudioSrc(id) || dataset.audioSrc || audio.src`.
- [ ] T009 [US1] `_getPlaybackAudioBuffer` keyed by `audioId` (pass id) → decode once, reuse; avoids
  retaining the multi-MB src string as a Map key.

## Phase 4: Route serialization through getSerializableHTML (US3)
- [ ] T010 [US3] editor-quill.js: `saveDocument()` (~11083) and `getHTML()` (~12564) → `getSerializableHTML()`.
- [ ] T011 [US3] document-manager.js: replace `this.quill.root.innerHTML` at the 4 save/autosave/library
  sites (~1471, ~2083, ~2156, ~2170) with `window.siksamitraEditor.getSerializableHTML()`.
- [ ] T012 [US3] file-operations.js: `exportDocx()` (~269) and `generateHtmlExport()` (~336) →
  `window.siksamitraEditor.getSerializableHTML()`.

## Phase 5: Validate
- [ ] T013 `node --check` editor-quill.js, document-manager.js, file-operations.js (all pass).
- [ ] T014 `python -m pytest tests/ -q` stays green (no Python change).
- [ ] T015 Review backwards-compat paths against the contract; confirm no-audio docs serialize identically
  (no `data-audio-src` injected when no attachments). Provide the user UAT checklist.

## Dependencies
T001→T002/T003→T004 → T005/T006 → T007/T008/T009 → T010/T011/T012 → T013/T014/T015.

## Notes
- No git. No `.smdoc` schema change. Viewer (`editor.py`) and `smdoc-format.toHTML` consume inflated
  content unchanged. Keep edits additive/reversible; user does final in-app UAT (GUI not testable here).
