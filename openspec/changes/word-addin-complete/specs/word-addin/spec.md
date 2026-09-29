## ADDED Requirements

### Requirement: A document is read in its own style vocabulary

Every reader (the add-in, the app's `.docx` importer, the CLI gates) SHALL
accept both the legacy and the clean vocabulary, and SHALL read a built-in
style through the document's own style table.

#### Scenario: A Croatian Word's headings
- **WHEN** a document's table defines `Naslov3` named `heading 3`
- **THEN** a paragraph styled `Naslov3` is read as a section heading

#### Scenario: German, French, and a Word that is English
- **WHEN** the same document is saved with `berschrift3`, `Titre3`, `Heading3`
- **THEN** all three import as the same document

#### Scenario: A document with no style table
- **WHEN** `word/styles.xml` is absent
- **THEN** ids are read as written and the import still completes

#### Scenario: A clean document and a legacy document
- **WHEN** the same verses are written once in each vocabulary
- **THEN** both import to identical text and markings

### Requirement: A document is written in the vocabulary it already uses

A write SHALL use the legacy vocabulary in a document that already uses it and the clean vocabulary otherwise, and SHALL NOT change an existing style definition.

#### Scenario: A new, empty document
- **WHEN** the first marking is written into a document with none of our styles
- **THEN** the clean styles are used and added

#### Scenario: One of the owner's documents
- **WHEN** the document defines `Translit` or uses any legacy character style
- **THEN** every write uses the legacy ids, and only `Visarga` is added

#### Scenario: A document holding both
- **WHEN** a document uses legacy and clean styles
- **THEN** writes use legacy, and the pane says the document holds both

#### Scenario: A style the user has changed
- **WHEN** the document's `Holding` has been recoloured by hand
- **THEN** no write or "Add the styles" changes its definition

#### Scenario: A style name taken by something else
- **WHEN** a document has a style named `Mantra` that is not ours (different
  id, or ours by id with a different type)
- **THEN** it is not overwritten, and the pane reports the clash

### Requirement: Anusvāra and visarga changes are distinct

An anusvāra change and a visarga change SHALL be written in different styles and SHALL be distinguishable when read.

#### Scenario: Written by the rules
- **WHEN** a rule turns `ṁ` into `n` and `ḥ` into `s`
- **THEN** `n` is written in the anusvāra style and `s` in the visarga style

#### Scenario: Read back
- **WHEN** either style is read
- **THEN** it is a `was` change whose value is `ṁ` or `ḥ` respectively

#### Scenario: A legacy document's blue runs, upgraded
- **WHEN** "Upgrade this document" runs on a legacy document
- **THEN** each `Anusvara` run is reclassified by the table in design D3, the
  counts are shown before anything is written, and every run that fits no row
  is left untouched and listed

#### Scenario: The upgrade is exact on his document
- **WHEN** the upgrade classifier runs over `fixtures-sadhana.docx`
- **THEN** every run is classified, the ambiguous ones are exactly the ones
  measured (3 `a`, 9 spaces), and a second upgrade changes nothing

### Requirement: Any text can be marked as an anusvāra or visarga change by hand

A reader SHALL be able to mark a selection as an anusvāra or visarga change from the pane, the ribbon, the right-click menu and the app.

#### Scenario: In Word, from the right-click menu
- **WHEN** the reader selects `n` in a mantra line and chooses śikṣāmitra ▸
  Anusvāra change
- **THEN** it is written as an anusvāra change of `ṁ`, with no pane open

#### Scenario: A letter that cannot be that change
- **WHEN** the selection is a vowel and Visarga change is chosen
- **THEN** nothing is written and the reason is shown

#### Scenario: In the app
- **WHEN** the same selection is marked from the app's Marking tab or context
  menu
- **THEN** the document gets the same `was` marking, as a hand-placed mark

#### Scenario: Toggling
- **WHEN** the command is applied again over the same letters
- **THEN** the change is removed (bold's rule), and undo restores it

### Requirement: The same commands everywhere

The pane, the ribbon menu and the right-click menu SHALL offer the same
commands, computed by the same model code: Short, Long, Anudātta, Svarita,
Dīrgha svarita, Anusvāra change, Visarga change, Candrabindu, Svarabhakti,
Pause, Long pause, Clear.

#### Scenario: One command, three entry points
- **WHEN** Short is applied from each of the three over the same selection
- **THEN** the three documents are byte-identical

### Requirement: Nothing the add-in cannot carry through is rewritten

A paragraph containing anything the add-in cannot carry through SHALL NOT be rewritten; the command SHALL refuse and name what is in the way.

#### Scenario: Every non-text element, one at a time
- **WHEN** a mantra paragraph contains a picture (inline or floating), a shape,
  a text box, a chart, an equation, a field, a content control, a hyperlink, a
  bookmark, a comment, a footnote reference, or a tracked change
- **THEN** a marking command refuses, names the element, and the paragraph's
  OOXML is byte-identical afterwards

#### Scenario: A whole-document run over a document with pictures
- **WHEN** "Run over the document" meets such paragraphs
- **THEN** it writes every other mantra paragraph, skips those, and lists them

#### Scenario: A table, a list, a header, a footnote, a text box
- **WHEN** the caret is in a table cell, a list item, the header or footer, a
  footnote, or inside a text box
- **THEN** the pane either works on that paragraph exactly as on a body
  paragraph, or says it cannot — never throws, never writes elsewhere

#### Scenario: A selection over several paragraphs
- **WHEN** a marking command is applied to a selection spanning paragraphs
- **THEN** it refuses with the reason; "Run over the selection" applies to each
  mantra paragraph in it

#### Scenario: Text that is not ordinary
- **WHEN** the paragraph holds a tab, a soft line break, an emoji or other
  non-BMP character, right-to-left text, 10 000 characters, or nothing
- **THEN** reading and writing it neither throws nor loses a character

### Requirement: A write is not made against a paragraph that has changed

A write SHALL be refused when the paragraph no longer holds the text the command was computed on.

#### Scenario: A co-author edits the line
- **WHEN** the paragraph's text changes between the pane's read and its write
- **THEN** the write is refused, the pane re-reads, and says so

### Requirement: The pane cannot be made to throw

No document, host state or Office error SHALL leave the pane throwing or unusable.

#### Scenario: Any exception
- **WHEN** any Office call rejects, or the model throws, in any entry point
- **THEN** one line names the operation and the reason, the pane stays usable

#### Scenario: A hostile document
- **WHEN** the paragraph's OOXML is malformed, huge, deeply nested or contains
  markup in its text
- **THEN** the reader returns or refuses in bounded time, and nothing from the
  document is interpreted as HTML

#### Scenario: A read-only document, or no office.js, or an old Word
- **WHEN** the document is in viewing mode, office.js did not load, or
  `WordApi 1.3` is not supported
- **THEN** the pane says which, and every command is disabled with that reason

### Requirement: Messages stay until the next action

A message SHALL remain visible until the reader's next action.

#### Scenario: A refusal
- **WHEN** Short is pressed over a range with no letter a holding may take
- **THEN** the reason is visible, and is still visible after the refresh

### Requirement: The pane follows Word's theme

The pane SHALL follow Word's light, dark and high-contrast themes, live.

#### Scenario: Word in dark mode, and in light
- **WHEN** Word's theme is dark (or light)
- **THEN** the pane is dark (or light), and every text pair is ≥ 4.5 : 1

#### Scenario: The theme changes while the pane is open
- **WHEN** Word's theme is switched
- **THEN** the pane follows without being reopened

#### Scenario: High contrast
- **WHEN** Windows high-contrast is on
- **THEN** the pane uses system colours and stays usable

### Requirement: The pane is clear at every width

The pane SHALL be usable and legible from 300 px wide, and SHALL show only the sections that need doing.

#### Scenario: Narrow and wide
- **WHEN** the pane is 300, 320, 400 or 600 px wide
- **THEN** nothing is clipped, nothing scrolls sideways, every control is
  reachable by keyboard and has a label

#### Scenario: Only what needs doing
- **WHEN** the document has every style and nothing to upgrade
- **THEN** the "This document" section is not shown

### Requirement: The register travels with the document

The chosen register SHALL be stored in the document.

#### Scenario: Reopening
- **WHEN** a register is chosen and the document is saved and reopened
- **THEN** the pane shows the same register

### Requirement: The add-in is tested inside Word

Every requirement above SHALL be exercised inside a real Word by an automated tool.

#### Scenario: Every command, live
- **WHEN** `tools/word-web.mjs` runs against a signed-in Word on the web
- **THEN** it performs every command and every refusal above on a real
  document and asserts the document's OOXML afterwards, and fails if the
  session is not the one it was told to use

### Requirement: Every symbol is one press away, in its proper style

The pane SHALL offer every character the app's IAST palette offers — vowels,
the five stop series, semivowels and sibilants, and the Vedic and punctuation
marks (svaras, candrabindu, anusvāra forms, visarga forms, avagraha, daṇḍa,
double daṇḍa, the virāma tick, oṁ) — from the ONE palette table the app uses,
and SHALL insert each in the style it belongs to.

#### Scenario: A letter
- **WHEN** `ṛ` is pressed with the caret in a mantra line
- **THEN** `ṛ` is inserted at the caret in the line's own text style

#### Scenario: A svara after a letter
- **WHEN** Svarita is pressed with the caret just after `a`
- **THEN** the combining stroke is attached to that `a`, in the Svara style

#### Scenario: A svara with nothing to attach to
- **WHEN** a svara is pressed at the start of a paragraph or after a space
- **THEN** nothing is inserted and the reason is shown

#### Scenario: A selection
- **WHEN** a symbol is pressed over a selection
- **THEN** the selection is replaced by it, exactly as typing would

#### Scenario: A pause, a Vedic anusvāra
- **WHEN** Pause or `gṁ` is pressed
- **THEN** it is inserted in the Pause or Vedic Anusvāra style

### Requirement: A styled insertion is not sticky

After the add-in inserts anything in a style other than the surrounding text's,
the next character the reader types SHALL be in the surrounding style, as if
the insertion had not changed the formatting at the caret.

#### Scenario: Typing after a svara
- **WHEN** Svarita is inserted after `a` and the reader then types `gni`
- **THEN** `gni` is in the mantra line's text style, not the Svara style

#### Scenario: Typing after a pause, a holding, a change
- **WHEN** the reader types right after any styled insertion or marking
- **THEN** what they type carries the surrounding style

### Requirement: The add-in can be shared without the store

The site SHALL say how to give the add-in to colleagues without the store —
per person by uploading the manifest in Word on the web, per organisation by an
administrator's deployment — and that code updates reach them automatically
while a manifest change needs a re-upload.

#### Scenario: A colleague follows the site
- **WHEN** a colleague with a personal Microsoft account follows the web steps
- **THEN** the add-in appears in their Word on the web

### Requirement: The add-in has its own ribbon tab

The add-in SHALL add a śikṣāmitra tab to Word's ribbon holding every command
that acts directly — the holdings, svaras, aids, the anusvāra and visarga
changes, pauses, Clear, the rules over the selection and the document — with
menu buttons for lists (symbols, style sets). The pane SHALL remain for what
needs room: the symbol palette, rule options, style-set previews, messages.

#### Scenario: Marking from the tab with no pane open
- **WHEN** a range is selected and Short is pressed on the śikṣāmitra tab
- **THEN** the paragraph is written exactly as the pane's Short writes it

#### Scenario: A command that cannot apply
- **WHEN** a tab command is pressed where it cannot apply
- **THEN** nothing is written and the reason is shown to the reader

### Requirement: Style sets

The reader SHALL be able to switch every śikṣāmitra style in the document
between named style sets (Veda Union Classic and the others the app's export
styles offer), from the SAME table the app exports with, and back.

#### Scenario: Switching and switching back
- **WHEN** a style set is applied and then the original is applied again
- **THEN** every style definition is byte-identical to before

#### Scenario: Only our styles
- **WHEN** a style set is applied
- **THEN** no style that is not śikṣāmitra's changes

### Requirement: The add-in is the app, one to one

Every capability, rule, command, register, style set and design token SHALL
come from the shared packages; the add-in and the app SHALL NOT carry parallel
implementations of anything. A capability the host cannot offer SHALL be
listed with the reason.

#### Scenario: One command, both programs
- **WHEN** the same command is applied to the same text in the app and in Word
- **THEN** the resulting text and markings are identical

### Requirement: Re-running the rules is idempotent

Running the rules again with the same register, stages and mode SHALL change nothing.

#### Scenario: Twice is once
- **WHEN** the rules are run over a range, and then run again with the same
  register, stages and mode
- **THEN** the second run changes nothing, in the app and in Word

### Requirement: Showing plain is lossless

The reader SHALL be able to show a text plain — every change mark turned back
into what was typed (`gṁ`, `m̐`, an assimilated nasal back to `ṁ`; a visarga
change back to `ḥ`) — and back, with no loss.

#### Scenario: Plain and back
- **WHEN** a marked text is shown plain and then marked again
- **THEN** it is byte-identical to the original, hand-placed marks included

### Requirement: A register change over a selection is defined

Choosing a register while text is selected SHALL apply to a stated scope, keep hand-placed marks, and be one undo step.

#### Scenario: A selection inside one section
- **WHEN** part of a Kṛṣṇa Yajurveda section is selected and Ṛgveda is chosen
- **THEN** the reader is asked whether the register applies to the selection's
  verses or the whole section, the chosen scope is re-derived, hand-placed
  marks are kept, and one undo restores it all

#### Scenario: A selection across sections with different registers
- **WHEN** the selection spans sections whose registers differ
- **THEN** the register shown is "mixed", and applying one sets every verse
  in the selection to it, with the same guarantees

#### Scenario: Nothing selected
- **WHEN** the caret is in a verse and a register is chosen
- **THEN** it applies to the caret's section, and says so

### Requirement: Large selections

A command over any amount of text SHALL keep the host responsive, show progress, be cancellable and finish in bounded time.

#### Scenario: A whole long document
- **WHEN** the rules run over Śrī Rudram-sized text in Word or the app
- **THEN** progress is shown, the host stays responsive, the run can be
  cancelled leaving the document as it was, and it completes in bounded time

### Requirement: The rulebook

A rulebook SHALL be available from the app and the add-in, in their shared
design: every rule, grouped by stage and register, with navigation, and with
examples COMPUTED by the engine and drawn by the shared renderer — generated
from the rule registry, so it cannot disagree with what the program does.

#### Scenario: A rule's example
- **WHEN** the rulebook shows a rule
- **THEN** its example is the engine's own output for that input, drawn

### Requirement: The owner's documents survive whole

Importing and exporting the owner's documents SHALL lose nothing they contain.

#### Scenario: Everything his documents contain
- **WHEN** his Word documents are imported and exported
- **THEN** every verse, every comment inside a line, every prose and comment
  paragraph, the title, the Ṛgvedic overline (`Long`) and the section
  registers survive, and a plain document with no styles imports as source
  text ready to mark
