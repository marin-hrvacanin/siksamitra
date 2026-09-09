## Why

A verse is stored twice. Once as `src.lines` — the letters someone typed — and
once as `tokens`, the marked result the rules produced from them. Everything
that has gone wrong in the editor for the last two days is that split.

**The two copies can disagree, and nothing can say which is right.** Deriving is
lossy in one direction: `ṁ` becomes `n` before a dental and the page keeps no
record that it ever was `ṁ`. So the input is kept separately, and now two
representations of one verse must agree forever.

**153 of 573 verses have no input at all.** v1's generator wrote out the marked
result and threw the input away; a later reverse pass recovered 420 of them and
could not recover the rest. Which verses are in which set follows nothing about
the texts — Puruṣa Sūktam recovered 0 of 26, Lakṣmī Aṣṭottara 110 of 111. It is
an accident of one script's bad day.

**That accident reached the owner's screen.** A verse in the 153 could not be
pointed at, could not be marked, and answered a holding button with a paragraph
about evidence. Three separate mechanisms exist only to manage the split — rule
zero's refusals, the source-adoption pass, and the `attested` verse concept —
and all three are load-bearing complexity in service of a data-import mishap.

**The split also makes ordinary editing wrong.** Change a short `a` to a long
`ā` in the marked result and a later re-derivation reverses it, because the
input still says `a`. There is no way to hand-set what a letter displays as,
because the display is not a stored thing anyone can address.

**And it is enormous.** The corpus is 6.41 MB on disk for 46 836 characters of
actual text — 137 bytes per character — because every letter is an object and
every syllable stores four script forms that the lossless gate already proves
are recomputable.

## What Changes

A verse becomes **one text and a list of markings on it**.

- **`text`** — the letters as typed. An anusvāra is `ṁ`. A long `ā` is `ā`. A
  daṇḍa, a bar, a space and a line break are text. Nothing derived lives here.
- **`marks`** — everything drawn on top, each addressed to a range of that text
  by character offset, each carrying what it is, what it is worth, which stage
  produced it, and whether the engine or a person put it there.

A marking that replaces what is shown — an anusvāra displayed as `n`, and every
future sandhi layer — is a `show` mark carrying the replacement. It is STORED,
not computed, so a person can set one by hand; and because the text underneath
still says `ṁ`, stripping the markings gives back the typed text exactly, with
no guessing.

Consequences, all of them removals:

- `src` disappears. So do "attested", "transcribed verse", rule zero's
  refusals, `adoptSource`, `tokenSrcMap`, `markUnits`, the source gate, and the
  vocabulary the owner had to ask about.
- Syllable division, script forms and the change colour stop being stored. They
  are computed when drawing, from one input, so they cannot disagree with it.
- A holding becomes a span, so it crosses a space and behaves like bold: apply
  to a mixed selection and it all turns on; apply again and it all turns off;
  apply to a subset and only that subset turns off.
- The holding controls lose **None** and **Clear**. Both existed only because
  derivation ran continuously and had to be suppressed. Two buttons, Short and
  Long, each a toggle.
- **The engine never runs by itself.** Typing produces text and nothing else.
  The rules run when a person asks them to, over the selection or the whole
  document, from the ribbon or the right-click menu — per stage, with a choice
  to keep hand markings or replace them. Today they run on every edit, which is
  why marks appear on text nobody asked to mark, and why an edit can reverse a
  decision made by hand three keystrokes earlier.
- A right-click menu in the app replaces the browser's native one, carrying the
  marking actions including `show as …`.

## Impact

- **Affected specs**: `format`, `engine`, `editor`, `render`, `interop`,
  `interchange`, `cli`, `performance`
- **Supersedes**, from `bootstrap-v2`: rule zero; "derived fields are outputs,
  recomputed never edited" (a `show` mark is derived AND hand-settable); the
  `src`-based source gate.
- **The corpus migrates**, and the migration is verified per verse: the new
  form must render identically to the old, or the verse is reported and not
  converted.
- **Projected size**: 46 836 characters of text and 12 815 markings, against
  6.41 MB today. Measured after migration, not promised here.
