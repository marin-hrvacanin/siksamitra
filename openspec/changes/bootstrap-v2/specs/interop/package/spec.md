## Purpose

The portable package: one file that carries a document, its sources, its audio
and its figures between siksamitra and Veda Union, between machines, and into
and out of the operating system.

## ADDED Requirements

### Requirement: No asset is ever inlined

A package SHALL store binary assets as separate entries. It SHALL NOT embed an
asset in the document body.

#### Scenario: A packaged document with audio stays small
- **WHEN** a document carrying recordings is packaged
- **THEN** the document entry contains references only
- **AND** the package is an order of magnitude smaller than the same content inlined

### Requirement: The document entry is byte-identical to what is served

The document inside a package SHALL be the exact canonical bytes the platform
serves, and the package hash SHALL be taken over exactly those bytes.

#### Scenario: A hash mismatch refuses
- **WHEN** a package is opened whose document bytes disagree with its hash
- **THEN** the open fails and reports the mismatch
- **AND** no repair is attempted

### Requirement: The operating system can open a package

The package extension SHALL be registered by the desktop application, and
launching a package SHALL open it.

#### Scenario: Double-clicking a package opens it
- **WHEN** a package file is double-clicked
- **THEN** the application opens with that document loaded
- **AND** if an instance is already running, that instance opens it

### Requirement: A package is the handoff between the two products

Uploading a package to the platform SHALL produce a stored document; downloading
from the platform SHALL produce a package the editor can open.

#### Scenario: Round trip between tool and platform
- **WHEN** a document is exported, uploaded, downloaded and reopened
- **THEN** the reopened document is identical to the exported one
