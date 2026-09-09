## ADDED Requirements

### Requirement: A book-length document works like a short one

The program SHALL hold and edit a document the size of the whole Devī
Māhātmyam — roughly 700 verses across 13 chapters, about three and a half times
Śrī Rudram — without the interface degrading. A `.docx` of that length opens and
types without complaint and so SHALL this.

#### Scenario: It opens quickly
- **WHEN** a 700-verse document is opened
- **THEN** the first page is drawn in under 500 ms on the reference machine

#### Scenario: Typing stays within a frame
- **WHEN** a key is pressed anywhere in that document
- **THEN** the document change and the redraw complete in under 16 ms
- **AND** the time does not grow with the document's length

#### Scenario: Marking a selection is immediate
- **WHEN** a holding is applied to a selection of any size
- **THEN** it is drawn in under 16 ms

#### Scenario: Only what is on screen is drawn
- **WHEN** a 700-verse document is scrolled
- **THEN** the number of elements in the page stays bounded
- **AND** scrolling holds 60 frames a second

#### Scenario: The file stays small
- **WHEN** that document is saved
- **THEN** it is under 400 kB uncompressed and under 70 kB in its container

#### Scenario: The measurement is a gate with a control
- **WHEN** the performance gate runs
- **THEN** it reports each number beside the same measurement taken with the
  editor disabled, so a cost that belongs to the browser is not attributed here
- **AND** a regression past the recorded figure fails the build
