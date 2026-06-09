# Feature Specification: Veda Union PDF Import

**Feature Branch**: `002-veda-union-pdf-import`

**Created**: 2026-06-08

**Status**: Draft

**Input**: Import a Veda Union–styled PDF (e.g. "bhū sūktam v1.1.pdf") into the editor so that its structure (title, headers to ignore, subtitle, source/comment, accented Sanskrit shlokas, translations) is recognized and rendered correctly, with all IAST symbols and Vedic accent marks intact — and so the imported shlokas can then be auto-mapped to a downloaded recording while translations/titles are left out of the mapping.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import a Veda Union PDF with correct structure & accents (Priority: P1)

A user opens a Veda Union PDF in the editor. The importer recognizes the document's parts and renders them in the editor's existing paragraph styles: the big top word becomes the **title**, the running page header + page number are **ignored**, the gray line under the title is the **subtitle**, the small italic citation (e.g. "taittirīya saṁhitā 1.5.3") is a **comment/source**, each accented mantra line is a **shloka** with its Vedic accents (svarita/anudātta/udātta) in the right places, and the gray italic English lines are **translations**. All IAST diacritics and accent marks render correctly (no mojibake, no lost/misplaced accents).

**Why this priority**: Without correct structured import, nothing else is possible. This is the feature.

**Independent Test**: Import "bhū sūktam v1.1.pdf"; verify the title/subtitle/comment/shloka/translation classification, that headers/footers are gone, and that a known line reconstructs exactly as `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।`.

**Acceptance Scenarios**:

1. **Given** a Veda Union PDF, **When** the user imports it, **Then** the document title, subtitle, comment, shloka lines, and translations appear in the corresponding editor paragraph styles.
2. **Given** the PDF's running header ("bhū sūktam   kṛṣṇa yajurvedīya") and page numbers, **When** imported, **Then** they do NOT appear in the document body.
3. **Given** a shloka with Vedic accents drawn as separate glyphs in the PDF, **When** imported, **Then** each accent attaches to the correct base character (no accents leaking into adjacent lines, none lost).
4. **Given** IAST text with diacritics (ā ī ū ṛ ṁ ḥ ś ṣ ṭ ḍ ṅ ñ ṇ) and transformation marks, **When** imported, **Then** all characters render correctly.

---

### User Story 2 - Map a recording to the imported shlokas, ignoring translations (Priority: P2)

After importing, the user attaches a recording (or fetches it from a URL) and runs the single mapping action. Only the chanted mantra lines are mapped; the title, subtitle, comment, and translation lines are excluded from mapping and left untouched.

**Why this priority**: The PDF→audio round trip is the end goal; mapping non-chant lines would be wrong.

**Independent Test**: Import the PDF, fetch the matching recording, map; verify shloka lines get audio regions and translation/title/subtitle/comment lines are not assigned regions.

**Acceptance Scenarios**:

1. **Given** an imported document with shlokas + translations, **When** mapping runs, **Then** translation/title/subtitle/comment lines receive no audio region and are reported as not-applicable (skipped), not as failed matches.
2. **Given** the imported shlokas and their recording, **When** mapping runs, **Then** the mantra lines are placed over their chanted spans with confidence, tolerant of the usual partial/order differences.

---

### User Story 3 - Robust, general PDF import (not just this file) (Priority: P3)

The importer works for Veda Union PDFs in general — different texts, multiple pages, varying numbers of verses, optional/“also in” citation labels — degrading gracefully (best-effort body text) for PDFs it doesn't fully recognize rather than failing.

**Why this priority**: The user explicitly wants it to "work in general," not overfit to one file.

**Independent Test**: Import a second Veda Union PDF (or a generic text PDF) and confirm it imports as reasonable structured/body text without errors.

**Acceptance Scenarios**:

1. **Given** any multi-page Veda Union PDF, **When** imported, **Then** each page's content is concatenated in order with structure preserved and no header/footer noise.
2. **Given** a non–Veda-Union PDF, **When** imported, **Then** text is extracted as body paragraphs without crashing.

### Edge Cases

- Accent glyphs drawn ABOVE the base line (different y) must bind to the base character below them, not to the preceding smaller line.
- Private-use-area glyphs (e.g. a candrabindu glyph) must map to their Unicode equivalent or be dropped cleanly, never emitted as boxes.
- Citation/label lines ("optional", "also in …", "taittirīya … 1.5.3") look identical (gray italic) to translations; they must still be classified sensibly (as comment/source vs translation).
- A verse that wraps across two physical lines, and the trailing "॥ N ॥" verse number, must be preserved.
- A scanned/image-only PDF (no text layer) must report that no text could be extracted rather than producing garbage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The editor MUST offer a PDF import path (open-file dialog accepts `.pdf`; an import action converts it to editor content).
- **FR-002**: Import MUST classify content into the editor's existing paragraph styles: title, subtitle, comment/source, shloka (body mantra), and translation.
- **FR-003**: Running page headers and page numbers (top margin) and footers (bottom margin) MUST be excluded from the body.
- **FR-004**: Vedic accent marks (svarita, anudātta, udātta, tick) rendered as separate positioned glyphs MUST be reattached to the correct base characters, preserving Unicode order.
- **FR-005**: All IAST diacritics and the editor's transformation marks MUST be preserved; private-use glyphs MUST be mapped to Unicode or dropped (never shown as tofu/boxes).
- **FR-006**: Multi-page PDFs MUST import in page order as one document; verse numbers and danda punctuation MUST be preserved.
- **FR-007**: Import MUST run locally (no cloud) and degrade gracefully: unrecognized structure → best-effort body paragraphs; no text layer → a clear "no text found" outcome; never crash the editor.
- **FR-008**: After import, the single audio-mapping action MUST map only chant lines; title/subtitle/comment/translation lines MUST be excluded from mapping (reported as not-applicable, not failed).
- **FR-009**: The imported document MUST be editable and savable like any other (it becomes normal editor content / `.smdoc`).

### Key Entities *(include if feature involves data)*

- **PDF span**: a run of text with font, size, color, and position — the raw signal for classification and accent reattachment.
- **Logical row**: a reconstructed line of the document (primary text + its attached accent/superscript marks), classified to a paragraph style.
- **Imported document**: editor-ready HTML of classified paragraphs, consumed exactly like DOCX import output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For "bhū sūktam v1.1.pdf", the title, subtitle, source-comment, every shloka line, and every translation are classified correctly (≥95% of lines in the right style), with zero header/footer lines in the body.
- **SC-002**: The reconstructed shloka line 1 equals exactly `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।`, and across the document no accent marks are stranded on translation/comment lines.
- **SC-003**: 100% of characters render as real Unicode (no replacement boxes/tofu).
- **SC-004**: After import + mapping the matching recording, the chant lines receive regions and 100% of translation/title/subtitle/comment lines are excluded from mapping.
- **SC-005**: Importing a second/generic PDF completes without error (best-effort body text).

## Assumptions

- The PDF has a real text layer (the target file does); OCR of scanned PDFs is out of scope.
- Holdings (samyukta borders) are visual CSS in the editor and are NOT recoverable from the PDF text layer; they are re-derived by the existing grammar engine after import, not imported.
- Classification is driven by font size + color + page position, calibrated to the Veda Union export style but with sensible fallbacks for general PDFs.
- The existing DOCX-import HTML contract (Quill-compatible `<p class="ql-…">`) is reused as the import output format.
