# A picture in a document

Word answers pictures with four questions — what is it anchored to, does text
wrap around it, how is it sized, and where is it positioned — and then adds
about forty controls on top. Some of those answers are right for a book of
recitation text and some are wrong. This file settles each one and says why,
including the ones that are refused.

The short version: **a picture is a block, its bytes are inside the file, its
width is a fraction of the column, and it never narrows a metrical line.**

## What a picture IS

`ChantFigure`, already in the format:

```ts
interface ChantFigure {
  id: string;
  /** `data:<type>;base64,…`, or a name the HOST resolves. */
  src: string;
  srcDark?: string;
  /** Required, non-empty, never a repeat of the caption. */
  alt: string;
  caption?: { en: string };
  flow?: 'block' | 'start' | 'end' | 'aside';
  size?: 'thumb' | 'small' | 'medium' | 'large' | 'full';
  captionAt?: 'below' | 'above' | 'beside' | 'none';
  crop?: 'auto' | 'square' | 'portrait' | 'wide';
  frame?: 'none' | 'thin' | 'violet';
  rounded?: boolean;
  width?: number; height?: number;   // intrinsic pixels
}
```

Nothing is added to it. The change is what the fields MEAN, what enforces them,
and the one component that draws them.

### Why nothing is added

The four axes were chosen so that no value of one constrains another, and they
are the four Word actually needs: how the text moves around it, how wide it is,
where the caption goes, and what box it sits in. Three years of a pūjā manual
have not produced a fifth. Adding a field to a format is easy and removing one
is not, so the bar is a document that cannot be expressed — and there is none.

## Anchoring — what is a picture attached to?

**A picture is an ITEM of a step, and its index in `items` is its anchor.**

Word offers two anchors and this program takes one of them.

| Word | Here | Why |
|---|---|---|
| **In line with text** (a character in the run) | **refused** | See below. |
| **Anchored to a paragraph**, floating | **taken**, as the item index | This is what `ChantItem` order already is. |
| Absolute position on the page | **refused** | See below. |
| Behind / in front of text | **refused** | See below. |

**Inline-with-text is refused.** Word puts a picture in a run as a character
(`U+0001` with a `<w:drawing>` on it). Here the run is a metrical line of
Sanskrit whose syllable division, holding boxes, svara strokes and script forms
are all computed per letter, and `text-and-marks` addresses every marking by a
character offset into one string. A picture in the middle of that string would
be a letter with no syllable, no transliteration and no grammar — and every one
of `recitationText`, the syllabifier, the four script emitters and the
per-word lookup would need a special case for it. One character's convenience
against a special case in six places, in the one code path this program exists
to keep clean.

**Absolute position on the page is refused.** The paged view and the exporter
share ONE page map (`paginate`), which places blocks in a single vertical flow —
that shared map is the whole reason "exactly how it will export" is true rather
than hoped for. An absolutely positioned picture is not a block in a flow, so it
would need a second placement mechanism, and the flow and web views, which have
no pages at all, could not honour it. "One place that decides placement" would
become two, and the second would be the one the preview used.

**Behind and in front of text are refused,** for that reason and one more: a
watermark behind a marked verse sits under the holding boxes and the svara
strokes, which are colour-coded DATA rather than decoration. Text over a picture
in this program means marks over a picture.

**A verse may also carry its own pictures** (`ChantVerse.figures`), and the
format has always had that. They are not blocks: they are inside the verse, so
the page map moves them with it, and the editor does not offer them — a picture
placed inside a verse cannot be addressed separately from it. Both placements
are drawn, by the same component, because drawing only one would lose a picture
silently.

## Wrapping — does text flow around it?

**Three of Word's seven, and a rule about the seventh.**

| Word's wrap | Here |
|---|---|
| In line with text | as `block` |
| **Square**, left / right | **`start` / `end`** |
| **Top and bottom** | **`block`** |
| Tight, Through | refused — they need a per-shape outline, and there is no shape editor here to draw one |
| Behind / In front of text | refused, above |

