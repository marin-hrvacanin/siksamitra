## Purpose

Reading marked documents out of published PDFs, including marks that exist only
in the vector layer, and writing PDFs back out through the renderer rather than
through a second drawing implementation.

## ADDED Requirements

### Requirement: Import reads the vector layer

PDF import SHALL read holding boxes from the vector layer, and SHALL recover
letters that an exporter flattened into paths and left absent from the text
layer.

#### Scenario: Flattened letters are recovered
- **WHEN** a document whose text layer is missing letters is imported
- **THEN** the recovered letters appear in the output
- **AND** the count of recovered letters is reported

#### Scenario: The reader is chosen by measurement
- **WHEN** a PDF is imported
- **THEN** the font family of the spans selects the calibrated reader before any row is parsed

### Requirement: Import writes IAST only

The PDF importer SHALL produce IAST and SHALL NOT produce derived scripts. The
derived scripts SHALL be filled by the one transliterator afterwards.

#### Scenario: No second transliterator exists
- **WHEN** the importer completes
- **THEN** its output carries IAST
- **AND** the derived scripts are produced by the shared transliteration step

### Requirement: Imported documents are attested

A document produced by PDF import SHALL carry no source layer, so that its marks
are never regenerated.

#### Scenario: An imported document resists re-derivation
- **WHEN** a PDF-imported document is asked to re-derive
- **THEN** the operation refuses under rule zero

### Requirement: Export goes through the renderer

PDF export SHALL print through the same renderer and stylesheet the screen uses.
There SHALL be no independent PDF drawing implementation for marks.

#### Scenario: Print output is verified
- **WHEN** the print gate prints a reference document headlessly
- **THEN** every syllable and every holding box survives into print media
- **AND** the page does not scroll, the paper is white regardless of theme, and the document paginates
