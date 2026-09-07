## Purpose

How siksamitra hands finished work to vedaunion.org, and how two independently
built programs stay agreed about what a document means. The two projects are
separately hosted, separately deployed and separately owned code. Neither
depends on the other. What they share is a FORMAT, and this capability is about
keeping that format honest without a shared library to enforce it.

## ADDED Requirements

### Requirement: Neither project depends on the other

Siksamitra SHALL NOT import, vendor or require any vedaunion.org code, and SHALL
NOT be required by it. The relationship is a file format, not a dependency.

#### Scenario: Siksamitra builds alone
- **WHEN** the repository is built on a machine that has never seen the platform
- **THEN** every package builds, every test runs and every gate passes

#### Scenario: The platform keeps its own renderer
- **WHEN** the platform displays a document
- **THEN** it uses its own rendering implementation
- **AND** nothing in this repository is needed at its build time or its run time

### Requirement: Export produces the interchange format exactly

Export SHALL produce documents that the platform reads without repair,
transformation or negotiation. An export that the platform cannot read is a
defect in the exporter, not a task for the importer.

#### Scenario: An exported document is accepted unmodified
- **WHEN** a document is exported and handed to the platform
- **THEN** it is stored and displayed with no field dropped, added or rewritten

#### Scenario: Export is verifiable without the platform present
- **WHEN** the export gate runs offline
- **THEN** it validates the output against the recorded contract
- **AND** it does not require a running platform to do so

### Requirement: The contract is a versioned, written artifact

The interchange format SHALL be specified in this repository as a written
contract carrying a version, so that either project can be changed first and the
other can be brought to match deliberately.

#### Scenario: One side moves first
- **WHEN** a construct is added on either side
- **THEN** the contract version is raised and the change recorded
- **AND** the other side can be updated against the written contract rather than by reading source

#### Scenario: A reader meets a newer document
- **WHEN** a document declares a contract version above what a reader supports
- **THEN** the reader reports the version gap
- **AND** it does not partially interpret the document

### Requirement: Conformance fixtures are the arbiter

Because the two projects implement the format independently, a shared set of
fixture documents SHALL exist covering every construct the format defines, each
with its expected interpretation. Both projects SHALL be runnable against it.

#### Scenario: Drift is detected rather than discovered
- **WHEN** the fixture suite runs against an implementation
- **THEN** every construct is exercised and each disagreement names the construct, the expected value and the produced one

#### Scenario: A new construct arrives with a fixture
- **WHEN** the format gains a construct
- **THEN** a fixture covering it is added in the same change
- **AND** the suite fails against an implementation that has not yet learned it

### Requirement: Import accepts what the platform produces

Siksamitra SHALL open documents the platform exports, so that a document may be
edited on either side. A construct siksamitra does not understand SHALL be
preserved and reported, never silently dropped.

#### Scenario: A round trip through the tool preserves unknown fields
- **WHEN** a document containing a construct this version does not model is opened, edited and written back
- **THEN** the unmodelled construct is still present in the output
- **AND** the user is told it was carried through untouched
