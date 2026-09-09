## ADDED Requirements

### Requirement: The HTML export carries a picture and fetches nothing

An exported `.html` SHALL contain every picture the document carries, as image
data in the page, and SHALL contain no reference the reader would have to fetch.

#### Scenario: The picture is in the page
- **WHEN** a document with an embedded picture is exported
- **THEN** the page contains an image element whose source is that picture's data

#### Scenario: Nothing is fetched
- **WHEN** the exported file is scanned for sources, hyperlinks and stylesheet
  URLs
- **THEN** every one of them is image or font data carried in the file

#### Scenario: A picture the document only names is not emitted as a URL
- **WHEN** a document names a picture that lives on a host
- **THEN** the page draws the placeholder and its alternative text
- **AND** the name still rides in the embedded document, so the file re-opens
  with it

#### Scenario: Every frame carries it
- **WHEN** the same document is exported in each export style
- **THEN** each frame contains the picture

### Requirement: An exported picture round-trips byte for byte

Reading an exported file back SHALL return the picture data unchanged.

#### Scenario: The bytes are the bytes
- **WHEN** an exported document is read back and its picture decoded
- **THEN** the decoded bytes equal the file that was inserted, byte for byte

### Requirement: The image export contains the picture

A raster or vector export of a page SHALL show the pictures that page draws.

#### Scenario: Measured in the pixels, not asserted
- **WHEN** a page holding one full-width picture of a known solid colour is
  rasterised
- **THEN** the commonest colour in the resulting image is that colour

### Requirement: A package does not duplicate a carried picture

Where a document carries its own pictures, the portable package SHALL NOT also
store them beside it.

#### Scenario: The package's assets are what is not in the document
- **WHEN** a document with embedded pictures is packaged
- **THEN** `assets/` holds the recordings and nothing that the document already
  carries
