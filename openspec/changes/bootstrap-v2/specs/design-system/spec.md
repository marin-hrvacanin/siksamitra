## Purpose

One home for every design value, and one implementation of every shared
surface. A colour, a font, a spacing step, a theme, a component: each is defined
once and consumed everywhere. This capability exists because the alternative is
what v1 became — a 169 KB stylesheet where the same value is written in dozens
of places and no two agree after six months.

## ADDED Requirements

### Requirement: Nothing is hardcoded

No component, stylesheet or module SHALL contain a literal colour, font family,
font size, spacing value, radius, border weight or duration. Every such value
SHALL resolve to a token.

This is enforced, not requested: a gate SHALL scan the source for literal design
values and fail on any it finds outside the token definitions themselves.

#### Scenario: A literal colour fails the build
- **WHEN** a hex colour, `rgb()`, `hsl()` or named colour is written in a component or stylesheet outside the token source
- **THEN** the token gate fails and names the file and line

#### Scenario: A literal size fails the build
- **WHEN** a px, rem or em value is written outside the token source, other than the documented exceptions for hairlines and optical corrections
- **THEN** the token gate fails and names it
- **AND** any exception carries a comment stating why it cannot be a token

### Requirement: One token source, generated into every consumer

Design values SHALL be defined in exactly one machine-readable source, and every
consumer — the stylesheets, the TypeScript modules, the print stylesheet, the
Word export style table — SHALL be GENERATED from it rather than kept in step by
hand.

#### Scenario: A token change reaches every surface
- **WHEN** a token's value is changed in the source and the generator is run
- **THEN** every generated consumer changes with it
- **AND** a check mode reports any consumer that has drifted from the source

#### Scenario: Export shares the screen's values
- **WHEN** a document is exported to Word or printed
- **THEN** the colours and weights come from the same tokens the screen uses

### Requirement: A theme is data, added in one place

Adding a theme SHALL consist of adding one set of token values. It SHALL NOT
require editing a component, a stylesheet rule, or a conditional anywhere.

#### Scenario: Adding a theme touches one file
- **WHEN** a new theme is added
- **THEN** the change is one entry in the token source
- **AND** every surface renders in it without further edits

#### Scenario: No component knows a theme's name
- **WHEN** the source is searched for a conditional on a theme identifier
- **THEN** none exists outside the theme definitions

### Requirement: Fonts are declared once

Every typeface SHALL be declared in one place, with its role, its fallback stack
and its loading strategy. A component SHALL name a ROLE, never a family.

#### Scenario: Changing a face is one edit
- **WHEN** the family for a role is changed
- **THEN** every surface using that role changes
- **AND** no component required editing

#### Scenario: A component cannot name a family
- **WHEN** a component references a font family directly
- **THEN** the token gate fails

### Requirement: One shared component library

Shared UI primitives — buttons, fields, menus, dialogs, tabs, the status bar,
icons — SHALL exist once and be used by every surface. A surface SHALL NOT
hand-roll a primitive that already exists.

#### Scenario: A second implementation is rejected
- **WHEN** a surface defines its own version of an existing primitive
- **THEN** the review rejects it in favour of extending the shared one

### Requirement: One document renderer, one place

There SHALL be exactly one implementation that turns a document into a rendered
surface, used by the reader, the editor, print and export. A rendering
difference between two surfaces SHALL be expressible as a parameter to it, never
as a second implementation.

#### Scenario: A new surface renders documents without new rendering code
- **WHEN** a surface that displays documents is added
- **THEN** it calls the one renderer with options
- **AND** it contains no mark-drawing code of its own
