## Purpose

Optional authenticated use: sign in with a Veda Union account and open, edit and
save platform chants directly from the editor, without leaving the tool or
handling files by hand.

## ADDED Requirements

### Requirement: Online mode is optional and additive

Signing in SHALL add a second library alongside the local one. Signing out, or
never signing in, SHALL leave every local capability intact.

#### Scenario: The tool works signed out
- **WHEN** a user has never signed in
- **THEN** every authoring, import and export capability remains available

#### Scenario: Both libraries coexist
- **WHEN** a user is signed in
- **THEN** local documents and platform documents are both listed, and each states where it lives

### Requirement: Online mode is a store, not a second editor

Platform access SHALL be an implementation of the storage interface. There SHALL
NOT be a separate editing path for platform documents.

#### Scenario: The same editor edits both
- **WHEN** a local document and a platform document are opened
- **THEN** the same editor, the same engine and the same renderer serve both

### Requirement: Permissions are the platform's to decide

The editor SHALL respect the platform's answer about what a user may read or
write, and SHALL present a document as read-only when the platform says so.

#### Scenario: A shared document opens read-only
- **WHEN** a user opens a platform document they may read but not write
- **THEN** the editor opens it read-only and says why

### Requirement: A concurrent edit is reported, never silently overwritten

Saving a section whose stored version has changed since it was loaded SHALL be
refused, and the user's work SHALL be preserved.

#### Scenario: A conflicting save is refused
- **WHEN** a section has changed on the platform since it was loaded and a save is attempted
- **THEN** the save is refused, the local copy is preserved, and the user is offered the current version

### Requirement: Credentials are held as the platform's own client sessions are

Authentication SHALL use the platform's existing token model for non-browser
clients. Credentials SHALL NOT be stored in plain text alongside documents.

#### Scenario: Signing out clears the session
- **WHEN** a user signs out
- **THEN** the stored token is removed and platform documents are no longer listed
