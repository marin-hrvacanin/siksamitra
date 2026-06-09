# Feature Specification: Unified Automatic Audio-to-Text Mapping

**Feature Branch**: `001-unified-audio-alignment`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "Unified automatic audio-to-text mapping for the śikṣāmitra Sanskrit editor — one button that confidently maps an entire known Sanskrit/Vedic text to a chant recording, fully local and lightweight, fusing speech recognition, phonetic/textual similarity, rhythm and silences, and the text's own mātrā duration structure; expects mostly-in-order audio but tolerates partial coverage and out-of-order sections; results are reviewable and editable."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Map a full chant recording to a known text in one action (Priority: P1)

A scholar has a Vedic text open in the editor and a separate audio file of that text being chanted (for example, downloaded from YouTube). They attach the audio and trigger a single "map audio to text" action. The system analyzes the recording and produces one audio region per text section/line, each positioned at the span of audio where that text is actually chanted, with a confidence indicator. The scholar reviews the result: most sections are confidently placed, a few may be flagged for review, and they can play any region to confirm it matches its text.

**Why this priority**: This is the core value of the feature and the thing that does not work today. Without it, the rest is irrelevant. It is the MVP — if only this works, the feature is already useful.

**Independent Test**: Attach a clean, in-order chant recording of a known multi-line text, trigger the single mapping action, and verify that each text line is covered by an audio region whose playback contains that line, with confidence reported per region.

**Acceptance Scenarios**:

1. **Given** a known multi-line text and a clean recording that chants all lines in order, **When** the user triggers the single mapping action, **Then** every line receives one audio region covering its chanted span and each region is marked as confidently matched.
2. **Given** the mapping has completed, **When** the user plays a mapped region, **Then** the audio heard corresponds to the text of that region.
3. **Given** the mapping has completed, **When** the user views the result, **Then** a single per-section confidence/status (matched, needs-review, unmatched) is shown for every section — with no competing "modes" or alternative result sets to choose between.

---

### User Story 2 - Handle partial coverage and out-of-order audio gracefully (Priority: P2)

The recording does not perfectly mirror the text: it may chant only some of the lines, or repeat/reorder a couple of sections. The scholar runs the same single action and expects the system to place what it can confidently find, clearly flag the text that the audio never covers as "unmatched," and still locate sections that appear out of their expected order.

**Why this priority**: Real recordings (especially YouTube sources) are imperfect. Confidently mapping only the in-order ideal case would make the feature untrustworthy. Honest handling of gaps and reordering is what makes the result usable for real material.

**Independent Test**: Use a recording that omits one line and swaps two others; verify the omitted line is reported as unmatched (not falsely placed), the swapped lines are each placed at their true audio location, and the remaining lines stay correctly mapped.

**Acceptance Scenarios**:

1. **Given** a recording that does not contain one of the text lines, **When** mapping runs, **Then** that line is reported as unmatched rather than assigned an arbitrary span, and the other lines remain correctly placed.
2. **Given** a recording in which two sections occur in a different order than the text, **When** mapping runs, **Then** each of those sections is placed at the audio span where it actually occurs.
3. **Given** the audio has leading/trailing silence or non-chant noise, **When** mapping runs, **Then** that material is excluded from the mapped regions.

---

### User Story 3 - Review, trust, and fine-tune the result (Priority: P3)

