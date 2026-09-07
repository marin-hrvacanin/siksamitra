# CLAUDE.md — working in this repository

Read this first. It tells you what this program is, where things live, what to
read for a given task, and the rules that are not negotiable.

**This is the `v2` branch, an orphan.** It shares no history with `main`, which
is frozen v1 — kept as a behavioural reference to diff against, never merged.

---

## What this is

**śikṣāmitra** is its own open-source program: a workbench for Vedic and
classical Sanskrit text. It marks recitation according to the śikṣā rules —
holdings, svaras, anusvāra and visarga treatments, reading aids — and renders
them in IAST, Devanāgarī, Telugu and Tamil.

It is **not** a tool belonging to vedaunion.org. The platform is one
*integration* among others: śikṣāmitra exports a format the platform reads, and
can optionally sign in to it. Neither project depends on the other, in either
direction. See [`docs/INTERCHANGE.md`](docs/INTERCHANGE.md).

Intended to grow: more writing systems, accents, etymology and dictionary
lookup, automatic sandhi, grammatical analysis, and eventually a corpus library.
That ambition is why nearly everything here is a **registry** rather than a
switch statement — see *Extension points* below.

---

## What to read, for what

| If you are… | Read |
| --- | --- |
| new here | this file, then [`README.md`](README.md) |
| changing the document format | [`docs/INTERCHANGE.md`](docs/INTERCHANGE.md) — the contract, binding |
| changing a marking rule | `openspec/changes/bootstrap-v2/specs/engine/spec.md`, then `packages/engine/src/rules/` |
| adding a writing system | `openspec/.../specs/scripts/spec.md`, then `packages/engine/src/script/` |
| touching the look | `openspec/.../specs/design-system/spec.md`, then `packages/tokens/src/` |
| working on views, pages, zoom | `openspec/.../specs/render/spec.md` + `packages/layout/src/` |
| working on the editor | `packages/edit/src/index.ts` — the layering is in its header — then `apps/web/src/editor/` |
| wondering why a document cannot be edited | `docs/INTERCHANGE.md` §9.7 (rule zero) and `packages/cli/src/attach-src.ts` |
| adding a test | [`tests/README.md`](tests/README.md) — which tier, and what each may *not* do |
| building an installer | [`docs/PACKAGING.md`](docs/PACKAGING.md) |
| wondering why something is the way it is | `openspec/changes/bootstrap-v2/design.md` — eight decisions with their rejected alternatives |
| wondering what is *not* built | `openspec/changes/bootstrap-v2/tasks.md` — kept honest, deliberately |

`openspec/` is the specification, managed by the OpenSpec CLI. `npm run spec`
is the entry point; capabilities live under `openspec/changes/bootstrap-v2/specs/`.

---

## Layout

```
packages/
  format/    the document model. Types, schemas, and the reader obligations
             every implementation must agree on (recitationText, holdingSpans,
             resolveSource, isAttested).
  engine/    derivation: source + profile -> marked tokens. The rules, the
             profiles, the script registry, transliteration. NEVER LEAVES.
  render/    the one renderer IN THIS PROGRAM: tokens -> screen and paper.
  layout/    pure: pagination, zoom, scroll anchoring, view modes.
  edit/      what an edit IS. The caret over a section, the one function that
             changes a verse's source, hand-placed marks as overrides,
             rebasing them when the text moves, the holding invariants, undo.
             No React, no DOM, no clock.
  tokens/    every design value. Three theme axes, generated into CSS/TS/JSON.
  interop/   Word, PDF, .vuchant, and (planned) v1 .smdoc.
  storage/   the ChantStore interface + a local file store.
  cli/       the headless SDK, the CLI, and all the gates.
apps/
  web/       the application. Vite + React. `src/editor/` is the surface: a
             caret over drawn text, nothing contenteditable.
  desktop/   the Tauri 2 shell. Four commands, knows nothing about documents.
assets/fonts/  11 vendored OFL families. Committed on purpose.
corpus/    11 verified documents + the interchange fixtures. What the gates
           measure against.
tools/     the gates, the font pipeline, the design preview.
```

---

## The rules

Not style preferences. Each one is here because its absence cost something.

1. **One implementation of each thing, within this repository.** v1 produced
   marks in four places and could not say which was right. Across the two
   *projects* the arrangement is different and deliberate — design D1.
2. **Marks are data, never CSS.** A document is not its presentation. v1 stored
   a holding as `<span class="ql-hold-short">`, which is why its documents were
   inseparable from one program's stylesheet.
3. **Derived fields are outputs.** Scripts and marks are recomputed, never
   hand-edited.
4. **A rule is data** with an id, a stage and a `when(profile)`. Never
   `if (slug === …)`. `Profile` is the one parametrization.
