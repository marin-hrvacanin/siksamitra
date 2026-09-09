## ADDED Requirements

### Requirement: A picture is a block of a step

A picture SHALL be an item of a section, and its index in `items` SHALL be its
only anchor. The format SHALL NOT provide a way to place a picture inside a
verse's text, at an absolute position on a page, or behind or in front of text.

#### Scenario: A picture sits between blocks
- **WHEN** a picture is put into a step
- **THEN** it occupies a position in that step's `items`
- **AND** the blocks before and after it keep their order and their content

#### Scenario: A verse is not rewritten by a picture
- **WHEN** a picture is inserted into a step that contains verses
- **THEN** no verse's text, marks or source changes
- **AND** nothing is re-derived

#### Scenario: A picture carried by a verse is not a block
- **WHEN** a verse carries its own figures
- **THEN** they are drawn inside the verse and move with it
- **AND** they are not addressable as blocks of the step

### Requirement: A picture the document carries holds its own bytes

A picture inserted by a person SHALL be stored as the image data itself. A
picture named by a path or a URL SHALL remain readable, and SHALL be resolved by
the host rather than by the renderer.

#### Scenario: An inserted picture survives a save
- **WHEN** a picture is inserted and the document is written and read again
- **THEN** the recovered image data is byte-identical to the file that was chosen

#### Scenario: A named picture is not fetched by the renderer
- **WHEN** a figure's `src` is a path and no host resolves it
- **THEN** no request is made for it
- **AND** the document draws a placeholder carrying the figure's alternative text

#### Scenario: What a document may carry
- **WHEN** a figure carries image data
- **THEN** its media type is one of PNG, JPEG, WebP, GIF or AVIF
- **AND** an SVG is refused, because an SVG is a script host

#### Scenario: A picture too large for a document is refused
- **WHEN** a picture's encoded size exceeds the recorded ceiling
- **THEN** it is refused by name, with its size and the ceiling
- **AND** nothing is written, and nothing is silently re-encoded

### Requirement: A picture has alternative text

Every figure SHALL carry non-empty alternative text, and it SHALL NOT be the
same text as its caption. A figure that fails either SHALL be refused before it
enters a document.

#### Scenario: A picture with no description cannot be inserted
- **WHEN** an insert is attempted with empty or whitespace alternative text
- **THEN** the insert is refused and the section is unchanged
- **AND** the refusal says a picture with none is a step somebody cannot follow

#### Scenario: A caption is not a description
- **WHEN** a figure's alternative text equals its caption
- **THEN** it is reported, because a screen reader would hear one sentence twice

#### Scenario: The whole corpus is checked
- **WHEN** every shipped document is walked
- **THEN** every figure in it has alternative text and a legal value on each axis

### Requirement: A picture reserves its space before it loads

A figure SHALL declare enough for its box to be reserved before its bytes
decode: either a fixed crop, or its intrinsic width and height.

#### Scenario: An automatic crop needs an intrinsic size
- **WHEN** a figure names `crop: auto` and carries no width and height
- **THEN** it is reported, because nothing reserves its space and the text under
  it moves when it loads

### Requirement: Every picture in a document can be found in one walk

The format SHALL offer one function that returns every figure a document draws —
inline in an item, referenced from the shared library, and carried by a verse —
in reading order, with where each one is.

#### Scenario: All three placements come back
- **WHEN** a document holds an inline figure, a referenced one and one on a verse
- **THEN** all three are returned, in document order

#### Scenario: A reference that resolves to nothing yields nothing
- **WHEN** an item names a figure the document's library does not hold
- **THEN** that item contributes no figure, and nothing is invented for it
