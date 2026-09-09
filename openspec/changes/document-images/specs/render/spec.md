## ADDED Requirements

### Requirement: One component draws every picture

There SHALL be exactly one component that renders a figure, and every surface —
the flow, paged and web views, the reader, the printed page and every export —
SHALL use it. No other module SHALL emit an `img` element for a document's
picture.

#### Scenario: The same picture in every view
- **WHEN** one document is drawn in the flow view, the paged view and the web view
- **THEN** each draws the picture from the same component with the same classes

#### Scenario: The reader draws it too
- **WHEN** the reader renders a step with a figure
- **THEN** it renders through the same component, differing only in the resolver
  it supplies

### Requirement: A picture's width is a fraction of its column

A figure's width SHALL be one of five named steps, each expressed against the
column it stands in, and every one of those values SHALL come from the token
source. A width SHALL NOT be a length stored in a document.

#### Scenario: The same figure in two columns
- **WHEN** a `medium` figure is drawn in a 605 px page column and again in a
  wider web column
- **THEN** it is half of each, up to its recorded ceiling

#### Scenario: Zoom moves a picture with the page
- **WHEN** the document zoom changes
- **THEN** a fixed-width step scales by the same multiplier as every other
  document length

### Requirement: A picture never narrows a metrical line

Text SHALL NOT flow beside a picture within a verse. A floated figure SHALL be
cleared at every verse.

#### Scenario: A float stands beside prose, not beside a mantra
- **WHEN** a `medium` figure is floated into a step of Durgā Sūktam at A4
- **THEN** no pāda level with it wraps onto a second line

#### Scenario: The control proves the rule defends something
- **WHEN** the clear is removed and the same page is measured again
- **THEN** at least one pāda level with the figure wraps
- **AND** if none does, the check fails, because the rule would be defending
  nothing

### Requirement: A picture always fits a page

A figure SHALL NOT be taller than the content box of the page it is drawn on.
Where the surface has no page, no cap SHALL be applied.

#### Scenario: A tall picture is shrunk, not cropped
- **WHEN** a figure would exceed the page's content height
- **THEN** it is scaled down inside its box with its whole content visible

#### Scenario: The measuring probe is capped like the page
- **WHEN** the paged view measures block heights
- **THEN** the probe carries the same cap as the page, so the map reserves what
  will be drawn

#### Scenario: The web column has no cap
- **WHEN** the same document is drawn in the web view
- **THEN** no page height limits the picture, because there is no page

### Requirement: A picture the file does not carry says so

Where a figure's image cannot be resolved, the renderer SHALL draw a placeholder
carrying the figure's alternative text, and SHALL emit no URL.

#### Scenario: The pūjā manual opened here
- **WHEN** a document names pictures the host cannot resolve
- **THEN** each draws a plate carrying its alternative text
- **AND** the page contains no reference the reader would have to fetch

### Requirement: A printed picture is the picture the paged view showed

The print path SHALL NOT change a figure's width, placement or wrapping.

#### Scenario: Print agrees with the preview
- **WHEN** a document with a figure is measured on screen and under print media
- **THEN** the figure has the same width in both

### Requirement: Reading preferences never hide a picture

No reading preference SHALL remove a figure. Focused reading in particular SHALL
keep it.

#### Scenario: Focused reading keeps the drawings
- **WHEN** the reader is in focused reading, with the play controls and the
  translation off
- **THEN** every figure is still drawn, because a mudrā drawing is the only form
  that step's instruction takes
