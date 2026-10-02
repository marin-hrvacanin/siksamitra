# His page, exactly

## What he asked for, in his words

> "Should be visually, every single line, every single comment, title, source,
> font, marking, perfectly matching visually. And then we can also go into
> correctness and verification and sources and whatnot."

> "Have in mind that the text should also be rich, have annotations for
> svarabhakti and stuff like that… Also sources above each shloka or set of
> shlokas… If any of that is not supported, the entire software, extension,
> desktop application, engine, all should be updated. It should be able to
> handle everything completely, use, import, export, reproduce, create new."

> "Parts of the text and subsets can come from different places and then above
> each new section it says so, like in the chants given in the Veda Union
> sādhanā document."

The examples are his own: `Veda Union sAdhanA v9.1.13 IAST` (`.docx` and the
PDF Word printed from it, 72 pages), `krimi saṁhāraka sūktam v0 IAST` (both),
and the PDFs `bhū sūktam v1.1`, `pūrṇakumbha mantra v0`, `sūryopaniṣat v0`.
All in `Library/reference/`, which git ignores.

## How it is measured

`tools/fidelity/compare_pdf.py HIS.pdf OURS.pdf` reads both PDFs as lines and
aligns them by their letters, then compares every matched line on what a reader
sees: where it starts, its size, face, slant and colour, its distance from the
line above, its page, and where the lines break. Nothing in it knows how either
page was made (rule 9).

`npm run check:fidelity` imports each `.docx` that has a PDF beside it, prints
it through the program's own PDF export, and compares. Ratcheted in
`corpus/fidelity-baseline.json`; skipped loudly when the folder is absent.

The first honest run, 2026-10-02, the sādhanā: his 2,277 lines, ours 2,083,
**0 identical**; 72 pages against 64; 571 of his lines missing, 377 of ours
extra, 447 indents and 542 gaps wrong.

**The bot's page, end to end** — `npm run check:bot-page`
(`tools/fidelity/bot-pages.ts`): each of his single documents read back from
his own PDF into the outline the agent would write (`outline-of.ts` —
letters and svaras as a witness gives them, nothing the rules place), handed
to the agent's own `build_document` and `deliver` with the bot's own host,
printed as the bot prints, and compared. Ratcheted in
`corpus/bot-page-baseline.json`. The first run, 2026-10-02: bhū sūktam v1.1
19 of 79 lines his. After this change:

| | lines his | pages, his / ours |
|---|---|---|
| bhū sūktam v1.1 | 73 of 77 (94.8 %) | 2 / 2, every line on his page |
| sūryopaniṣat v0 | 167 of 174 (96.0 %) | 5 / 5, every line on his page |
| pūrṇakumbha mantra v0 | 28 of 30 (93.3 %) | 1 / 1 |

What is left is not the page: the `g` of `jñ` (his ruling of 2026-09-30 is
newer than these files), his own pauses and gum where his files disagree with
themselves, and two questions for him — `vivasvāṁ̐ aditiḥ` (how a source writes
the Taittirīya gum before a vowel) and an Atharvaveda register (sūryopaniṣat:
"traditional svaras, not strictly as per Atharvaveda Prātiśākhya" — no gum,
no lengthening, which no register of ours is). A real Word, given the bot's
`.docx`, breaks bhū sūktam's and sūryopaniṣat's pages where his do.

## What his documents contain, and where each lives here

| | In his `.docx` | Status |
|---|---|---|
| F1 | A verse line is a `Translit` paragraph, or a line of one after a soft break (`w:br`). Only a soft-broken or wrapped line takes the hanging indent; a new paragraph starts flush. Same for `Prijevod`. | to build: the format records which lines start a paragraph |
| F2 | Comment lines ABOVE a verse or a set of verses — a source ("taittirīya saṁhitā 1.5.3", "Also in maitrāyaṇī saṁhitā 1.7.1.1"), a metre, a direction — each its own line, in order. | to build: drawn above, kept one per line |
| F3 | A comment INSIDE a mantra line, after the words — "bramha", "required as per taittirīya āraṇyaka 2.11.", "p.b. sūryād (with svarita)". | to build: a marking; the importer used to drop all 160 |
| F4 | `Insert` — an empty 8 pt paragraph that spaces blocks. | to build: an item |
| F5 | A page break, in an otherwise empty paragraph. | to build: an item |
| F6 | Headings: a book (title page, `Heading 2` parts, `Heading 3` chants) and a single document (`Heading 2` name, `Heading 3` tradition or other name), in his sizes, colours and indents. | to fix |
| F7 | The running head (`STYLEREF Heading 2` + `Heading 3` centred, the page number at the right tab, over his rule picture) and the footer ("About VedaUnion http://vedaunion.org/ - videos at https://www.youtube.com/c/VedaUnion", linked). | to build, PDF and Word |
| F8 | A book's title page. | to build |
| F9 | A book's table of contents, with dotted leaders and page numbers. | to build |
| F10 | Pictures floating at the side, text wrapping round them. | in the format; to honour in the export |
| F11 | The pause bar: a blue italic `|` between spaces (his `Anusvara` style). The daṇḍa in the text's own face and ink. | done — the bar in Arimo's real italic, upright as Arial Italic's is (it was slanted by the browser); the daṇḍa in our face of Mangal's bars (`tools/fonts/danda.py`) |
| F12 | Svaras, holdings, the virāma sign, superscript annotations (ṁᵘ, ḥᶠ, gṁ), svarabhakti. | in the format; to compare |
| F13 | Pagination as Word does it: `keepNext` on `Translit`, `keepLines` on headings, widow control, his page breaks. ONE page map for the paged view and the PDF. | the RULE is one, in three places: widow control within his paragraphs, a verse's last line with its translation, its earlier half-verses loose — `breaksAfter` (paged view), `export.css` (PDF), `KEEP_OF` + `loose` (Word). One map: open |
| F14 | The `.docx` written back with all of the above. | to build |
| F15 | The add-in reads and writes all of it through the same interop. | to build |
| F16 | The agent builds every document in this shape. | done for single documents: half-verse and refrain layouts, explicit paragraphs, notes above and at line ends, unnumbered verses, a source line over verses from elsewhere, the virāma tick — measured by `check:bot-page` |

