## Purpose

The standing obligation that every marking, in every script, survives every
operation unchanged — and the mechanism that makes it an obligation rather than
an intention. The owner's instruction: "whenever we add new features and
markings and whatever, we need to have full tests across all scripts, to make
sure that they are always lossless, without an exception, roundtrip is always
exactly 1 to 1 to 1 to 1".

## ADDED Requirements

### Requirement: The matrix is enumerated by the program, not by hand

The test matrix SHALL be generated from the registries themselves — the mark
kinds, the stages, the scripts and the operations — so that adding any one of
them adds its rows. A row with no test SHALL fail the build.

#### Scenario: A new mark kind cannot ship untested
- **WHEN** a kind is added to the mark registry with no tests covering it
- **THEN** the conformance gate fails and names the kind and the missing
  combinations

#### Scenario: A new script cannot ship untested
- **WHEN** a script module is registered with no round-trip coverage
- **THEN** the gate fails and names the script

#### Scenario: The matrix is reported, not just asserted
- **WHEN** the gate passes
- **THEN** it prints how many combinations it covered
- **AND** the number is recorded so a silent shrink is a failure

### Requirement: Every round trip is exact, in every script

A document SHALL survive every conversion unchanged: written and read, exported
and imported, drawn and read back, in every script it declares.

#### Scenario: The file round-trips
- **WHEN** every corpus document is written and read back
- **THEN** the text and every marking are identical, field for field

#### Scenario: Every script round-trips
- **WHEN** each document is rendered to IAST, Devanāgarī, Telugu, Tamil and
  ITRANS and read back
- **THEN** the text and markings recovered are identical to what was drawn from

#### Scenario: Every export round-trips
- **WHEN** a document goes out to Word, to the package format and to `.smdoc`
  and comes back
- **THEN** the text and markings are identical, or the exporter declares in the
  gate exactly which construct it cannot carry and why

#### Scenario: A marking never drifts by one letter
- **WHEN** any round trip is compared
- **THEN** every marking's start and end are the same offsets over the same text

### Requirement: Every marking operation is covered in every script

Applying, removing and toggling SHALL be tested for every mark kind, over
already-marked text as well as unmarked, in every script.

#### Scenario: The operation matrix
- **WHEN** the gate runs
- **THEN** for every kind and every script it covers: applying to unmarked text;
  applying to fully marked text; applying to partly marked text; applying to a
  subset of a marking; applying across a marking's edge; applying across a
  space; applying across a syllable boundary; applying across a line break;
  removing each of those; and toggling each twice back to the start

#### Scenario: Toggling twice is the identity
- **WHEN** any marking is applied to a selection and applied again
- **THEN** the document is byte-identical to before the first press

#### Scenario: The invariants hold after every operation
- **WHEN** any operation in the matrix completes
- **THEN** the markings are sorted, non-overlapping per kind, merged where
  adjacent and equal, and within the text's bounds

### Requirement: Editing text moves the markings correctly

#### Scenario: An edit before a marking shifts it
- **WHEN** text is inserted before a marking
- **THEN** the marking covers the same letters it did

#### Scenario: An edit inside a marking resizes it
- **WHEN** text is inserted in the middle of a marking
- **THEN** the marking covers the inserted text as well, and says so

#### Scenario: Deleting a marking's letters removes it
- **WHEN** every letter a marking covers is deleted
- **THEN** the marking is gone, and the deletion is reported if it was placed by
  hand
