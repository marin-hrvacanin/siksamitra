# Driving śikṣāmitra from a command line

Everything the window can do, a command can do. That is not a convenience; it
is the design. The owner authors documents by hand **and** by handing the job
to an agent, and a power only one of them has is a power that rots — so the
editing commands here call the same `apply` in `@siksamitra/edit` that runs
when a key is pressed in the editor. Rule zero, the mark rebasing, the
re-derivation and the refusals are therefore identical by construction.

Read `docs/authoring/` first for the rules the marks follow. This file is only
about *working* them.

```
npm run run                              # start it — see below
npm run sm -- <command> [options]        # from this repository
sm <command> [options]                   # once installed
```

## Starting the program

```bash
npm run run              # the newest build, building whatever is stale
npm run run -- --build   # rebuild the desktop app first (compiles Rust)
npm run run -- --web     # skip the desktop app: serve the bundle in a browser
npm run run -- --dev     # the dev server, with hot reload
```

One command on Windows, macOS and Linux. It knows the two things that are
otherwise learnt the hard way: `copy:fonts` has to run before a desktop build
or the window opens on "asset not found: index.html", and a desktop binary
embeds the bundle it was built with, so one older than the bundle shows the
previous version of the program. It says so rather than springing a
minutes-long Rust build on you.

**The browser gates refuse a stale build.** Every tool in `tools/` that drives
a page checks the build stamp the web build writes (`tools/build-stamp.mjs`)
against the source on disk, and stops if they disagree. They were pointed at a
`serve apps/web/dist` from hours earlier and passed green against it while the
source they were meant to be checking had changed underneath them.

Every command takes `--json` (machine-readable on stdout, human on stderr).

| Exit | Means |
|---|---|
| 0 | done |
| 1 | the document is invalid |
| 2 | bad input — a flag, a path, an id that does not exist |
| 3 | the engine refused, or the edit costs marks that cannot be rebuilt |

## The shortest useful path

```bash
sm import ~/Downloads/durga.docx --out durga.json   # a marked Word file, read
sm validate durga.json                              # is it sound?
sm set-register durga.json --preset rigveda --write # whose rules govern it
sm diff durga.json                                  # engine's marks vs the file's
sm export durga.json --out durga-out.docx           # back to Word
```

## Sending someone a mantra

```bash
npm run export -- --styles                                  # what the styles are
npm run export -- durga.json                                # one .html, lossless
npm run export -- durga.json --style card --png             # a card for a chat
npm run export -- durga.json --style card --png --select '#sec-1/v-1'
```

The **`.html` is the lossless one**, and it is the only export that is also an
import. It is one file with nothing to fetch — the page, its stylesheets, the
font files it needs and any recordings, all inline — and the document itself
rides inside it in a `<script type="application/json">` block, so the same file
opens again with nothing lost. `npm run check:export:html` proves that over all
eleven corpus documents by comparing the document that comes back with the one
that went in, field for field.

The **image** is that same file, photographed: `--png`, or `--svg` for a
`foreignObject` SVG that scales (it opens in a browser; a vector editor will
show it empty). `--scale 3` for a bigger one. The `card` style is built to be
sent in a chat — the mantra centred on a rounded ground, 1 184 px at 2×.

A style is one entry in `packages/tokens/src/export-styles.ts` and it names a
document theme, so `veda-union` is his own Word page — 16 pt Arial on 24 pt
exact leading, his holding green — and not a lookalike. Both exports take the
same list, and so does the window: **File ▸ Export HTML** and **Export image**,
with the style beside them.

## Nothing is written without `--write`

Every editing verb prints what it *would* do and stops. `--write` saves over
the file; `--out <path>` saves elsewhere. So a command you are unsure of costs
nothing: run it, read the report, decide.

    sm hold durga.json --verse v-2 --units 0-4 --value long
      v-2: 5 letter(s) held long
      1 verse(s) re-derived: v-2
      not saved — add --write to save it, or --out <path>.

## Reading a document

| Command | What it answers |
|---|---|
| `stats <doc>` | what is in it — verses, syllables, holdings, how many are transcribed |
| `validate <doc>` | the invariants, with the line that broke one |
| `diff <doc>` | where the engine's marks and the document's own disagree |
| `roundtrip <doc>` | every letter, mark and script re-derived and compared |
| `profile <doc>` | which register reproduces this document best |
| `words <doc>` | every distinct word surface, with counts |
| `inspect <file.vuchant>` | a package's manifest, without opening it |

## Changing a document

| Command | What it changes |
|---|---|
| `set-register` | which register's rules govern the text — `--preset` or `--none`, `--section <id>` for one step |
| `set-text` | a verse's own words: `--verse <id> --text "pāda one / pāda two"` |
| `hold` | a holding placed by hand: `--verse <id> --units 0,3,5 --value short\|long\|none` |
| `clear-marks` | withdraw a hand-placed opinion so the rules decide again |
| `auto-hold` | re-run the holding rules over a section, `--mode keep\|replace` |
| `set-field` | a title, a heading, a verse number, a translation, a source |
| `add-verse` / `remove-verse` | a verse in or out of a section |