And then the rule that matters:

> **A float never runs beside a pāda.** `figure.css` clears the float at every
> verse.

A pāda is a metrical line. Text narrowed by a picture wraps where the picture
ends rather than where the metre does — and because the pagination measures one
`[data-line]` element as one line, the same picture also moves a page break for
a reason that has nothing to do with the text.

**This was measured, with the control.** Durgā Sūktam at A4 in the flow view, a
`medium` picture floated left:

| | as it ships | control (`clear: none`) |
|---|---:|---:|
| room beside the picture | — | 303 px of a 605 px column |
| pādas level with the picture | 0 | 4 |
| of those, wrapped onto a second line | 0 | **3** |

One of the three broke mid-word — `asmānth svastibhira-ti du / rgāṇi viśvā` —
and another left its closing `‖` alone on a line. `tools/export/gate-figures.mjs`
takes both readings on every run **and fails if the control stops wrapping**,
because a rule that defends nothing is a rule whose measurement has gone stale.

The float is not wasted: the step's instructions are English prose and wrap
wherever they like, so a left-floated picture stands beside the direction and
the mantra gets the whole column. In the pūjā manual, where every figure comes
first in its step and the instructions second, that is the layout the float was
put there for.

`aside` — a margin rail — is in the format and has no implementation. It draws
as `block`, which is a degradation and not a lie, and the editor does not offer
it, because a control that says `aside` while drawing `block` is a lie.

## Sizing — how wide is it?

**A fraction of the column, never a length somebody typed.**

```
thumb   5.5rem fixed
small   clamp(7.5rem,  25%, 13.125rem)
medium  clamp(10rem,   50%, 21.25rem)
large   75%
full    100%
```

Word sizes a picture in inches. That is right for Word, where a document has one
page width, and wrong here, where one document is drawn in three columns of
different widths — the A4 content box (453.5 pt = 605 px), the web view's
reading measure, and whatever a card is. A picture set at 340 px is a third of
an A4 column and two thirds of an A5 one.

The five steps are the vocabulary `ChantFigure.size` already had, restated from
`chant.css` **unchanged**, so adopting one shared component moved no picture in
the pūjā manual. They are now `fig-*` in `packages/tokens/src/figure.ts`.

`small` and `medium` are clamps rather than bare percentages because of the web
column: at the 46rem reading measure a bare 25 % is 184 px and readable, and on
a phone's 20rem it is 80 px, which is a thumbnail nobody asked for.

**Zoom.** Every fixed step is `calc(var(--fig-…) * var(--doc-zoom))`, the same
multiplier every document token carries. Without it a `thumb` would stay 88 px
while the page doubled, so the picture would shrink against the text at every
zoom but 100 %. The percentages need nothing: the column itself is already
zoomed.

**And a picture can never be taller than a page.** A figure cannot be split, so
one taller than the content box is placed on a page of its own by `paginate` and
then overflows it. `--doc-fig-max-h` is the page's own content height, written
onto the column by the view that knows the page, with `object-fit: contain` so
the cap shrinks the picture instead of cropping it — a mudrā with its fingers
cut off is worse than a small mudrā. Measured: at A4 the content box is 700.2 pt
and the tallest a full-width figure reaches on its own is 604.7 pt (100 % of a
453.5 pt column at 4∶3), so the cap bites only on a picture taller than a page.
Letter is 627.0 against 650.3; A5 is 446.0 against 510.2.

The web view sets no cap, deliberately: it has no page, so there is nothing for
a tall picture to break across and capping it would shrink a picture for a
reason that does not apply.

