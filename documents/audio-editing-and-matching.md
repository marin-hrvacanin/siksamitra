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

The automatic matching workflow is designed to reduce manual region assignment. It runs as a **tiered anchor-alignment** pipeline: each text section is projected into an expected phoneme-class sequence, the audio is analyzed into an observed phoneme-class event stream, and the two are aligned locally (Smith–Waterman) with skip-both-sides semantics so that mismatched material on either side is tolerated.

### Alignment tiers

The tier selector in the audio editor toolbar picks which engine produces the observed event stream. All Whisper tiers run **on top of** the DSP baseline (hybrid mode) — Whisper contributes word-boundary anchors, never content.

| Tier | Engine | On-disk size | Runtime (2 min audio, 10 verses) | When to use |
|------|--------|--------------|-----------------------------------|-------------|
| **Anchors (local)** (default) | Pure DSP: RMS VAD, ZCR, spectral centroid, rolloff, band energies. Optional pYIN pitch if any section has svara marks. Classifies frames into SIL / VOW_S / VOW_L / NAS / SIB / STOP / APP. | 0 MB (uses numpy + librosa, already in requirements) | ~5 s (no svaras) / ~60 s (with svaras, pYIN runs) | Default — works offline, accurate for most chants. |
| **Anchors + Whisper tiny** | Tier 0 PLUS `faster-whisper tiny` word timestamps merged as extra boundary anchors. | ~75 MB (fp32 + int8 combined) on first download | ~30–90 s depending on audio length | Recordings where the DSP tier places regions slightly off and you want Whisper's word cadence as an extra timing signal. Whisper tiny usually detects ~0 Sanskrit words but can still emit coarse segment boundaries. |
| **Anchors + Whisper small** | Tier 0 PLUS `faster-whisper small` word timestamps. Much better word detection than tiny. | ~470 MB on first download | ~60–120 s | Noisy recordings or complex chants where Whisper tiny under-detects. |
| **Legacy (energy only)** | The original energy-VAD + DP section-order matcher. | 0 MB | ~5 s | Fallback / A/B comparison only. |

A tier always falls back to a lower one if its dependencies are not installed. Whisper models are downloaded lazily into `cache/models/` on first use via a one-click "Download" button next to the tier selector.

**Language setting for Whisper:** all Whisper tiers use `language="hi"` (Hindi) since Sanskrit's language code isn't in Whisper's trained set. The transcript content is never used — we only consume word-level `(start, end)` timestamps and merge them with the DSP event stream as silence/boundary markers.

### Core alignment algorithm (Tier 0, always available)

1. **Audio → events.** RMS + spectral + voicing features per 10 ms frame; contiguous same-class frames collapse into `AudioEvent` segments with times and optional f0 contours. Pitch tracking (pYIN) runs only when at least one target has svara marks.
2. **Text → events.** Each target is projected through `SanskritRules.projectToEventSequence` — vowels (short / long), sibilants (ś / ṣ / s / h), nasals (ṅ ñ ṇ n m ṁ), approximants (y r l v), stops, and pause markers.
3. **Syllable coarsening.** The per-phoneme text events are then collapsed into per-syllable events (one event per vowel nucleus, with the preceding consonant cluster absorbed as metadata). This matches the acoustic reality that DSP/Whisper produce roughly one event per syllable, and avoids severe granularity mismatch.
4. **Per-section Smith–Waterman.** Each text section is located in the audio independently, allowing skips on both sides. A positional prior biases each section toward its expected time slot (`i/N × duration`) so early sections don't latch onto late audio matches. Returns `{start, end, confidence, channel_breakdown}`.
5. **Cross-section assembly.** A greedy monotonic placement picks non-overlapping audio ranges, clamped to the audio's speech span. Sections with confidence below threshold are left **unassigned** rather than force-placed.
6. **Neighbor propagation.** An unassigned section sandwiched between two confidently-placed neighbors gets a second-chance local alignment restricted to the bracketed interval; on success its confidence is boosted.

### Scoring channels

Confidence is a weighted combination of channels. Each channel is either **applicable** or **skipped** for a given section, so the score is never capped by evidence the section can't actually provide:

| Channel | Weight | Applicable when |
|---------|--------|----------------|
| `class` — phoneme-class Smith–Waterman | 1.0 | Always |
| `dur`   — duration ratio sanity (`\|log(obs / exp)\|`) | 0.5 | Always |
| `pause` — SIL events co-located with `\|` / `\|\|` / `।` / `॥` marks | 0.4 | Section contains any pause mark |
| `svara` — pitch contour matches U+030D / U+0331 / U+030E marks | 0.3 | Section contains any svara mark |
| `anchor`— Whisper / Conformer word/char anchors | 1.2 | Tier 1 or Tier 2 only |

