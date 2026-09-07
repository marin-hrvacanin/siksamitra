## Purpose

Word `.docx` import and export, against a style table measured off the owner's
own documents, so that a sadhana written in Word arrives complete and a document
exported from siksamitra opens in Word looking like his own files.

## ADDED Requirements

### Requirement: One measured style table

The mapping between Word character and paragraph styles and format constructs
SHALL live in exactly one table, derived by measurement from real documents
rather than by guess.

#### Scenario: A style has one home
- **WHEN** a Word style is mapped to a format construct
- **THEN** the mapping appears in the style table and nowhere else

#### Scenario: An unknown style is reported, not guessed
- **WHEN** a document uses a character style with no mapping
- **THEN** the import reports the style, its colour, its size and its run count
- **AND** it does not invent a meaning for it

### Requirement: Export preserves the author's Word setup

Export SHALL substitute only the document body into a committed style-only
template, leaving styles, theme and content types byte-identical.

#### Scenario: Styles survive an export
- **WHEN** a document is exported to Word
- **THEN** the styles part, the theme part and the content-types part are byte-identical to the template

### Requirement: The round trip is counted, not eyeballed

A gate SHALL import the owner's own file, export it, and re-import it, asserting
exact counts of verses, syllables, holdings and accents.

#### Scenario: The Word gate holds
- **WHEN** the Word gate runs against the reference document
- **THEN** it reports 340 verses, 11 360 syllables, 3 411 holdings and 4 644 accents preserved
- **AND** any deviation fails the run