**And the fallback is at the point of use, not on the element.** Writing
`--doc-fig-max-h: none` on `.fig` looked tidier and was wrong: a custom property
declared on an element WINS over the value it would inherit, so every figure
shadowed the column's cap with `none`. Measured: a 300 × 4000 picture at full
width drew 8 063 px tall on a 934 px page and hung 7 035 px off the bottom of
it. With `var(--doc-fig-max-h, none)` it draws 934 px. The gate checks it
against the page geometry from `@siksamitra/layout` rather than against the
stylesheet, because a cap read out of the CSS that set it would agree with
itself whatever it said.

**`crop` reserves a box; it does not crop.** The name is the format's own and
its comment already said what it is for: reserving the aspect box BEFORE the
bytes decode, so a figure landing mid-step never pushes the mantra being read
down the screen. With `contain`, a wide picture in a `portrait` box gets bands
rather than losing its edges. Word's Crop tool is refused with the rest of the
image editing below.

## Where the bytes live

**Inside the document, as a `data:` URI in `src`.**

Three answers were possible.

1. **Beside the document, named** — what the corpus does today, and the reason
   this change exists: `puja-vidhi.json` names 22 PNGs under
   `/figures/puja-vidhi/`, not one of which is in this repository, so every one
   of them is a hole. Send the file and the pictures do not go.
2. **In a container beside the JSON** — `.vuchant` already has `assets/`, and
   the HTML export already has an assets block. Correct, and unreachable: the
   program's Save writes one `.json`, so a picture in a sidecar would be lost
   the first time anybody pressed Ctrl+S.
3. **Inside the document.** What ships.

Word's answer is the same answer arrived at differently: a `.docx` IS a
container and keeps its pictures in `word/media/`. Our container is the JSON,
and base64 is the only encoding a JSON has.

Three things follow, and all three are the point:

- **Saving is saving.** `canonicalJson` carries it, `docHash` covers it, and
  `.vuchant` and the `.html` export get it for nothing.
- **The lossless HTML export stays lossless BY CONSTRUCTION.** Its gate counts
  URLs that are not `data:`; a `data:` URI already is one. No inlining pass, no
  second thing to keep in step, nothing to forget.
- **The cost is visible.** Base64 is four characters per three bytes, so a
  picture adds about a third more to the file than it weighs. The insert dialog
  says the number before the picture goes in, and the status bar says it again
  after.

**The ceiling is 8 MiB per picture,** and it comes from the page rather than
from taste: the A4 text column is 453.5 pt = 6.30 in, so a picture printed
across it at 300 ppi is 1 889 px wide, which is about 2 MB as a good JPEG and
about 6 MB as a PNG. 8 MiB takes both and refuses a raw camera dump, which is
bytes nobody can ever see. Nothing is silently re-encoded: refusing is honest,
resampling behind someone's back is not.

**SVG is refused** — a security decision, not a typographic one. An SVG is a
script host; an `<img>` of one inherits nothing, but the same file opened in a
tab does, and a picture that arrives inside a document someone was sent must not
be able to run.

### What this does to the size work

Nothing. The 6.56 MB the corpus is escaping is 137 bytes per character of
Sanskrit — four script forms per syllable and an object per letter, all of it
recomputable. A picture is not that. It is data an author put there, it does not
compress by being modelled better, and the honest thing is to let it show in the
file size rather than hide it in a folder. `tools/size-study.mjs` weighs verses
and is untouched.

### A `src` that is not bytes

Still legal, still rendered — the corpus and the platform both use paths, and a
reader that refused would refuse the pūjā manual. **The HOST resolves it**
(`RenderHost.resolveUrl`), never the renderer, and the default resolver resolves
the bytes and nothing else.

So in this editor and in every export, a picture the file does not carry draws
as a **plate with its alt text**, and on vedaunion.org the same document draws
the picture, because the platform's host can resolve `/figures/…`. One
component, one resolver apart.

That default is not timidity. An exporter that emitted `/figures/step-dipa.png`
would write a file that looks complete on the machine that made it and shows a
broken image everywhere else — and the editor would have shown it correctly the
whole time. A preview that is right while the export is wrong is the failure
this codebase refuses everywhere else.