The **svara channel** only activates when a section actually has svara marks. Smṛti / classical content without svaras is never penalized for pitch evidence it couldn't produce.

### Confidence thresholds

| Band | Meaning |
|------|---------|
| ≥ 0.55 | Matched (green). |
| 0.35 – 0.55 | Matched with warning badge. Review suggested. |
| < 0.35 | Left **unassigned**. Target stays in the list with an "audio missing" hint; the user assigns manually if needed. |

### Partial matching on both sides

- Audio content not present in the text (intros, bells, extra chants) is absorbed as skip-audio gaps and does NOT push section boundaries.
- Text sections not present in the recording are left unassigned without dragging neighboring sections out of place.
- Sections can be matched out of text order; the assembly DP enforces monotonic starts but tolerates dropped sections between matches.

### Behavior details

- The clicked region is staged first so the dialog focuses it immediately.
- When no speech intervals are detected at all, the pipeline falls back to duration-only proportional splitting.
- The tier selector is persisted in `localStorage` under key `siksamitra-align-tier`.

### Writing System Coverage

Auto-align weighting is script-aware for the editor's currently supported script flow.

| Writing system | Matching quality | Notes |
|---|---|---|
| IAST (Latin) | Full | Vowel-nucleus counting runs directly on IAST text. |
| Devanagari | Full | Text is transliterated to IAST for consistent syllable counting. |
| Telugu | Full | Text is transliterated to IAST for consistent syllable counting. |
| Tamil | Full (approximation-aware) | Uses table-based transliteration; Tamil approximation limits still apply for some Sanskrit phonemes. |
| Kannada | Full | Text is transliterated to IAST for consistent syllable counting. |
| Mixed-script paragraphs | Best effort | Dominant script is used for weighting; highly mixed lines may need manual adjustment. |

### Interleaved Shloka and Translation

For patterns such as `shloka + translation + shloka + translation`, matching remains deterministic:

- auto-align splits audio into exactly the number of target sections provided
- if translation lines are included as targets, the algorithm assumes the recording also includes those translation lines
- if audio contains only recitation (no spoken translation), include only shloka lines as targets for best results

After auto-align, regions can still be reassigned manually (target dropdown) without rerunning the whole process.

### Relation to DOCX Import

DOCX import is compatible with the matching pipeline:

- paragraph styles are mapped to editor paragraph classes (`title`, `section`, `translation`, etc.)
- script class detection runs on imported paragraph text
- section targets generated from imported lines carry syllable estimates used by auto-align

Practical caveats:

- import quality depends on source `.docx` style consistency
- if `python-docx` is unavailable, DOCX import endpoint returns an explicit error
- script-specific insert annotation conversion is currently strongest for Devanagari; non-Devanagari annotation conversion remains best-effort

### Relation to PDF Import

Faithful PDF import (`pdf_import.py`, `specs/003-faithful-pdf-import/`) is fully compatible
with the matching pipeline:

- paragraph classes (`ql-doc-title`/`ql-doc-subtitle`/`ql-comment-style`/`ql-doc-translation`
  and shloka) map to alignment levels; non-chant levels are **skipped** by `align_service`.
- the inline markings imported 1-to-1 — holdings (`ql-holding-short`/`-long`), pauses
  (`ql-short-pause`/`-long-pause`), Vedic accents (`ql-svara-true`), change-style and
  superscripts — are HTML spans; the mapping target text is the tag-stripped chant text, so
  these markings do **not** affect alignment (the pause `|` is plain text either way).
- auto-mapped regions and the imported holding/pause markup coexist and persist together in
  `.smdoc` save/load (holdings/pauses are document content; regions are audio attachment data).

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

## Suggested Improvements

These are the highest-value next steps for audio/text alignment robustness:

1. Add an "Ignore translation/comment targets during auto-align" toggle (while still preserving those lines for manual assignment).
2. Add an optional "speech-to-text guided" mode where boundary candidates can also be scored by transcript similarity, not only VAD + syllable ratio.
3. Surface per-boundary confidence values in the dialog to quickly spot risky splits.
4. Add a regression test corpus with IAST/Devanagari/Telugu/Tamil/Kannada samples and known-good alignments.
5. Extend explicit script tooling symmetry across the stack (including Malayalam, if added as a first-class editor script).

## Notes For Future Changes

If you extend the audio model, keep these constraints in mind:

- preserve the region timing data in saves and exports
- keep visibility state separate from serialized data unless there is a strong reason to persist it
- make new controls fit the existing SVG icon language of the UI
- keep the editor and preview playback behavior aligned

If a future change adds a new playback effect, it should be reflected in both the live editor and the exported HTML so the user sees the same behavior in both places.

