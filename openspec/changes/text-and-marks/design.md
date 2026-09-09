# One text, and markings on it

## The model

A verse holds two things and derives everything else.

```ts
interface Verse {
  id: string;
  /** The letters as typed. One string; `\n` separates pādas. */
  text: string;
  /** Everything drawn on top, sorted by `from` then `k`. */
  marks: Mark[];
  /* …the author's own fields: n, translation, source, words, audioId… */
}

interface Mark {
  /** What it is. */
  k: MarkKind;
  /** Half-open range over `text`, in code points. `from === to` is a point. */
  from: number;
  to: number;
  /** Its value, if the kind has one. */
  v?: string;
  /** Which pass produced it — the unit a re-run works on. */
  stage: Stage;
  /** Who put it there. The one bit that makes a re-run safe. */
  by: 'rule' | 'hand';
  /** Which rule, when `by` is `rule`. For tracing, never for behaviour. */
  rule?: string;
}

type Stage = 'sandhi' | 'change' | 'holdings' | 'svara' | 'aids';

type MarkKind =
  /** This range was typed as `v` and the rules replaced it. See below. */
  | 'was'
  | 'hold'      // v: 'short' | 'long' | 'none'
  | 'svara'     // v: 'anudatta' | 'svarita' | 'dirgha-svarita'
  | 'candra'    // candrabindu on the range
  | 'sbhakti'   // svarabhakti dot before `from`
  | 'sup'       // superscript, v: the letters
  | 'pause';    // v: 'short' | 'long'; a point mark
```

That is the whole format. Everything below follows from it.

### Why offsets and not ids

A mark could name a stable letter id instead of an offset, and would then never
need rebasing. It would also make every letter an object again, which is the
6.41 MB the format is escaping, and would put an id in the file for every one of
46 836 characters. Offsets are two integers, and the rebasing they need already
exists (`rebase.ts`) and is already tested against the corpus. Code points, not
UTF-16 units, so a surrogate pair cannot be split.

### Why the shown letter is stored

`ṁ` renders as `n` before a dental. Three options were considered.

1. **Compute it at render time.** Smallest, and wrong: a person can then never
   say "show this one as `n`" by hand, which is a thing the owner asked for
   explicitly. A derived value nobody can address is a value nobody can correct.
2. **Store the shown letter and record the original beside it** (`c: 'n', was:
   'ṁ'`). Recoverable, but the text on disk is then the *displayed* text, so
   "give me the plain text" is a reconstruction, and every consumer must know to
   undo substitutions before reading.
3. **Store the true letter in the text and the display as a mark.** The text
   would always be the typed text, and reading it would need no knowledge of
   the marking system at all.

**Option 2 is what ships, and the spike is why** — see "The one consequence"
under the editing surface below. A flat text run is what makes Lexical's
selection work, and a flat run means the DOM's text is the model's text: there
is no way to show `n` over a stored `ṁ` and still have a click land where the
person aimed. So the text holds what is displayed and the mark carries what it
was.

Nothing that matters is lost by the inversion. Stripping the markings still
gives the typed text exactly — replace each `was` range with its value — and it
is still an exact recovery rather than a guess, which is the whole point. An `s`
that came from a visarga is still permanently distinguishable from a typed `s`,
because it carries the mark; today it is not, since the letter on the page is
`s` and only a `change: true` flag hints otherwise. And the editor is WYSIWYG,
which option 3 could not be without showing `ṁ` while editing.

The kind is therefore named `was` rather than `show`, and its value is the
letter it replaced.

### Why `was` is one construct and not four

The corpus carries 966 substituted letters: `m` 254, `ñ` 139, `ś` 112, `n` 104,
`ṁ` 100, `s` 96, `ḥ` 69, `ṅ` 60, `r` 29, `:` 3. Today each is a `change: true`
flag on a unit, and the original is recovered by a lookup table that guesses
"a changed nasal was probably `ṁ`, a changed sibilant was probably `ḥ`". The
guess happens to hold across this corpus. It is still a guess, and a rule that
ever produces something outside the table fails silently.

A `was` mark carries the original outright, so nothing is inferred. One
construct covers every case the notation has and the ones it does not have yet:

