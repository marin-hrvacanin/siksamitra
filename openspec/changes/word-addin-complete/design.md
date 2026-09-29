## Context

The add-in is a task pane plus a ribbon button. It reads a paragraph with
`getOoxml`, turns its runs into text and markings with the same codec the app
uses, applies one command, and writes the paragraph back with
`insertOoxml(…, replace)` over the paragraph's content range. Its first run
inside a real Word is described in `proposal.md`.

## Decisions

### D1. Two vocabularies, chosen per document, read always

LEGACY is the owner's: `Translit`, `Prijevod`, `Holding`, `2Holding`, `Svara`,
`Virama`, `Anusvara`, `VedicAnusvara`, `Pause`, `Comment`, `Long`, `Insert`,
`Reference`. CLEAN is English with the IAST term, ids ASCII so they survive any
tool, names readable in the Styles pane:

| role | clean id | clean name | legacy id |
|---|---|---|---|
| mantra line | `Mantra` | Mantra | `Translit` |
| translation | `Translation` | Translation | `Prijevod` |
| short holding | `HoldingShort` | Holding · Short | `Holding` |
| long holding | `HoldingLong` | Holding · Long | `2Holding` |
| accent | `Svara` | Svara | `Svara` |
| virāma tick | `Virama` | Virāma | `Virama` |
| anusvāra change | `Anusvara` | Anusvāra | `Anusvara` |
| visarga change | `Visarga` | Visarga | — (added: `Visarga`) |
| Vedic anusvāra | `VedicAnusvara` | Vedic Anusvāra | `VedicAnusvara` |
| reading aid | `ReadingAid` | Reading Aid | `Anusvara` (superscript) |
| pause | `Pause` | Pause | `Pause` |
| svarabhakti | `Svarabhakti` | Svarabhakti | (dot, unstyled) |
| comment | `Comment` | Comment | `Comment` |
| counting mark | `Reference` | Reference | `Reference` |

Headings, header and caption are Word's built-ins in both.

