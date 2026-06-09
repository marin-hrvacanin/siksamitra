# Feature Specification: Faithful (1-to-1) Veda Union PDF Import

**Feature Branch**: `main` (no git operations)

**Created**: 2026-06-08

**Status**: Draft

**Input**: When a user imports a Veda Union–styled PDF (e.g. "bhū sūktam v1.1.pdf"), the editor must reproduce it **exactly** — not just the structure and accents (already done in feature 002), but **every visible marking the PDF physically carries**: the green samyukta **holding boxes** (short vs long) and the colored **pause pipes** (short/long), in addition to titles, subtitle, source-comment, translations, Vedic accents, change-style transformation glyphs, and superscripts. The imported document must be visually and structurally indistinguishable from a document authored natively in the editor, so the user can then attach a recording and have only the chant lines auto-mapped.

## Clarifications

### Session 2026-06-08

- Q: Should holdings be imported from the PDF, or re-derived by the grammar engine after import? → A: **Imported faithfully from the PDF.** "Import" means reproduce the source exactly. Re-deriving holdings via the grammar engine ("Run Agent") is a separate, opt-in transform step — not part of import. Feature 002's assumption to the contrary is **superseded** by this feature.
- Q: How are holdings encoded in the PDF? → A: As **green filled vector boxes** (not text), readable via the PDF drawing/vector layer. Fill RGB ≈ (0.324, 0.508, 0.207). Each box is drawn as four/five thin edge rectangles forming a border around the consonant(s). Border edge thickness distinguishes type: thin (< ~0.5 pt) → short holding; thick (~1.0 pt) → long holding.
- Q: How are pause marks encoded? → A: As colored pipe `|` glyphs in the text layer: a **red** pipe (RGB hex `c00000`) is a long pause; a **blue** pipe (RGB hex `0070c0`) is a short pause. (Black `।`/`॥` daṇḍas are ordinary verse punctuation, not pauses.)
- Q: What is the target markup? → A: Exactly what the editor saves natively (verified against `Library/rudram.smdoc`, `Library/puruṣa sūktam.smdoc`): `<span class="ql-holding-short">…</span>`, `<span class="ql-holding-long">…</span>`, `<span class="ql-short-pause">|</span>`, `<span class="ql-long-pause">|</span>`, `<span class="ql-svara-true">◌̍</span>` for accents, `<span class="ql-change-style">…</span>` for transformation glyphs, `<sup>…</sup>` (composing with change-style) for superscripts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Holdings imported exactly as drawn (Priority: P1)

A user imports a Veda Union PDF that contains samyukta holding boxes. After import, every consonant (or consonant cluster) that has a green box in the PDF is wrapped in the editor's holding style, with the correct short/long variant, on the exact same character(s) — no holdings added, none missed, none on the wrong character.

**Why this priority**: Holdings are the defining mark of this corpus and the explicit reason this feature exists ("import must be faithful, including holdings"). Without them the import is not 1-to-1.

**Independent Test**: Import "bhū sūktam v1.1.pdf"; count the green boxes in the source (83 on page 1) and verify the same number of `ql-holding-short`/`ql-holding-long` spans wrap the same consonants, with short/long matching the box edge thickness.

**Acceptance Scenarios**:

1. **Given** a PDF consonant surrounded by a thin-edged green box, **When** imported, **Then** that consonant is wrapped in `<span class="ql-holding-short">…</span>`.
2. **Given** a PDF consonant surrounded by a thick-edged green box, **When** imported, **Then** that consonant is wrapped in `<span class="ql-holding-long">…</span>`.
3. **Given** a green box that visually spans a multi-character cluster (e.g. an aspirate "bh", a geminate "tt", a conjunct "ddh"), **When** imported, **Then** all base characters inside the box — and only those — are wrapped together in one holding span.
4. **Given** a consonant that is both inside a holding box **and** carries a Vedic accent or is a change-style glyph, **When** imported, **Then** the holding span wraps the character while the accent/change/superscript markup is preserved inside it (correct nesting, no lost marks).

---

### User Story 2 - Pause marks imported with correct type (Priority: P1)