---

## The unified automatic mapping engine

Automatic audio→text mapping is a **single** action ("Map audio to text") backed by
one local, offline engine. There is no tier selector, no separate auto-split, and
no client-side fallback cascade — the previous DSP / Whisper-boundary / Conformer
tiers were removed.

### Why the old approach failed

The earlier engine ran speech recognition but **discarded the transcript**, keeping
only word-boundary times, and tried to guess phoneme classes (vowel/nasal/sibilant/
stop) frame-by-frame from raw spectra. Acoustic class-guessing is unreliable, so
every downstream step inherited the noise. The fix is to *use the transcript
content*.

### How it works (one pass, four fused signals)

1. **Recognition** — `faster-whisper` (CTranslate2, int8, CPU, no torch; `tiny`
   default / `small` optional, cached under `cache/models/`) transcribes the chant
   with word timestamps. Sanskrit (`sa`) is requested, `hi` is the fallback. The
   transcript is deliberately treated as *noisy evidence*, not ground truth.
2. **Phonetics** — the known text (IAST) and the transcript (Devanagari) are both
   folded to a shared 21-symbol phone alphabet (`align_roman.py`; IAST `agnimīḷe`
   and Devanagari `अग्निमीळे` both become `agnimile`). Each text section is located
   in the transcript by a local Smith–Waterman scored on phonetic similarity
   (`align_fuse.py`). The matched transcript span's timestamps become the region.
3. **Rhythm** — adaptive silence detection (`align_audio.py`) snaps region edges to
   real pauses.
4. **Mātrā prior** — the text's prosodic durations (short vowel 1, long vowel 2,
   short/long holdings 1/2, short/long pauses, dīrgha/hrasva — from
   `projectToEventSequence`) bias placement toward the expected in-order slot.

### Guarantees

- **In-order preferred, out-of-order tolerated**: the prior is soft, so a section
  that occurs out of order is still placed at its true audio location.
- **Partial coverage is honest**: text the audio never chants stays **unmatched**
  (not fabricated); audio with no matching text is left uncovered.
- **Confidence per section**: matched / needs-review / unmatched, surfaced in the
  status line and per-region badges.
- **Graceful degradation**: if the speech model is unavailable, mapping falls back
  to a proportional duration-estimate layout with every section flagged
  needs-review — it never hard-fails and never presents a guess as confident.
- **Editable + persistent**: auto regions use the same region objects as manual
  ones, so boundary/fade edits and `.smdoc` persistence are unchanged.

Backend: `align_service.py` orchestrates `align_audio` → `align_recognize` →
`align_fuse` (+ `align_core`, `align_roman`). Endpoint: `POST /api/align/run`.
Specs and design: `specs/001-unified-audio-alignment/`.

### Fused boundary refinement (bleed-free cuts) — `align_fused.py`

The coarse drivers (MMS forced alignment primary; recognition + phonetic fuse fallback) place each
pāda roughly right and in order, but their per-pāda edges come straight from token times, so adjacent
regions overlap or cut a hair early — and per-line playback then bleeds the previous pāda's tail or
clips the last syllable. A final **fusion + refinement** stage (`align_fused.refine`, run inside
`align_service.run` after the driver) fixes the boundaries:

1. **Anchors** — confident, order-consistent coarse placements become anchors with trusted absolute
   time.
2. **Rhythm fill** — pādas between anchors are (re)placed by mātrā-weighted division of the
   inter-anchor interval, so boundary error **re-syncs at every anchor** instead of accumulating
   across the clip (fixes the "offset grows each line" drift).
3. **Bleed-free boundaries** — each inter-pāda boundary is snapped to a real **silence** and the
   silent gap is given to **neither** neighbour (`end_k = silence.start`, `start_{k+1} = silence.end`).
   With no silence, the cut is the mātrā split point and both sides are trimmed inward by ~40 ms — the
   user prefers "a hair short" to hearing the neighbour. A small ~40 ms fade-in/out is suggested per
   region (carried through `fadeIn`/`fadeOut` in the response and applied by the editor).
4. **Honest coverage** — a None-run between two anchors is only rhythm-filled when the audio gap is
   long enough to plausibly contain those pādas; otherwise (the recording skipped them) they stay
   **unassigned**, never fabricated.

The stage is engine-agnostic (operates on `PlacedRegion` lists), works with or without svaras/holdings
(svara/pitch is an optional bonus only when marks exist), and is designed to extend to sub-pāda
(word / word-group) boundaries later. Spec/plan/design: `specs/005-fused-alignment/`.
Tests: `tests/test_align_fused.py` (boundary unit tests) + `tests/manual_e2e.py` (prints a
`BLEED:` overlap metric and per-line timeline for the real PDF + recording).