**Which one a document gets:** LEGACY when the document's style table defines
`Translit`, or any legacy character style is USED in its body; otherwise CLEAN.
Decided once per read, from the document, never from a setting — the same file
must be written the same way on every machine. A document that has both is
LEGACY (its owner's styles win), and the pane says it holds both.

**Why ids ASCII and names with diacritics:** the id is what `w:pStyle`/
`w:rStyle` name and what other tools grep for; the name is what a person sees.

**Rejected:** a switch in the pane. A per-user preference makes one document
come out two ways depending on who pressed the button.

### D2. A document's style definitions are never overwritten

`insertOoxml` carrying a style Word already has keeps the document's
definition (measured on desktop in `word-live.mjs`; to be measured on the web).
We rely on that and test it: a user who recoloured `Holding` keeps their colour.
"Add the styles" adds only what is missing.

### D3. Anusvāra and visarga are told apart by what the letter IS

By the sandhi rules an anusvāra only ever becomes a nasal and a visarga only
ever becomes a sibilant, `r`, or itself. Measured over all 971 substitutions in
the corpus: anusvāra → `m ñ n ṁ m̐ ṅ`, visarga → `ś s ḥ r :`, no overlap.

So a CHANGE is written as `Anusvara` when its `was` is `ṁ` and `Visarga` when
it is `ḥ`. Reading back, both styles are a `was` change; the style is a second
witness, not the only one.

**Upgrading a legacy document** reclassifies each `Anusvara`-styled run:

| content | becomes |
|---|---|
| a nasal `m n ñ ṅ ṇ ṁ m̐ gṁ gm` | `Anusvara` (unchanged) |
| `s ś ṣ r ḥ :` or `ḥ` + aid | `Visarga` |
| a superscript `u i l` after an anusvāra, `g` in `gṁ/gm` | reading aid, anusvāra side |
| a superscript `f` or `k` after `ḥ` | reading aid, visarga side |
| a lone `|` / `||` between words | `Pause` |
| anything else (measured: 3 `a`, 9 spaces in his file) | untouched, listed |

The upgrade is explicit (a button, with the counts shown BEFORE it runs), one
pass, and never guesses. Its classifier is one pure function with a unit test
per row and an integration test over his whole document.

### D4. A paragraph the add-in cannot carry through is refused, never rewritten

`insertOoxml(…, replace)` replaces the paragraph's whole content. So before any
write the paragraph's OOXML is inspected, and a paragraph containing any of:
`w:drawing`, `w:pict`, `w:object`, `mc:AlternateContent` (pictures, shapes,
charts, SmartArt, OLE, text boxes), `m:oMath` (equations), `w:fldChar` /
`w:fldSimple` (fields — page numbers, TOC, dates), `w:sdt` (content controls),
`w:ins` / `w:del` / `w:moveFrom` / `w:moveTo` / `w:rPrChange` (tracked
changes), `w:commentRangeStart` / `w:commentReference` (comments),
`w:footnoteReference` / `w:endnoteReference`, `w:hyperlink`, `w:bookmarkStart`
(except Word's own `_GoBack`) — is NOT written. The pane names what is in the
way ("this line has a comment on it"), and a whole-document run skips it and
lists it. Nothing is dropped silently.

**Rejected:** carrying unknown elements through by splicing. It is how a
comment ends up anchored to the wrong letter. A later change may carry specific
elements (bookmarks, hyperlinks) once each is proven round-trip in real Word.

### D5. The write is checked against what was read

Word on the web is co-authored: the paragraph may change between the read and
the write. The write re-reads the paragraph's text in the same batch and
refuses if it differs from what the command was computed on.

### D6. Nothing can make the pane throw

Every entry point — a button, the selection-changed handler, a context-menu
command, the theme handler — runs inside one guard that turns ANY exception,
including Office's `RichApi.Error`, into one visible line with the operation's
name, and logs the stack. A document is data from a stranger (`.docx` by email):
the reader is fuzzed with hostile and malformed OOXML in the security tier.

### D7. The pane follows Word's theme

Colours come from `@siksamitra/tokens`, which already has light and dark. The
pane picks from, in order: `Office.context.officeTheme` (its body background's
luminance), then `prefers-color-scheme`. It re-picks on
`Office.EventType.OfficeThemeChanged` where the host supports it and on the
media query change. `forced-colors` (Windows high contrast) is honoured with
system colours. Every foreground/background pair is ≥ 4.5 : 1 in both, checked
by the pane gate — the red and blue of his mark colours are NOT legible on dark
as text, so buttons carry the mark as a small swatch, not as text colour.

### D8. The pane is tools, not prose

- One status line at the top: what is selected, and the last message. A message
  stays until the next action (the refresh no longer clears it).
- Marking tools as compact icon buttons in labelled groups, like a ribbon
  group; every button has a tooltip and, when disabled, says why.
- The rules in a collapsible section, closed by default; the register chosen is
  stored in the DOCUMENT (`Office.context.document.settings`), so it travels.
- "This document" appears only when something needs doing (styles missing, a
  legacy document that can be upgraded).
- Works from 300 px to any width, no horizontal scroll; keyboard reachable,
  visible focus, labels for screen readers.

### D9. The right-click menu

A `ContextMenu` extension point on `ContextMenuText` adds a śikṣāmitra submenu:
Anusvāra change, Visarga change, Short holding, Long holding, Svara ▸
(Anudātta, Svarita, Dīrgha svarita), Pause, Clear. They run as
`ExecuteFunction` commands from a function file sharing the pane's model —
no pane needs to be open. A ribbon menu button offers the same list. The app
gains the same two commands (`Anusvāra change`, `Visarga change`) on its
Marking tab and in its own context menu, as hand-placed `was` markings.

**A hand-placed change needs what it replaced.** Marking `n` as an anusvāra
change records `was: ṁ`; marking `s` as a visarga change records `was: ḥ`.
Applied to a letter that cannot be one (a vowel marked as an anusvāra change)
the command refuses with the reason, by D3's table.

### D10. Hosts

Word on the web is the host tested live (a signed-in browser driven by
`tools/word-web.mjs`). Desktop Word runs the same pane in WebView2 with the
same Office.js; it is confirmed once, before the store, with the existing COM
gate plus a sideload. Mac and iPad remain claimed-not-verified, and the site
says so.
