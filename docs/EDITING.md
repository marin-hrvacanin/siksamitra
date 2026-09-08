# The editing surface

The page is `contenteditable`. The browser owns the caret, the selection, the
pointer and every motion key; every `beforeinput` is refused and re-expressed
as a command against the document. The DOM is a projection at all times: the
browser may select in it and may not change it.

That invariant is the whole design. `agnim īḷe` in the file is drawn as
syllable boxes with holdings around them and accents above the line, and an
anusvāra may be drawn `gṁ` — so the text on screen is not the text in the
document, and anything that let the browser edit the page directly would be
editing a picture of the document rather than the document.

| file | what it owns |
| --- | --- |
| `EditorSurface.tsx` | the listeners, the focus, and the first caret |
| `useDomCaret.ts` | the seam: the browser's selection ⇄ an address in the source |
| `dom-selection.ts` | a DOM position as a unit, and a unit as a DOM position |
| `apply-input.ts` | what each `beforeinput` means to the document |
| `unit-map.ts` | a unit as a line and a column, and back |
| `focus.ts` | putting the keyboard back on the page |

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
