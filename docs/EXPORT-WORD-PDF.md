# Word and PDF export — what was measured

The owner's words: *"each of the exports should the user be able to select a
style, and if veda union style is selected, for example, then it should be
identical"*, *"The Word document and the PDF from it should be identical"*, and
*"if there is even 0.001 % loss, then fix the logic and algorithms and
everything in a clean and scalable way so that it's exactly 0 %."*

Everything below is a measurement. Nothing here is an assertion that something
ought to work; each number came out of a file, and every one of them can be
re-taken with `npm run check:export:word` and `npm run check:export:pdf`.

## Are they lossless? Yes, and it is checked over every document

Both formats carry the document itself — the same canonical JSON a `.smdoc`
carries, hashed the same way (`packages/interop/src/embed.ts`).

| | where the document rides | recovered by |
| --- | --- | --- |
| `.html` | `<script type="application/json">` | `importHtml` |
| `.docx` | `customXml/item1.xml`, base64 | `importWord` |
| `.pdf` | `/EmbeddedFiles` → `document.json`, base64 | `importPdf` |

Both gates export all eleven corpus documents, read each one back and compare
the recovered document with the object loaded from disk — `canonicalJson`, byte
for byte. All eleven are exact in both formats, with an attached recording
compared byte for byte on the way back, over all eight export styles and all
four scripts.

## Does Word keep the part? Yes — measured, not assumed

The claim that a custom XML data store part survives Word is the one thing the
code cannot check, so it was checked with Word itself:

```
powershell -File tools/export/word-survives.ps1 \
  -In artifacts/export/agree.docx -Out artifacts/export/agree-resaved.docx \
  -Pdf artifacts/export/agree-word.pdf
```

Word 16.0 (Microsoft 365), 2026-09-09:

```
word 16.0
opened  paragraphs=16
customXmlParts=4
  ours: urn:sikshamitra:document:1  209108 chars
saved   agree-resaved.docx
```

and the re-saved file, read back by `importWord`:

```
parts after Word: [Content_Types].xml _rels/.rels customXml/_rels/item1.xml.rels
  customXml/item1.xml customXml/itemProps1.xml docProps/app.xml docProps/core.xml
  docProps/custom.xml word/_rels/document.xml.rels word/document.xml
  word/fontTable.xml word/settings.xml word/styles.xml word/theme/theme1.xml
  word/webSettings.xml
from custom-xml | intact true | identical to source: true
```

Word added parts of its own and kept ours untouched. `docProps/custom.xml` — the
format, the hash and the style, which is all a 255-character property can hold —
survived as well.

**The documented second location** is a hidden-text paragraph (`w:vanish`) in
the body, written when `fallback: 'hidden-text'` is asked for. Body text is the
one thing Word cannot lose. It is not the default because it puts the whole
base64 payload where Show/Hide ¶ reveals it and adds ~120 KB to a document. The
reader tries it whether or not the writer was asked for it, and the gate proves
it by deleting the datastore part and reading the document out of the body.

## Which PDF producers keep the attachment

The document is attached by an **incremental update**: the bytes the browser
produced are left alone and new objects are appended after them, with a new
cross-reference section pointing back. The gate checks that the leading bytes
are byte-identical to what was printed.

* **The file as written** — read back exactly; verified for all eleven corpus
  documents.
* **Chrome / Edge's viewer, Acrobat's viewer** — display it and offer the
  attachment. Neither re-saves by itself, so nothing is lost by viewing.
* **A tool that rewrites the file** (Acrobat's "Save As", `qpdf --linearize`,
  Ghostscript) keeps `/EmbeddedFiles` where it understands it. `importPdf`
  searches for the `/Filespec` by name rather than following our own
  cross-reference table, so a rewritten file still opens.
* **Printing a PDF to a PDF** produces a new document and keeps nothing. The
  XMP packet carries `sm:docHash`, so `importPdf` can still say what the file
  was and what its document should have hashed to, rather than "not one of
  ours".

## Are Word and the PDF identical? Measured three ways

The `.docx` and the PDF of one document, both of `#sec-1` of the Durgā Sūktam in
the `veda-union` style. The PDF's own text is read out of its content streams
(`tools/export/pdf-text.mjs`) and the `.docx`'s styles are parsed back into
points (`tools/export/docx-metrics.mjs`).

### 1. The PDF against what the `.docx` says it will draw

```
mantra        16.00 pt on 24 pt, .docx says 16 pt
indents       first -0.00 pt, .docx says 0.00 pt
lines         28 mantra lines, every one identical
worst gap     0.011 pt (continuation indent)
```

**The worst divergence is 0.011 pt** — about one four-hundredth of a millimetre.

