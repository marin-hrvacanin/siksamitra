## Purpose

The one renderer IN THIS PROGRAM: token stream to screen and to paper, in four
scripts, with the siksa marks drawn as measured geometry rather than font
combining marks. The editor is WYSIWYG, so the surface an author types into and
the surface a reader reads must be the same code — one renderer here is what
makes that true.

vedaunion.org has its own, independently. That is deliberate (design D1), and
the conformance fixtures under `interchange` are what keep the two readings of
the format agreed.

## ADDED Requirements

### Requirement: There is exactly one renderer in this program

Screen, editor, print and any embedded reader SHALL render through the same
implementation. No surface in this repository SHALL draw a mark by any other
means. (This says nothing about other programs; see `interchange`.)

#### Scenario: Print matches screen
- **WHEN** a document is printed
- **THEN** the marks come from the same stylesheet the screen uses
- **AND** no separate drawing code exists for paper

#### Scenario: The editor matches the reader
- **WHEN** a verse is shown in the editor and in the reader
- **THEN** both call the same render primitives with the same tokens

### Requirement: Marks are drawn from tokens, not from fonts

A svara, a holding box, a candrabindu or a reading aid SHALL be positioned from
the token model and the measured geometry table. The renderer SHALL NOT rely on
a font's combining-mark placement to position a siksa mark.

#### Scenario: A mark survives a script change
- **WHEN** the same verse is shown in IAST, Devanagari, Telugu and Tamil
- **THEN** every mark appears in every script

#### Scenario: Short and long holdings stay distinguishable
- **WHEN** the render check measures a fragment carrying every mark
- **THEN** the short stroke and the long stroke differ measurably at every supported text size
- **AND** neither collapses to the other at large sizes

### Requirement: Geometry comes from generated tokens

Every mark dimension, weight, inset and colour SHALL originate in the single
token source and be generated into the stylesheet. A dimension SHALL NOT be
written literally in a component or a stylesheet by hand.

#### Scenario: The token gate is clean
- **WHEN** the token generator runs in check mode
- **THEN** the generated stylesheet matches the token source exactly

### Requirement: A long document mounts lazily

The renderer SHALL mount a section's DOM only when it approaches the viewport,
and SHALL keep it mounted thereafter. It SHALL NOT rely on `content-visibility`
to achieve this.

#### Scenario: A large document opens without stalling
- **WHEN** a document of well over 100 000 potential DOM nodes is opened
- **THEN** only sections near the viewport have DOM
- **AND** scrolling mounts further sections ahead of the scroll position

#### Scenario: Mounted stays mounted
- **WHEN** the reader scrolls past a section and back
- **THEN** the section was not unmounted, and text selection and scroll anchoring are preserved

### Requirement: The render check is measured, not asserted by eye

A diagnostic surface SHALL render one fragment carrying every mark in all four
scripts and report the measured result, so that a new WebView can be qualified
before the shell ships on it.

#### Scenario: A new WebView is qualified
- **WHEN** the render check runs on a WebView the app has not shipped on
- **THEN** it reports box counts, stroke weights and distinct glyph advances per script
- **AND** a failure to resolve four distinct faces is reported as a failure