`--units` counts letters from the start of the verse, and takes `0,3,5` or
`0-4`. A line break in `--text` may be a real newline, a literal `\n`, or ` / `
— which is how the marking guides themselves write one.

### Two things a command will refuse

**A verse copied from a marked source is never re-derived.** It has no source
layer: its marks are a record of what somebody wrote by hand, and the program
cannot rebuild them. Any edit that reaches one exits 3 and changes nothing.
Give the verse a source layer first (`sm attach-src`, which only succeeds where
a derivation reproduces the marks exactly) if you mean to make it derivable.

**An edit that spends a transcribed accent has to say so.** Replacing text
whose accents came off a scan loses them. The command reports the cost and
exits 3 without writing; `--accept-loss` is how you say you meant it.

## The recitation

A document can say which second of a recording is which pāda, and the reader
plays from that — a verse, a single line, the line lit as it is sung. Nothing
could ever produce that mapping, so most recordings never had one.

The **Audio tab** does all of this in the window — attach a take, map it, see
the boundaries on the waveform with the guessed ones marked, drag one straight,
play a verse or a line — and it calls the functions below rather than its own,
so the window and the command line produce the same mapping from the same file.
The commands are what a script and an agent use.

```bash
sm audio map durga.json --file take.wav --write   # listen, and work it out
sm audio check durga.json                         # is a hand-edited one usable?
sm audio show durga.json                          # what it currently claims
```

It finds the breaths in the recording, works out what share of the time each
pāda's **syllables** are owed, and matches the two. A boundary that lands on a
breath is heard; one with no breath near it is the arithmetic's guess and is
marked `?` in the output and in `--report`. Fix those two or three by hand
rather than distrusting the whole mapping.

WAV is read directly. Anything compressed goes through `ffmpeg` if the machine
has one — the editor needs neither, because the browser decodes everything.

## The register — which rules apply

The rules are not one set. Five registers, and the document says which:

| Preset | The texts it covers |
|---|---|
| `taittiriya` | Kṛṣṇa Yajurveda — Puruṣa Sūktam, Śrī Rudram, Mantra Puṣpam |
| `rigveda` | Ṛgvedic sūktas — Durgā, Śrī, Bhāgya |
| `sukla-yajurveda` | Vājasaneyi — Rudrāṣṭādhyāyī, the Mādhyandina recension |
| `smarta` | stotras, aṣṭakas, purāṇic and āgamic verse |
| `prose` | saṅkalpa, nāmāvalīs, offerings, instructions |

A section may name its own, which is what a manual needs: a saṅkalpa in prose
inside a book of Taittirīya. Changing a register re-derives everything it
reaches, keeps every hand-placed mark, and never touches a transcribed verse.

## Marks by hand, and why they survive

A hand-placed mark is an **override**, addressed to a letter in the verse's
*source* rather than to a position in its output. So it survives a re-derive, a
register change and an edit somewhere else in the verse. When an edit deletes
the letter an override was on, the mark cannot follow — and that is reported,
never dropped in silence:

```
  1 hand-placed mark(s) could NOT be carried:
    {"verseId":"v-4","line":0,"letter":12,"field":"hold"}
```

## Using the packages directly

The CLI is a thin client. If you are writing a tool, import the packages:

```ts
import { apply, newState, emptyHistory } from '@siksamitra/edit';
import { normalizeChantDoc } from '@siksamitra/format';

const doc = normalizeChantDoc(JSON.parse(await readFile(path, 'utf8')));
const { state } = apply(newState(doc), emptyHistory(), {
  k: 'profile', scope: 'document', preset: 'rigveda',
});
state.refusals;   // why it would not
state.lostMarks;  // what it could not carry
state.doc;        // the result
```

| Package | What it owns |
|---|---|
| `@siksamitra/format` | the document: its shape, its validation, its canonical bytes |
| `@siksamitra/engine` | the marking rules — text in, marks out, nothing stateful |
| `@siksamitra/edit` | editing: the caret, the commands, undo, rule zero |
| `@siksamitra/layout` | pages, zoom and how a document becomes a page |
| `@siksamitra/audio` | where the voice stops, and which second is which pāda |
| `@siksamitra/interop` | Word, PDF, `.smdoc`, `.vuchant` |
| `@siksamitra/render` | drawing a marked text |
| `@siksamitra/tokens` | every design value, so none is buried in a stylesheet |

## The editing surface

`docs/EDITING.md` — how the window edits, why the browser owns the caret, what
is checked, and what is known to be wrong and not yet fixed.

## Before you commit a change to a document

```
npm run check
```

runs the type check, all tests, and the gates — the marking conformance suite,
the corpus score, the lossless round trip, the source-layer gate and the token
and module rules. A document change that breaks one of those is a document
change that is wrong; the gate is not the obstacle.