Then correctness: the agent names what a text is and where it begins before it
builds; a cited locus is checked against the witness's own numbering; a
fragment of a longer anuvāka is never delivered as the whole; his reference
documents are in the bot's library.

### The harness, after the page (his words, 2026-10-02)

> "It sent me a different document than what is said here! How comes?! I think
> we might need a much more robust harness perhaps… Maybe something like
> opencode (but without interacting with the surrounding system)."

What happened: the bot's closing message was the model's account of what it
believed it had done, written from memory. Three of its claims were never
checked by any tool ("same passage word for word" in a second witness it read
20 lines of; "the document carries the same mark"; a spaced text the file did
not contain). So:

- the description of a delivered file is WRITTEN BY THE PROGRAM from that file
  — title, locus, first words, verse count, the check's own result — and the
  model may add to it, never replace it;
- nothing is called "verified" or "agrees" without a tool result behind it:
  comparing two witnesses is a tool that compares their letters and returns
  the differences;
- the loop is studied against opencode's (his fork `MarinCodeCLI` is on his
  Desktop): a plan the person can see, sub-agents, compaction, tool
  permissions — with no shell and no file system.

### Where the bot stands (2026-10-02, measured on real requests)

Six real bhū sūktam requests, each read through to the PDF. What each broke,
and what was built so that it cannot again:

- A step that wrote for longer than 120 s was dropped as if the provider were
  stuck → replies are streamed, and a try is given up only on silence
  (`packages/agent/src/stream.ts`). A step that thought until the length limit
  and did nothing is taken back and the model told to act; a call cut off
  half-written is answered with why, and how to send it in parts.
- The model deliberated 166 000 characters over an opening oṁ, and placed his
  junction hyphens by hand, wrongly → `spaced` is now only WHERE the words
  part. The program writes his junctions (`junctions.ts`: every one of his 312
  hyphens has a vowel before and a consonant after), his anusvāra and visarga
  as typed, the source's svaras vowel by vowel and its half-line daṇḍas
  (`letters.ts`), and an opening oṁ may be left out, never added.
- `spaced` and `check` disagreed, and `check` named no place → one comparison
  for both, built from vignanam's and vishvasa's spellings against his (a nasal
  before a consonant, a sibilant a visarga became, the y/v a ṁ nasalises, a
  doubled final n, the palatal ñ after ś); a difference is said exactly; a
  comment on a mantra line is not read as its letters.
- A source's spelling reached the page (`dē̠vī`, `gauᳶ`, `trigṁ̐`) → the engine
  reads the Vedic visarga signs, a svara written after ḥ or ṁ, and the gum in
  every written form; an IAST line is spelt as his before it is built.
- A romanisation of its own (vignanam's "English": ch for c) was built from as
  IAST, and reported as Devanāgarī because of its daṇḍas → said when it is
  read, with the Devanāgarī pointed to.

The last request (run 6): 32 steps, $0.29, checked clean, reviewed, looked at,
delivered — and its first verses are his letter for letter, marks included
(`devya-dite'gnima-nnādama-nnādyāyā''dadhe`, `pṛśnira-kramīda-sanan mātaram
punaḥ`). What still differs is not the program's to settle: which recension
(his: the whole of TS 1.5.3, mahīṁ devīm, the gāyatrī; vignanam's adds khila
verses), where a semivowel's junction parts (`pānat yantaś`), and a source's
reading against his. Those need his own documents in the bot's library — his
decision, not yet asked.

### The bot's interface, after the page (his words, 2026-10-02)

> "Once this is all done and perfected, I want you to build a proper GUI.
> Research online and see the official docs, telegram really allows a lot of
> freedom when it comes to custom GUI and some things like clearing the chat
> … if I am talking with it and I create some documents … and tomorrow want
> something new, it will pass the old conversation and 'poison' the future
> conversation … Would be the best to have some sort of 'session' system where
> I can switch back and forth between different contexts … at least an option
> to restart the conversation (clear the context) should be there."

- a fresh start that is a button, not only `/new`; the old context gone;
- sessions to switch between, if the Bot API allows it (topics in a private
  chat with a bot; else a session picker on inline buttons);
- the official Bot API docs read first: menu button, command menus, inline
  and reply keyboards, Mini Apps.
- the status message: kept, appended to, never deleted; an icon per kind of
  step (searching, reading, writing, checking) and for done / failed; long
  before it is shortened; no `/stop` in it; each line what is really being
  done, from the step's own arguments, and the model's own one-line intent.
- (his words) "if it supports screenshots (images) natively … we could also
  enable it … to 'see' selectively … so that when it's in the desktop editor,
  it feels like a proper MCP, with the ability to see everything."
