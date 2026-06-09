# Feature Specification: Fused, bleed-free audio→text alignment

**Branch**: `main` (no git) · **Created**: 2026-06-08 · **Status**: Draft

**Input**: The current mapping (MMS forced alignment alone) places shlokas roughly in order but
produces **bad region boundaries**: a region ends a hair early (chops the last syllable) while the
next region starts a hair early (so you hear the *previous* pāda's tail), and adjacent regions
overlap — so per-line playback bleeds into neighbors, and the offset can creep. The user wants a
**fused** matcher that combines the reliable signals — recognition word-anchors, syllable/mātrā
rhythm, silence/pause boundaries, and (when present) svara/pitch — into one engine, with clean,
**bleed-free** cuts, working on any text (with or without holdings/svaras). Test on the bhū sūktam
PDF + recording `u_FzN8wdHg0`.

## Clarifications (Session 2026-06-08)
- Engine: **fused matcher; A/B variants and keep the best on the sample.** Forced alignment is one
  signal, not the sole driver.
- Budget: **accuracy first (~1–3 min on the user's laptop OK).**
- Cuts: **bias against bleed** — snap to the nearest silence; when uncertain trim *inward* (better a
  hair short than hearing the neighbor); keep a tiny fade. Per-pāda for now; design must stay
  word-splittable for a future "play these words" feature.
- Must work without svaras/holdings (those are optional bonus signals).

## User Scenarios & Testing

### US1 - Clean, bleed-free per-line playback (P1)
Map a recitation onto its shlokas; playing any line plays *that* line only — no audible tail of the
previous pāda, no clipped final syllable.
- **Independent Test**: bhū sūktam + `u_FzN8wdHg0`: assert regions are monotonic and
  **non-overlapping** (region[k].end ≤ region[k+1].start), boundaries sit on detected silences where
  available, and each region's duration is plausible for its mātrā weight.
- **Acceptance**:
  1. Adjacent placed regions never overlap; the silent gap between two padas belongs to **neither**.
  2. Where a real pause exists between padas, the cut lands within it.
  3. Where no pause is detected, the cut is placed by mātrā-weighted split and both sides trimmed
     inward by a small margin (no bleed), with a small fade.

### US2 - Robust placement via fusion (P1)
Placement uses multiple agreeing signals so a single weak signal can't drag a line off.
- **Independent Test**: lines that recognition can't transcribe (opening verses) are still placed
  (forced-alignment/rhythm carry them); lines neither can place are left unassigned, not fabricated.
- **Acceptance**:
  1. High-confidence agreements (forced-alignment ↔ recognition) act as anchors; other padas are
     placed by mātrā rhythm *between* anchors, so boundary error does not accumulate across the clip.
  2. Out-of-order is tolerated but in-order preferred; unmatched text stays unassigned.

### US3 - Works on plain text (P2)
A text with no svaras/holdings maps just as well (svara/pitch is an optional bonus channel).
- **Acceptance**: removing svara marks from targets does not break or degrade placement materially.

### Edge Cases
- Audio with intro/outro/refrains not in the text → absorbed as gaps, not forced onto padas.
- A pada the recording skips → unassigned, neighbors not dragged.
- Very short padas (refrains like "॥ N ॥") → still get a clean, non-overlapping slot.
- No silences detected at all → fall back to mātrā split with inward trim (still no overlap).

## Requirements
- **FR-001**: Produce per-pada regions that are **monotonic and non-overlapping**; the gap between
  two padas is assigned to neither.
- **FR-002**: Snap each inter-pada boundary to the nearest detected silence within a tolerance; if
  none, place by mātrā-weighted split and trim both sides inward by a small margin.
- **FR-003**: Fuse signals — forced alignment (text-driven), recognition word-anchors (phonetic SW),
  silence/pause structure, and mātrā/syllable rhythm — into one placement + confidence; svara/pitch
  contributes only when svara marks exist.
- **FR-004**: Use high-confidence cross-signal agreements as **anchors** and place intervening padas
  by rhythm between them, so boundary error does not accumulate (no global drift).
- **FR-005**: Each region carries a small fade-in/out suggestion so any residual boundary content
  fades rather than clicks/bleeds.
- **FR-006**: Non-chant levels (title/subtitle/comment/translation) remain excluded (skipped).
- **FR-007**: Works with or without svaras/holdings; never hard-fails (degrades to rhythm/proportional
  with honest low confidence).
- **FR-008**: Runs locally/offline within ~1–3 min for a ~3–5 min clip on the target laptop.
- **FR-009**: Output stays compatible with the existing region model (editable, persists in `.smdoc`).
- **FR-010**: Design must remain extensible to sub-pada (word/word-group) boundaries later.

## Success Criteria
- **SC-001**: On the sample, **0 overlapping regions** (no bleed) and ≥90% of inter-pada boundaries
  land within a detected silence (when silences exist there).
- **SC-002**: ≥ the current count of placed mantra lines (≥31/34), 0 out-of-order.
- **SC-003**: Per-region duration within a sane band of its mātrā-expected duration (no region
  absurdly long/short vs its neighbors).
- **SC-004**: Removing svaras from the targets changes placement count by ≤1 line.
- **SC-005**: A/B: the chosen boundary strategy beats the others on SC-001 on the sample, recorded in
  the test output.

## Assumptions
- The existing building blocks are reused: `align_audio` (decode/silences/snap), `align_ctc` (MMS),
  `align_recognize`+`align_fuse` (recognition+phonetic SW), `align_roman`, `align_core` (mātrā).
- Ground-truth timings aren't available; quality is judged by structural proxies (no-overlap,
  silence-alignment, duration plausibility, in-order, coverage) plus the user's listening UAT.
