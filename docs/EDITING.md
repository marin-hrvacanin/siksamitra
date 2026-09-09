# The editing surface

**It is being rebuilt on [Lexical](https://lexical.dev), and both halves are in
the tree.** Read this whole section before changing anything here: which files
are the future and which are the present is not obvious from their names.

## Why it changed

The surface was written by hand over `contenteditable` — the browser owning the
caret, every `beforeinput` refused and re-expressed as a command. It was a
reasonable design and it was the source of every serious defect the owner
reported: a frozen window, text that could not be selected, the caret and the
insertion point in different places, navigation "buggy in more ways than I can
name", drag-and-drop landing short.

None of those were about marking, which is the part that is genuinely this
program's to write. They were about a text-editing substrate, which is a solved
problem with years of other people's bug reports already in it. The owner's
ruling, now a standing rule: look for the battle-tested implementation first,
and build on top of it, even when adopting it costs a rewrite.

**Lexical is the surface and never the format.** Storing an editor's internal
state as the document is v1's fatal mistake — a marking became a CSS-classed
span inside Quill's `innerHTML`, and marks were produced in four places that
could not be reconciled. That is why v2 exists. The document is one text and a
list of markings; Lexical sits over it behind one bridge.

## What the spike settled, by measurement

`tools/spike-lexical/` — run it when Lexical is upgraded; it is the cheapest way
to find out whether these assumptions still hold.

A custom node emitting this program's per-letter markup — a `.syl` per
syllable, a `.u` per letter — survived the reconciler and then failed
everything: a click on the sixth letter reported offset 1, and typing two
characters turned `sunavāma` into `YsX`. Lexical maps a DOM position through
the node's own text node, and there is none when every letter is wrapped.

**Flat runs work**, and better than what they replace:

| | |
|---|---|
| a marked range is one run | `"su" "navā" "ma " "क्ष्मी"` |
| a click maps to the right offset | clicked `v`, the model says 2 |
| typing reaches the model and returns | `sunaXYvāma क्ष्मी` |
| applying a holding splits the run | `"su":short "naXYvā":long` |
| the box is one rectangle | 1 client rect |
| the Devanāgarī conjunct still shapes | 48.7px against 81.7px with `akhn`, `half`, `vatu`, `cjct` off |

Two things fall out that the hand-written surface could not manage: one box
over a whole range crossing spaces, because Lexical splits text at every format
boundary; and bold's semantics, because splitting runs at a selection's edges
is what it already does.

## The files

**The new surface:**

| file | what it owns |
| --- | --- |
| `packages/format/src/mark.ts` | what a marking IS, and its invariants |
| `packages/format/src/mark-ops.ts` | every operation on a list of them |
| `packages/render/src/runs.ts` | where the drawing changes |
| `packages/render/src/render/run-marks.tsx` | one run, drawn |
| `apps/web/src/editor/lexical/MarkedText.ts` | the one node the document is made of |
| `apps/web/src/editor/lexical/bridge.ts` | document ⇄ editor, both directions in one file |

**The present one**, still what the app runs, and going when the app holds text
and markings rather than `src` and `tokens`:

| file | what it owns |
| --- | --- |
| `EditorSurface.tsx` | the listeners, the focus, and the first caret |
| `useDomCaret.ts` | the seam: the browser's selection ⇄ an address in the source |
| `dom-selection.ts` | a DOM position as a unit, and a unit as a DOM position |
| `apply-input.ts` | what each `beforeinput` means to the document |
| `unit-map.ts` | a unit as a line and a column, and back |
| `focus.ts` | putting the keyboard back on the page |

## What is not done, and what it blocks

The app still holds `src` + `tokens`. Two things the owner asked for are
waiting on the switch and cannot be done before it:

- **The engine runs on every keystroke.** In the old model typing REQUIRES
  re-derivation, because the tokens are the rendered text — so "why does the
  engine immediately write the holdings? Who said that?" cannot be answered
  until the text is the text.
- **Removing a holding cannot be told from never having placed one**, which is
  what the `None` button exists to express. With `by: 'rule' | 'hand'` on every
  marking the button goes and the capability stays.

## Why the browser owns the caret

Not for speed — that was the first answer and the measurement did not support
it. `npm run perf:selection` prints the numbers with a control: dragging a
selection across Śrī Rudram costs about the same whether this program is
running or not, because the cost is the browser extending a selection over
15,000 inline boxes.

The reason is correctness. A caret is not a rectangle. It is the I-beam
pointer, drag-select, double-click for a word, triple-click for a line,
shift-click to extend, arrows that know where a line wrapped, word motion that
knows the font, Home and End, an accessible cursor, and an IME — which is also
how half the diacritics in this program get typed. The previous surface
reimplemented all of that by hand, and each piece of it was a separate bug.

## What is checked, and how

```
npm run check:edit          # both of the below
node tools/interaction.mjs        # 21 gestures
node tools/interaction-views.mjs  #  9 checks across the views
```

Every assertion is against something the editor does not control — the
**browser's own selection**, the **document's own text**, the count of **drawn
marks**. That rule exists because the test these replaced asked the caret where
it was and then asserted it was there: it found a letter's rectangle, clicked
the middle of it, and checked the caret had been drawn at that rectangle. Both
sides used the same arithmetic, so they agreed by construction, and it passed
every time while the editor was unusable.

## Marking a verse that came from a marked source

Most of a real document is TRANSCRIBED: the marks were placed by hand in Word
and the verse carries no `src` layer, so nothing can be re-derived from it.
Rule zero protects those marks, and it used to protect them by refusing every
mark command that reached one — which made the holding buttons dead on the
documents this program exists for. Selecting five letters in Durgā Sūktam and
pressing Long printed a paragraph about evidence and changed nothing.

What must never happen is the marks CHANGING. That is now enforced by checking
rather than by refusing, in three steps:

1. **The letters are addressable either way.** `tokenSrcMap` maps a transcribed
   verse's drawn letters onto its own recited text, so a click and a drag name
   letters even where `verseSrcMap` has nothing to derive. Without it the drag
   produced no selection at all and the button had nothing to act on — the
   status bar said `col 1` while the page showed a highlight.
2. **`adoptSource` gives the verse a real source layer**, derived from its own
   text, with a `source-witness` override wherever the engine disagrees with
   the transcription — then derives again and requires the WHOLE TOKEN STREAM
   to be identical to what was there before. If any of it differs, nothing is
   written.

   That check was letters-only once, and `unitsOf` walks past every token that
   is not a syllable. So adoption passed its own safety check while deleting
   the brackets around an instruction (`[ oṁ … ]` in ganeśa-aṣṭottara n-17) and
   moving the recitation pauses of 31 verses. `npm run check:marking` marks a
   letter in all 153 transcribed verses and compares every other byte.

3. **No verse in the shipped corpus adopts today**, and the reason is a
   spacing disagreement rather than anything about marks: a transcribed verse
   stores a space either side of a `¦` bar and this engine emits none, so the
   streams differ on almost every verse. The 420 verses that already carry a
   source layer have no such spaces — which is exactly why they re-derive
   exactly — and the 153 transcribed ones came in by an older path that padded.
   Ignoring spacing would make adoption succeed by deleting those spaces from a
   transcription. Reconciling the two is `sm attach-src`'s job.

4. **So every transcribed verse marks by the third route: onto the letter.**
   `markUnits` writes the mark onto the unit; the verse stays frozen and every
   other byte is identical. See `mark-tokens.ts` for why that does not violate
   rule zero.

So a mark always lands, and a transcription is never rewritten to make it.

### The buttons

A holding button is a state as well as an action, the way Word's bold is.
`holdState` reports what the selection carries — one weight, `mixed`, or
nothing — the button shows it, and pressing a weight the selection already has
takes it off. A mixed selection becomes all-one on the first press rather than
toggling letter by letter, so one press always has one visible meaning. Off is
`hold: null` (there is no holding here), not `unmark` (let the rules decide) —
`unmark` on a letter the rules want to hold puts the box straight back, which
is a toggle that visibly does nothing. `Clear` is the button that hands the
decision back.

### One box, not three

A box is drawn per syllable and cannot be otherwise: an Indic akṣara is one
shaped cluster and half a conjunct cannot be boxed (MARKING-RULES §2.4). Five
adjacent held letters spanning three syllables therefore drew three touching
boxes. They now keep their three elements and lose the EDGE where they meet —
`holdJoins` works out which edges those are and the CSS clips them away — so
the run reads as the single box it is. Within one syllable nothing changed:
`normaliseHoldings` already merged those into one group.

## Known and unfixed

Written down rather than left to be rediscovered.

**Dragging text within a document lands short.** The browser sends
`deleteByDrag` and `insertFromDrop` in the same task, so the drop's offsets are
computed against the text as it was before the delete. Dragging text to a point
*after* where it came from lands it short by its own length. The two do share
an undo step, so one Ctrl+Z puts it back. Dragging text is a rare gesture here
and a hurried fix would be worse than a recorded fault.

**The paged view re-paginates on every keystroke.** `contentKey` includes the
revision, so the off-screen probe re-measures after each edit. When a verse
moves across a page boundary the DOM it was in is replaced, and if the page
count shrinks the focused page can unmount — the caret is then placed at the
start of the page instead of where it was.

**A long document is slow to select across.** Every verse is rendered, so Śrī
Rudram is about 15,000 inline boxes and the browser takes ~45 ms to extend a
selection over them. The remedy is to render only what is near the viewport in
the flowing view, and it is not done. Documents of the usual size are
unaffected: Durgā Sūktam measures 10 ms a move against 8 ms of harness
overhead.

**The visual join does not reach the reader.** `holdJoins` marks the edges and
both the IAST and the Indic branches of `renderSyl` draw them, so the editor
joins boxes in every script. `ChantReader` renders from its own syllable lists
and never calls `holdJoins`, so a run of adjacent holdings still draws as
separate boxes there.

**A selection is clamped to one section.** A caret is bound to a section, so a
selection that runs out of one is pulled back to its edge and the status bar
says how much is really selected. Ctrl+A in a multi-section document therefore
selects the last section, not the document.

**Motion in `packages/edit` is no longer used by the editor.** `moveChar`,
`moveWord`, `moveLine`, `lineEdge` and `selectAll` are still exported and still
tested; the window uses the browser's motion instead. They are kept for the
command line, which has no browser.
