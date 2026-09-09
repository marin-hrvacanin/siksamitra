# Tasks

The order is chosen so the corpus is never broken: the new model is built and
proved beside the old one, the corpus is migrated under a gate that compares the
two, and only then is the old one deleted.

A box is ticked only when there is something that FAILS if the work is undone —
a gate, or a test with an independent oracle. Where a task is partly done it
says which half, because "roughly done" is how a list stops being read.

**Where this stands.** The model, its algebra and the migration are built and
gated, and THE CORPUS HAS MOVED: a verse on disk is one text and a list of
markings, and its tokens are rebuilt on open by `openChantDoc`. The corpus is
1871.6 kB, from 6564.7 kB.

What has not moved is the EDITOR. It still edits `src`, re-derives `tokens` on
every keystroke, and the text and markings are computed from those tokens when
the file is written — so the truth in memory is still the token stream. That is
what blocks §4.3 (the engine running unasked) and §6.4 (removing None), and it
is the next piece of work: the surface has to edit text and markings directly,
which is what Lexical is for.

## 1. The model, on its own

- [x] 1.1 `packages/format`: `Mark`, `MarkKind`, `Stage` and the verse shape — `mark.ts`, and `ChantVerse.text` + `ChantVerse.marks`, which is what a document now stores. No dependencies. `tokens` remains on the in-memory verse until §10.1.
- [x] 1.2 The invariants as one function — `markFaults` / `assertMarks` in `mark.ts`, called after every operation in `mark-ops.ts`.
- [x] 1.3 The mark algebra, pure — `mark-ops.ts`. `normalise` is `mergeAdjacent`; splitting falls out of `applyMark`/`removeMark` rather than being its own entry point.
- [x] 1.4 Property tests over random ranges — 38 in `__tests__/mark.test.ts`, including `coverage` against a character-by-character oracle and the invariants after every random operation.
- [~] 1.5 Canonical bytes — `writeChantFile` is now the ONE writer and save/open/save is byte-identical (`doc-lifecycle`). The zip container exists (`.vuchant`); it does not yet hold the new shape.

## 2. Reading and writing

- [x] 2.1 Read and write the new shape — `writeChantFile` converts on the way out; `openChantDoc` (`@siksamitra/engine`) rebuilds the tokens on the way in. Every load site in the program, the gates, the tools and the tests goes through it.
- [~] 2.2 A size gate — `check:size` (`tools/size.mjs`) holds every document to a recorded size that may only fall, and fails structurally when a verse is stored twice. It is a RATCHET, not the target: the targets below need §4.5 and §5.2 first.

  Measured, after the `items`/`verses` duplication went:

  | | before | now | +deflate | without `syl` | +deflate |
  |---|---|---|---|---|---|
  | Śrī Rudram | 918.7 kB | **340.5 kB** | 59.0 kB | 227.0 kB | 40.7 kB |
  | the corpus | 3330.6 kB | **1871.6 kB** | 307.3 kB | 1581.6 kB | 252.8 kB |

  From 6564.7 kB at the start of this change: the `items`/`verses` duplication
  was half of it and the tokens 45% of the rest.

  Against targets of 25 kB and 60 kB. The gap is not compression: on Śrī Rudram
  the text itself is 22.3 kB, `syl` markings 373.5 kB, other markings 372.0 kB,
  `stage` 205.1 kB and `by` 135.7 kB. Stage is `STAGE_OF[kind]` and `by` is
  'rule' on all but a handful, so the remaining win is not storing what is
  derived — which needs the engine to reproduce it (§4.5), and adoption is
  measured at 0%.
- [ ] 2.3 The round-trip gate for the file: write, read, compare field for field.

## 3. Migration, under a gate

- [x] 3.1 `tokens` → `text` + `marks`, per verse — `toTextAndMarks` in `migrate.ts`, with `toTokens` back the other way.
- [x] 3.2 **The gate** — `check:migrate` (`tools/migrate-audit.mjs`), 573/573 round-trip exactly. It compares the box PARTITION rather than group ids, because ids are an implementation detail.
- [x] 3.3 The 420 verses with a source layer are re-derived from `src.lines` through the engine and compared with what they store — `check:source`, 420 of 420. It renumbers holding groups the way `holdingSpans` defines a box, because `hg` is a reused label rather than a fact.
- [x] 3.4 Run it over the corpus — 573/573, "NOTHING WAS LOST". Faults it found are recorded in `design.md`.

## 4. The engine, against the text

