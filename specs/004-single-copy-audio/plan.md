# Implementation Plan: Single-Copy Audio Storage

**Branch**: `main` (no git) | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

## Summary

Make each audio file live as **one** in-memory copy in `SiksamitraEditor.audioLibrary` (keyed by
`id`), referenced by every attachment via its existing `data-audio-id`. The live DOM carries **no**
base64. Backwards compatibility is preserved by two complementary passes:

- **Dedupe on load** — hoist any per-attachment embedded audio into the library, then strip it from
  the DOM (auto-repairs pre-fix documents).
- **Inflate on save/export/preview** — write the single library copy back onto each attachment in a
  *clone*, so serialized output is self-contained and identical in shape to pre-fix files (any version,
  and the viewer, can open it). The live DOM is never mutated by serialization.

Playback resolves the source by id from the library and decodes once (reused buffer).

## Technical Context

**Language**: JavaScript (ES2020+), no build step. **Files**: `editor-quill.js` (owner of
`audioLibrary`, the blot, playback, save), `document-manager.js`, `file-operations.js` (save/export
call sites). **No Python change** (viewer/`editor.py` and `smdoc-format.js` consume inflated content).
**Constraints**: offline, low-RAM, no git, must not break old files. **Testing**: `node --check` on
changed files; existing `pytest` suite stays green; manual in-app verification by the user.

## Constitution Check

Constitution is an unfilled template — no formal gates. De-facto rules honored: local/offline, no git,
reuse existing structures (`audioLibrary`, `data-audio-id`), no `.smdoc` schema change, backwards
compatible. No violations.

## Architecture

Single source of truth: `audioLibrary` (array of `{id, label, src, duration, size, …}`) on
`window.siksamitraEditor`. Attachments reference by `data-audio-id`.

New methods on `SiksamitraEditor`:
- `resolveAudioSrc(audioId)` → `audioLibrary` src for an id, else `''`.
- `_dedupeAudioInDOM()` → for each `.ql-audio-attachment`: ensure the library has the id's bytes
  (hoist from `data-audio-src` / `<audio src>` if missing), then remove `data-audio-src` and clear the
  hidden `<audio>` element's `src`. Idempotent.
- `getSerializableHTML()` → clone `quill.root`; for each attachment inject `data-audio-src` and
  `<audio src>` from `resolveAudioSrc(id)` (only if the clone lacks it); return `innerHTML`. Pure read;
  live DOM untouched.

Hooks:
- `refreshAudioAttachments()` calls `_dedupeAudioInDOM()` first (covers load, insert, apply, fetch).
- Blot `value(node)` falls back to `window.siksamitraEditor.resolveAudioSrc(id)` when the node has no
  src (keeps internal Delta round-trips lossless on a de-duplicated DOM).
- Blot `create()` no longer sets the hidden `<audio>` element's `src` eagerly (the guard/playback
  resolve by id); it may still accept `data-audio-src` from a value, which dedupe then strips.

## Integration points (serialization → `getSerializableHTML()`)

Replace `this.quill.root.innerHTML` at save/export sites:
- `editor-quill.js`: `saveDocument()` (~11083); `getHTML()` (~12564) returns inflated content.
- `document-manager.js`: save/autosave/library-save (~1471, ~2083, ~2156, ~2170).
- `file-operations.js`: `exportDocx()` (~269), `generateHtmlExport()` (~336).

Playback (resolve by id):
- `toggleAudioPlayback()` guard `if (!audio.src)` → check `resolveAudioSrc(id) || audio.src || data-audio-src`.
- `_playPreciseAttachmentRange()` src = `resolveAudioSrc(id) || dataset.audioSrc || audio.src`.
- `_getPlaybackAudioBuffer` cache keyed by `audioId` (not the multi-MB src string) → decode once, reuse.

The viewer (`editor.py`, opened from the saved file) and `smdoc-format.toHTML` consume inflated content
→ no change.

## Phased build

- **A. Core store**: `resolveAudioSrc`, `_dedupeAudioInDOM`, `getSerializableHTML`; call dedupe in
  `refreshAudioAttachments`.
- **B. Blot resilience**: `value()` fallback by id; stop eager `<audio>.src`.
- **C. Playback by id**: guard + `_playPreciseAttachmentRange` + buffer cache key.
- **D. Route serialization** through `getSerializableHTML()` at all save/export sites.
- **E. Validate**: `node --check` all changed JS; `pytest` green; review backwards-compat paths;
  user verifies in-app (open old doc, map+play, save+reopen, viewer).

## Risks & Mitigations

- **Audio lost on save if library missing an id** → inflate only overwrites when the clone lacks src;
  if neither library nor DOM has it, leave as-is (FR-006). Dedupe hoists before stripping, so the
  library always has it after load.
- **Internal Delta round-trip on a stripped blot** → `value()` falls back to `resolveAudioSrc(id)`.
- **document-manager/file-operations are separate classes** → they already use `window.siksamitraEditor`;
  call `window.siksamitraEditor.getSerializableHTML()`.
- **Untestable GUI here** → keep changes additive and reversible; `node --check`; explicit user UAT list.

## Complexity Tracking

No constitution violations; not applicable.