| shown | mark |
|---|---|
| anusvāra before a dental, shown `n` | `was [4,5) = "ṁ"` |
| anusvāra before a sibilant, shown `gṁ` | `was [4,6) = "ṁ"` |
| visarga before `p`, shown `ḥ` | `was [9,10) = "ḥ"` + `sup "f"` |
| a future sandhi join, shown `e` | `was [3,4) = "a i"` |

The range and the original have independent lengths, so a substitution may have
grown or shrunk the text. Stripping is a replacement of the range by the value,
and it composes: undo the latest stage first, then the one before it.

### Layers, which is what stages are for

The owner's question: "maybe we will have layers… automatic sandhi and then on
top of the sandhi (maybe few layers of sandhi) and on top of it changes".

`stage` is that. The text holds the outcome of every stage that has run;
each stage's `was` marks are what undo it, latest first. Re-running is per stage: "re-run
`sandhi` over this selection" discards that stage's `rule` marks in the range,
runs the pass, and writes new ones. Marks of other stages are untouched, and
hand marks are untouched unless the caller asks for `replace`.

Adding a layer is adding a value to `Stage` and a pass that produces marks with
it. No other file changes. That is the flexibility being bought.

### Re-running, in full

```
recompute(range, stages, mode: 'keep-hand' | 'replace-all')
```

1. Drop every mark in `range` whose `stage` is in `stages` and whose `by` is
   `rule`. In `replace-all`, drop the `hand` ones too.
2. Run each stage's pass over the text in `range`, in stage order.
3. In `keep-hand`, a produced mark is discarded where a `hand` mark of the same
   kind already covers that position. The hand wins; that is the owner's ruling.
4. Sort, merge adjacent equal marks, write.

**The engine is never invoked by anything else.** Not by typing, not by opening
a document, not by changing the register. A document opens showing exactly the
marks it was saved with.

### A hand-removed rule mark

Deleting a holding the rules placed leaves no record, so a later `keep-hand`
re-run would put it back. That is what today's **None** button is for — an
explicit "there is no holding here" that survives a re-derive.

The capability is kept; the button is removed. Pressing **Long** on text that is
already long removes the holding, and if any mark being removed was `by: 'rule'`
the removal is recorded as `{k:'hold', v:'none', by:'hand'}` over that range. A
`keep-hand` re-run sees it and places nothing. A `replace-all` re-run clears it
like any other hand mark. The person presses one button and never learns the
word "none".

### Mark algebra — the bold rule

One set of pure functions over a sorted, non-overlapping-per-kind list.

```ts
coverage(marks, k, from, to): 'all' | 'some' | 'none'
applyMark(marks, mark): Mark[]      // union with the range, merging equals
removeMark(marks, k, from, to): Mark[]  // difference, splitting partial overlaps
toggleMark(marks, mark): Mark[]     // coverage === 'all' ? remove : apply
```

`toggleMark` is the whole of the owner's requirement: a mixed selection reads
`some`, so the first press applies to all of it; the second reads `all`, so it
removes; a subset reads `all` within itself, so it removes just that subset and
splits the surrounding mark in two.

Invariants, asserted after every operation:

- sorted by `from`, then by kind;
- no two marks of the same kind overlap;
- no empty range except a deliberate point mark;
- adjacent marks of the same kind and value and `by` are merged into one;
- every offset is within `[0, text.length]` and on a code-point boundary.

### Rendering

One pass, and nothing it produces is stored.

```
text + marks
  → the text IS the displayed characters  → nothing to apply
  → syllabify them                        → syllables
  → place hold/svara/candra/sbhakti/sup   → marks on letters
  → transliterate per script              → the written forms
  → draw
```

Syllable division and script forms leave the file entirely. They cannot
disagree with the text because there is only one of them and it is computed. The
lossless gate already proves the script forms are recomputable at 15 881 / 15 881
in five scripts; this change is what lets us stop storing them.

A holding box is drawn over a **range**, so it crosses a space, and it is the
same drawing whether the range is one letter or eleven.

### The box must not move the text

Applying a holding today widens the letters, because the box is an inline-block
with padding and margin. That is a layout change caused by a marking, and it
makes the page jump as you work.

The air a box needs is reserved on every letter whether marked or not, and the
box is drawn as an overlay that occupies no space. Asserted by measurement: the
bounding box of every glyph in a line is identical before and after a marking is
applied.

