# Research: Single-Copy Audio — measured facts & decisions

## 1. The duplication (measured in code)

- `AudioAttachmentBlot.create()` (`editor-quill.js`) stores the full base64 src **twice** per
  attachment: `node.dataset.audioSrc = src` and `audio.src = src`.
- `_applyAudioEditorResult()` inserts one attachment per mapped region, each with
  `audioData.src = audio.src` (the full clip). N regions → N×2 base64 copies in the live DOM.
- `_getPlaybackAudioBuffer(src)` decodes the clip to PCM (~100 MB for 5 min stereo) and caches it
  keyed by the multi-MB src string.

→ ~30 sections of a 5-min/5-MB clip ≈ ~400 MB base64 in the DOM + ~100 MB PCM on play. On a machine
with <1 GB free RAM this exhausts memory → freeze / black screen (the reported bug).

## 2. Existing single-copy infrastructure (reused, not rebuilt)

- `audioLibrary` already exists on `SiksamitraEditor` and is keyed by `id`; session-added audio
  (upload/YouTube) is already pushed there.
- Every attachment already carries `data-audio-id`.
- `_syncAudioLibraryFromDocument()` already hoists `data-audio-src` from DOM nodes into the library.

→ Decision: the library is the single source of truth; no new store. Add `resolveAudioSrc(id)`.

## 3. Serialization paths (where audio must be present)

- Save/autosave/library: `document-manager.js` reads `this.quill.root.innerHTML`; `editor-quill.js`
  `saveDocument()` and `getHTML()`; `file-operations.js` `exportDocx()`/`generateHtmlExport()`.
- `SMDocFormat.create({content})` stores that innerHTML as `doc.content` (the `audio.attachments`
  field is optional/secondary).
- The **viewer** opens from the **saved file** (`open_viewer_from_file(filePath)`), and
  `SMDocFormat.toHTML()`/`editor.py` render `doc.content`.

→ Decision: if every serialization site emits **inflated** content (src present per attachment), the
on-disk format, the viewer, export, and older builds all keep working **unchanged**. So: dedupe the
live DOM (memory win) + inflate at serialization (compat). No Python/viewer/schema changes.

## 4. Backwards / forwards compatibility

- **Old file → new code**: per-attachment `data-audio-src` present → `_dedupeAudioInDOM()` hoists to
  library + strips DOM copies → memory freed ("fix applied on open"). ✓
- **New file → new code**: saved inflated → identical to old shape → dedupe on load. ✓
- **New file → old code / viewer**: inflated content is exactly today's shape → opens unchanged. ✓

## 5. Alternatives considered

- **Store audio only in `audio.attachments`, strip from content** — rejected: breaks old-build/viewer
  reads of `doc.content`, and risks audio loss; larger blast radius.
- **Lazy per-blot `<audio>.src` but keep `data-audio-src`** — rejected: still N base64 copies in the
  DOM (the dominant cost); only removes the second copy.
- **Don't change the blot, only dedupe post-hoc** — adopted in part: dedupe is post-hoc in
  `refreshAudioAttachments`; the only blot changes are a resilient `value()` fallback and dropping the
  eager `<audio>.src` (so playback must resolve by id). Minimal blot surface.

## 6. Decoded-buffer cache

`_getPlaybackAudioBuffer` cache keyed by the giant src string holds that string as a Map key.
→ Decision: key the cache by `audioId` so the multi-MB string is not retained as a key and the buffer
is shared across all attachments of that id (decode once).
