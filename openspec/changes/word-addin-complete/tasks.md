## 1. Reading a document from any Word

- [x] 1.1 `word/style-names.ts`: built-in ids read through the document's own
      table (`Naslov1` → `Heading1`); `readParagraphs(documentXml, stylesXml)`
- [x] 1.2 The app's importer and the add-in's two readers pass the table
- [x] 1.3 `missingStyles` reads through the table
- [x] 1.4 Tests: unit (the table, pass-through, null), integration (the REAL
      package a Croatian Word on the web returned; his document localised to
      Croatian and German imports identically — fails without 1.2)

## 2. Two vocabularies

- [x] 2.1 `word/vocabulary.ts`: the table in design D1, one entry per role with
      clean id, clean name, legacy id; `vocabularyOf(stylesXml, bodyXml)`
- [x] 2.2 Readers: every role reachable from both ids (`roleOf`, `paraRoleOf`)
- [x] 2.3 Writers: the add-in's sheet, `paragraphsXml`, and the app's Word export
      write the vocabulary chosen; the app's "Veda Union" export style is legacy
- [ ] 2.4 Existing style definitions are never replaced (D2) — measured on the web
- [x] 2.5 Tests: unit (choice for empty / legacy / mixed / clean docs; every
      role both ways; name clash), integration (the corpus written in each and
      read back byte-identical; legacy doc stays legacy after a write),
      component (the pane says which vocabulary, and "holds both")

## 3. Anusvāra and visarga

- [x] 3.1 The `Visarga` style in both vocabularies; the writer picks by `was`
- [ ] 3.2 `classifyBlueRun` — the upgrade table in D3, pure
- [ ] 3.3 "Upgrade this document": counts first, then one pass, then the list
      of what was left; idempotent
- [x] 3.4 Hand-placed Anusvāra change / Visarga change commands in
      `packages/edit` (the app) and the add-in model; refusal for letters that
      cannot be that change
