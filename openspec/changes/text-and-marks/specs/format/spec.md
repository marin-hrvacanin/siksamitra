## ADDED Requirements

### Requirement: A verse is one text and a list of markings

A verse SHALL hold its letters as a single string and its markings as a list
addressed into that string. The format SHALL NOT store a second representation
of the same letters.

#### Scenario: The text is what was typed
- **WHEN** a verse contains an anusvāra that the rules display as `n`
- **THEN** the stored text contains `n`, which is what is shown
- **AND** a `was` marking over it carries the `ṁ` that was typed

#### Scenario: Stripping the markings gives the typed text
- **WHEN** every marking is removed from a verse
- **THEN** the remaining text is exactly what an author would type
- **AND** no reconstruction, inversion or lookup table is involved

#### Scenario: There is no second copy to disagree with
- **WHEN** a document is read
- **THEN** no field holds syllable division, a script spelling, or a displayed
  letter
- **AND** each of those is computed from the text and the markings

### Requirement: A marking addresses a range of the text

A marking SHALL carry a kind, a half-open range over the verse's text, an
optional value, the stage that produced it, and whether a person or the engine
placed it. An offset SHALL NOT fall inside a character — neither between the two
halves of a surrogate pair nor between a base letter and a combining mark.

#### Scenario: A marking spans whatever was selected
- **WHEN** a holding is applied to a selection that crosses a space
- **THEN** one marking covers the whole selection including the space

#### Scenario: A point marking attaches to no letter
- **WHEN** a pause is inserted between two letters
- **THEN** its range is empty and sits at that position

#### Scenario: Offsets never split a character
- **WHEN** a marking is written over text containing a surrogate pair or a
  letter carrying a combining mark
- **THEN** both offsets fall between characters, never inside one

### Requirement: Markings hold their invariants

After every operation a verse's markings SHALL be sorted by start then kind, and
no two markings of the same kind SHALL overlap. Adjacent markings of the same
kind, value and origin SHALL be one marking.

#### Scenario: Applying over an existing marking does not double it
- **WHEN** a long holding is applied over letters that are already long
- **THEN** exactly one marking covers them afterwards

#### Scenario: Removing part of a marking splits it
- **WHEN** a holding covers letters 3 to 10 and letters 5 to 7 are cleared
- **THEN** two markings remain, 3 to 5 and 7 to 10

#### Scenario: An invalid marking list is refused, not repaired silently
- **WHEN** a document is read whose markings overlap or run past the text
- **THEN** the read reports the fault and names the verse

### Requirement: A displayed letter is a stored marking a person may set

A substitution SHALL be a marking carrying the letters that were REPLACED by the
range it covers. It SHALL be settable and removable by hand, and SHALL NOT be recomputed
except by an explicit re-run.

#### Scenario: The engine records what it substituted
- **WHEN** the rules display an anusvāra as `n`
- **THEN** the text holds `n` and a `was` marking over it carries `ṁ`
- **AND** its origin is the engine

#### Scenario: A person sets a display by hand
- **WHEN** a letter is selected and shown as something else from the menu
- **THEN** a `was` marking carries it with a hand origin
- **AND** no re-run in keep-hand mode replaces it

#### Scenario: A substitution may change the number of letters shown
- **WHEN** one typed letter is displayed as two
- **THEN** the marking covers the two shown letters and its value is the one typed

#### Scenario: A substituted letter is never mistaken for a typed one
- **WHEN** a visarga is displayed as `s`
- **THEN** the letter carries a `was` marking holding `ḥ`
- **AND** a reader can tell it from a typed `s` without heuristics

### Requirement: A document file is a compressed container

A saved document SHALL be a zip container holding canonical JSON. The JSON SHALL
use full key names and one object per marking.

#### Scenario: A large document is kilobytes
- **WHEN** Śrī Rudram is saved
- **THEN** the file is under 25 kB
- **AND** the whole eleven-document corpus is under 60 kB

#### Scenario: The bytes are canonical
- **WHEN** a document is saved twice with no change between
- **THEN** the two files are byte-identical

#### Scenario: Size is a gate
- **WHEN** a document grows past its recorded size
- **THEN** the build fails and names the document and both numbers

## REMOVED Requirements

### Requirement: Attested marks are never re-derived

**Reason**: Rule zero existed because a verse could lose the letters it was
derived from. With one text there is nothing to lose and nothing to re-derive
against — the text is always present, and the engine only runs when asked. The
concept, its refusals, and the words "attested" and "transcribed verse" go with
it.

**Migration**: Every marking a document arrives with is recorded with a hand
origin, so no re-run in keep-hand mode can overwrite it. The protection rule
zero gave is kept; the prohibition is not.

### Requirement: Derived fields are outputs, recomputed never edited

**Reason**: A displayed letter is derived AND must be hand-settable, which this
rule forbids. Origin replaces it: a value the engine produced may be recomputed;
a value a person set may not, unless they ask.

**Migration**: Script spellings and syllable division remain pure outputs and
are no longer stored at all. Markings carry an origin.
