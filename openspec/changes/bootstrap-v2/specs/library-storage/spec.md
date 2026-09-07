## Purpose

Where documents live for a user who has no account: local, file-first,
section-at-a-time, no server. It is one half of the storage interface whose
other half is online mode.

**Open design question (owner, 2026-09-06): is a bespoke "Library" needed at
all?** v1 carries both a Recents list and a Library browser, which are two
answers to one question, and a file-first tool already has an answer built by
the operating system. This capability specifies the STORAGE contract; which
surfaces sit on top of it is settled in `9.x` and is deliberately not assumed
here. What the requirements below must not do is presuppose a browser UI.

## ADDED Requirements

### Requirement: Storage is an interface with interchangeable implementations

The editor SHALL depend on a storage interface, not on a transport. Local files
and the platform API SHALL be implementations of that interface.

#### Scenario: The editor is transport-agnostic
- **WHEN** the editor is constructed with either implementation
- **THEN** it opens, edits and saves without conditional logic on which store is active

### Requirement: A document loads a section at a time

Opening a document SHALL read its index and manifest only. Section bodies SHALL
be read on demand, and a save SHALL write one section.

#### Scenario: A large document opens immediately
- **WHEN** a multi-megabyte document is opened
- **THEN** only the manifest and section index are read
- **AND** the first section is fetched separately

#### Scenario: Saving one section preserves the others
- **WHEN** one section is edited and saved
- **THEN** the other sections are untouched on disk
- **AND** document-level data keyed across sections is merged rather than replaced

### Requirement: The library is file-first and account-free

The application SHALL be fully usable with no account and no network. Opening,
editing, saving, importing and exporting SHALL all work offline.

#### Scenario: First run without an account
- **WHEN** the application is launched by a user who has never signed in
- **THEN** the library, the editor and every interop path are available

### Requirement: Nothing in the contract presupposes a browsing UI

The storage interface SHALL expose documents by identity and location. It SHALL
NOT require that a catalogue, a recents list or a browser exist, so that the
question of which surfaces to build stays open.

#### Scenario: The interface serves a file the OS handed over
- **WHEN** the application is given a path by the operating system, with no catalogue involved
- **THEN** the document opens through the same interface as one chosen in-app

### Requirement: A save is atomic

Writing a document SHALL NOT leave a partially written file if the write is
interrupted.

#### Scenario: An interrupted save preserves the previous file
- **WHEN** a save fails partway
- **THEN** the previously saved document remains intact and readable
