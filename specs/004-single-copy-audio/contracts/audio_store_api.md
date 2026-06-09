# Contract: Single-Copy Audio store (SiksamitraEditor)

## New / changed methods (editor-quill.js)

```js
resolveAudioSrc(audioId): string         // library src for id, else ''
_dedupeAudioInDOM(): void                 // hoist per-attachment bytes → library, strip DOM copies (idempotent)
getSerializableHTML(): string             // inflated, self-contained editor HTML (clone; live DOM untouched)
```

- `getHTML()` now returns `getSerializableHTML()` (inflated, canonical serialization).
- `refreshAudioAttachments()` calls `_dedupeAudioInDOM()` first.
- `AudioAttachmentBlot.value(node)` src fallback: `dataset.audioSrc || <audio src> || window.siksamitraEditor.resolveAudioSrc(id)`.
- `AudioAttachmentBlot.create()` no longer sets the hidden `<audio>` element's `src` eagerly.
- Playback (`toggleAudioPlayback`, `_playPreciseAttachmentRange`) resolves src by id; PCM cache keyed by `audioId`.

## Serialization call sites routed through `getSerializableHTML()`
- editor-quill.js: `saveDocument()`, `getHTML()`
- document-manager.js: save / autosave / library-save (4 sites)
- file-operations.js: `exportDocx()`, `generateHtmlExport()`

## Invariants
- **Single copy**: live DOM holds no base64; `audioLibrary` holds one per id.
- **Lossless**: serialized output always carries audio bytes for every attachment whose id is known
  (library) or that still carried bytes (DOM) — never empty (FR-006).
- **Backwards compatible**: old files dedupe-on-load; new saves are inflated (same shape as old) and
  open in older builds and the viewer.
- **No-audio docs**: `_dedupeAudioInDOM()`/inflate are no-ops → byte-identical serialization.

## Manual verification (user UAT — no automated GUI here)
1. Open a **pre-fix** `.smdoc` with mapped audio → loads, plays; after load audio is single-copy.
2. Map a multi-minute recording to many shlokas, Apply, play several lines → responsive, no freeze.
3. Save → reopen → audio present and plays.
4. Open the **preview/viewer** for the saved file and **export HTML** → audio plays.
5. A no-audio document saves/opens exactly as before.

## Automated checks
- `node --check` on editor-quill.js, document-manager.js, file-operations.js.
- `python -m pytest tests/ -q` stays green (no Python change).
