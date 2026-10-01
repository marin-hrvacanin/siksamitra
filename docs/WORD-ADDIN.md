# śikṣāmitra inside Microsoft Word

How to install it (the first section is for anybody — no programming needed),
what it is, how to run and test it, and what it takes to get it into
Microsoft's store. For what it does to a document — the styles, the marks, what
Word can and cannot represent — read `apps/word-addin/src/model/paragraph.ts`
and `packages/interop/src/word/script-runs.ts`, which is where that is written
down.

---

## Installing it — for anybody

It is not in Microsoft's store yet (that is a submission with an identity check
behind it — see the end of this page). Until it is, it installs from one small
file and one choice in Word, and **keeps itself up to date**.

**Windows** (Word 2019, 2021, 2024 or Microsoft 365):

1. Download
   [`install-windows.cmd`](https://marin-hrvacanin.github.io/siksamitra/word-extension/install-windows.cmd).
2. Double-click it. If Windows says it "protected your PC", choose
   *More info → Run anyway* — it is a short text file anyone can open and read.
   It needs no administrator: it installs for you alone. It also installs
   **URW Palladio ITU**, the face the svaras and the candrabindu are set in —
   fetched from where it is published (Ulrich Stiehl's sanskritweb.net) and
   checked against its hash before anything is installed. Without it Word
   draws every svara in a fallback face.
3. Close Word if it is open, and start it again.
4. Once: **Home → Add-ins → More Add-ins → SHARED FOLDER**, choose
   **śikṣāmitra**, then **Add**. The śikṣāmitra tab is on the ribbon from then
   on, every time Word starts.

To remove it,
[`uninstall-windows.cmd`](https://marin-hrvacanin.github.io/siksamitra/word-extension/uninstall-windows.cmd)
undoes all of it; the tab is gone when Word next starts.

**Mac**: download
[`install-mac.command`](https://marin-hrvacanin.github.io/siksamitra/word-extension/install-mac.command),
double-click it (the first time, right-click → *Open*), quit Word and open it
again, open a document, then **Home → Add-ins → śikṣāmitra**. For now that last
step is needed each time Word starts — see *Why a shared folder* below.

**Word on the web**: Home → Add-ins → *Upload My Add-in*, and give it
[`manifest.xml`](https://marin-hrvacanin.github.io/siksamitra/word-extension/manifest.xml).

**Updates are automatic.** Word loads the add-in's pages from the web every time
it starts, so a new version of what the buttons do is simply there. The Windows
installer also fetches the manifest again once a day. A release that changes the
ribbon itself — a new button — Microsoft says a shared-folder add-in has to be
added again to show: *More Add-ins → MY ADD-INS*, remove it, then add it from
*SHARED FOLDER* as above. On a Mac, running `install-mac.command` again fetches
the new manifest.

### Why a shared folder, and the one step in Word

Until the end of September 2026 the installer wrote Microsoft's developer
sideload — the manifest's path under
`HKCU\Software\Microsoft\Office\16.0\WEF\Developer` — and the tab was simply
there. **Office's update of 24–25 September broke that**: Word now forgets an
add-in registered that way when it closes, on Windows and on a Mac
([OfficeDev/office-js#6973](https://github.com/OfficeDev/office-js/issues/6973),
*under investigation*). Measured here on Word 16.0.20326: the tab on the ribbon
in the session it was added, gone on the next start.

What Word still keeps is an add-in added from a **trusted shared-folder
catalog**. That must be a network path — Word accepts a catalog at `C:\...` and
never lists it — and the installer's own folder is one through the drive's
administrative share, `\\localhost\C$\Users\<you>\AppData\Local\siksamitra\word`,
which needs nothing created and no administrator to read. Word lists the add-in
under *SHARED FOLDER*; added once, it was still on the ribbon after every
restart. Adding it is a choice Word insists a person makes: a program cannot
make it for them.

Where that share cannot be read — a standard (non-administrator) account, or a
machine with the administrative shares turned off — the installer falls back to
the developer sideload and says so: the add-in is then under *MY ADD-INS →
Developer Add-ins*, to be added each time Word starts until Microsoft fixes
#6973. A Mac has no catalog, so the same is true there.

---

## What it is, physically

An Office add-in is **a web page Word loads over HTTPS, plus an XML manifest
naming its URLs.** There is no server, no binary, and nothing it sends
anywhere. So:

- **publishing it** is copying a folder somewhere with a certificate;
- **installing it** is putting the manifest where Word looks;
- **updating it** is replacing the files in that folder.

The folder is `apps/word-addin/dist` plus the manifest and the three installer
files, assembled by `scripts/word-publish.mjs`.

**Everything is on the ribbon.** The śikṣāmitra tab holds every command —
Holding, Svara, Change, Reading aids, Insert (typing help and the IAST
palettes), Script, Rules (registers, parts, re-applying), Document — and the
right-click menu repeats the marks. The manifest is generated from one table,
`apps/word-addin/src/commands-table.ts`, together with every icon and every
keyboard shortcut (`npm run gen:word-commands`), and a test fails if the
manifest on disk is not what the table generates.

**One page, loaded once.** `taskpane.html` is the shared runtime Word keeps
loaded behind the tab (`runtime.ts` registers each command). When *Settings* is
pressed the same page is shown as a side panel: the register (for the part the
caret is in, or the document), the stages the rules run, the styles in the
document, and the keyboard shortcuts. What a command has to *say* — a refusal, a
question before the whole document is changed, the typing help — is an Office
dialog (`said.html`, `type.html`).

**A marking with nothing selected goes on the letter before the caret**, and the
caret comes back where it was, so typing carries on; a pause and a svarabhakti
go *at* the caret. Nothing is sticky: the next letter typed is plain.

**Alt and a letter types its IAST form** — Alt+A ā, Alt+S ś, Alt+Shift+S ṣ —
the app's F9 table, one chord each, because Word allows a chord and never a
sequence. Ctrl+Shift+I opens the typing help. In a Devanāgarī, Telugu or Tamil
line the same keys type that script's letter, and a vowel after a consonant is
its vowel sign (क then ā is का).

**Scripts.** A mantra line may be written in IAST, Devanāgarī, Telugu or Tamil,
and every line is read in the script it is in. *Script → Devanāgarī* rewrites
the selected lines (or, with nothing selected, the whole document, after
asking) with every mark kept; *Script → IAST* gives back exactly what was
there. What a cluster cannot show — which consonant of र्ष a box is on, a raised
reading aid — is kept in Word's own hidden text after it. Headings and
translations are never transliterated.

**Parts.** One document may hold chants of different traditions: *Rules → New
part from these lines* makes the selection a content control with rules of its
own, and *Register* then applies to that part only. Outside every part, the
document's register (kept in the document's own settings) applies.

---

## The desktop app and Word documents

The app opens and writes all three kinds of `.docx`, with the clean style names
(`Mantra`, `Translation`, `Holding · Short`) for anything it writes new, and his
legacy names read and kept wherever a document already uses them:

- **his hand-made files** are read from their styles (`importDocx`);
- **the add-in's documents** the same way, and a Word part comes back as that
  section's register, the document's register from the add-in's settings, and a
  line in any script as the IAST it is;
- **the app's own exports** carry the whole document inside them, and what was
  done to the page in Word since — a verse edited, marked, added or deleted —
  is taken back into it (`word/body-edits.ts`), while untouched verses keep
  everything the file carried.

A `.docx` in the *Veda Union* style is his document: his sheet (A4, 25 mm left,
9 mm right, 15 mm top, 10 mm bottom), his running head (the chant and the step
over a rule, the page number at the right), his styles and colours, the pauses
the rules placed in his blue and those placed by hand in his red.

## In the add-in: one vocabulary, his look

**Every document the add-in writes is in the clean style names** — `Mantra`,
`Translation`, `Holding · Short`, `Holding · Long`, `Overline`, `Anusvara` and
`Visarga` apart. The owner's ruling of 2026-09-30: his older names (`Translit`,
`Prijevod`, `Holding`, `2Holding`, `Long`) "have no place" in the Styles list.

- **Import styles converts one of his documents** (`word/convert.ts`): every
  paragraph in his names is written again in the clean ones, with its letters,
  marks and line-end notes as they were; a paragraph a rewrite would lose
  something of (a picture, a field, hidden text) is left and named; then each
  style of his that nothing uses any more is deleted.
- **Visually nothing changes**, because a clean style takes HIS definition
  (`packages/interop/src/word/clean-styles.ts`, `model/package.ts`): his
  `Translit`'s face, size and leading become `Mantra`'s, his `Long`'s face
  becomes `Overline`'s, and `Visarga` is cloned from his `Anusvara`, so a
  replaced visarga keeps his blue italic while now saying what it is.
  `check:word:reference` measures it over his six documents, and
  `tests/integration/word-his-lines.test.ts` over his shapes without them.
- Word's own styles (`Normal`, `Heading 1`…) are never listed as missing and
  never touched.

**A register belongs to a part, never to "the document".** Choosing one with
the caret in a part marks that part; with lines selected outside every part,
they become a part of their own in it; with a bare caret outside every part,
it is the register of the lines outside every part — and the wording says
exactly that.

**The conventions** (Settings → Conventions, `packages/engine/src/conventions.ts`)
are the rulings where marked texts differ, each with an example typed and
marked: ṁ before a nasal takes that nasal, ḥ before k/kh marked as a change
(both on), the raised u between v and y (off), and the geminate's box on one
letter or both (one). They are kept in the file and Re-apply rules uses them.

**A register belongs to what it is chosen for — and a selection in two
places is refused.** A selection partly in a part and partly not, or over two
parts of different registers, has no one place to choose for; it is said, and
nothing changes. A new part is refused if ANY selected line is in a part
already: parts never nest.

**Word forgets who placed a mark; the add-in asks again.** A marking carries
whether a person or the rules placed it, and Re-apply keeps a person's. Word
keeps no such record — every mark read back is a person's — so before a
re-run the rules the line is marked in (its register, and the conventions the
text was last marked with, recorded in the file) are asked what they make of
it, and a mark exactly theirs is theirs again (`model/provenance.ts`). That is
what makes switching a register or a convention and back give back exactly
what was there.

**A part can be made with another document open.** Word refuses an add-in a
new content control whenever another document is open in it — a blank one is
enough (measured on 16.0.20430: `GeneralException` on every kind of range) —
while one arriving inside an `insertOoxml` package goes in. So when Word
refuses, the selected paragraphs' own package is wrapped in the part and put
back (`model/part-package.ts`); retitling and dissolving a part were never
affected.

**A box pressed on an akṣara is on its consonant.** In a script line the
smallest thing a person can select is the akṣara (`स` is `s` and `a`), so a
box pressed on one goes on the consonant the holding rule chooses for it —
where the add-in's script reader reads a boxed cluster's box too — and the
line is exactly its IAST twin marked the same way (`model/akshara-host.ts`).

**Our styles are known by name.** Word gives a style it inserts an id made
from its name with what is not ASCII dropped — `Virāma` is `Virma` in every
document — and matches an inserted style to the document's by NAME. So the
reader and the pane's style count go by name as well as id, and in one of his
documents a style whose id is also ours keeps HIS name, so Word writes onto his
style rather than beside it.

**Bring in a document from the app** (Settings): a `.smdoc`, a chant package,
a Word file the app exported, or its HTML page, read by the app's own reader
(`openDocumentFile` in interop, which the app's Import now calls too) and
written by the app's own Word body writer — so it comes in marked exactly as
the app has it, a section of another register as a part. It goes in after the
line the caret is in. Pictures are marked where they go; Word inserts a picture
better than a package can.

**Typing after a mark is plain** (`word/typing-guard.ts`): Word carries a
character style on to the next letter typed and Office.js cannot reset a bare
caret's style, so the line just written is watched (`onParagraphChanged`,
WordApi 1.6) and written once more with the typed letters plain.

---

## The three hosts

`scripts/word-addin.mjs` holds them as data — the base URL, the `<Id>` Word
keys the add-in by, and the display name. One manifest
(`apps/word-addin/manifest.xml`, the localhost one) and the published ones are
derived from it by substitution.

| host | serves from | for |
| --- | --- | --- |
| `local` | `https://localhost:3000` | development, and anybody who would rather nothing left the machine |
| `pages` | `https://marin-hrvacanin.github.io/siksamitra/word-extension` | everybody; published with the landing page |
| `vedaunion` | `https://vedaunion.org/siksamitra/word-extension` | the same folder, uploaded there |

**Each host has its own GUID**, so the local build and the published one can be
installed side by side. The substitution is **textual, not an XML rewrite**:
`CT_OfficeApp` is a schema sequence and Word reports a violation of it as an
add-in that does nothing. Every icon URL carries `?v=<version>`, because Word
caches an icon by its URL for good.

---

## Commands

```bash
npm run check:word-addin      # typecheck, build, and assemble all three folders
npm run gen:word-commands     # the manifest's tab, menus, shortcuts and every icon, from the table
npm run word-addin:publish    # out/word-extension for GitHub Pages
npm run word-addin:validate   # Microsoft's own validator, over all three (needs the network)

npm run word-addin:certs      # once: a local certificate authority (Windows asks you to confirm)
npm run word-addin:serve      # https://localhost:3000, loopback only, over the BUILT folder
npm run word-addin:install -- --host local    # sideload the local one
npm run word-addin:install                    # sideload the published one
npm run word-addin:install -- --list
npm run word-addin:install -- --uninstall

npm run check:word:live       # the add-in's Word I/O against a real Word, over COM
CHROME=<path> npm run check:word:pane   # Settings and both dialogs, actually rendered
```

`word-addin:serve` serves the BUILT folder — the same bytes that get uploaded —
which is what makes "it works locally" mean "it works published". The server
answers `cache-control: no-cache`, so Word revalidates rather than keeps a stale
page; `no-store` stopped Word caching the ribbon icons at all and drew them
blank.

**The sideload** (`word-addin:install` and the friends' installer alike, from
the same constants in `scripts/word-catalog.mjs`) is the shared-folder catalog
described above: one manifest per host in
`%LOCALAPPDATA%\siksamitra\word` (the published one is `manifest.xml`, the
local build `siksamitra-local.xml`), that folder trusted through
`\\localhost\C$\...`, and each add-in added once from *SHARED FOLDER*. The
developer key is the fallback where the share cannot be read.

**Driving Word's add-in dialog from a script** — to check the whole route
without a person — needs to know that the dialog is the legacy MSHTML control:
UI Automation sees an empty pane, its page is reachable through
`WM_HTML_GETOBJECT`, and its gallery ignores synthetic DOM events, so choosing
the add-in takes one real click. That is how the route above was verified.

---

## How it is tested

Rule 13: every tier that can see it.

| tier | what it holds |
| --- | --- |
| unit | a line read and written back in each of his shapes — no-break spaces, tabs, double spaces, the pause's spaces, the daṇḍa's face, the overline, the candrabindu glyph, a box over a space (`packages/interop/src/__tests__/word-his-shapes.test.ts`); notes at a line's end (`line-notes.test.ts`); spacing carried through a re-run (`packages/format/src/__tests__/spacing-carry.test.ts`, `packages/engine/src/__tests__/rerun-spacing.test.ts`); one line as written, and what refuses it (`apps/word-addin/src/model/__tests__/line-xml.test.ts`); our paragraph index against Word's past hidden paragraphs (`paragraph-index.test.ts`); the look resolver (`packages/cli/src/__tests__/word-look.test.ts`); the rulings of 2026-09-30 and their switches (`packages/engine/src/__tests__/rulings-2026-09-30.test.ts`); the manifest every host gets (`scripts/__tests__/word-addin.test.mjs`); the installers (`word-friend-installers.test.mjs`); the command table against the manifest on disk; the style vocabulary; parts and registers (`packages/interop/src/__tests__/rule-parts.test.ts`, `docx-registers-scripts.test.ts`); script lines, offsets and the caret (`apps/word-addin/src/model/__tests__/script-lines.test.ts`); Word edits merged back (`body-edits.test.ts`); the vowel-sign rule (`packages/edit/src/__tests__/text-commands.test.ts`) |
| integration | his lines, typed in his files' own OOXML over his template's style table, written back by the add-in and drawn character by character — the same (`tests/integration/word-his-lines.test.ts`); the whole corpus through Word in every script — 573 of 573 verses exact, the same bytes on a second write, and IAST → Devanāgarī → Telugu → Tamil → IAST arriving where it began (`tests/integration/script-round-trip.test.ts`); seeded random lines with random marks in every script, none refused and none changed (`script-fuzz.test.ts`) |
| component | every ribbon command pressed against a Word faked at its edges (`tests/component/word-runtime.test.ts`); a line with a note, a hidden line, and the conventions reaching the rules (`word-notes.test.ts`); Settings, the conventions switches included; the dialogs; the page with and without office.js |
| security | OOXML injection through document text, and what the inserted package may not contain (`tests/security/word-addin.test.ts`) |
| live | `npm run check:word:live` — a real Word, over COM; `npm run check:word:live:reference` — every mantra line of his reference documents written back in a real Word and drawn as Word now has it |
| reference | `npm run check:word:reference` — the same over his documents without Word, as a ratchet (`corpus/word-reference-baseline.json`, counts only) |
| ui | `npm run check:word:ui` — the commands run in Word's own add-in runtime over its debugging port (`tools/word-ui.ts`, `tools/word-ui/`): a mark on a selected letter, a svara at the caret, a pause, Clear all, Re-apply over a line and over the whole document through its dialog, a line of his with its note, typing after a mark; and used DIRTILY (`dirty.ts`, `dirty-more.ts`): two registers and a part, hand marks in both, the outside register changed under them, the part's changed and changed back, a selection across the part's edge refused, a part that would nest refused, “mine out” over the edge, Clear all over it, the part dissolved, Word's Undo, every convention switched and back, every script and back over parts and hand marks, a heading and a translation between the mantra lines untouched, and a document of the app brought in through the pane's own file picker |
| browser | `check:word:pane` — the published pages in a real browser, at Word's sizes, in light, dark and high contrast |

**The live gate is where the real faults were.** It establishes what nothing
else can: a fresh document has none of the custom styles; the specimen puts
them all in and they survive its deletion (*Import styles*); a marked line
comes back as itself in his mantra style at 16 pt; **his own document is not
damaged** — his real file, opened read-only, its mantra lines written back as
the add-in writes them and read out of Word again, letter for letter; Word and
the reader agree how many paragraphs there are; and **a Devanāgarī, Telugu and
Tamil line comes back exactly**, hidden runs and all. It is not in
`npm run check` because it needs Word, and it skips loudly when there is none.

**The UI gate** (`check:word:ui`) runs the add-in itself, in Word, and its
first honest runs found five faults no other tier could see, all fixed and all
held by it now:

- **every whole-document run was refused** — `body.getOoxml()` ends with an
  empty paragraph of its own that `body.paragraphs` does not count, so the two
  counts never agreed (`model/paragraph-index.ts`);
- **Import styles changed his look** — it put our `Mantra` in before the
  conversion, and Word keeps a style a document already has;
- **and so did his own definitions** — Word folds a package's `docDefaults`
  into each style it brings, so his `Translit` arrived black instead of
  automatic; a package carrying his styles now carries his defaults, and
  `word-look.ts` models the folding, so `check:word:reference` sees it too;
- **a converted line stayed `Translit`** — replacing a paragraph's content
  keeps its paragraph mark, where the style is;
- **a one-line part vanished when it was re-marked** — replacing the only
  paragraph of a content control deletes the control (`word/line-target.ts`).

And the live reference gate found a sixth, made by the third fix: his
Kanakadhārā's defaults use `w14:`, which our styles part did not declare, and
Word refused every one of its 45 writes. Only a document of his with that
defaults block could show it; the declarations his definitions need now travel
with them. The gate had counted those 45 as "drawn the same", because a line
never written looks exactly like his, so a refused write no longer counts.

The commands are run by calling each button's own function in the add-in's
runtime (`tools/word-ui/press.mjs`), over the WebView2 debugging port. UI
Automation's clicks on the ribbon were measured not to reach the add-in every
time. Start Word with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229`, open the
sideloaded add-in's own document, and point `WORD_UI_DOC` at it — never one of
your own documents, since it deletes the content and the custom styles.

**The pages gate** (`tools/word-pane.mjs`) found the typing help's labels at
2.6:1 contrast, a face the pages asked for and never loaded, an icon drawn
black on a dark dialog, and a window too short for a 1366 × 768 laptop — all
fixed, all checked there now.

**Invisible characters were tried for what a script line cannot show, and
Word draws them**: one variation selector after a letter is hidden, a second in
a row and every TAG character are boxes on the page, and an accent in a run of
its own sits on a dotted circle. Measured in Word's own PDF; the line is now
written with the accent in its cluster's run and the rest in hidden text.

**A save cannot be driven from an invisible Word** on this machine: `SaveAs2`
blocks indefinitely. The gate therefore does what the add-in does — insert,
read back, never save. A visible Word exports PDFs fine, which is how the
pages were compared with his.

---

## Getting it into AppSource

The store is a **submission**, not a script, and two steps need the owner
personally:

1. **A Microsoft Partner Center account with a verified publisher identity.**
   Verification takes days, and cannot be delegated.
2. **Press Submit.** The listing needs a name, a summary, a description,
   screenshots (1366×768), a 300×300 logo, a support URL, a privacy-policy URL
   and a terms-of-use URL — the landing page carries the last two.

Everything else is done: the manifest passes `office-addin-manifest validate`
for all three hosts, the icons exist at 16, 32 and 80 px over HTTPS, and the
add-in collects, transmits and stores nothing — every operation is local to the
open document. **Until then it is not unavailable**: the installers above, and
an organisation's administrator can deploy it to everyone from the Microsoft
365 admin centre's *Integrated apps* page with the same manifest.

---

## What Word cannot represent

Read `apps/word-addin/src/model/carry.ts`. In short: a Word run carries ONE
character style, so a letter that is both boxed and substituted needs a
combined style of its own, and a marking with no Word equivalent is reported
rather than dropped quietly. A paragraph carrying text the reader cannot place
— an inline comment, for instance — is not written back at all, because
writing it would delete that text; the add-in says so.

Known differences from his hand-made files, when the app writes a document from
its own model rather than editing his: a source line is written above what it
names (as he does), but blank lines between verse groups and his footer text are
not in the model and are not written; a verse's lines are one paragraph broken
by line breaks (as his Kanakadhārā), where some of his files give each pāda a
paragraph of its own; and a translation's lines are a paragraph each (as his
sādhanā and Kanakadhārā), where his Śivopāsana breaks one paragraph.
