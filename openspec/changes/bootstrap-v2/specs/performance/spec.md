## Purpose

The application must stay fast on the documents that break v1. This capability
turns that into numbers, because "fast" is not a specification and cannot fail a
build.

**On "100× faster" (owner, 2026-09-06).** Taken as the intent it plainly is —
v1 lags and crashes on large documents and the difference must be a different
order of magnitude, not a tuning pass. It is written below as measured budgets
against measured v1 behaviour, so that progress is demonstrable rather than
asserted. Where a budget is met with room to spare it is tightened; where a
100× ratio turns out to be physically unavailable for some operation, the real
achievable number is recorded and stated, not quietly dropped.

## ADDED Requirements

### Requirement: Budgets are measured, and regressions fail the build

Every budget below SHALL be measured by a harness that runs in CI, recorded as a
baseline, and ratcheted: a number may improve, and a regression SHALL fail.

#### Scenario: A slow change is caught
- **WHEN** a change pushes a measured budget past its baseline
- **THEN** the harness fails and names the operation, the baseline and the measurement

#### Scenario: The baseline records the machine
- **WHEN** a baseline is recorded
- **THEN** it carries the machine and build it was measured on, so a number is never compared across unlike hardware

### Requirement: Opening a document is independent of its size

Opening SHALL read the manifest and the section index only. Time to first
readable verse SHALL NOT grow with the number of sections, verses or recordings
in the document.

#### Scenario: A large document opens like a small one
- **WHEN** the largest corpus document and the smallest are both opened
- **THEN** the time to first readable verse differs by a small constant, not in proportion to size

#### Scenario: Audio is never on the opening path
- **WHEN** a document with recordings is opened
- **THEN** no audio byte is read before the first verse is readable

### Requirement: Only what is near the viewport exists

A section's DOM SHALL be created only as it approaches the viewport, and SHALL
be retained once created. Memory and node count SHALL scale with what has been
viewed, not with the document.

#### Scenario: Node count tracks viewing, not size
- **WHEN** the first screen of a document of well over 100 000 potential nodes is displayed
- **THEN** the live node count is proportional to what is on screen and its margin

#### Scenario: Scrolling back does not rebuild
- **WHEN** the reader scrolls past a section and returns
- **THEN** the section was not unmounted, and selection and scroll anchoring survive

### Requirement: Editing cost is bounded by the verse, not the document

A keystroke SHALL re-derive only the verse it changed. Derivation SHALL be
memoised on the hash of source, profile and overrides.

#### Scenario: A keystroke is imperceptible
- **WHEN** a character is typed into a verse of a large document
- **THEN** derive-and-repaint completes within one animation frame
- **AND** no other verse is re-derived

### Requirement: The application ships only what a screen needs

Code and assets SHALL be split so that a surface loads what it uses. A packaged
build SHALL NOT carry assets no reachable surface references.

#### Scenario: The first screen is not the whole program
- **WHEN** the application starts
- **THEN** the initial payload covers the opening surface, and heavier surfaces load on demand

#### Scenario: No dead weight in the package
- **WHEN** a packaged build is inspected
- **THEN** every bundled asset is reachable from some surface
- **AND** the packaged size is recorded and ratcheted

### Requirement: Saving writes one section

A save SHALL write only what changed. It SHALL NOT rewrite the whole document,
and document-level data keyed across sections SHALL be merged rather than
replaced.

#### Scenario: Editing one section leaves the rest untouched
- **WHEN** one section is edited and saved
- **THEN** only that section's bytes are written
- **AND** other sections' recordings and timings survive intact

### Requirement: Large assets never pass through the document

Audio and images SHALL be referenced and streamed. No path SHALL base64 an asset
into a document, a package entry or a network payload.

#### Scenario: The v1 failure cannot recur
- **WHEN** a document with a full set of recordings is written and reopened
- **THEN** the document body stays small enough to parse in a frame
- **AND** the 38.8 MB v1 result is unreachable by construction
