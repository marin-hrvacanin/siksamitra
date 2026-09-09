## Why

**A picture is already in the format and nothing draws it.** `ChantFigure` has
been in `chant-parts.ts` since v3, `puja-vidhi.json` carries 22 of them, and
`DocumentBlocks.tsx` said so in its own header: *"STILL NOT DRAWN: figures and
embeds… a document with figures is faithful in text and incomplete on the
page."* So the pūjā manual opens in this editor as a manual with its
illustrations deleted, and there is no way to put one back.

**And the pictures it names are not there.** All 22 point at
`/figures/puja-vidhi/step-dipa.png?v=2be24db2` — a path this repository does not
have and that only vedaunion.org can serve. A document whose pictures live
somewhere else is not one thing: send it, and the pictures do not go.

**The pictures that do get drawn are drawn twice.** `ChantReader` had its own
`<figure>` markup and `chant.css` its own widths — 88 px, `clamp(120px, 25%,
210px)`, `clamp(160px, 50%, 340px)`, 75 %, 100 % — plus a `@media print` block
forcing `width: 25% !important` on top. That last one is the failure the rule
exists to prevent: a printed page silently disagreeing with the paged view,
which is this program's print preview.

**The owner asked for Word's behaviour.** Word answers pictures with anchoring,
wrapping, sizing and positioning, and most of those answers are right. Some are
wrong here, and being explicit about which is the point of this change: a pāda
is a metrical line, and Word's square wrap would break one at a width rather
than at the metre.

## What Changes

A picture is a **block** — an item of a step — drawn by **one component**, sized
by **one stylesheet**, from **tokens**, everywhere.

- **`ChantFigure` is not replaced.** Its four axes are already the right four.
  What is added is the rule that `src` may be the BYTES (`data:…`), the
  vocabularies as data, the validation, and the walk that finds every figure.
- **The bytes go inside the document.** This program saves one `.json`, and a
  picture stored anywhere else is a picture the file does not have. Word's
  answer is the same answer — a `.docx` keeps its pictures inside the zip — and
  it makes the lossless HTML export lossless by construction rather than by a
  new inlining pass.
- **One component**, `packages/render/src/render/figure.tsx`, used by the flow,
  paged and web views, the reader, the print sheet and every export. The
  reader's own `<figure>` markup is deleted; the widths become `fig-*` tokens.
- **A picture the file does not carry draws as a plate with its alt text.** Not
  a broken image, not nothing, and the same in the editor as in the export — so
  the preview cannot be right while the export is wrong.
- **Alternative text is required and enforced.** A mudrā drawing is the only
  form that instruction takes; a picture without a description is a step a
  blind reciter cannot perform. The insert dialog asks before the picture goes
  in, rather than a gate refusing it after it is saved.
- **Six gestures, one command.** Insert, replace, resize, align, caption and
  delete are one `figure` command through the edit session, so undo covers all
  of them and no second path writes a figure.
- **A float never runs beside a pāda.** Measured: at A4 a `medium` picture
  leaves 303 px of the 605 px column, four pādas fall level with it, and with
  the clear off three of them wrap — one mid-word. The clear is Word's "top and
  bottom" wrap applied where it is needed, with Word's "square" wrap kept
  everywhere else.

## Impact

- **Affected specs**: `format`, `render`, `editor`, `interop`, `conformance`
- **No format version change.** Nothing is added to `ChantFigure`; a `data:`
  `src` is a legal `src` today and every existing document reads unchanged.
- **The pūjā manual's 22 figures draw** — as plates carrying their alt text
  here, and as pictures on the platform, which serves them. Same document, same
  component, one resolver apart.
- **`chant.css` loses 35 literal design values and 23 lines**, and the paged
  view and the printed page now agree about how wide a picture is.
- **The size work is unaffected.** A picture is not in the 6.56 MB the corpus
  is escaping — that is 137 bytes per character of Sanskrit. Pictures are bytes
  an author put there, and the insert path states the cost before it commits
  it.
- **Word and PDF export are NOT wired up here.** `packages/interop/src/docx.ts`
  and `word/` belong to another change in flight. The model and the render path
  are what those need; the `<w:drawing>` and the PDF image are theirs to add.
