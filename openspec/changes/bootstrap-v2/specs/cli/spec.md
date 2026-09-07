## Purpose

The headless surface: everything the editor can do, available to a script or an
agent. It is how documents are authored in bulk, how the gates run, and how an
agent works on a corpus without a browser.

## ADDED Requirements

### Requirement: The CLI can do everything the editor can

Every operation the editor performs on a document SHALL be reachable from the
CLI. A capability SHALL NOT exist only behind the user interface.

#### Scenario: An agent authors without a browser
- **WHEN** an agent marks, derives, validates and packages a document from the command line
- **THEN** the result is identical to performing the same operations in the editor

### Requirement: Output is machine-readable and cleanly separated

Every verb SHALL support structured output. Human-readable progress and
diagnostics SHALL go to the error stream so that the output stream stays
parseable.

#### Scenario: Piping the output works
- **WHEN** any verb is run with structured output and its output stream is piped
- **THEN** the piped bytes parse as data with no human text interleaved

#### Scenario: Diagnostics remain visible
- **WHEN** the same command runs in a terminal
- **THEN** progress and warnings appear on the error stream

### Requirement: The gates are CLI verbs

Re-derivation against the corpus, transliteration verification, format
validation and interop round-trips SHALL be CLI verbs, so that continuous
integration and a developer run the same code.

#### Scenario: A gate fails with a non-zero status
- **WHEN** a gate detects a regression against its baseline
- **THEN** the process exits non-zero and names the document and the measure that regressed

### Requirement: The package is consumable as a library

The CLI SHALL be a thin layer over exported functions, so that the same
operations are available programmatically.

#### Scenario: Programmatic use needs no subprocess
- **WHEN** a consumer imports the package
- **THEN** it can derive, validate, import, export and package without spawning a process
