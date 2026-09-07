## Purpose

Writing systems, as interchangeable modules. Every script is equal: any may be
authored in, any may be read in, any may be added without touching the ones
already there. IAST, Devanagari, Telugu and Tamil are the four that exist today;
ITRANS, Kannada, Malayalam, Bengali, Grantha, ISO-15919 and Harvard-Kyoto are
the kind of thing that must cost one file.

## ADDED Requirements

### Requirement: The canonical layer is phonemic, not a script

The engine SHALL operate on a script-neutral phoneme inventory. No writing
system SHALL serve as the engine's internal representation.

This is the requirement the others depend on. Today IAST plays two roles at
once — it is a script a reader can choose, AND it is the key every table is
indexed by and the surface every rule matches against. That double role is the
whole of why the other scripts are second-class: they are defined as columns
next to IAST rather than as peers of it.

#### Scenario: A rule matches sounds, not letters
- **WHEN** a rule tests whether a letter is a sibilant, is voiced, or belongs to a varga
- **THEN** it reads the phoneme's own classification
- **AND** it does not inspect a glyph in any particular script

#### Scenario: IAST is one rendering among several
- **WHEN** the script registry is inspected
- **THEN** IAST appears as a registered script like any other
- **AND** removing it from the registry does not prevent the engine from deriving

### Requirement: A script is a module, registered

Each writing system SHALL be a self-contained module supplying its own mapping
from phoneme to written form, plus whatever it needs to assemble a syllable.
Adding a script SHALL require adding a module and registering it, and SHALL NOT
require editing another script's data or any shared table row.

#### Scenario: Adding a script touches one file plus a registration
- **WHEN** a new writing system is added
- **THEN** the change consists of that script's own module and one registry entry
- **AND** no existing script's mapping, no phoneme row and no rule is edited

#### Scenario: No conditional names a script
- **WHEN** the transliteration code is searched for a branch on a script identifier
- **THEN** no such branch exists — differences between scripts are fields in a script module

### Requirement: The script identifier is open

Script identity SHALL be an open identifier resolved against the registry, not a
closed union enumerated in the type system. A document, a preference or an API
SHALL be able to name a script the compiler has never heard of and be told at
run time whether it is registered.

#### Scenario: An unregistered script is reported, not crashed on
- **WHEN** a document names a script this build has no module for
- **THEN** the reader reports the unknown script by name
- **AND** it renders the scripts it does have

### Requirement: A document carries script forms as a map

A syllable SHALL carry its written forms keyed by script identifier, not as a
fixed set of named fields. A document SHALL declare which scripts it carries.

#### Scenario: A document carrying a new script needs no format change
- **WHEN** a document is written that carries a script added after the format was specified
- **THEN** the forms are stored under that script's identifier
- **AND** a reader without that script's module ignores it and reports it, rather than failing

### Requirement: Any script may be the authored surface

Authoring SHALL be possible in any registered script whose mapping is
reversible. The editor SHALL NOT require the author to work in one designated
script.

#### Scenario: Authoring in Devanagari
- **WHEN** an author types in Devanagari
- **THEN** the input resolves to phonemes and every other registered form is derived from those
- **AND** the result is identical to authoring the same text in any other reversible script

#### Scenario: A one-way script cannot be authored in
- **WHEN** a script's mapping is not reversible
- **THEN** the registry marks it as read-only
- **AND** the editor offers it for reading and refuses it for authoring, saying why

### Requirement: Representational gaps are data, not special cases

Where a script has no character for a phoneme, that gap SHALL be recorded in
that script's module together with its approximation, and SHALL be reported as
an approximation. No script SHALL be handled by a named exception in shared code.

#### Scenario: A script lacking a vowel says so
- **WHEN** a phoneme has no character in some script and an approximation is defined
- **THEN** the output carries the approximation, marked as approximate
- **AND** the round trip reports the loss rather than silently absorbing it

#### Scenario: Lossless round trip where the script allows it
- **WHEN** text is converted to a reversible script and back
- **THEN** every phoneme returns identical
- **AND** the transliteration gate reports 100 % for that script

### Requirement: Every registered script is gated

The transliteration gate SHALL cover every registered script, and a newly
registered script SHALL enter the gate with its own baseline rather than being
exempt.

#### Scenario: A new script arrives with evidence
- **WHEN** a script module is registered
- **THEN** the gate measures it over the corpus and records its baseline
- **AND** a script whose forms have not been reviewed is marked unverified rather than counted as passing
