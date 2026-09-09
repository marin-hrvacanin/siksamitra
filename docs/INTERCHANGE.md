# The interchange contract

**Contract version: 4**
**Status: binding. Both sides are brought to match this document, not to each other's source.**

---

## 0. What this document is for

śikṣāmitra and vedaunion.org are two independent programs. Separate repositories,
separate hosting, separate deployments. Neither depends on the other, in either
direction, at build time or at run time.

They share exactly one thing: **the format of a marked document**. śikṣāmitra
writes it; the platform reads it. Both implement it themselves.

That arrangement has one failure mode and it is worth naming plainly: two
independent readers of one format can drift, and no compiler will catch it. A
construct that śikṣāmitra starts emitting is simply not understood by the
platform until the platform is taught it — and nothing fails loudly in between.

This document, plus the conformance fixtures beside it, is the whole of what
stands against that. So:

- **A format change lands here first.** Not in either implementation.
- **A construct without a fixture will drift silently.** Adding one without
  adding its fixture is how this file stops being true.
- **Either side may move first.** That is the point of the split. What may not
  happen is a side moving without this document moving with it.

---

## 1. The shape of a document

A document is JSON. It carries a version, a hierarchy, and tokens.

```
ChantDoc
├── version          the contract version this document claims
├── title            + titleForms per script
├── source?          provenance, inheritable downward
├── profile?         which register produced the marks (a NAME, not the rules)
├── recording?       audio references, keyed by verse id
└── sections[]
    ├── id, n?, title?, label?, part?
    ├── source?      overrides the document's
    └── verses[]
        ├── id, n?
        ├── src?     THE SOURCE LAYER — see §2, rule zero
        ├── tokens[] the marked text
        ├── words[]? per-word grammar, aligned to syllable runs
        └── translation?
```

### 1.1 Tokens

A verse's text is a flat token list. Every token has a discriminator `t`.

| `t` | meaning | fields | in the corpus |
| --- | --- | --- | --- |
| `syl` | one syllable | `iast`, `deva`, `tel`, `tam`, `units[]` — see §1.3 | 15 875 |
| `sp` | a word space | — | 7 148 |
| `danda` | `।` or `॥` as structure | `s` | 1 081 |
| `br` | a line break within the verse | — | 800 |
| `pause` | a recitation pause | `len: 'short' \| 'long'` | 488 |
| `num` | a verse number — **structure, never recited** | `s` | 204 |
| `bar` | a structural rule | — | 59 |
| `text` | text that is not marked syllables | `s`, `deva`, `tel`, `tam`, `fill`, `placeholder` | 14 |
| `slot` | **a variable slot — RECURSIVE** | `name`, `tokens[]` | 3 |

The union has **nine** members. An earlier version of this document listed six,
omitting `num`, `bar` and `slot` — 266 tokens in the shipped corpus that a
reader built from the contract would not have known existed.

**Three reader obligations live in this table**, and each fails silently:

1. **`slot` is recursive and transparent.** It carries its own `tokens[]` and a
   reader must descend into them: they are real syllables and they are really
   chanted. A reader that treats the union as flat drops them. It is the only
   recursive construct in the format, so it is the one most likely to be missed.
2. **`text.placeholder` is NEVER emitted as text.** It is the marker standing
   where a reciter has not supplied a name or a gotra. It is shown on screen and
   it is not speech: emitting it puts `(your name)` into the recitation, into a
   copy-to-clipboard and into an export.
3. **`num` and `bar` are not speech.** A reader that concatenates every token
   carrying an `s` recites the verse numbers.

`text.fill` marks free text the reciter supplied, rendered under a dotted
underline. `text` without `fill` is plain unmarked text; `deva`/`tel`/`tam` give
its per-script form, and where absent `s` is used in every script.

The script fields on a `syl` are **derived**. A reader displays whichever the
user asked for.

They are *not yet* equal in the way they should be — see §1.3, which is the one
part of this contract known to be changing.

### 1.3 Scripts — a planned change, stated in advance

