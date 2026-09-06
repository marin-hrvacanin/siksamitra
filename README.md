# śikṣāmitra v2

A standalone editor for Vedic and classical Sanskrit recitation text — holdings,
svaras, anusvāra and visarga treatments — in IAST, Devanāgarī, Telugu and Tamil.

**This branch is a rewrite.** It shares no history with `main`. `main` stays as
the frozen v1 reference to compare behaviour against; it is never merged.

---

## Why v2 exists

v1 works and is unmaintainable, for reasons that are architectural rather than
incidental.

A marking in v1 is a CSS-classed `<span>` inside Quill's `.ql-editor` innerHTML.
"Is this holding correct?" is therefore a question about a DOM blob, and there is
nowhere to assert it. The marks are produced in four places — a 720 KB
`editor-quill.js`, `custom-blots.js`, `smdoc-format.js`, and the viewer HTML
generated inside a 180 KB `editor.py`. When two disagree, nothing can say which
is right.

Three measured consequences of that one cause:

| | v1 | v2 |
| --- | --- | --- |
| Puruṣa Sūktam on disk | **38.8 MB** `.smdoc`, after LZMA preset 9 — audio base64'd into the content string | assets referenced, never inlined |
| A long document | one Quill delta over one contenteditable; every syllable is an inline-block with a span per letter, so it lags and crashes | sections mount lazily; off-screen sections have no DOM at all |
| A logic defect | untraceable — four producers, no arbiter | `derive(source, profile)` is pure, so a defect is an input/output pair |

Five engine defects were found by re-deriving eleven documents letter by letter
and comparing. All five are still in v1: `Profile.pauses` declared and read by
nothing; 469 hyphens silently deleted on re-derivation; the anusvāra opening the
next syllable where the corpus writes it closing the previous one, 418 to 0; a
reading aid firing unconditionally where it actually splits 102:3 Vedic against
0:40 smārta.

---

## Relationship to vedaunion.org

**Two independent projects.** Separate repositories, separate hosting, separate
deploys. Neither depends on the other, in either direction.

They share a **format**. śikṣāmitra exports it; the platform reads it with its
own reader. Either side may gain a construct first, and the other is then
brought to match — against [`docs/INTERCHANGE.md`](docs/INTERCHANGE.md), not by
reading the other's source.

Two independent readers of one format can drift, and no compiler catches it.
What stands against that is the **conformance fixture suite**
(`corpus/conformance/`): 15 constructs mined from the verified corpus, each
stating what a correct reader must conclude, as plain data that imports nothing.
Both projects can run it.

---

## Layout

```
packages/
  format/    the document model — types, schemas, normalise, slice, hash
  engine/    derivation: source + profile → marked tokens. Never leaves.
  render/    the one renderer IN THIS PROGRAM: tokens → screen and paper
  interop/   Word, PDF, .vuchant, and (planned) v1 .smdoc
  cli/       the headless SDK, the CLI, and the gates
corpus/
  chants/       11 verified documents — what the ratchets measure against
  conformance/  the interchange fixtures
tools/        Python PDF readers, alignment, the fixture generator
openspec/     the specs: what is decided, and why
docs/         INTERCHANGE.md — the format contract, binding on both sides
```

---

## State

Everything below is measured by running it, not asserted.

```
npx tsc -b                 five packages, 0 errors
npx vitest run             83 tests pass
npm run check:transliteration   31 762 / 31 762   (100 %)
npm run check:engine            15 506 / 16 021   (96.79 %, 11 documents, ratcheted)
npm run check:conformance       90 assertions, 15 fixtures
```

The transliteration and corpus numbers are **identical to the platform's**, which
is the point: the engine was moved, not rewritten, and the gates moved with it.

**Built:** the format, the engine, the renderer (with its platform coupling
extracted into a host contract), Word and package interop, the CLI, the corpus,
the interchange contract and the conformance suite.

**Not built yet:** the storage interface, the editor, the applications, online
mode, and the v1 `.smdoc` importer. See
[`openspec/changes/bootstrap-v2/tasks.md`](openspec/changes/bootstrap-v2/tasks.md)
— it is accurate about what is done and what is not.

---

## Commands

```bash
npm install
npx tsc -b                 # build all packages
npm run check              # typecheck, tests, and every gate in series
npm run gen:conformance    # re-mine the interchange fixtures from the corpus
npx tsx packages/cli/src/main.ts help
```

---

## The rules this codebase is built on

- **One implementation of each thing, within this repository.** Two renderers
  here would be v1's disease again. Across the two projects the arrangement is
  different and deliberate — see design D1.
- **Marks are data, never CSS.** A document is not its presentation.
- **Derived fields are outputs.** Scripts and marks are recomputed, never edited.
- **A rule is data** with an id, a stage and a `when(profile)`. Never
  `if (slug === …)`.
- **Rule zero:** a document with no `src` layer has attested marks and must not
  be re-derived.
- **Gates ratchet.** A number may improve; a regression fails the build.
