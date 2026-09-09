# Tasks

The order is chosen so the corpus is never broken: the new model is built and
proved beside the old one, the corpus is migrated under a gate that compares the
two, and only then is the old one deleted.

## 1. The model, on its own

- [ ] 1.1 `packages/format`: `Mark`, `MarkKind`, `Stage`, and the verse shape — text plus marks. No engine, no renderer, no dependencies.
- [ ] 1.2 The invariants as one function: sorted, non-overlapping per kind, merged where adjacent and equal, within bounds, on code-point boundaries. Called after every operation, not merely exported.
- [ ] 1.3 The mark algebra, pure: `coverage`, `applyMark`, `removeMark`, `toggleMark`, `splitAt`, `mergeAdjacent`, `shiftForEdit`.
- [ ] 1.4 Property tests over random ranges: toggle twice is the identity; apply then remove is the identity; the invariants hold after every operation; no operation loses a marking it did not name.
- [ ] 1.5 Canonical bytes, and the zip container. Two saves of an unchanged document are byte-identical.

## 2. Reading and writing

- [ ] 2.1 Read and write the new shape, with the invariants checked on read and the fault named per verse.
- [ ] 2.2 A size gate: every corpus document under its recorded size, uncompressed and in its container. Śrī Rudram under 25 kB compressed; the corpus under 60 kB.
- [ ] 2.3 The round-trip gate for the file: write, read, compare field for field.

## 3. Migration, under a gate

- [ ] 3.1 `tokens` → `text` + `marks`, per verse: letters to text, `change` letters to their original plus a `show` marking, holdings to runs, everything else to markings, all with a hand origin.
- [ ] 3.2 **The gate**: render the converted verse and compare with the tokens it came from. Identical, or the verse is reported and left alone. Report the count.
- [ ] 3.3 For the 420 verses that have one, compare the new text against `src.lines` and report every disagreement — this is the last chance to see where the two copies had drifted.
- [ ] 3.4 Run it over the corpus; fix what it reports; record the numbers in the change.

## 4. The engine, against the text

- [ ] 4.1 A pass takes text and a range and returns markings. Convert the holdings, svara, substitution and aid rules to that shape, keeping every rule id.
- [ ] 4.2 `recompute(range, stages, mode)` — the only entry point. Nothing else may invoke a rule.
- [ ] 4.3 Remove every incidental invocation: on edit, on open, on register change, on script change.
- [ ] 4.4 The hand-removal record, so a keep-hand re-run does not restore what was removed by hand.
- [ ] 4.5 The corpus gate re-expressed: re-running every stage over each document reproduces the markings it shipped with, at or above the recorded percentage.

## 5. Drawing

- [ ] 5.1 Render from text and markings: apply substitutions by stage, syllabify what is shown, place the marks, transliterate per script.
- [ ] 5.2 Stop storing and stop reading script spellings and syllable division.
- [ ] 5.3 One box over a range, in every script, crossing spaces and syllable boundaries, with no internal edge and no gap in its rules.
- [ ] 5.4 A marking occupies no layout space; assert glyph positions are identical with and without it.
- [ ] 5.5 The reader (`ChantReader`) draws through the same path, so it cannot differ from the editor.

## 6. The editing surface

- [ ] 6.1 Typing writes text and nothing else.
- [ ] 6.2 The input gate: every printable key, space, newline, backspace, delete, word and line deletion, undo, redo, cut, copy, paste plain and marked, drag, and an IME composition — driven through the real surface, asserted against the document's text, in an empty document and a loaded one. **This is where the reported "cannot type a space" is closed.**
- [ ] 6.3 Marking buttons behave like bold, over the selection, through `toggleMark`.
- [ ] 6.4 Short and Long only. None is removed; Clear becomes "clear the markings here".
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