### 2. The PDF against a PDF Word itself printed from that `.docx`

```
pages         2 ours, 2 Word's
mantra lines  28 ours, 28 Word's
per page      [20, 8] ours, [20, 8] Word's
worst dx      1.13 pt
worst leading 0.330 pt
first baseline per page: +3.83, +3.77 pt
worst size    0.040 pt
worst width   18.95 pt over a 453.54 pt column
lines whose letters differ: 0 of 28
```

Same pagination, same lines, same words on every line. `worst width` is the one
large number and it is item 1 below.

### 3. The `veda-union` style against his own `.docx`

`word/styles.xml` is generated from `typeScaleOf(theme)`, which for this style is
`wordScale()`, which is `WORD_PARAGRAPHS`. That chain would be circular on its
own, so the gate also parses the styles out of
`tools/chant/templates/vu-word-template.docx` — his own file — and compares the
same six numbers:

```
every measured paragraph value agrees with his file to 0.000 pt.
```

size, exact leading, space after, left indent, hanging indent and right indent,
for `Translit`, `Heading1`–`Heading4`, `Prijevod`, `Header`, `Normal` and
`Comment`. Mark colours agree too: `538135` holding green, `943634` svara red.

## What could NOT be made identical, and why

Five things. Each is measured and each has a reason.

1. **A line is up to 18.95 pt longer in the PDF — 4.2 % of the column.** The
   page reserves air around a holding box: `MARK_GEOMETRY.holdPad` is 0.07 em on
   each side and `holdMargin` 0.03 em, so a box costs 0.2 em ≈ 3.2 pt of extra
   advance at 16 pt, and a line with eight boxes carries eight of them. Word's
   `w:bdr` is a character border with no space of its own — `w:space` applies to
   paragraph borders and Word ignores it here — so there is no way to ask Word
   for the same air. It never moves a line break (`Translit`'s negative right
   indent means a pāda does not wrap) and never changes which letters are on
   which line: measured over all 28 lines, 0 differ. It does mean a long pāda
   reaches further to the right in the PDF than in Word. **Closing it means
   changing `MARK_GEOMETRY`**, which would change the screen too — the padding
   is there so a thin frame reads as a mark ON a letter rather than as part of
   its neighbours.

2. **The whole text block sits 3.8 pt lower in Word.** Constant on every page,
   never cumulative — the leading itself agrees to 0.330 pt. CSS centres a line
   inside its leading (half-leading above and below); Word's
   `w:lineRule="exact"` hangs the baseline from the top of the line box. For a
   16 pt face on 24 pt that is `(24 − ascent − descent) / 2` ≈ 3 pt of
   difference in where the FIRST baseline lands. Correcting it would mean a
   per-font fudge factor in the page's top margin, which would be wrong for
   every other theme.

3. **A svara is a stroke in the PDF and a character in the `.docx`.** The page
   draws accents from `MARK_GEOMETRY.svaraStroke`; his Word file writes them as
   combining characters in the `Svara` style, and ours does the same so that a
   Word document behaves like his. They look the same. The consequence is real:
   the PDF's text layer holds 116 combining marks where the `.docx` holds 260,
   so a PDF of a mantra cannot be searched for an accented syllable. The
   svarabhakti dot is the same story.

4. **The holding box stroke.** His file draws 0.25 pt and 1.5 pt; the page draws
   `max(1px, 0.032em)` and `0.075em`, which at 16 pt is 0.75 pt and 1.2 pt. The
   `.docx` writes what the PAGE draws, so the Word file and the PDF agree with
   each other, and both differ from his original by 0.5 pt on a short box and
   0.3 pt on a long one. Word stores a border weight in eighths of a point and
   takes integers only, so 1.2 pt is written as 10/8 = 1.25 pt — a further
   0.05 pt. **This is a decision for the owner**: making the page draw his two
   fixed weights would make all three agree, and it is a change to
   `MARK_GEOMETRY`, not to either exporter.

5. **Word's own rounding.** Word writes a 16 pt run into a PDF as 15.96 pt and
   an 11 pt run as 11.04. 0.040 pt, in Word's PDF writer, not ours.

## What was found and fixed along the way

Each of these was a defect, each was found by measuring, and each is now closed
and gated.

* **The old Word exporter wrote a package Word offered to repair.** It replaced
  one part of a stripped copy of his file, whose `[Content_Types].xml` still
  declared eleven parts the stripping had removed. Word 16.0's report was "The
  file appears to be corrupted", with no further detail. `packageProblems` in
  the gate now checks both directions — declared and missing, present and
  unreachable — over every style.
