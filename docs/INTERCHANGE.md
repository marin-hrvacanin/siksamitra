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

| `t` | meaning | fields |
| --- | --- | --- |
| `syl` | one syllable | `iast`, `deva`, `tel`, `tam`, `units[]` — see §1.3 |
| `sp` | a space | — |
| `br` | a line break within the verse | — |
| `danda` | `।` or `॥` as structure | `s` |
| `pause` | a recitation pause | `len: 'short' \| 'long'` |
| `text` | literal text that is not recited | `s` |

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
| `cj` | a conjunct control: `split` or `join` | 0 — modelled, unattested |

The counts are measured over the eleven documents in `corpus/chants/`, not
estimated. They matter because they say which constructs a reader will actually
meet: a reader that handles `c` and `svara` and nothing else already renders
most of the corpus wrongly but recognisably, whereas one that ignores `hg` draws
every multi-letter holding as separate boxes.

`cj` is modelled by the format and occurs nowhere in the corpus. It is
**unexercised**, listed as such by the fixture index, and therefore the most
likely construct for the two implementations to disagree about without anyone
noticing.

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

## 4. Assets are referenced, never inlined

`recording` carries **references** and timings. Audio bytes live beside the
document, not inside it.

This is not a preference. v1 base64'd audio into the content string and produced
a 38.8 MB Puruṣa Sūktam that had to be decompressed in full before verse 1 could
be shown. A reader must be able to open the first verse of a document without
reading a single byte of audio.

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
