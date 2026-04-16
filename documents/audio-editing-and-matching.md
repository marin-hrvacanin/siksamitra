# Audio Editing and Matching — śikṣāmitra

This document explains how śikṣāmitra stores, edits, matches, previews, and exports recitation audio.

The goal is simple: keep the audio workflow attached to the text workflow, so a scholar can place a recording against the right passage, inspect the ranges, and preserve that work in the document file.

---

## Overview

Audio is stored inside `.smdoc` documents as attachment metadata plus a base64-encoded audio source. The editor presents that audio through a dedicated waveform dialog and the inline play controls in the main editor.

The workflow centers on a single attachment with one or more regions:

- A region is a time range inside the audio file
- A region can be linked to a text target in the editor
- A region can be shown, hidden, or displayed alongside other regions
- Each region can have fade-in and fade-out values

The current default behavior is intentionally conservative: when the audio editor opens from the three-dots button, it focuses the clicked region and shows only that region unless you explicitly choose otherwise.

---

## Main Pieces

### Main editor attachment

In the Quill editor, an audio attachment is represented as embedded document metadata plus a play control. The attachment stores the file source and the region timing information needed to reconstruct playback.

### Audio editor dialog

The audio editor dialog is the dedicated region-management window. It includes:

- waveform and timeline display
- transport controls
- zoom controls
- region and section lists
- visibility controls
- fade controls for the selected region
- automatic alignment / matching actions

### Matching and region staging

When you open the dialog from a specific audio button, that target region is staged first. This makes the selected range visible immediately, which is the default view users expect when they are editing one passage.

---

## Data Model

A stored audio attachment uses the same base fields throughout the editor and export path.

| Field | Meaning |
|-------|---------|
| `id` | Stable attachment identifier |
| `label` | Display label shown in the UI |
| `src` | Base64 audio data URI |
| `startTime` | Region start time in seconds |
| `endTime` | Region end time in seconds |
| `fadeIn` | Fade-in duration in seconds |
| `fadeOut` | Fade-out duration in seconds |

Only timing and fade metadata are persisted as attachment data. Region visibility is a dialog state and is not saved as part of the document payload.

If a field is missing, the editor treats it as a default value. In practice, that means:

- `fadeIn` defaults to `0`
- `fadeOut` defaults to `0`
- missing region bounds are handled by the dialog's current state

---

## Visibility Modes

The audio editor exposes three clear modes plus per-region control.

### Selected

Shows only the currently selected region. This is the default when opening the dialog from a specific attachment.

### Show All

Shows every region in the attachment.

### Hide All

Hides every region. This is useful when you want to inspect the waveform without visual overlays.

### Custom per-region visibility

Each region can be toggled individually once you need a mixed view. That lets you keep only a few ranges visible while hiding the rest.

The important rule is that the visibility mode is about presentation, not data loss. It changes what you see in the editor, not what is stored in the document.

---

## Fade-In and Fade-Out

Each region can carry a fade-in and fade-out duration.

Typical use cases:

- soften the beginning of a chant or verse
- trim abrupt transitions between adjacent regions
- keep the exported preview closer to the recitation flow you want to preserve

Fades are applied at runtime in both live playback and preview/export playback. The same metadata is reused in both places, so the editor and the exported document behave consistently.

---

## Automatic Matching

The automatic matching workflow is designed to reduce manual region assignment.

The current behavior is:

- the clicked region is staged first
- the dialog uses the selected text and the staged audio ranges to build the matching view
- matching updates the region list directly instead of opening a separate section-picking popup
- the old add-selected popup was removed so the workflow stays in one place

This keeps the workflow centered on the region editor itself. You review the ranges, adjust the visibility, and apply the result without an extra modal step.

The matching logic is meant to work with normalized IAST text and the same transliteration / standardization pipeline used by the rest of the editor.

---

## Playback Behavior

Playback is not just a raw audio file player. The editor applies the attachment metadata while it plays.

That means:

- the selected region can be previewed by itself
- region fades are respected during live playback
- the same fades are used in the preview/export window
- the attachment view in the editor stays in sync with the region model

This is important when you are testing a recitation match against a specific shloka or verse segment. The playback behavior should reflect the stored region boundaries, not just the original recording.

---

## Save, Load, and Export

Audio attachments are part of the `.smdoc` document payload. When a document is saved, the attachment metadata is serialized with the rest of the editor content.

The save path preserves:

- region start and end times
- fade-in and fade-out values
- the base64 audio source

The export path uses the same information so the resulting HTML preview behaves like the editor. That way, the audio file does not lose its region boundaries or fades just because it moved from the live editor into a generated document view.

---

## Under the Hood

The implementation is split between the main editor and the popup dialog.

- `editor-quill.js` owns the attachment behavior inside the rich text editor
- `dialog-audio-editor.js` manages the waveform, regions, visibility, fades, and matching UI
- `document-manager.js` keeps the saved audio attachment data in sync with the document state
- `smdoc-format.js` serializes and deserializes the document payload
- `editor.py` hosts the popup window and the local Flask endpoints used by the dialog bridge

The dialog is app-owned, not globally topmost. It stays above the editor, but it should not force itself above unrelated applications.

---

## Practical Editing Flow

A typical session looks like this:

1. Click the audio button in the main editor
2. Open the audio editor for that attachment
3. Inspect the selected region
4. Switch between Selected, Show All, and Hide All as needed
5. Toggle individual regions when you need a custom view
6. Set fade-in and fade-out values for the regions that need them
7. Apply the changes back to the document
8. Save or export the document and keep the metadata intact

This is the flow the UI is designed around now. There is no extra region-selection popup in the middle of it.

---

## Notes For Future Changes

If you extend the audio model, keep these constraints in mind:

- preserve the region timing data in saves and exports
- keep visibility state separate from serialized data unless there is a strong reason to persist it
- make new controls fit the existing SVG icon language of the UI
- keep the editor and preview playback behavior aligned

If a future change adds a new playback effect, it should be reflected in both the live editor and the exported HTML so the user sees the same behavior in both places.