- [ ] 4.1 A pass takes text and a range and returns markings. Convert the holdings, svara, substitution and aid rules to that shape, keeping every rule id.
- [ ] 4.2 `recompute(range, stages, mode)` — the only entry point. Nothing else may invoke a rule.
- [ ] 4.3 Remove every incidental invocation: on edit, on open, on register change, on script change. **Blocked by §2.1** — `tokens` IS the display, so not re-deriving means not showing what was typed. The owner asked for this directly; it cannot be honoured in the old model.
- [ ] 4.4 The hand-removal record, so a keep-hand re-run does not restore what was removed by hand.
- [ ] 4.5 The corpus gate re-expressed: re-running every stage over each document reproduces the markings it shipped with, at or above the recorded percentage.

## 5. Drawing

- [x] 5.1 Render from text and markings — `runs.ts` + `render/run-marks.tsx`, drawing a run as ONE element.
- [~] 5.2 Stop STORING the script spellings — done; they are rebuilt on open, and the published forms are frozen in `corpus/transliteration-reference.json` so the gate that checks the tables still has an authority. Nothing has stopped READING them, and the syllable divisions are still stored (`syl`, 373.5 kB on Śrī Rudram) until the engine reproduces them.

  **The Tamil forms need the owner's decision.** Rebuilding changed 215 syllables of 15,881. The shipped Tamil disagrees with itself on 43 of them and puts the Devanāgarī avagraha `ऽ` in a Tamil field ten times; the engine is consistent. `check:transliteration` prints the whole list on every run.
- [x] 5.3 One box over a range — a run is one element, so a holding crossing a space is one rectangle. `check:run-parity` photographs a verse drawn both ways: worst 0.97% of pixels against a 1.5% limit. Three real faults were found on the way down and are recorded in the tool.
- [ ] 5.4 A marking occupies no layout space; assert glyph positions are identical with and without it.
- [ ] 5.5 The reader (`ChantReader`) draws through the same path — it and `apps/web/src/views/token-renderers.tsx` are the only two drawing sites left on tokens.

## 6. The editing surface

- [ ] 6.1 Typing writes text and nothing else.
- [ ] 6.2 The input gate: every printable key, space, newline, backspace, delete, word and line deletion, undo, redo, cut, copy, paste plain and marked, drag, and an IME composition — driven through the real surface, asserted against the document's text, in an empty document and a loaded one. **This is where the reported "cannot type a space" is closed.**
- [ ] 6.3 Marking buttons behave like bold, over the selection, through `toggleMark`.
- [ ] 6.4 Short and Long only. None is removed; Clear becomes "clear the markings here". **Blocked by §4.3** — while the rules run unasked, None ("suppress what the rules would place") is a capability with no replacement. The two are one change.
- [ ] 6.5 The I-beam pointer over the document.
- [ ] 6.6 The application's right-click menu, replacing the native one in both the desktop app and the browser.
- [ ] 6.7 Re-apply rules from the ribbon and the menu: by stage, over the selection or the document, keep-hand or replace-all.
- [ ] 6.8 `Show as…`, nasalisation and insert-pause in the menu.

## 7. The conformance matrix

- [ ] 7.1 Enumerate the matrix from the registries — kinds × scripts × operations × contexts — rather than by hand.
- [ ] 7.2 Fail the build when a row has no test, naming the kind, the script and the combination.
- [ ] 7.3 The operation matrix from the conformance spec, generated and run.
- [ ] 7.4 Round trips in every script; every export; the marking-drift check.
- [ ] 7.5 Report the covered count and record it, so a silent shrink fails.

## 8. Scale

- [ ] 8.1 Build a Devī Māhātmyam-sized document — about 700 verses — as a fixture, from the corpus, so the number is real rather than synthetic where it can be.
- [ ] 8.2 Render only what is near the viewport in the flowing view.
- [ ] 8.3 The performance gate with its control: open, keystroke, marking, scrolling, and the file size. Record the figures.

## 9. Interop

- [ ] 9.1 Word, PDF, `.smdoc` and the package format read and write the new shape.
- [ ] 9.2 The interchange contract and its fixtures, updated with Veda Union's reader in mind, since it reads this format too.
- [ ] 9.3 The CLI: every command against text and markings, and `recompute` exposed with its range, stages and mode.

## 10. Removing the old model

- [ ] 10.1 Delete `src`, `tokens`, `adoptSource`, `markUnits`, `tokenSrcMap`, `applyMark`'s adoption path, rule zero, the source gate, and the words "attested" and "transcribed verse" from the code and the documentation.
- [ ] 10.2 Update `openspec/config.yaml`: rule zero and "derived fields are never edited" are superseded here.
- [ ] 10.3 `docs/EDITING.md` and `docs/AGENTS.md` rewritten for one text and its markings.
- [ ] 10.4 `npm run check` green, every browser gate green, and a fresh hostile review of the whole change before it is called done.