## The four views, the reader, and print

One renderer, so the answer is mostly "the same".

| | what a picture does |
|---|---|
| **flow** | Sized against the page's content column, capped at the page's content height. This is the authoring view and the picture is what will print. |
| **paged** | The same, plus the page map. A figure is an unbreakable block: `paginate` moves it whole to the next page rather than splitting it, which it could never do. `--doc-fig-max-h` guarantees it always fits one. |
| **web** | The same component, a different column, so `medium` is 50 % of whatever that column is — clamped at 21.25rem so a wide window does not produce a poster. No page height cap; there is no page. |
| **reader** | The same component and the same stylesheet, with the host's resolver in front of it. Measured at the reader's 900 px column: `medium` is 340 px, exactly as in the editor's web view. |
| **reader, focused** | **The picture stays.** Focused reading turns off the play controls and the translation; it must not turn off a picture, because a mudrā drawing IS the instruction for that step and losing it silently leaves a step nobody can perform. This is the same ruling the reader already makes about directions. |
| **print** | Whatever the paged view shows. `chant.css` used to force `width: 25% !important` and `float: none` on every printed figure — inherited from a reader that has no paged view to disagree with. Removed; measured before and after at 151 px against 302 px in the same column. |

## The exports

| | what carries |
|---|---|
| **`.html`** (lossless) | The picture, as the `data:` URI it already is, in an `<img>` in the page — AND inside the embedded document, so the file re-opens with it. Zero external URLs. Proved per export by `gate-figures.mjs`, byte for byte against the PNG it made. |
| **image** (`--png`, `--svg`) | The page, photographed. The picture is in the raster, and the gate reads it back: the commonest colour in a page holding one full-width magenta rectangle must be that magenta. |
| **`.vuchant`** | Unchanged. The document carries its pictures, so `assets/` holds only audio. |
| **`.docx` / `.pdf`** | **Not wired up in this change**, because `packages/interop/src/docx.ts`, `word/` and the PDF work belong to another change in flight. `figuresOf(doc)` gives them every picture in reading order with its placement; the `<w:drawing>` and the PDF `XObject` are theirs to add. |

## Accessibility

**`alt` is required, non-empty, and never a repeat of the caption.**
`figureFaults` refuses a figure without one and `insertFigure` refuses to write
it, so an alt-less picture cannot reach a saved document.

This is not a formality here in the way it is on a marketing page. These are
liturgical manuals: a drawing of a mudrā is the only form that instruction
takes, so a picture with no description is a step a blind reciter cannot
perform. There is no "decorative image" category, because there are no
decorative images.

- The insert dialog asks for the description and keeps **Insert disabled** until
  there is one. Asking at the start of the gesture beats refusing at the end of
  one that has already happened.
- The caption is asked for separately and labelled for what it is: the caption
  is shown to everyone and says what the picture is FOR; the description says
  what is IN it. Repeating one as the other is reported, because a screen reader
  then hears the same sentence twice and learns nothing.
- `<figure>` / `<figcaption>`, so the caption is ASSOCIATED with the picture
  rather than merely near it.
- The missing-picture plate carries the alt text as visible text, so a person
  who cannot see the drawing and a person whose file does not have it get the
  same sentence.
- The preview in the insert dialog has an EMPTY alt on purpose: it is the
  picture being described, and announcing a description it does not have yet
  would be announcing a lie.

## Editing

Six gestures, **one command**, through the edit session:

```ts
{ k: 'figure', sectionId, at, op:
  | { kind: 'insert'; figure }
  | { kind: 'update'; patch }
  | { kind: 'remove' } }
```

They differ only in the patch — a resize and a re-alignment are both "this
figure, with one field changed" — and splitting them into six commands would be
six places for undo to be got wrong.