* **Two more schema violations with the same symptom**, both found by bisecting
  the package: the core properties in the wrong order (they are an `xs:sequence`
  — created, creator, lastModifiedBy, modified, title) and the core-properties
  NAMESPACE written under `/relationships`, which is the relationship TYPE.
* **The hanging indent never appeared.** One `Translit` paragraph per pāda made
  every pāda a first line, so all of them printed flush where his page steps the
  continuations in by 14.2 pt. One paragraph per VERSE with `<w:br/>` between
  pādas is the shape his style describes.
* **Four structural disagreements with the page**: a section's source line drawn
  under its heading instead of under its verses, a part heading repeated above
  every section, the heading levels one too high (Heading2 where the page sets
  Heading3), and a verse's instructions and source line not drawn at all.
* **Printing lost a seventh of the document.** `base.css` sizes `html`, `body`
  and `#root` to 100 %, so a printed page was exactly one sheet tall: a
  seven-verse section printed as ONE page with the seventh verse cut off in the
  middle of a translation. The column was 1430 px against a 600 px body.
* **Page two had no top margin.** The sheet's 25 mm is padding on one tall
  column, and padding is applied once to a flow — page two began 12 pt from the
  paper's edge where Word began at 70.87. The vertical margins are the page
  box's now; the horizontal ones stay on the column, because `Translit`'s
  negative right indent puts a pāda 13.8 pt into the margin and content wider
  than the page box makes Chrome scale the whole page down (measured: a 16 pt
  mantra printed at 15.53 pt).
* **A CSS `@page { margin: 0 }` silently cancels the printer's margins.**
* **The sheet's hairline cost the text 1.5 pt of measure.** `box-sizing` is
  `border-box` and the column's width IS the sheet's, so a 1 px border on each
  side came out of the line: 452.04 pt where his Word column is 453.54. It is an
  outline now, drawn outside the box, so the editor, the PDF and the `.docx` all
  measure the same column.
* **Chrome and Word broke the page in different places.** With nothing said,
  Word's widow control moved a four-line verse whole while Chrome split it two
  and two — the PDF ended page one on verse 6 and the Word file on verse 5.
  `keepNext` + `keepLines` in the style and `break-inside: avoid` in the print
  block say the same thing to both. (`document.css` sets `break-inside: auto` on
  `.verse` at the same specificity and is loaded later, so the rule needs three
  classes to win.)
* **A mark was painted on the page its letter had left.** A svara is drawn above
  the line box, and when a page break falls before its line Chrome paints that
  overflow at the pre-break position: three red ticks alone in the bottom margin
  of page one. `overflow: clip` on the line, with a clip margin exactly the
  mark's own reach, confines a line's ink to the line. Measured before and
  after: 108 → 105 svara fills on page one, 42 → 42 on page two.
* **`packages/render/src/print.css` was a second print stylesheet** — 187 lines,
  imported by nothing, written against token names the program no longer has.
  Deleted.

### Six faults in the Word body, found by the add-in's round trip

Reported over all 573 corpus verses and fixed here:

1. A raised reading aid set `change` on 104 letters across 79 verses. The
   `Anusvara` style carries both the letter actually recited and the small
   letter printed above one; only the second is raised, and only the first is a
   substitution.
2. All 59 bars came back as pauses — both were one pipe in one style. A bar is
   `¦` now, in the same `Pause` style: same colour and weight, unambiguous
   coming back. His own files contain no bar.
3. `॥1॥` came back as `॥ 1 ॥`. The importer invented a space on each side of a
   daṇḍa when the whitespace around it already arrives as its own piece.
4. A space inside a holding closed the box and opened another. The space now
   takes the group's style when the letters on both sides are in the same
   numbered group — and only then: comparing `hold` alone matched two adjacent
   boxes with no group id, because `undefined === undefined`.
5. A line break inside a verse came back as a space, running the pādas onto one
   line.
6. A letter that was both boxed and substituted printed as a plain black box. A
   run carries one character style, so the pairing has one of its own:
   `HoldingChange` and `2HoldingChange`.

The gate now reads every corpus document's body back with `importDocx` and
requires every letter, every mark, every bar and every daṇḍa to be identical.
Separator differences — a space next to a verse number, and how consecutive
paragraphs are grouped into verses — are counted rather than failed, because
they are `importDocx` re-deriving a document from a RENDERING and cannot lose a
letter or a mark. The count is a ratchet at 108 over all eleven documents.

## Running it

```
npm run check:export:word
npm run check:export:pdf
CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  WORD_PDF=artifacts/export/agree-word.pdf npm run check:export:pdf
npm run export -- corpus/chants/durga-suktam.json --docx --pdf --style veda-union
```

The files land in `artifacts/export/` and stay there. A gate whose output nobody
can look at is a gate that will one day pass on a page of empty boxes.