A user imports a PDF whose recitation lines contain pause pipes. After import, each pipe appears in the editor's pause style with the correct short/long variant matching the pipe's color in the PDF.

**Why this priority**: Pause marks are part of the recitation notation and currently import as the wrong style (plain text or change-style). 1-to-1 fidelity requires them.

**Independent Test**: Import the PDF; verify each red `|` becomes `<span class="ql-long-pause">|</span>` and each blue `|` becomes `<span class="ql-short-pause">|</span>`, while black `।`/`॥` remain ordinary text.

**Acceptance Scenarios**:

1. **Given** a red (`c00000`) pipe in the PDF, **When** imported, **Then** it becomes a long-pause span.
2. **Given** a blue (`0070c0`) pipe in the PDF, **When** imported, **Then** it becomes a short-pause span (and is NOT mistaken for a change-style glyph despite sharing the blue color).
3. **Given** a black daṇḍa `।` or double daṇḍa `॥`, **When** imported, **Then** it stays as plain punctuation (not a pause span).

---

### User Story 3 - Everything else stays 1-to-1 (Priority: P1)

The structure and inline markings already handled by feature 002 — title, ignored running header/footer/page-number, subtitle, source/comment, translations, Vedic accents reattached to the correct base character, change-style transformation glyphs, superscripts, verse grouping with blank-paragraph separators — must remain correct after the importer is reworked to be character-aware. The known line-1 reconstruction must still be byte-exact.

**Why this priority**: The rework (span-aware → character-aware reconstruction) touches the same code path; regressions here would break the existing passing behavior.

**Independent Test**: Re-run the existing import tests; line 1 still equals `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।`; title/subtitle/comment/translation counts unchanged; no header strings, no tofu/PUA, no stranded accents on gray lines.

**Acceptance Scenarios**:

1. **Given** the same PDF, **When** imported with the character-aware engine, **Then** all feature-002 acceptance scenarios still pass.
2. **Given** a verse ending on `॥`, **When** imported, **Then** its pādas are consecutive `<p>` and the verse is followed by an empty `<p><br></p>` separator.

---

### User Story 4 - Import then map audio, translations excluded (Priority: P2)

After a faithful import, the user attaches (or fetches via URL) a recording and runs the single mapping action. Only the chant lines are mapped; title/subtitle/comment/translation lines are excluded (reported not-applicable, not failed). Holdings and pauses on the chant lines survive mapping and `.smdoc` save/load unchanged.

**Why this priority**: The PDF→audio round trip is the end goal. The new inline markup must not interfere with target building or persistence.

**Independent Test**: Import the PDF, fetch the matching recording, map; verify shloka lines receive audio regions, translation/title/subtitle/comment lines receive none, and the holding/pause spans are still present after save/reload.

**Acceptance Scenarios**:

1. **Given** an imported document with holdings/pauses on shlokas plus translations, **When** mapping runs, **Then** non-chant lines get no region and shloka lines are placed over their chanted spans.
2. **Given** a mapped, imported document, **When** saved and reloaded, **Then** holding/pause/accent markup is byte-identical.

### Edge Cases