**Contract v4 fixes four script fields on every syllable: `iast`, `deva`, `tel`,
`tam`. This is a defect, and it will change in v5.**

It is written down here rather than quietly fixed because a reader built against
v4 will meet v5 documents, and it should know now what is coming.

What is wrong with it:

- The set of writing systems is closed by the format. Adding Kannada, Bengali,
  Grantha or ISO-15919 requires a format change, which is backwards — a writing
  system is not a property of the format.
- ITRANS already exists in the exporter's tables and cannot be carried by a
  document at all, because there is no field for it. It is implemented and
  unrepresentable.
- Four named fields make IAST look like the real text and the rest like
  translations of it. They are all renderings of the same phonemes.

**v5 will carry `scripts: Record<ScriptId, string>`** on a syllable, plus a
document-level declaration of which scripts it carries. A reader that meets a
script it has no support for reports it by name, renders the ones it has, and
**passes the unknown forms through untouched** on a round trip.

Implementers on both sides: a reader written to iterate the script fields it
finds, rather than to destructure four known names, will survive v5 unchanged.
That is the cheapest thing either side can do today.

### 1.2 Units — where the marks live

A syllable's `units[]` are its letters. A mark is a **field on a unit**, never a
class name, never an element, never a style.

| field | meaning | occurrences in the corpus |
| --- | --- | --- |
| `c` | the IAST letter, after sandhi | 37 626 |
| `svara` | the accent: `anudatta`, `svarita`, `dirgha-svarita` | 6 093 |
| `hold` | a holding on this letter: `short` or `long` | 4 789 |
| `hg` | the holding GROUP id — a box spanning several letters is one `hg`, not several `hold`s | 4 789 |
| `change` | a change-style letter: an anusvāra rewritten by rule, shown as itself | 964 |
| `sup` | a superscript reading aid | 359 |
| `candra` | the Vedic candrabindu | 89 |
| `sbhakti` | the epenthetic svarabhakti vowel | 31 |


The counts are measured over the eleven documents in `corpus/chants/`, not
estimated. They matter because they say which constructs a reader will actually
meet: a reader that handles `c` and `svara` and nothing else already renders
most of the corpus wrongly but recognisably, whereas one that ignores `hg` draws
every multi-letter holding as separate boxes.

An earlier version of this table listed a `cj` conjunct control as "modelled but
unattested". **`ChantUnit` has no such field** — `cj` exists only on the
engine's internal lexer type and never reaches a document. It was reported as
the flagship unexercised construct every run, which is worse than silence: the
one place the suite admitted a gap, it admitted a gap that does not exist while
saying nothing about `num`, `bar` and `slot`, which do.

**This is the whole of why the format exists.** v1 stored a holding as
`<span class="ql-hold-short">`, which made the document inseparable from one
program's stylesheet, made it single-script, and made "is this mark right?" a
question about a DOM blob with no place to assert an answer.

A reader that needs to know where to draw a box reads `unit.hold`. It does not
parse markup, and it does not consult the engine.

---

## 2. Rule zero: attested marks are never re-derived

A verse MAY carry a `src` layer — the plain IAST lines it was derived from.

- **`src` present** → the marks were computed, and may be recomputed.
- **`src` absent** → the marks are **attested**. They came from a witness: a
  published PDF, a hand-marked Word file, an accented manuscript. They are
  evidence, not output.

**A reader must never regenerate marks for a verse with no `src`.** A writer
must never add one to a document imported from a witness. PDF import and Word
import both write documents with no `src`, deliberately.

This is the single most important rule in the contract, because violating it
loses information that cannot be recovered by recomputation — that is what
"attested" means.

---

## 3. Provenance

`source` may appear on the document, on a section, or on a verse. It is
**inheritable**: a node without one resolves to its nearest ancestor's.

A citation identifies the text precisely enough to reproduce it — recension,
corpus, text, division, and number. A document that cannot say where its text
came from is not finished.

---

## 4. Audio is referenced, never inlined — a picture is the other way round

`recording` carries **references** and timings. Audio bytes live beside the
document, not inside it.

