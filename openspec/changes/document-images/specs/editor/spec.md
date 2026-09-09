## ADDED Requirements

### Requirement: Every change to a picture is one undoable command

Inserting, replacing, resizing, aligning, captioning and deleting a picture
SHALL all be the same edit command with a different payload, applied through the
edit session. There SHALL be no other path that writes a figure.

#### Scenario: Undo gives back the bytes that were there
- **WHEN** a picture is inserted into a document and the insert is undone
- **THEN** the document's canonical bytes equal the bytes before the insert

#### Scenario: A resize is undoable on its own
- **WHEN** a picture is resized and the resize is undone
- **THEN** the picture returns to the size it had, and stays in the document

#### Scenario: A command that changed nothing records no undo step
- **WHEN** a figure command names a position that holds no picture
- **THEN** the document is unchanged, no undo step is recorded, and the reason
  is reported

### Requirement: A picture command does not touch the text

A figure command SHALL NOT write a verse's source, re-derive a verse, rebase a
mark or orphan a recording.

#### Scenario: The verses are the same objects afterwards
- **WHEN** a picture is inserted into a step containing verses
- **THEN** the verses are unchanged, no marks are reported lost, and no verse is
  reported re-derived

### Requirement: A shared picture is copied before it is changed

Where an item references a figure from the document's shared library, changing
it SHALL make an inline copy carrying the change, leave the library entry alone,
and say so.

#### Scenario: Resizing one of three uses of a drawing
- **WHEN** a referenced figure is resized at one step
- **THEN** that step carries its own copy at the new size
- **AND** the library entry and the other steps are unchanged
- **AND** the person is told that a copy was made

### Requirement: A picture is described before it is inserted

The insert gesture SHALL ask for alternative text and SHALL NOT complete without
it.

#### Scenario: Insert is unavailable until there is a description
- **WHEN** a file has been chosen and no description typed
- **THEN** the insert control is disabled and says why

#### Scenario: The cost is stated before it is paid
- **WHEN** a picture is about to be inserted
- **THEN** its pixel size and how much it will add to the document are shown

### Requirement: A picture is selectable, and not editable as text

A picture SHALL be selectable by pointing at it, SHALL be drawn as selected, and
SHALL NOT accept the caret or be altered by a text-editing gesture.

#### Scenario: Selecting a picture arms its controls
- **WHEN** a picture is clicked in the editor
- **THEN** it is drawn as selected and the controls that act on a picture become
  available, reading that picture's own size and alignment

#### Scenario: The caret does not enter a picture
- **WHEN** the document column is editable and a picture is in it
- **THEN** the picture is not editable content and a keystroke beside it cannot
  remove it

#### Scenario: Selecting a picture does not move it
- **WHEN** a picture becomes selected
- **THEN** its position and size on the page are unchanged