- A green box whose x-range straddles a consonant **and** its following vowel sign must wrap only the consonant character(s) the box actually covers (box bounds are tight around consonants in the source — vowels fall outside).
- A geminate / conjunct cluster ("tt", "nn", "ddh", "cch") drawn under a single box wraps all its base characters in one holding span.
- A blue pipe must be classified as a short-pause, not as a change-style glyph (both are blue) — the `|` character is the discriminator.
- Holding boxes drawn on a line must bind to characters on that line's baseline, not to an adjacent line at a similar x.
- A PDF with no green boxes / no colored pipes imports with zero holding/pause spans (no false positives) and otherwise behaves exactly like feature 002.
- A scanned/image-only PDF (no text layer, no vector boxes) still yields a clear "no text found" outcome, never a crash.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Import MUST read the PDF's vector/drawing layer, detect green holding boxes (fill ≈ RGB (0.324, 0.508, 0.207)), and group their constituent edge rectangles into one logical box each.
- **FR-002**: Each holding box MUST be classified short vs long by its border edge thickness (thin → short, thick → long) using a single robust threshold.
- **FR-003**: Import MUST reconstruct text at the **character** level (per-character bounding boxes) so a holding box can be matched to the exact base character(s) whose horizontal extent falls within the box, on the same baseline.
- **FR-004**: The matched base character(s) of a box MUST be wrapped together in one `ql-holding-short` or `ql-holding-long` span, preserving any accent (`ql-svara-true`), change-style (`ql-change-style`), or superscript (`<sup>`) markup of those characters inside the holding span.
- **FR-005**: Import MUST classify colored pipe glyphs: red (`c00000`) `|` → `ql-long-pause`; blue (`0070c0`) `|` → `ql-short-pause`; and MUST NOT misclassify a blue pipe as change-style. Black `।`/`॥` remain plain text.
- **FR-006**: All feature-002 behavior MUST be preserved: title/subtitle/comment/shloka/translation classification, header/footer/page-number removal, accent reattachment to the correct base char in correct Unicode order, change-style and superscript emission, PUA→Unicode mapping (never tofu), verse grouping with blank-paragraph separators, multi-page ordering.
- **FR-007**: Import MUST run locally/offline and degrade gracefully: PDFs without holdings/pauses import with none; unrecognized structure → best-effort body paragraphs; no text layer → clear "no text" outcome; never crash.
- **FR-008**: The single audio-mapping action MUST continue to map only chant lines; the new holding/pause markup MUST NOT cause non-chant lines to be mapped, and MUST NOT corrupt the text used for alignment target building.
- **FR-009**: The imported document MUST be editable and savable like any other; holding/pause/accent markup MUST round-trip through `.smdoc` save/load byte-identically.

### Key Entities *(include if data involved)*

- **PDF character**: a single glyph with its text, font, size, color, superscript/italic flags, and a tight bounding box (x0, x1, y0, y1) — the unit of character-aware reconstruction.
- **Holding box**: a logical rectangle reconstructed from green edge rectangles in the vector layer, with bounds and an edge thickness → {short, long}, mapped to the base character(s) it surrounds.
- **Logical row**: a reconstructed line (base characters + attached accent/superscript marks + any holdings/pauses), classified to a paragraph style.
- **Imported document**: editor-ready HTML of classified paragraphs with full inline markup, consumed exactly like DOCX import output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For "bhū sūktam v1.1.pdf", the number of imported holding spans equals the number of green boxes in the source (83 on page 1), each on the same consonant(s) with the correct short/long type (100% match, 0 false positives, 0 misses).
- **SC-002**: Every colored pipe in the source becomes the correct pause span (red→long, blue→short); 0 blue pipes misclassified as change-style; black daṇḍas unchanged.
- **SC-003**: Line 1 still reconstructs exactly as `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।`; all feature-002 tests still pass; 100% of characters render as real Unicode (no tofu/PUA).
- **SC-004**: Holding/pause markup nests correctly with accents/change/superscripts (no lost or duplicated marks anywhere in the document).
- **SC-005**: After import + mapping the matching recording, chant lines receive regions, 100% of title/subtitle/comment/translation lines are excluded, and holding/pause markup is byte-identical after `.smdoc` save/reload.
- **SC-006**: A second/generic PDF (or one with no holdings) imports without error and with no false holding/pause spans.

## Assumptions

- The target PDF has a real text layer and a vector layer with the holding boxes (the Veda Union export does). OCR of scanned PDFs is out of scope.
- Holding short/long is fully determined by border edge thickness with a single threshold (~0.5 pt) separating the observed thin cluster (≈0.12–0.24 pt) from the thick cluster (≈0.96 pt).
- The editor's native save markup (the classes listed in Clarifications) is the import output contract, reused exactly so imported docs are indistinguishable from authored ones.
- Holding boxes in the source are drawn tightly around the consonant(s), so center-based character containment cleanly excludes following vowels.
- Pause pipes use the editor's existing pause colors (short = blue `0070c0`, long = red `c00000`); these match the editor's `ql-short-pause`/`ql-long-pause` rendering.