This is not a preference. v1 base64'd audio into the content string and produced
a 38.8 MB Puruṣa Sūktam that had to be decompressed in full before verse 1 could
be shown. A reader must be able to open the first verse of a document without
reading a single byte of audio.

### 4.1 A picture goes INSIDE, and the difference is not inconsistency

`ChantFigure.src` may be either:

- **the bytes** — `data:image/png;base64,…`, which is what this program writes;
- **a name** — a path or a URL, which the **host** resolves
  (`RenderHost.resolveUrl`). The platform serves `/figures/<doc>/…`; this
  editor resolves nothing but the bytes.

The two answers differ because the two things do. A recording is tens of
megabytes and is played after the first verse is on screen; a picture is
kilobytes and IS the first thing on the page. And the failure each avoids is the
opposite one: inlining audio made a document nobody could open, while
referencing a picture made a document whose pictures do not travel —
`puja-vidhi.json` names 22 PNGs, and every one of them is a hole in any copy of
the document outside the platform.

A reader that cannot resolve a named picture **draws a placeholder carrying the
figure's `alt`**, and emits no URL. It does not fetch, and it does not draw
nothing.

Binding, for every implementation:

- `alt` is REQUIRED and non-empty, and is not the caption repeated. A picture in
  a liturgical manual is frequently the whole of an instruction.
- A carried picture is PNG, JPEG, WebP, GIF or AVIF. **SVG is refused**: it is a
  script host, and a picture arriving inside a document someone was sent must
  not be able to run.
- A figure reserves its box before it loads — a fixed `crop`, or `width` and
  `height`.
- `size` is one of five named fractions of the column. A width in pixels is not
  expressible, on purpose: one document is drawn in an A4 column, a web measure
  and a card.

`packages/format/src/figure.ts` is the definition and `figureFaults` is the
check. The reasoning is `openspec/changes/document-images/design.md`.

---

## 5. Version and integrity

- `version` is this contract's version, currently **4**.
- A package (`.vuchant`) carries `docHash`, taken over **exactly** the canonical
  document bytes it transports.

**A hash mismatch is refused, not repaired.** A reader that "fixes" a document
it was given is a reader that can silently disagree with the writer.

**A document declaring a version above what a reader supports is reported, not
partially interpreted.** Half-understanding a document is worse than refusing
it, because the failure is invisible.

---

## 6. What is NOT in the contract

Deliberately, and permanently:

- **The rules.** How a holding is placed, which anusvāra treatment a recension
  takes, where svarabhakti appears — none of it crosses. The engine is
  śikṣāmitra's, and the platform never derives a mark.
- **`profile`** names a register (`taittiriya`, `rigveda`, `sukla-yajurveda`,
  `smarta`, `prose`). It is provenance: it says which register produced the
  marks. It is **not** an instruction to reproduce them.
- **Presentation.** Colours, weights, geometry, fonts, spacing. Each side draws
  the format as it sees fit; the fixtures constrain *meaning*, not pixels.
- **How a script is written.** The phoneme-to-glyph mapping, vowel signs,
  virama placement and approximations belong to whichever program is producing
  the forms. The contract carries the RESULT, per script, not the tables.
- **Reading preferences.** Which script is on top, font scale, whether marks are
  shown. Those belong to whoever is displaying.

---

## 7. Changing the contract

1. Change **this document**, and raise the version.
2. Add or update the **fixture** covering the construct.
3. Bring the two implementations to match — in either order.

Step 2 is the one that gets skipped under time pressure, and it is the one that
makes the other two worth doing.

---

## 8. Conformance fixtures

`corpus/conformance/` holds one fixture per construct: a minimal document that
exercises it, and the interpretation a correct reader must produce.

They are deliberately small and deliberately boring. Their value is coverage,
not realism — the eleven real documents in `corpus/chants/` cover realism, and
the engine ratchet already measures against those.

Run them here with:

```
npm run check:conformance
```

The suite is plain JSON with a documented shape, so the platform can run it too
without importing anything from this repository. That is the entire mechanism
keeping two independent implementations honest, which is why it is a file format
and not a library.