## Size

The corpus is 6.56 MB and should be kilobytes. `tools/size-study.mjs` converts
the real corpus to the proposed shape and weighs it; these are its numbers, not
arithmetic.

Where the 6.56 MB goes today:

| | | |
|---|---:|---:|
| the four script forms, per syllable | 746 kB | 45.2% |
| one object per letter | 332 kB | 20.1% |
| token structure | 328 kB | 19.9% |
| the actual markings | 245 kB | 14.8% |

**Nearly half of it is spellings the program can compute.** The lossless gate
already re-derives all 15 881 syllables in five scripts with no loss, so storing
them buys nothing but bytes and a second thing to disagree with the text.

What the new shape weighs:

| | today | text + marks | gzipped |
|---|---:|---:|---:|
| śrī rudram | 1806 kB | 104 kB | 17 kB |
| pūjā vidhi | 1220 kB | 36 kB | 7 kB |
| śiva saṅkalpa sūktam | 881 kB | 31 kB | 5 kB |
| durgā sūktam | 170 kB | 6 kB | 1.4 kB |
| **whole corpus** | **6565 kB** | **252 kB** | **44 kB** |

26× smaller as plain files, 150× compressed. 58 kB of the 252 kB is the text
itself; the rest is 12 635 markings.

### What the file is

A `.docx` holds far more than this and is smaller, because it is a **zip of
XML**. The same applies here, and the same reasoning:

- **A saved document is a zip container** holding canonical JSON. Śrī Rudram is
  17 kB, everything else is single-digit kilobytes. This is also what `.vuchant`
  already does for a package, so it is one mechanism rather than a new one.
- **Inside the zip the JSON stays readable** — full key names, one mark per
  object. A compact tuple encoding was measured at 252 kB against 632 kB
  readable, but after compression the gap is 44 kB against ~55 kB. Ten
  kilobytes across the entire corpus is not worth a file no one can read in a
  diff, and the corpus in the repository stays uncompressed for exactly that
  reason.

Both numbers are gates: a document that grows past its recorded size fails.

## Migration

`tokens` → `text` + `marks`, per verse, verified.

1. Walk the tokens. Letters become text; `sp`, `danda`, `num`, `bar`, `br`
   become their characters (`\n` for `br`).
2. A unit with `change: true` contributes its ORIGINAL letter to the text — the
   guess table, which is all that exists — and a `show` mark carrying the
   displayed letter.
3. `hold` runs of equal value and group become one `hold` mark; `svara`,
   `candra`, `sbhakti`, `sup` become marks on their letter; `pause` becomes a
   point mark. Every mark from a token is `by: 'hand'`, because that is what it
   is: the marks the document arrived with, and nothing may regenerate them
   without being asked.
4. **Render the result and compare with the tokens it came from.** Identical, or
   the verse is reported and left unconverted. The migration is a gate, not a
   script that ran once.

The 420 verses with a `src` get a second check: their `text` must equal their
`src.lines` joined. Where it does not, the difference is reported — that is a
real disagreement between the two copies, and finding them is worth doing before
one of them is deleted.

## The editing surface

**It is Lexical.** Meta's editor framework, with its React bindings. The
`contenteditable` seam — `beforeinput` normalisation, selection across blocks,
IME composition, undo, the clipboard, a reconciler that does not repaint the
world — is where every serious defect came from, and it is a solved problem
that this project should not be solving. The standing rule from the owner: look
for the battle-tested implementation first, and build on top of it.

**Lexical is the surface. It is never the format.** Storing an editor's internal
state as the document is v1's fatal mistake — Quill `innerHTML`, four places
producing marks, no arbiter — and it is the reason v2 exists. The document is
`text` + `marks`; one adapter maps between them.

### What the spike settled

`tools/spike-lexical` is the spike, and it was run rather than reasoned about.

**A custom node emitting this program's existing markup does not work.** A
`TextNode` subclass that drew a `.syl` per syllable and a `.u` per letter
survived the reconciler and then failed everything that matters: a click on the
sixth letter reported offset 1, and typing two characters turned `sunavāma` into
`YsX`. Lexical maps a DOM position to a model offset through the node's own text
node, and there is none when every letter is wrapped.

