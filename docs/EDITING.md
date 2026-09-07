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

**A selection is clamped to one section.** A caret is bound to a section, so a
selection that runs out of one is pulled back to its edge and the status bar
says how much is really selected. Ctrl+A in a multi-section document therefore
selects the last section, not the document.

**Motion in `packages/edit` is no longer used by the editor.** `moveChar`,
`moveWord`, `moveLine`, `lineEdge` and `selectAll` are still exported and still
tested; the window uses the browser's motion instead. They are kept for the
command line, which has no browser.
