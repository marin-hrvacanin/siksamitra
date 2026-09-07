## Purpose

The authoring surface. It edits the token model through a projection of the
source text, and it must feel like an editor: one continuous caret, real
selection, real paste. This is the capability whose absence in both v1 and the
platform editor made them feel wrong in opposite ways.

## ADDED Requirements

### Requirement: The editor edits the token model, never HTML

Typing, marking and pasting SHALL mutate the source text and the override set.
The editor SHALL NOT read or write rendered HTML as its document state.

#### Scenario: A keystroke edits source
- **WHEN** a character is typed in the marked view
- **THEN** the source string is edited at the offset the source map gives
- **AND** the verse is re-derived and repainted from the new source

#### Scenario: A mark cannot be typed
- **WHEN** an author attempts to place a holding directly
- **THEN** the editor records an override or edits the source character
- **AND** it never inserts a mark as an unexplained presentational artifact

### Requirement: The caret is continuous within a section

Within a section the caret SHALL move across verse boundaries, selection SHALL
span verses, and a multi-verse paste SHALL distribute across verses. The caret
SHALL NOT span sections, because the section is the unit of loading.

#### Scenario: Arrow-down crosses a verse boundary
- **WHEN** the caret is on the last line of a verse and the author presses Down
- **THEN** the caret enters the next verse without a mode change or a click

#### Scenario: Select-all selects the section
- **WHEN** the author presses select-all inside the marked surface
- **THEN** the whole section is selected
- **AND** no other section is loaded as a result

#### Scenario: Pasting an anuvaka distributes
- **WHEN** the author pastes several lines of IAST spanning multiple verses
- **THEN** the lines are distributed across verses and each is derived

### Requirement: Derived output is not editable

The editor SHALL NOT allow typing into a derived script or into a derived mark
field. Where a script is a reading view, the editor SHALL say so rather than
silently discarding input.

#### Scenario: A reading script refuses input
- **WHEN** the author types while a derived script is the active view and in-place editing for it is unavailable
- **THEN** the editor states that the view is a reading view and how to reach an editable one

### Requirement: One gesture is one undo step

Every mutation SHALL be a named command with an inverse. Undo and redo SHALL
move one authoring gesture at a time, not one character.

#### Scenario: A mark command undoes as a unit
- **WHEN** an author applies a holding across a selection and presses undo once
- **THEN** the whole application is reversed

### Requirement: An attested verse is protected

A verse whose marks are attested SHALL NOT be edited silently. The editor SHALL
state that editing discards the attested marks, and SHALL require an explicit
action.

#### Scenario: Editing a transcribed verse warns first
- **WHEN** an author opens a verse whose svaras are attested
- **THEN** the editor reports that the marks are attested and not in the letters
- **AND** editing proceeds only after an explicit confirmation

### Requirement: Derivation is cached, never stored

The editor SHALL memoise derivation per verse on the hash of source, profile and
overrides, and SHALL NOT persist derived tokens as editor state.

#### Scenario: A profile change repaints without a save
- **WHEN** the profile changes
- **THEN** affected verses re-derive from cache keys
- **AND** no stale derived state survives the change