**Flat runs work, and work better than what they replace.** One element per
marked range, the text flat inside it. Measured in the browser:

| | |
|---|---|
| a marked range is one run | `"su" "navā" "ma " "क्ष्मी"` |
| a click maps to the right offset | clicked `v`, model says offset 2 |
| typing reaches the model and returns | `sunaXYvāma क्ष्मी` |
| applying a holding splits the run | `"su":hold-short "naXYvā":hold-long` |
| the box is one rectangle | 1 client rect |
| the Devanāgarī conjunct still shapes | 48.7px against 81.7px with `akhn`, `half`, `vatu`, `cjct` off — 40% narrower |

Two things this buys that the hand-written surface could not. **One box over a
whole range, crossing spaces, for free** — Lexical splits text at every format
boundary, so a marked range is naturally one element, and the box-per-syllable
problem and the CSS that joins the pieces back together both disappear. And
**bold's semantics for free**, because splitting runs at a selection's edges is
what `formatText` already does.

### The one consequence: which side the substitution records

A flat run means the DOM's text is the node's text. So the editable text is
what is DISPLAYED, and a substitution cannot show `n` over a stored `ṁ`.

The model therefore records the substitution the other way round: **the text
holds the displayed letter, and the mark carries what it was.**

```
text:  … s a n   t a …
mark:  { k: 'was', from: 4, to: 5, v: 'ṁ', by: 'rule' }
```

Every property asked for survives, and none of them depends on which side the
mark sits:

- one text, no second copy;
- stripping the markings gives the typed text **exactly** — replace each `was`
  range with its value, no guessing and no lookup table;
- an `s` that came from a visarga can never be read as a typed `s`, because it
  carries the mark;
- a person can set or remove one by hand;
- and now the editor is WYSIWYG, which the other way round it could not be
  without showing `ṁ` while editing and `n` only in the reader.

That is why the model above names the kind `was`.



**Typing produces text.** Nothing else. No rule runs, no mark appears, no verse
is re-derived. A newly typed document is plain until somebody asks for marks.
Today the engine runs on every edit, which is why markings appear on text nobody
asked to mark; the owner's words were "why does the engine immediately write the
holdings and all that? Who said that?".

The rules are invoked from exactly two places, both deliberate:

- the ribbon — over the selection, or over the whole document;
- the right-click menu — over the selection.

Both offer the stage and the mode (`keep-hand` / `replace-all`).

**The right-click menu is the application's, not the browser's.** Today the
native OS menu appears over the text, which offers Reload and Inspect and
nothing about marking. It becomes an in-app menu carrying: Short, Long, Clear
markings here, Show as…, Nasalisation, Insert pause, Re-apply rules ▸ (per
stage), and the ordinary Cut / Copy / Paste.

**Marking never moves a glyph.** See the box rule above.

**The pointer is an I-beam over text.** It is currently the arrow, because the
shell sets `cursor: default` for tool chrome and the document never overrides
it.

### The bug sweep

The owner reports "many more bugs… I just created a new document and I can't
type space". A space is not a special character to this model — it is text —
and a surface that drops one is dropping input. Rather than fixing the reported
one, the input path gets a systematic gate: for a new empty document and for a
loaded one, every printable key, every space, every newline, every IME
composition, every paste shape and every deletion gesture is driven through the
real surface and asserted against the document's text. That is the only way the
class gets closed rather than the instance.

## Rejected alternatives

**Keep the two copies and fix the edges.** Two days were spent on this: an
adoption pass that gives a verse a source layer whose derivation reproduces its
marks. It works, it is safe, and it adopts **0 of 153** verses, because
transcribed verses store a space either side of a `¦` bar and the engine emits
none. Every fix revealed the next disagreement. The split is the defect.

**Store the document as HTML.** It is what v1 did, and the reason v2 exists: a
marking became a CSS-classed span, "is this holding correct" became a question
about a DOM blob, and marks were produced in four places that could not be
reconciled. HTML is what this renders to.

**Character ids instead of offsets.** Rebasing disappears; 46 836 ids appear,
and with them the per-letter object the size problem is made of.

**A separate overlay document.** Marks in their own file addressed at the text
by offset. Same model, two files to keep in step, and a document that is not one
thing. Rejected for the reason the whole change exists.