---

## 9. Byte-level definitions

Everything above describes meaning. This section is what a second implementer
actually needs and could not previously get from this document: the exact bytes.
Each item here was asserted somewhere above without being defined, which made
"binding on both sides" untrue in practice.

### 9.1 `format` and the two versions

Three fields are easy to conflate and mean different things:

| field | example | what it is |
| --- | --- | --- |
| `format` | `"vedaunion.chant"` | the discriminator. Present on every corpus document. A reader checks it before anything else. |
| `version` | `2` or `3` | the document's **SHAPE generation**. `2` = verses only. `3` = adds `items`, `instructions`, `figures`, `groups`. |
| contract version | `4` | the version of THIS DOCUMENT, carried by fixtures as `contractVersion`. |

They are not the same number and never have been. A reader told to "refuse
anything above 4" while reading `version` will accept a v3-shaped document it
cannot render, and refuse nothing. **Refuse on `version` above what your reader
supports; read this document at whatever contract version it declares.**

### 9.2 Canonical JSON

One serialisation, or no hash can ever agree:

```
canonical(v):
  null / number / string / boolean  ->  JSON scalar
  array   ->  "[" + canonical(each) joined by "," + "]"
  object  ->  "{" + for each key in SORTED order:
                    JSON-quoted key + ":" + canonical(value)
              joined by "," + "}"
```

- Keys sorted by code unit (JavaScript `Array.prototype.sort` default; Python
  `sort_keys=True`).
- **No whitespace anywhere** — separators are `,` and `:`.
- Non-ASCII is emitted literally, NOT escaped (`ensure_ascii=False`). Devanagari
  stays Devanagari.
- Text must be **NFC**-normalised before hashing. IAST and Devanagari both have
  multiple encodings of the same grapheme, and an unnormalised hash disagrees
  across platforms for text that is identical on screen.

### 9.3 `docHash`

```
docHash = sha256( utf8( canonical(document) + "\n" ) ), lower-case hex
```

**The trailing newline is part of the input.** It is not decorative and it is
not guessable; a reader that omits it computes a different hash for identical
content and refuses every package.

Those same bytes — `canonical(document) + "\n"` — are the definition of "the
document as it is served". `document.json` inside a package must be exactly
them.

### 9.4 The `.vuchant` container

A **zip**. Members:

```
document.json        canonical bytes per 9.3            deflated
source/…             the authored source, iff derived   deflated
assets/…             audio, figures                     STORED (level 0)
originals/…          the .docx / .pdf it came from      STORED (level 0)
manifest.json        format, version, slug, title, engine, createdAt,
                     docHash, contents{documentBytes,assets,assetBytes}
```

- `manifest.format` is `"vedaunion.chant.package"`.
- Assets and originals are **stored, not deflated**: they are already-compressed
  media and deflating them costs time to no benefit.
- Every member is written with a **fixed mtime** (`315532800000` ms — 1980-01-01),
  so packing the same document twice produces identical bytes. Without it a zip
  carries the clock and nothing downstream can be compared.

### 9.5 `hold` is about the vowel before, not about duration

`hold: 'short' | 'long'` reads like a duration and is not one. It names the
vowel **preceding** the holding: `short` renders a thin box, `long` a thick one.
An implementer who reads it as "hold this letter longer" marks the wrong
syllables and nothing in the format contradicts them.

### 9.6 Script ids versus syllable field names

A document declares `"scripts": ["iast","devanagari","telugu","tamil"]` and a
syllable carries `iast`, `deva`, `tel`, `tam`. These are **different spellings
of the same four scripts**:

| declared id | syllable field |
| --- | --- |
| `iast` | `iast` |
| `devanagari` | `deva` |
| `telugu` | `tel` |
| `tamil` | `tam` |

On a syllable, `iast` and `deva` are required; `tel` and `tam` are optional and
fall back to `deva`. When §1.3's change lands in v5 this mismatch goes with it —
one id, everywhere.

### 9.7 `src`, and what "attested" means exactly

