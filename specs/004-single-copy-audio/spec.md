# Feature Specification: Single-Copy Audio Storage (memory fix, backwards compatible)

**Feature Branch**: `main` (no git operations)

**Created**: 2026-06-08

**Status**: Draft

**Input**: When a recording is mapped onto many shlokas, the editor currently stores the **entire audio file** (a multi-MB base64 data URI) on **every** audio attachment — twice (a `data-audio-src` attribute and the hidden `<audio>` element's `src`). A document with ~30 mapped sections of a 5-minute clip therefore holds **hundreds of MB of duplicated audio in the live page**, and pressing play additionally decodes the whole clip to ~100 MB of PCM. On a low-RAM machine this exhausts memory and the editor freezes / goes black. This feature makes each audio file live as **one** in-memory copy (keyed by id), referenced by every attachment, while remaining **fully backwards compatible**: existing documents that embed the audio on every attachment must still open, get the de-duplication fix applied automatically on load, and continue to save in a self-contained form any version can open.

## Clarifications

### Session 2026-06-08

- Q: Full single-copy refactor, partial mitigation, or defer? → A: **Full single-copy refactor** (user-selected).
- Q: Compatibility requirement? → A: **Do not break backwards compatibility.** Old/"badly-made" files must still open; the optimization (dedup) is applied on open. New saves must stay openable (self-contained).
- Q: Where does the single copy live? → A: In the existing in-memory audio **library** (`audioLibrary`), keyed by the audio **id** that every attachment already carries (`data-audio-id`). The live DOM keeps only the id reference (no base64).
- Q: How do saves stay self-contained/openable? → A: At serialization time the content is **inflated** — the single library copy is written back onto each attachment — so the saved `.smdoc`/HTML has the same shape as today and opens in any version. On load it is de-duplicated again.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Map a long recording to many shlokas without freezing (Priority: P1)

A user imports a text, attaches/fetches a recording, maps it onto ~30 shlokas, applies, and plays individual lines. The editor stays responsive; playing a line does not exhaust memory or black-screen the app.

**Why this priority**: This is the reported crash and the entire reason for the feature.

**Independent Test**: With a multi-minute recording mapped to many sections, confirm the live document holds a single in-memory copy of the audio (not one per attachment) and that per-line playback works without the app freezing.

**Acceptance Scenarios**:

1. **Given** N attachments referencing the same audio, **When** the document is live in the editor, **Then** the audio bytes exist **once** in memory (in the library), and no attachment carries its own base64 copy.
2. **Given** a mapped document, **When** the user clicks a line's play button, **Then** the correct trimmed/faded range plays, resolving the audio by its id.
3. **Given** the same document, **When** the user plays several different lines, **Then** the decoded audio buffer is reused (decoded once), not re-duplicated per line.

---

### User Story 2 - Open an existing (pre-fix) document and have it auto-repaired (Priority: P1)

A user opens a previously-saved `.smdoc` that embeds the full audio on every attachment ("badly made"). It opens correctly, and the de-duplication fix is applied automatically so it no longer wastes memory.

**Why this priority**: Explicit user requirement — never break old files; apply fixes on open.

**Independent Test**: Open a pre-fix document; verify it loads, audio plays, and after load the audio bytes are held once (the per-attachment duplicates were hoisted into the library and removed from the DOM).

**Acceptance Scenarios**:

1. **Given** an old document with `data-audio-src` on every attachment, **When** opened, **Then** it loads without error and each audio plays.
2. **Given** that same document after load, **When** inspected, **Then** the per-attachment base64 duplicates have been removed (hoisted to the single library copy).

---

### User Story 3 - Save / export stays self-contained and openable anywhere (Priority: P1)

After editing, the user saves (or exports HTML / opens the preview/viewer). The saved file plays its audio and can be reopened by the editor (and the viewer) exactly as before.

**Why this priority**: Backwards/forwards compatibility — a save that drops the audio, or that only this build can open, is unacceptable.

**Independent Test**: Save a document with mapped audio; reopen it; the audio is present and plays. Open the preview/viewer for the saved file; audio plays there too.

**Acceptance Scenarios**:

1. **Given** a live (de-duplicated) document, **When** saved, **Then** the saved content is **inflated** (audio present on each attachment) so the file is self-contained and identical in shape to pre-fix saves.
2. **Given** a saved file, **When** reopened, **Then** it is de-duplicated again on load and behaves like US2.
3. **Given** a saved file, **When** opened in the preview/viewer or exported to HTML, **Then** audio plays (viewer/export consume the inflated content unchanged).

### Edge Cases

- An attachment whose id is not (yet) in the library at save time must not lose its audio — if the DOM still carries a copy, keep it.
- Audio uploaded/fetched mid-session (not from a file) must be in the library so save can inflate it.
- A document with no audio must be unaffected (no library entries, no inflate/dedupe work, identical output).
- Re-serialization of a de-duplicated attachment by the editor (e.g. internal Delta round-trip) must still recover the audio src (by id), never emit an empty source.
- Deleting an attachment/audio must not corrupt the shared single copy used by other attachments of a different id.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each distinct audio file MUST be stored as a single in-memory copy keyed by its id; attachments reference it by id and MUST NOT each hold their own base64 copy in the live DOM.
- **FR-002**: On load, the editor MUST hoist any per-attachment embedded audio (`data-audio-src` or `<audio src>`) into the single library copy (keyed by id) and remove the per-attachment duplicates (the automatic fix for pre-fix documents).
- **FR-003**: Playback MUST resolve the audio source by attachment id from the single copy, decode it at most once (cached/reused), and honor each attachment's start/end/fade.
- **FR-004**: Serialization for save/export/preview MUST produce **inflated**, self-contained content (the single copy written back onto each attachment) so the output is identical in shape to pre-fix files and openable by any version, including the viewer.
- **FR-005**: The change MUST be backwards compatible: pre-fix documents open, play, and are auto-repaired; documents saved after the fix open in older builds and the viewer.
- **FR-006**: No audio MUST be lost in any path — if the single copy is unavailable for an id but the DOM still carries bytes, those bytes MUST be preserved on save.
- **FR-007**: Documents with no audio MUST be unaffected (byte-identical serialization to today, no added work).
- **FR-008**: All existing audio behaviors (mapping, regions, fades, visibility, delete, `.smdoc` round-trip, DOCX/HTML export, viewer) MUST continue to work.

### Key Entities *(include if data involved)*

- **Audio library entry**: the single in-memory record per audio id (`{id, label, src, duration, size, …}`) — the one source of truth for bytes.
- **Audio attachment (blot)**: a reference in the document carrying the audio **id** + region metadata (start/end/fade/confidence), and (only transiently / when serialized) the bytes.
- **Serializable content**: the editor HTML with audio inflated back onto attachments, used by every save/export/preview path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a document with N attachments sharing one audio, the live page holds the audio bytes **once**, not N times (and not 2N as today).
- **SC-002**: Opening a pre-fix document with audio on every attachment loads without error, plays, and ends with a single in-memory copy (duplicates removed).
- **SC-003**: Saving then reopening a document preserves all audio (present and playable); the saved file opens in the preview/viewer with working audio.
- **SC-004**: Per-line playback of a multi-minute recording mapped to many sections works without the app freezing / black-screening (decoded buffer reused, not re-duplicated).
- **SC-005**: A document with no audio serializes identically to before (no regressions).

## Assumptions

- Every attachment already carries a stable `data-audio-id`; the library is already keyed by id and already populated for session-added audio.
- The on-disk `.smdoc` is LZMA-compressed, so inflating identical audio bytes per attachment compresses away on disk; the memory win is in the live page and on play.
- The viewer/export consume the saved (inflated) content, so they need no change.
- No change to the `.smdoc` schema is required (content stays the inflated `.ql-editor` innerHTML; the optional `audio.attachments` field is unchanged).
