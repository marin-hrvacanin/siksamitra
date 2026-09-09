## ADDED Requirements

### Requirement: The engine runs only when asked

The marking rules SHALL run only in response to an explicit request naming a
range. Typing, opening a document, changing a register, switching a script or
any other incidental event SHALL NOT invoke them.

#### Scenario: Typing produces text and nothing else
- **WHEN** a person types into a new document
- **THEN** the document holds exactly the characters typed
- **AND** it carries no markings

#### Scenario: Opening a document shows what was saved
- **WHEN** a document is opened
- **THEN** its markings are the ones in the file
- **AND** no rule has run

#### Scenario: Changing the register marks nothing by itself
- **WHEN** the register is changed
- **THEN** the document is unchanged until a re-run is asked for
- **AND** the interface says which stages are now out of date

### Requirement: Re-running is per range, per stage, per origin

A re-run SHALL take a range, a set of stages and a mode. In `keep-hand` it SHALL
replace only markings the engine placed; in `replace-all` it SHALL replace every
marking of those stages in the range.

#### Scenario: A hand marking survives keep-hand
- **WHEN** a holding placed by hand lies inside a re-run range in keep-hand mode
- **THEN** it is still there afterwards with the same value and origin

#### Scenario: A hand marking is cleared by replace-all
- **WHEN** the same re-run is asked for in replace-all mode
- **THEN** the hand marking is gone and the engine's answer is in its place

#### Scenario: Other stages are untouched
- **WHEN** only the holdings stage is re-run
- **THEN** every svara, substitution and aid marking is unchanged

#### Scenario: A hand-removed marking stays removed
- **WHEN** a holding the engine placed is removed by hand, and holdings are
  re-run in keep-hand mode
- **THEN** no holding is placed there

### Requirement: A stage is added without touching the model

Adding a marking pass SHALL require adding a stage name and the pass that
produces markings for it, and SHALL NOT require a change to the document format,
the renderer's marking placement, or the re-run mechanism.

#### Scenario: Stages stack in order
- **WHEN** two stages both produce substitutions over the same letters
- **THEN** the later stage sees the earlier stage's output
- **AND** re-running one leaves the other's markings in place

### Requirement: The rules read the text, never the display

A rule SHALL read the letters in the text. It SHALL NOT read a substitution
another stage produced except through that stage's declared output.

#### Scenario: An anusvāra is an anusvāra to the rules
- **WHEN** a holding rule examines a letter displayed as `n` whose text is `ṁ`
- **THEN** it sees an anusvāra

## MODIFIED Requirements

### Requirement: Every script is equal and open-ended

A document SHALL declare which scripts it is written for. Script spellings SHALL
NOT be stored; each SHALL be computed from the text and the markings when
drawing or exporting.

#### Scenario: Nothing on disk is a spelling
- **WHEN** a document is written
- **THEN** it contains no Devanāgarī, Telugu or Tamil forms

#### Scenario: Every script is verified against the corpus
- **WHEN** the transliteration gate runs
- **THEN** every syllable in every script matches its recorded form
- **AND** the gate covers IAST, Devanāgarī, Telugu, Tamil and ITRANS
