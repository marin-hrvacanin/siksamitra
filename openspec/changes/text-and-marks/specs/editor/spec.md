## ADDED Requirements

### Requirement: A marking button behaves like bold

Applying a marking to a selection SHALL turn it on everywhere in the selection
unless it is already on everywhere, in which case it SHALL turn it off.

#### Scenario: A mixed selection turns fully on
- **WHEN** part of the selection is long and part is unmarked, and Long is pressed
- **THEN** the whole selection is long

#### Scenario: Pressing again turns it fully off
- **WHEN** Long is pressed again on that selection
- **THEN** no part of it is long

#### Scenario: A subset turns off on its own
- **WHEN** a subset of a long run is selected and Long is pressed
- **THEN** only that subset stops being long
- **AND** the two remaining pieces are still long

#### Scenario: The button shows the selection's state
- **WHEN** the whole selection is long
- **THEN** the Long button is shown pressed
- **AND** a mixed selection shows it unpressed

#### Scenario: A holding crosses a space
- **WHEN** a selection spanning two words is marked long
- **THEN** one box is drawn across both words and the space between them

### Requirement: The holding controls are Short and Long

The ribbon and the menu SHALL offer Short and Long as toggles, and SHALL NOT
offer None. Removing a marking the engine placed SHALL record that removal so a
later keep-hand re-run does not restore it.

#### Scenario: None is gone
- **WHEN** the holding controls are shown
- **THEN** they are Short and Long, and a way to clear every marking in the
  selection
- **AND** no control is labelled None

#### Scenario: Removing an engine holding sticks
- **WHEN** a holding the engine placed is toggled off and the rules are re-run
  in keep-hand mode
- **THEN** the holding does not come back

### Requirement: Marking does not move the text

Applying or removing a marking SHALL NOT change the position or size of any
glyph.

#### Scenario: The line does not reflow
- **WHEN** a holding is applied to a word in the middle of a line
- **THEN** every glyph in that line is at the same position as before, measured

### Requirement: The pointer says what it is over

#### Scenario: An I-beam over the text
- **WHEN** the pointer is over the document
- **THEN** it is the text cursor
- **AND** it is the arrow over the ribbon, the panel and the status bar

### Requirement: Right-click opens the application's menu

#### Scenario: The browser menu never appears over the text
- **WHEN** the text is right-clicked, in the desktop app and in a browser
- **THEN** the application's menu opens and the native one does not

#### Scenario: The menu carries the marking actions
- **WHEN** the menu is open over a selection
- **THEN** it offers Short, Long, clear markings, Show as…, nasalisation,
  insert pause, re-apply rules by stage, and cut, copy and paste

### Requirement: Every input gesture reaches the document

Text entry SHALL be verified end to end against the document's own text for
every ordinary gesture, in an empty document and in a loaded one.

#### Scenario: A space is a character like any other
- **WHEN** a space is typed into a new empty document
- **THEN** the document's text contains it

#### Scenario: The whole input surface is driven
- **WHEN** the input gate runs
- **THEN** it covers printable characters, space, newline, backspace, delete,
  word and line deletion, undo, redo, cut, copy, paste of plain and marked
  text, drag within the document, and an IME composition
- **AND** each is asserted against the document's text, not against the page