**Undo is free and is checked against something the package does not compute.**
A history step already snapshots a whole section and a picture is in one, so
nothing was added. The test asserts that a document with a picture inserted and
then undone is byte-identical under `canonicalJson` — the assertion that caught
five of the eleven shipped documents failing an edit-and-undo before.

**A picture is not text, so the command is dispatched before rule zero, the
source writing and the re-derivation.** It changes `items` and no verse, so it
cannot cost a mark, orphan a recording or reach a transcribed verse — and
putting it through that pipeline would make it look as though it could.

**A shared picture is copied before it is changed.** `{ t: 'figure', ref }`
points into `ChantDoc.figures`, and the pūjā manual uses one añjali drawing at
three steps; resizing it at one of them would resize it at all three, which is
not what anybody pressing a button on one picture means. The reference becomes
an inline copy carrying the change, the other sites keep the shared one, and the
person is told — a command that quietly turns one thing into two is a command
whose effect nobody can predict.

**In the editor a picture is `contentEditable={false}`.** Without it the browser
treats the picture as content it owns: the caret walks into it and a Backspace
beside it deletes the `<img>` from the DOM while the document knows nothing
about either.

**Selection is an outline, not a border,** because a border is layout and would
move the picture the moment it was selected — the same fault the holding box
had.

## What is deliberately NOT supported

Each of these is in Word and is refused here, with the reason.

| Refused | Why |
|---|---|
| **Inline with text** | A picture in a run is a letter with no syllable, no script form and no grammar; six code paths would need a special case. |
| **Absolute position on the page** | The paged view and the exporter share one page map. A second placement mechanism is a second opinion, and the preview would be using it. |
| **Behind / in front of text** | Same, plus: the marks over a picture are data, not decoration. |
| **Tight and Through wrap** | They need a per-shape outline and there is no shape editor here to draw one. Square wrap covers what a manual needs. |
| **Crop, rotate, flip** | Image editing. A document editor that crops is an image editor with a worse crop tool; the picture that goes in is the picture that was made. |
| **Brightness, contrast, artistic effects, colour recolour** | The same, and worse: a "corrected" picture in a manual is a picture nobody else can reproduce. |
| **Borders and shadows beyond `frame`** | Three frames cover a plate, a rule and a violet rule. A border editor is a stylesheet in a dialog, which is rule 2 (marks are data, never CSS) applied to pictures. |
| **A picture in a header, footer or watermark** | The running head is page furniture drawn by the view from the page geometry, not document content. A watermark is "behind text", refused above. |
| **Automatic downsampling ("Compress Pictures")** | Silently re-encoding somebody's picture is worse than refusing one that is too big. The ceiling is stated and the refusal names the number. |
| **SVG** | A script host. See above. |
| **Linked (not embedded) pictures, in the editor** | The format still reads a named `src` and the platform still serves one, but nothing here WRITES one: a link is the state the pūjā manual is in, and this change exists because of it. |

## Rejected alternatives

**A new `image` block type beside `figure`.** Two block types meaning "a
picture", one for the reader and one for the editor, is the four-places-produce-
marks failure of v1 with a different subject. `ChantFigure` was already right.

**Bytes in a sidecar the document names.** Correct in a world where Save writes
a container. Save writes a `.json`, so it is a picture the file does not have —
which is what is being fixed.

**A `data:` URI resolved by the renderer, other URLs resolved too.** It is one
line and it makes the export a file that works on the machine that wrote it.
The resolver is a seam the host fills precisely so that the export's answer and
the editor's answer are the same answer.

**Letting the float run beside the mantra, as the reader does today.** Measured
and rejected: three of four pādas wrap, one mid-word. The reader was never
checked against a metrical line; now both are.

**A contextual "Picture Format" ribbon tab, as Word has.** It needs machinery
for tabs that appear and disappear under the cursor, so that four controls could
hide. The group is always present and its four controls are disabled until a
picture is selected, which is the same information and one less mechanism.
