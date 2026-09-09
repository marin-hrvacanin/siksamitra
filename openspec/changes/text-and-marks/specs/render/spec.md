## ADDED Requirements

### Requirement: Drawing is a function of the text and the markings

The renderer SHALL take a verse's text and markings and produce the drawn page.
It SHALL read no stored spelling, no stored syllable division and no stored
displayed letter.

#### Scenario: The same input always draws the same page
- **WHEN** a verse is drawn twice from the same text and markings
- **THEN** the two results are identical

#### Scenario: The text is what is drawn
- **WHEN** a verse carries substitutions from two stages
- **THEN** the letters drawn are the text itself, with no substitution applied at draw time

#### Scenario: Syllables are divided from the displayed letters
- **WHEN** a substitution has changed how many letters are shown
- **THEN** the syllable division follows the text, which is what is shown

### Requirement: A box is drawn over a range, in every script

A holding SHALL be drawn as one box over its whole range, whatever it contains
and whichever script is shown.

#### Scenario: One box across three syllables
- **WHEN** a holding covers letters that fall in three syllables
- **THEN** one box is drawn, with no internal edges and no gap in its rules

#### Scenario: A box across a space
- **WHEN** a holding covers two words and the space between them
- **THEN** the box encloses the space

#### Scenario: Every script joins
- **WHEN** the same holding is drawn in IAST, Devanāgarī, Telugu and Tamil
- **THEN** each draws one box
- **AND** the reader and the editor draw it the same way

#### Scenario: Weight survives a join
- **WHEN** a long holding and a short holding are each drawn over a range
- **THEN** the long box's stroke is measurably heavier than the short one's

### Requirement: A marking occupies no layout space

#### Scenario: Marked and unmarked text set identically
- **WHEN** a line is drawn with and without a holding on it
- **THEN** every glyph box is in the same place in both