- [ ] 3.5 Tests: unit (every row of D3 and every refusal), integration (his
      document: exact counts, the 12 ambiguous runs, a second upgrade changes
      nothing; the corpus' 971 substitutions each land in the right style),
      component (upgrade flow shows counts and the leftovers)

## 4. Never damage a paragraph

- [x] 4.1 `whatIsInTheWay(paragraphOoxml)` — the element list in D4
- [x] 4.2 Every write checks it; the whole-document run skips and lists
- [x] 4.3 The write re-reads and compares text in the same batch (D5)
- [x] 4.4 Multi-paragraph selections refused for marks; per-paragraph for rules
- [x] 4.5 Tests: unit (one fixture per element kind, real OOXML as Word writes
      it), security (malformed / huge / nested / markup-in-text OOXML,
      bounded time), integration (whole-document run over a document with
      pictures, tables, comments: those paragraphs byte-identical), live (each
      element inserted in Word on the web, the refusal, the OOXML unchanged)

## 5. The pane cannot throw; messages stay

- [ ] 5.1 One guard for every entry point, including selection-changed and
      context-menu commands; logs the stack
- [ ] 5.2 The refresh no longer clears the message line
- [ ] 5.3 Read-only, no office.js (done), no `WordApi 1.3`: disabled with reason
- [ ] 5.4 Tests: component (each Office rejection shape → one line; a refusal
      survives the refresh; each unavailable state), live (viewing mode)

## 6. The pane's look

- [x] 6.1 Theme from `officeTheme`, then `prefers-color-scheme`; live on change;
      `forced-colors` (`ui/useMode.ts`, for Settings and both dialogs)
- [x] 6.0 `packages/ui` (D11): Icon + icon table, RibbonButton, RibbonStack, group
      frame, Popover, Tooltip, and their stylesheets, moved out of `apps/web`; the
      app imports them from there, every browser gate still green
- [ ] 6.2 Layout per D8, built from `packages/ui`: status line, grouped icon tools, rules
      collapsible, "This document" only when needed
- [x] 6.3 Register stored in document settings
- [x] 6.4 Tests: component (Settings, dialogs), browser `check:word:pane` — the
      published Settings panel and both dialogs, light, dark and high contrast,
      at Word's sizes: no clip, no sideways scroll, no scrollbar in a dialog,
      contrast ≥ 4.5:1 for every text, every face loaded, every icon in its
      colour (300 checks)

## 7. The right-click menu and the ribbon menu

- [x] 7.1 Manifest: `ContextMenuText` submenu and a ribbon menu, both valid in
      Microsoft's validator for all three hosts
- [x] 7.2 Function file sharing the model; the commands of the spec
- [ ] 7.3 The app: the two change commands on the Marking tab and its context
      menu (`apps/web/src/editor/keymap.ts` + `EditCommand`)
- [ ] 7.4 Tests: unit (manifest shape), component (the app's buttons), live
      (right-click ▸ each command on the web; byte-identical to the pane's)

## 8. Live testing inside Word

- [ ] 8.1 `tools/word-web.mjs`: attaches to a signed-in Edge, refuses unless the
      signed-in account is the one given, uploads the manifest, runs the
      scenarios of the spec on a fresh document, asserts OOXML, cleans up
- [ ] 8.2 Serve the local build over https so the live tool tests the working
      tree, not the last deploy
- [ ] 8.3 Desktop confirmation before the store: sideload + `check:word:live`

## 9. Housekeeping found on the way

- [x] 9.1 Manifest version rises every deploy (Pages run number)
- [x] 9.2 Pages redeploys when a bundled package changes
- [x] 9.3 Support URL and Get Started text
- [ ] 9.4 The vedaunion.org host: remove, or deploy — the owner decides
- [x] 9.5 Windows install: `word-install.mjs` and the published
      `install-windows.cmd` trust `%LOCALAPPDATA%\siksamitra\word` as a
      shared-folder catalog through `\\localhost\C$\...`, and the person adds
      it once from SHARED FOLDER. The Developer key they wrote before is kept
      only as the fallback: since Office's update of 24–25 September 2026 Word
      forgets it on close (OfficeDev/office-js#6973), measured on 16.0.20326;
      the catalog's add-in survived every restart
- [ ] 9.6 A Mac keeps the add-in across restarts — not until Microsoft fixes
      #6973; there is no catalog on a Mac to fall back on

## 10. Symbols, and insertions that are not sticky

- [x] 10.1 Move the IAST palette table (`apps/web/src/editor/iast.ts`) into
      `packages/engine` so the app and the add-in share ONE table; the app
      re-imports it unchanged
- [x] 10.2 The pane's symbol palette: the groups, each key inserting in its
      proper style; svaras attach to the letter before the caret
- [x] 10.3 Not sticky: after every styled insertion the caret's formatting is
      the surrounding text's. The technique is MEASURED in Word on the web
      (typing after an insertion and reading the typed run's style), not
      assumed; the chosen one is recorded in design
- [x] 10.4 Tests: unit (each key's style; attach/refuse rules), integration
      (the palette table is the app's — one module), component (palette
      renders every group, keys labelled), live (insert each kind, then type,
      then assert the typed run's style)

## 11. Sharing

- [x] 11.1 The site's install section: one file to double-click per platform,
      per organisation by an admin; the code updates by itself, the manifest
      daily (Windows) or by running the installer again (Mac)

## 12. The owner's documents, whole (measured on the sādhanā v9.1.4, kanakadhārā, agnimīḻe)

- [x] 12.1 Hyphen joins the syllable before it — one `attachHyphen`, in the engine
- [x] 12.2 A lone blue bar is the rules' pause; registers fitted per section
- [x] 12.3 Presentational spacing (after a daṇḍa/pause, `॥ 1॥`, after the tick)
      is not a difference, and an original keeps its own
- [x] 12.4 ONE reader for Word and PDF: the Python side only reads the page
      (letters, boxes, colours, superscripts, accents, overline) as Word-style
      paragraphs; `buildDocument` (shared) makes the document. Deletes the
      Python syllabifier and token builder. The overline and hyphen faults of
      the PDF path go with it.
- [ ] 12.5 A comment INSIDE a line survives: `ChantText.comment` (format,
      interchange, renderer, Word and every export) — 296 in the sādhanā
- [x] 12.6 The document title is read from the file; prose before the first
      section is kept
- [ ] 12.7 A plain document with no styles (Rudra kṣamā prārthana) imports as
      source text ready to mark

## 13. The Ṛgveda, complete (agnimīḻe sūktam, ṚV 10.191, 8.81)

- [x] 13.1 The three svarita rules, the overline as a character, the inverse
- [x] 13.2 Rule 3 reads the NEXT syllable's cluster (past a visarga or
      anusvāra coda), and a cluster is held if any letter of it is
- [x] 13.3 Rule 2 across a hyphen (`satyama-ṅ̎giraḥ`)
- [x] 13.4 Word-initial clusters are boxed in the Ṛgveda (measured, both sources)
- [x] 13.5 The anunāsika: `-ān` + vowel → `-ām̐` (ṚPrāt 4.80)
- [ ] 13.6 Per-verse fitting for a verse whose register differs from its
      section's (the anukramaṇī: lengthening off)
- [x] 13.7 A gate over the owner's Ṛgveda references that ratchets, run when
      `Library/reference` is present and skipping loudly when not

## 14. Everything on the tab, every script, every register (2026-09-30)

Supersedes sections 5, 6.2 and 8.1 where they speak of a task pane: there is
none. Everything is on the śikṣāmitra tab; Settings is the one side panel.

- [x] 14.1 The tab, the right-click menu and every keyboard shortcut from ONE
      table (`commands-table.ts`) — the manifest, its icons and
      `shortcuts.json` generated from it; a test fails if the manifest on disk
      is not the table's. Every command completes and says why when it cannot.
- [x] 14.2 A marking with nothing selected goes on the letter before the caret,
      and the caret comes back; a selection stays selected; nothing is sticky
- [x] 14.3 Alt and a letter from the app's F9 table; the typing help dialog; in
      a script line the script's letter, a vowel after a consonant its sign
- [x] 14.4 Every line read in the script it is in; Script → IAST / Devanāgarī /
      Telugu / Tamil over the selection or the document, every mark kept —
      the corpus 573 of 573 exact in each script, the same bytes on a second
      write, IAST → Devanāgarī → Telugu → Tamil → IAST home again; seeded
      random lines with random marks never refused and never changed
- [x] 14.5 What a cluster cannot show is Word's hidden text after it; an accent
      is in its cluster's run. Measured in Word's own PDF: a second variation
      selector in a row, every TAG character, and an accent in a run of its
      own are drawn (boxes, a dotted circle)
- [x] 14.6 Parts: a content control with a register of its own; the document's
      register in its settings. The app reads both (`importDocx`) and writes a
      section of another register as a part (`exportWord`)
- [x] 14.7 The app takes back what was done in Word to a .docx it exported:
      verses edited, marked, added, removed (`word/body-edits.ts`)
- [x] 14.8 His look, compared page by page in Word's PDF against his Śivopāsana
      and sādhanā: his running head, his sheet (A4 25/9/15/10 mm), the pauses
      the rules placed in his blue, the name in Heading 2 and the chants in 3
      and 4, source lines above what they name, a translation's own lines; no
      invented step numbers
- [x] 14.9 Installing for anybody: `install-windows.cmd`, `uninstall-windows.cmd`,
      `install-mac.command`, published with the add-in — the Windows pair run
      against a real Word: installed, added from SHARED FOLDER, on the ribbon
      after two restarts, Settings loaded from the published folder; removed,
      and the tab gone on the next start
- [ ] 14.10 Blank lines between verse groups, and his footer text, are not in
      the model and are not written
- [ ] 14.11 A verse typed as one paragraph per pāda (his Lalitā) and one broken
      by line breaks (his Kanakadhārā) are one model; the app writes the second

