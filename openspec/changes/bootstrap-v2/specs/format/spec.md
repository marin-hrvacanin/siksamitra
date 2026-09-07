## Purpose

The presentation-independent document format that holds Vedic and classical
Sanskrit recitation text. It is the source of truth; every rendering, export and
print is derived from it. It is the one artifact both siksamitra and Veda Union
agree on, and the only logic Veda Union is permitted to contain alongside the
renderer.

## ADDED Requirements

### Requirement: Marks are data, never presentation

A marking (holding, svara, anusvara treatment, pause, reading aid, candrabindu,
svarabhakti) SHALL be represented as a typed field on a token. The format SHALL
NOT represent a marking as a CSS class, an HTML element, an inline style, or any
other presentational encoding.

#### Scenario: A holding is stored as data
- **WHEN** a document carries a short holding on a conjunct
- **THEN** the holding is a field on the syllable's unit, carrying its kind and extent
- **AND** no HTML or CSS class name appears anywhere in the stored document

#### Scenario: Presentation cannot round-trip through the format
- **WHEN** a document is written and read back
- **THEN** no field exists whose value is a class name, a colour, a font, or a pixel measurement

### Requirement: Every script is equal and open-ended

A document SHALL carry its written forms keyed by script identifier, and SHALL
declare which scripts it carries. No script SHALL be privileged by the model,
and the set of scripts SHALL NOT be fixed by the format. See `scripts` for the
registry this rests on.

#### Scenario: Deriving scripts is lossless
- **WHEN** the transliteration gate runs over the corpus
- **THEN** every syllable in every verified script matches its stored form
- **AND** the gate reports 31 762 of 31 762 or better

#### Scenario: A derived script is never authored
- **WHEN** an editor writes to a document
- **THEN** it writes the authored surface and the marks
- **AND** every other script form is recomputed, not accepted from the caller

#### Scenario: A document may carry a script the reader lacks
- **WHEN** a document carries a script this build has no module for
- **THEN** the reader reports the script by name and renders the ones it has
- **AND** the unknown forms survive a read-and-write round trip untouched

### Requirement: Attested marks are never re-derived

A document without a `src` layer SHALL be treated as attested: its marks came
from a witness, not from the engine, and any operation that would regenerate
them SHALL refuse rather than proceed. This is rule zero.

#### Scenario: A transcribed verse resists derivation
- **WHEN** a caller asks to re-derive a verse that has no source layer
- **THEN** the operation refuses and reports the verse as attested

#### Scenario: An importer marks its output attested
- **WHEN** a document is imported from a PDF or a Word file
- **THEN** the written document carries no `src` layer

### Requirement: Provenance attaches at any level

A citation SHALL be attachable to any node of the hierarchy: the whole document,
a part, a section, or an individual verse. Provenance SHALL be inheritable
downward, a node without its own citation taking its nearest ancestor's.

#### Scenario: A verse overrides the document's source
- **WHEN** a verse carries its own citation and its document carries another
- **THEN** the verse resolves to its own
- **AND** its siblings without a citation resolve to the document's

### Requirement: The hierarchy is arbitrary-depth

The format SHALL NOT fix a document to a specific number of levels. Grouping
SHALL nest to whatever depth a text requires, down to pada and word.

#### Scenario: A deeply nested text is representable
- **WHEN** a text has parts containing kandas containing anuvakas containing verses containing padas
- **THEN** the document represents that nesting without a synthetic or flattened level

### Requirement: The format carries a version and a content hash

Every document SHALL declare a format version. Every package SHALL carry a hash
computed over exactly the canonical bytes it transports. A hash mismatch SHALL
be refused rather than repaired.

#### Scenario: A tampered package is refused
- **WHEN** a package is opened whose document bytes do not match its recorded hash
- **THEN** the open fails with a mismatch error and nothing is imported

#### Scenario: A newer document meets an older reader
- **WHEN** a document declares a format version above what the reader supports
- **THEN** the reader reports the version gap rather than parsing it partially

### Requirement: Assets are referenced, never inlined

Audio, images and other binary assets SHALL be referenced by identity and stored
beside the document. The format SHALL NOT permit an asset to be embedded in the
document body as a data URI or a base64 string.

#### Scenario: A document with audio stays small
- **WHEN** a document with twenty-six recordings is written
- **THEN** the document body contains references only
- **AND** opening the first verse does not require reading any audio