After automatic mapping, the scholar adjusts boundaries by hand where needed (nudging a region's start/end, setting fades), and the corrected mapping is saved with the document and survives reopening.

**Why this priority**: Automatic mapping will never be perfect for every recording; the workflow must end in human-trustable, persistent results. This builds on P1/P2 rather than standing alone.

**Independent Test**: After an automatic mapping, move a region boundary, save the document, reopen it, and verify the adjusted region and its timing persist.

**Acceptance Scenarios**:

1. **Given** an automatic mapping result, **When** the user drags a region boundary or sets a fade, **Then** the change is applied and reflected in playback.
2. **Given** edited regions, **When** the document is saved and reopened, **Then** the regions and their timings (including fades) are restored.
3. **Given** a section flagged "needs-review" or "unmatched," **When** the user assigns or adjusts its region manually, **Then** the system accepts the manual mapping and clears the flag.

### Edge Cases

- **No usable speech detected** (silent file, music-only, wrong file): the system reports that it could not map the text rather than fabricating regions, and leaves sections unmatched/needs-review for manual assignment.
- **Audio much longer than the text** (long intro, multiple repetitions, applause): only the spans that match the text are mapped; extraneous audio is left uncovered.
- **Audio much shorter than the text** (only first verses chanted): the covered lines are mapped confidently; the rest are reported unmatched.
- **Very fast or very slow chanting** (tempo far from average): mapping still tracks the text because relative rhythm/duration, not an absolute tempo, drives placement.
- **Two adjacent lines chanted as one continuous breath** (no pause between them): the boundary between them is still estimated from the text's duration structure even without an audible pause.
- **Repeated identical lines** (refrains): each occurrence is treated as a candidate placement for the corresponding text occurrence; ambiguity is resolved by order preference and flagged for review when genuinely ambiguous.
- **Modest hardware** (2-core CPU, ~8 GB RAM, no GPU, limited free disk): mapping completes without requiring large downloads or exhausting memory; long recordings may take longer but must not fail for lack of resources.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a SINGLE automatic action that maps the entire current text to an attached audio recording. There MUST NOT be multiple user-facing alignment modes, strategy selectors, or competing result sets to choose between.
- **FR-002**: The system MUST run entirely locally and offline, with no dependency on any cloud service or network API for mapping.
- **FR-003**: The system MUST operate within modest hardware limits (low-end multi-core CPU, ~8 GB RAM, no GPU, limited free disk) and MUST NOT require a large model download in order to perform a basic mapping.
- **FR-004**: The mapping MUST fuse multiple kinds of evidence in a single decision process: (a) approximate recognition of the chanted speech, (b) phonetic/textual similarity between recognized audio and the known text, (c) the audio's rhythm — silences and pause locations, and (d) the text's own prosodic duration structure (mātrā timing).
- **FR-005**: The duration structure MUST actively inform mapping, using the editor's existing prosodic units: short vowel = 1 unit, long vowel = 2 units; short consonant holding = 1 unit, long holding = 2 units; short pause vs long pause; and the dīrgha/hrasva (long/short) distinction. These contribute to expected section durations and to validating placements.
- **FR-006**: The system MUST treat the audio as MORE LIKELY to follow the text's order, while still correctly placing sections that occur out of order in the recording.
- **FR-007**: The system MUST correctly handle partial coverage: text not present in the audio MUST be reported as unmatched, and audio not corresponding to any text MUST be left uncovered.
- **FR-008**: The system MUST produce, for every text section, a result status that distinguishes confidently matched, needs-review (low confidence), and unmatched.
- **FR-009**: The system MUST NOT silently fabricate coverage: when confidence is low or no match exists, it MUST surface this for review rather than present it as a confident mapping.
- **FR-010**: The system MUST accept text in the scripts the editor already supports (IAST and Devanagari) and map it without the user manually transliterating first.
- **FR-011**: Every automatically produced region MUST remain editable by the user (boundary move/resize and fades), and manual edits MUST override automatic results.
- **FR-012**: Mapped and edited regions MUST persist in the saved document and be restored on reopen, including their timing and fade metadata.
- **FR-013**: The system MUST give clear progress/outcome feedback during and after mapping (working, done, how many sections matched/flagged/unmatched), suitable for a single-machine desktop workflow.
- **FR-014**: The mapping action MUST degrade gracefully: if the best-quality analysis component is unavailable on the machine, the system still returns a usable best-effort mapping (clearly lower confidence) rather than failing outright.

### Key Entities *(include if feature involves data)*

- **Text Section (mapping target)**: A unit of text to be located in the audio (e.g., a line or verse). Carries its textual content, its script-normalized form, its prosodic duration profile (mātrā units, holdings, pauses, dīrgha/hrasva), and its expected order position.
- **Audio Region (mapping result)**: A span of the recording assigned to a text section, with start time, end time, an editable fade-in/fade-out, a confidence value, and a status (matched / needs-review / unmatched). One region corresponds to one text section.
- **Mapping Result Set**: The collection of regions produced by one run of the action, plus an overall summary (counts of matched/needs-review/unmatched) and the recognized speech evidence used to justify placements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a clean, in-order recording of a known text, at least 90% of text sections are placed such that the mapped region's span overlaps the section's true chanted span by a majority (more than half), in a single action with no mode selection.
- **SC-002**: For mapped sections, the region boundaries fall within roughly a quarter-second of the true section boundaries on clean recordings (boundaries feel "snapped" to the chant rather than arbitrary).
- **SC-003**: When the recording omits part of the text, 100% of the truly-absent sections are reported as unmatched, and no truly-present section is wrongly reported as unmatched, on the partial-coverage test recording.
- **SC-004**: When two sections are out of order in the audio, both are placed at their true audio locations (not at their text-order expected slots).
- **SC-005**: The single action completes on the target laptop for a several-minute recording without running out of memory or requiring any download beyond what ships/by-default-caches with the app; the user sees clear progress throughout.
- **SC-006**: A user can go from "attach audio" to "entire text confidently covered, with anything uncertain flagged" without ever choosing between alignment strategies.
- **SC-007**: Manual edits to auto-mapped regions and their persistence across save/reopen succeed 100% of the time.

## Assumptions

- **Single recording per mapping run**: One audio attachment is mapped to the current text per action; mixing multiple separate recordings in one run is out of scope.
- **Known text is authoritative**: The text in the editor is the ground truth; the goal is to locate it in the audio (alignment of known text), not to transcribe unknown speech.
- **Recognition is approximate**: Speech recognition of Sanskrit chant on a lightweight local model is imperfect; it is used as one evidence source among several, not as a reliable transcript. Mapping quality must not depend on accurate transcription.
- **Lightweight by default**: The default mapping uses speech-analysis capabilities that are already present/cached with the app and require no large additional download. An optional higher-accuracy model may be offered later but is not required for the feature to function.
- **Target hardware**: A modest laptop (2-core CPU class, ~8 GB RAM, no GPU, single-digit GB free disk). Performance is expected to be CPU-bound and possibly slower than real-time for long audio, which is acceptable as long as it completes with progress feedback.
- **Reuse of existing prosody model**: The editor already computes mātrā durations, holdings, pauses, and dīrgha/hrasva for text; the feature reuses that existing duration model as its rhythm prior rather than defining a new one.
- **Reuse of existing region UI and document format**: Regions are represented, edited, and persisted using the editor's existing audio-region structures and document format; this feature changes how regions are produced, not how they are stored or hand-edited.
- **Order preference, not order requirement**: "More likely in order" is a soft prior that improves accuracy and disambiguates repeats, not a hard constraint that breaks on reordering.
