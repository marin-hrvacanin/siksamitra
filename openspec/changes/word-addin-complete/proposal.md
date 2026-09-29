## Why

The Word add-in passed every check that could run without Word, and had never
been run inside Word. Its first run — Word on the web, a Croatian Word, the
owner's personal account, 2026-09-29 — found in minutes what the checks could
not:

- **Built-in style ids are translated.** A Croatian Word stores `Heading1` as
  `Naslov1`, `Header` as `Zaglavlje`, `Caption` as `Opisslike`; only `w:name`
  keeps the English form. Everything that keyed on the id saw no heading, the
  pane reported six styles missing that the document was using, and the APP's
  own `.docx` importer lost the structure of any document saved by a Word that
  is not English. (Fixed and tested; recorded here so the rest is built on it.)
- **The pane is always light**, including inside a dark Word, and is hard to
  read: a column of identical outlined buttons with paragraphs between them.
- **A refusal is invisible.** Pressing Short over a word with no letter a
  holding may take does nothing on screen — the message is written and then
  wiped by the refresh that follows.
- **One style means four things.** In the owner's documents `Anusvara` is the
  blue of "the rules did this": anusvāra changes, visarga changes, reading aids,
  and the pauses the rules place. Nothing can tell a visarga change apart.
- **The style names are one person's.** `Translit`, `Prijevod`, `2Holding` are
  right for the documents that already use them and wrong for everybody else.
- **Nothing says what happens to a picture, a table, a comment or a tracked
  change** in a paragraph the add-in rewrites. `insertOoxml(…, replace)` over a
  paragraph replaces all of it.

## What Changes

- Two style vocabularies — the owner's LEGACY one, kept exactly in any document
  that already uses it, and a CLEAN one (English, with the IAST term) for every
  other document. Readers accept both, always.
- Anusvāra and visarga become separate styles. A legacy document can be
  UPGRADED exactly — each blue run reclassified by what it contains — with
  anything ambiguous left untouched and reported.
- Built-in styles are read through the document's own style table in every
  reader (done).
- The pane follows Word's theme, light and dark, and is laid out as tools
  rather than prose.
- Every message stays until the next action.
- A paragraph holding anything the add-in cannot carry through is never
  rewritten: it is refused, named, and left exactly as it was. Nothing in any
  document can make the pane throw.
- A live test tool drives the add-in inside Word on the web.

## Capabilities

### Modified Capabilities
- `word-addin`: the add-in's styles, pane, safety and testing.
- `interop`: the `.docx` reader and writer share the two vocabularies and the
  localised-id reading.

## Impact

- `packages/interop/src/word-styles.ts`, `word/styles.ts`, `docx-read.ts`,
  `docx.ts`, new `word/style-names.ts`, new `word/vocabulary.ts`
- `apps/word-addin/src/**` — model, word client, the whole pane UI
- `tools/word-web.mjs` (new), `tools/word-pane.mjs`, `tools/word-live.mjs`
- `site/index.html` install steps, `docs/WORD-ADDIN.md`