5. **Rule zero: a document with no `src` layer has ATTESTED marks and must not
   be re-derived.** They are evidence, not output. This includes not
   "correcting" them to match our rules — see the geminate note in
   `holding-invariants.test.ts`.
6. **Nothing is hardcoded.** No literal colour, face, size or spacing outside
   `packages/tokens`. `check:literals` fails the build on one.
7. **Gates ratchet.** A number may improve; a regression fails. Never raise a
   baseline to make a build pass.
8. **Files stay under 400 lines.** `check:modules` enforces it. When a file
   approaches the limit, split it — do not raise the limit.
9. **An expectation must be something a reader PRODUCES, not something the
   document CONTAINS.** The conformance suite once passed 90 assertions while
   testing nothing because it forgot this.
10. **Commits are in the owner's name, with no AI attribution and no co-author
    trailers.** Do not add one, do not offer to.
11. **A verse is written through `withVerses`.** A composed section stores its
    verses in `items` too, and `normalizeChantDoc` rebuilds `verses` from
    those — so a writer that touches only `verses` has its work discarded on
    the next load. It happened to all 573 verses of the corpus at once.
12. **Nothing is `contenteditable`.** The text is drawn, the caret is ours, and
    keystrokes arrive through a hidden field. v1's Quill editor made the
    document *be* the DOM, which is why "is this holding correct?" had no
    answer.

---

## Extension points

Adding to this program should be adding an *entry*, not editing a switch. Where
that is true today:

| To add… | Add one entry to |
| --- | --- |
| a writing system | `packages/engine/src/script/scripts/` + `registry.ts` |
| a chrome theme | `packages/tokens/src/chrome-themes.ts` |
| a document theme | `packages/tokens/src/document-themes.ts` |
| a page size | `packages/layout/src/geometry.ts` |
| a view mode | `packages/layout/src/view.ts` |
| a command (button + shortcut together) | `apps/web/src/shell/commands.ts` |
| a ribbon group | the array in `apps/web/src/shell/Toolbar.tsx` |
| a token type's rendering | `apps/web/src/views/token-renderers.tsx` |
| an editing key or a marking button | `apps/web/src/editor/keymap.ts` — one table, buttons render from it |
| an editing command | `EditCommand` in `packages/edit/src/session.ts` |
| a font | `tools/fonts/manifest.mjs`, then `npm run fonts` |

Where it is **not** yet true, and should become so: `emit.ts` still writes four
fixed script fields, so adding a script is not yet one file. Design D8 and task
section 12 cover it.

---

## Commands

```bash
npm install
npm run dev                # the app at http://localhost:5273
npm run check              # typecheck + every test tier + every gate
npm test                   # the four test tiers
npm run package            # an installer for this platform
npm run design             # regenerate the design-choice preview
npm run fonts              # re-vendor the fonts
npm run spec               # the OpenSpec CLI
```

The gates, individually: `check:modules` `check:tokens` `check:literals`
`check:fixtures` `check:conformance` `check:transliteration` `check:lossless`
`check:engine` `check:fonts` `check:web`.

`sm attach-src <doc.json>` gives a document its source layer back where a
derivation reproduces it exactly — which is what makes it editable at all.

Browser-driven checks need a Chromium: `CHROME=<path> node tools/<name>.mjs`.
`tools/theme-matrix.mjs`, `tools/responsive.mjs`, `tools/smoke.mjs` and
`tools/edit-smoke.mjs` all need `npm run dev` running. On this machine the
Chromium is Edge:
`CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"`.

---

## Before you claim something works

This repository has a specific history of confident wrong answers, all caught
by making a check actually run:

- A conformance suite that passed 90 assertions while testing nothing, because
  its expectations were computed from the bytes it was checking.
- A font gate that reported a pass for a file it had never read, because the
  page had no origin and the family happened to be installed on the machine.
- A "four scripts verified" claim that was two.
- A responsive check that read every window width as two rows, because it
  counted `top` values on centre-aligned elements of different heights.
- `npm run dev` serving a 500 for days, because `main.tsx` imported a
  stylesheet out of `public/` — which Vite refuses. Nothing had run the app.
- A theme-contrast gate that had never executed a single assertion: it asked
  for `.tb`, and the toolbar stopped being that when the ribbon replaced it.
- A literal-value gate that walked only `packages/` while every stylesheet in
  the program lives in `apps/web/src`.
- A source layer attached to all 573 verses of the corpus and silently
  discarded, because `items` — not `verses` — is what a load reads.

So: **run it, read the output, and report the number you saw.** If a gate is
green, say which gate. If something is not built, say so — `tasks.md` is kept
honest for exactly this reason, and a plausible summary is worse than a gap.