```
ChantVerse.src?: { lines: string[]; accented?: string[]; departures?: {from,to,why}[] }
```

A verse is **attested** — rule zero, §2 — when `src` is absent **or** when
`src.lines` is empty. Both, not just the first: two readers in this repository
disagreed about it, one checking absence and one checking emptiness, over the
rule the contract calls its most important.

`@siksamitra/format` exports `isAttested(verse)` as the single definition.

### 9.8 What is verified, and what is merely carried

Not everything in this contract is evidence:

| | status |
| --- | --- |
| Devanagari, Telugu forms | **verified** — 15 881 syllables, 31 762 assertions, against the owner's own corpus |
| Tamil forms | **carried, unreviewed.** Asserted by the fixtures so both implementations agree, NOT evidence that they are correct Tamil |
| ITRANS | **read-only.** Sequence-ambiguous (`sh` is also `s`+`h`); round-tripping corrupts |

A fixture asserting a Tamil form is pinning two implementations to the same
output. It is not a claim that the output is right.

### 9.9 The source layer's own spelling

`src.lines` is canonical IAST — `norm()` is idempotent on it, which is what
makes an override's `letter` offset mean one thing. Four glyphs in it are
structure rather than letters:

| in `src.lines` | becomes | note |
| --- | --- | --- |
| `\|` / `\|\|` | `danda` `।` / `॥` | one bar or two |
| `/` (any run) | `br` | a line break inside the verse |
| `¦` (U+00A6) | `bar` | a pāda rule. Drawn, never recited |
| a run of digits, optionally with an interior dot | `num` | `1`, `1.1` — Śrī Rudram numbers by anuvāka |

`¦` and the digit run were added when the eleven shipped documents were given
source layers: 59 `bar` tokens and 204 `num` tokens had **no spelling at all**,
so a third of the corpus could not be reproduced from any source. The dot
matters for the same reason — `||1.1||` read as one word swallowed the number
and both daṇḍas.

`src.accented` is the same letters carrying the accents as combining marks
(U+030D svarita, U+030E dīrgha-svarita, U+0331 anudātta), one string per line,
**one slot per nucleus**. A line whose nucleus count disagrees with the text's
is refused whole rather than slid along — a silent off-by-one there moves every
accent in the verse and the result still looks marked.

### 9.10 Overrides, and how they survive an edit

```
ChantOverride = { at: {verse, line, letter}, set: {...}, why, ch?, note?, provenance? }
```

`at.letter` is the **character offset** of the letter's start in the canonical
source line — not an ordinal. A digraph (`ai`, `kh`) is one letter spanning two
characters, and the gum run spans several, so counting letters and counting
characters give different answers and only one of them is recoverable from the
stored text.

`set` maps a mark field to a value, or to **`null`, which means "there is no
mark here"** — an instruction, and a different one from omitting the field. A
reader that treats `null` as falsy-and-skip gets it exactly backwards.

`ch` is the letter the override was placed on, in IAST: a **witness, not an
address**. An offset survives a rule change but not an edit to the text before
it, and arithmetic cannot tell a correct rebase from one that moved a box a
letter to the left — both produce a valid offset. With `ch` recorded, a rebase
is checkable, and one that fails its check is reported rather than silently
misplacing a hand-drawn mark. Optional: a document written before the field
existed rebases unverified.

Overrides are applied **after every rule, including svara**, because an
override exists to overrule them: a transcribed accent that a positional plan
disagrees with is evidence, and the engine does not get to win that argument.

### 9.11 `items` and `verses` are the same verses, twice

A composed section stores its verses in `items` — interleaved with instructions
and figures — **and** in `verses`. `normalizeChantDoc` treats `items` as
authoritative and rebuilds `verses` from it.

So a writer that updates only `verses` has its work discarded on the next load.
Measured: a pass that attached a source layer to all 573 verses of the corpus
lost every one of them this way, and ten of the eleven documents are composed.
`@siksamitra/format` exports `withVerses(section, verses)` as the one function
allowed to know this, and every writer must go through it.
