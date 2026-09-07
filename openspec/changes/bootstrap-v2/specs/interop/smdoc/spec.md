## Purpose

Reading v1 documents. v2 replaces v1, so it must open the library v1 leaves
behind, including its embedded audio and its presentation-coupled markup. This
is the one interop capability that is new work rather than moved work.

## ADDED Requirements

### Requirement: All three v1 container encodings are read

The importer SHALL read the v1 container in each of its encodings: the
LZMA-compressed form, the legacy zlib form, and plain JSON, selected by the
file's magic bytes.

#### Scenario: Each encoding opens
- **WHEN** a v1 document in any of the three encodings is opened
- **THEN** its content, metadata and asset payloads are recovered

#### Scenario: An unknown container is refused clearly
- **WHEN** a file carries unrecognised magic bytes
- **THEN** the importer reports the bytes it found and refuses

### Requirement: Presentational markup becomes tokens

The importer SHALL convert v1's class-annotated markup into the token model:
holdings, svaras, anusvara treatments, pauses and reading aids become data.

#### Scenario: A class-annotated holding becomes data
- **WHEN** a v1 document containing holding markup is imported
- **THEN** the output carries holdings as token fields
- **AND** no class name survives into the output

#### Scenario: Implicit hierarchy is recovered
- **WHEN** a v1 document expresses verse numbering as literal text in a flat paragraph sequence
- **THEN** the importer produces explicit sections and verses
- **AND** the numbering is structure, not text

### Requirement: Embedded audio is extracted to assets

Audio embedded in a v1 document SHALL be extracted to separate asset entries and
referenced, never carried through as inline data.

#### Scenario: A large v1 document becomes a small package
- **WHEN** a v1 document whose compressed size is tens of megabytes is imported
- **THEN** its audio is written as separate assets
- **AND** the resulting document body is small enough to open a single verse without reading audio

### Requirement: The importer is scored against documents that exist in both formats

Where a text exists both as a v1 document and as a verified v2 document, the
importer SHALL be compared letter by letter against the verified one, and the
score SHALL be ratcheted.

#### Scenario: The importer gate holds the line
- **WHEN** the smdoc gate runs over texts present in both formats
- **THEN** it reports a per-document score against the verified document
- **AND** a score below the recorded baseline fails the run
