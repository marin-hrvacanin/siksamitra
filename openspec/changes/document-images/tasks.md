# Tasks

Kept honest. A box is ticked when the thing works and has been looked at, not
when the code compiles.

## 1. The model

- [x] 1.1 `packages/format/src/figure.ts`: the four vocabularies as data, the defaults in one place, and the walk that finds every figure a document draws (inline, by reference, and on a verse).
- [x] 1.2 The byte rules: which media types a document may carry, the size ceiling and its arithmetic, decoding a `data:` URI's length without decoding the picture.
- [x] 1.3 `figureFaults`: alternative text required and never the caption, every axis in its vocabulary, an automatic crop only with an intrinsic size.
- [x] 1.4 `ChantFigure`'s own comments say what `src` may be and why `alt` is not a formality.
- [x] 1.5 Unit tests, with Node's base64 decoder as the control for the byte arithmetic. 13 assertions.

## 2. The one component

- [x] 2.1 `packages/render/src/render/figure.tsx` — the only `img` a document's picture is ever drawn as. Resolver as the seam; the bytes resolve themselves and nothing else does by default.
- [x] 2.2 `packages/render/src/figure.css` — the one place that decides a width and a placement, every value a token, zero literals.
- [x] 2.3 `packages/tokens/src/figure.ts` — the five steps and the air around them, restated from `chant.css` unchanged so no picture in the pūjā manual moved.
- [x] 2.4 The reader delegates: `FigureView` is six lines and passes the host's resolver. Its own markup is gone.
- [x] 2.5 `chant.css` loses the `.fig` block **and** the `@media print` override that forced `width: 25% !important`. 35 literals and 23 lines removed; measured before and after at 151 px against 302 px in the same column.

## 3. The views

- [x] 3.1 `DocumentBlocks` draws a figure item, resolving `ref` through the document's library, and a verse's own figures inside the verse.
- [x] 3.2 `blocks.ts` — the block list, split out when `DocumentBlocks.tsx` crossed 400 lines. A figure is a block with an id the page map knows.
- [x] 3.3 The page-height cap: `--doc-fig-max-h` from the page's content box, on the flow column, on each page's content, and on the measuring probe at zoom 1. Not on the web column, which has no page. The fallback is at the point of use — declared on `.fig` it shadowed the column and a 4 000 px picture hung 7 035 px off the page.
- [x] 3.4 Looked at in all four views and in print. Numbers in the report.

## 4. Editing

- [x] 4.1 `packages/edit/src/figures.ts` — insert, update, remove, and the id allocator. Pure.
- [x] 4.2 One `figure` command in the session, dispatched before rule zero and the re-derivation, because a picture changes `items` and no verse.
- [x] 4.3 A referenced figure is copied before it is changed, and the person is told.
- [x] 4.4 `useFigures` — the selection, reading a file, and the view props the two views spread.
- [x] 4.5 The ribbon group: Insert, Replace, Delete, five sizes, three alignments, four caption positions. Disabled until a picture is selected.
- [x] 4.6 The insert dialog: preview, the size and what it will cost the file, a required description, an optional caption. Insert disabled until there is a description.
- [x] 4.7 **Describe** reopens the same dialog on a picture already in the document, so a description typed in a hurry can be corrected. A required field that can never be edited is worse than an absent one.
- [x] 4.8 Unit tests, with `canonicalJson` as the control for undo. 10 assertions.

## 5. The exports

- [x] 5.1 The HTML export carries it, because `documentView` renders the same views. Zero external URLs, proved per document.
- [x] 5.2 The image export shows it, proved in the pixels rather than asserted.
- [x] 5.3 `tools/export/gate-figures.mjs`, in `npm run check`: the round trip byte for byte, self-containment, the placeholder, the raster, the float control, and the corpus.

## 6. Not done, and named rather than implied

- [ ] 6.1 **`.docx` export.** `packages/interop/src/docx.ts` and `word/` belong to another change in flight and were not touched. What they need is `figuresOf(doc)`, which gives every picture in reading order with its placement; the `<w:drawing>`, the relationship and `word/media/` are theirs.
- [ ] 6.2 **PDF export.** Same: `packages/interop/src/pdf/` is another change's, untouched. The picture needs an image `XObject` and the placement the page map already computes.
- [ ] 6.3 **The Word add-in** (`apps/word-addin/`) does not know about pictures. Out of scope and untouched.
- [ ] 6.4 **`aside`** — the margin rail the format declares — still draws as `block`. It is not offered in the editor for that reason.
- [ ] 6.5 **Moving a picture up or down its step.** The command can express it (remove then insert) and no control does it. A person must delete and re-insert, which loses the caption.
- [ ] 6.6 **A picture cannot be edited in place** — no crop, no rotate, no compress. Refused on purpose; see `design.md`.
- [ ] 6.7 **`srcDark`** is rendered and cannot be set from the editor. A document that wants a dark-mode alternate must be authored with one.
- [ ] 6.8 **Drag and drop, and paste, of a picture** are not wired to the insert path. Only the ribbon's file picker is.
- [ ] 6.9 **A caption and a description can be edited, but only through a dialog.** Word lets you click into a caption and type. Here the caption is a field of the figure rather than a paragraph in the flow, so it is edited where it was written.
