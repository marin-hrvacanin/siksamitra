## Purpose

The native shell: a window, a menu, file dialogs, file associations and launch
arguments. It is deliberately thin, because a shell that understood documents
would be a second implementation of the thing that must have one.

## ADDED Requirements

### Requirement: The shell knows nothing about documents

The native layer SHALL move bytes and own operating-system concerns only. It
SHALL NOT parse, derive, render or validate a document.

#### Scenario: No format knowledge in the shell
- **WHEN** the native shell source is inspected
- **THEN** it contains no document parsing, no mark logic and no format types

### Requirement: The shell grants least privilege

The shell SHALL grant the web layer exactly the capabilities the application
uses, enumerated explicitly. It SHALL NOT grant filesystem-wide access.

#### Scenario: Capabilities are enumerated
- **WHEN** the shell's capability configuration is inspected
- **THEN** each granted permission corresponds to a used feature
- **AND** no wildcard grant is present

### Requirement: Launch arguments are allowlisted

Files named on the command line SHALL be opened only if their extension is on a
known list and the path is a real file.

#### Scenario: An unexpected launch argument is ignored
- **WHEN** the application is launched with an argument that is not a known document type
- **THEN** the argument is ignored rather than opened or guessed at

### Requirement: One instance owns the documents

Launching the application while an instance is running SHALL hand the file to
the running instance rather than starting a second one.

#### Scenario: A second launch reuses the window
- **WHEN** a document is opened while the application is already running
- **THEN** the existing instance receives and opens it

### Requirement: A WebView is qualified before the shell ships on it

The application SHALL NOT ship on a WebView until the render check has been run
and measured on it. Where a WebView fails, the recorded fallback SHALL be taken.

#### Scenario: An unqualified platform is not shipped
- **WHEN** a platform's WebView has not passed the render check
- **THEN** that platform's build is not published as verified
- **AND** the outstanding check is stated rather than omitted
