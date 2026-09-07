## Purpose

The marking engine: given source text in IAST and a profile, it produces the
marked token stream, applying the siksa rules for holdings, anusvara and visarga
treatment, reading aids, svarabhakti and svara. It is the intellectual core of
siksamitra and it never leaves this repo.

## ADDED Requirements

### Requirement: Derivation is a pure function

`derive(source, profile)` SHALL be a pure function of its inputs. It SHALL NOT
read global state, mutate its arguments, or depend on the identity of the
document being processed.

#### Scenario: The same input gives the same output
- **WHEN** derive runs twice over identical source and profile
- **THEN** the two token streams are byte-identical

#### Scenario: A defect is expressible as a case
- **WHEN** a marking defect is reported
- **THEN** it can be written as an input, a profile and an expected output, and added to the test suite without any surrounding application

### Requirement: A rule is data, not a branch

Every rule SHALL be a registry entry carrying an identifier, a stage, and a
predicate over the profile. The engine SHALL NOT contain a conditional on a
document identifier, slug, title or filename.

#### Scenario: The registry has no document-specific branch
- **WHEN** the engine source is searched for a comparison against a document identifier
- **THEN** no such comparison exists

#### Scenario: A rule is switched by profile alone
- **WHEN** a document needs a rule that another document must not have
- **THEN** the difference is expressed as a profile field and the rule's predicate reads it

### Requirement: The profile is the one parametrization

Every difference in behaviour between two documents SHALL be a field on the
profile. Presets SHALL be named compositions of profile fields and SHALL add no
behaviour of their own.

#### Scenario: A preset reproduces a document
- **WHEN** the profile verb is run against a shipped document
- **THEN** it reports which preset reproduces that document's marks, or that none does

#### Scenario: A declared profile field is live
- **WHEN** a profile field is declared
- **THEN** at least one rule reads it, and a test proves that toggling it changes the output

### Requirement: Re-derivation is verified against the corpus

The engine SHALL be gated by re-deriving every shipped document from its own
letters and comparing the result to the stored document letter by letter, mark
by mark, in every verified script. The gate SHALL be a ratchet: a score may
improve, and a regression SHALL fail.

#### Scenario: The corpus gate holds the line
- **WHEN** the corpus gate runs over the eleven shipped documents
- **THEN** it reports at least 15 506 of 16 021 syllables reproduced
- **AND** any document scoring below its recorded baseline fails the run

#### Scenario: An attested svara is excluded honestly
- **WHEN** a document carries svaras from an accented witness rather than derived from letters
- **THEN** the gate holds those out of its score and reports that it did

### Requirement: An automatic holding lands on one letter

Automatic holding placement SHALL mark exactly ONE letter per cluster. It SHALL
NOT group a cluster under a single spanning box.

The letter is the first member of the cluster that is ABLE to host: for a
doubled or aspirated pair the first member itself, and where the first member
cannot host — a sibilant or a nasal — the next member that can.

Owner's ruling, 2026-09-06: another practitioner groups whole clusters under one
box. This software does not. A person may build such a group by hand, the format
carries it, and documents imported from that practice keep it — but derivation
never produces one.

#### Scenario: A doubled consonant hosts on its first member
- **WHEN** automatic holdings run over a cluster written as a doubled or aspirated pair
- **THEN** the box is on the first letter of the pair
- **AND** it covers that letter only

#### Scenario: A cluster opening with a letter that cannot host
- **WHEN** the first member is a sibilant or a nasal
- **THEN** the box moves to the next member able to host

#### Scenario: Derivation never widens a box
- **WHEN** any line is derived
- **THEN** every holding group produced covers exactly one letter

### Requirement: The engine is isomorphic

The engine SHALL run unchanged in a browser, in Node, in the CLI and in the
desktop shell. It SHALL NOT depend on the DOM, on the filesystem, or on any
platform API.

#### Scenario: The engine runs headless
- **WHEN** the CLI derives a document with no browser present
- **THEN** the derivation completes and matches what the editor produces for the same input
