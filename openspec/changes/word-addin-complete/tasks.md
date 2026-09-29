## 1. Reading a document from any Word

- [x] 1.1 `word/style-names.ts`: built-in ids read through the document's own
      table (`Naslov1` → `Heading1`); `readParagraphs(documentXml, stylesXml)`
- [x] 1.2 The app's importer and the add-in's two readers pass the table
- [x] 1.3 `missingStyles` reads through the table
- [x] 1.4 Tests: unit (the table, pass-through, null), integration (the REAL
      package a Croatian Word on the web returned; his document localised to
      Croatian and German imports identically — fails without 1.2)

## 2. Two vocabularies

- [ ] 2.1 `word/vocabulary.ts`: the table in design D1, one entry per role with
      clean id, clean name, legacy id; `vocabularyOf(stylesXml, bodyXml)`
- [ ] 2.2 Readers: every role reachable from both ids (`roleOf`, `paraRoleOf`)
- [ ] 2.3 Writers: the add-in's sheet, `paragraphsXml`, and the app's Word export
      write the vocabulary chosen; the app's "Veda Union" export style is legacy
- [ ] 2.4 Existing style definitions are never replaced (D2) — measured on the web
- [ ] 2.5 Tests: unit (choice for empty / legacy / mixed / clean docs; every
      role both ways; name clash), integration (the corpus written in each and
      read back byte-identical; legacy doc stays legacy after a write),
      component (the pane says which vocabulary, and "holds both")

## 3. Anusvāra and visarga

- [ ] 3.1 The `Visarga` style in both vocabularies; the writer picks by `was`
- [ ] 3.2 `classifyBlueRun` — the upgrade table in D3, pure
- [ ] 3.3 "Upgrade this document": counts first, then one pass, then the list
      of what was left; idempotent
- [ ] 3.4 Hand-placed Anusvāra change / Visarga change commands in
      `packages/edit` (the app) and the add-in model; refusal for letters that
      cannot be that change
- [ ] 3.5 Tests: unit (every row of D3 and every refusal), integration (his
      document: exact counts, the 12 ambiguous runs, a second upgrade changes
      nothing; the corpus' 971 substitutions each land in the right style),
      component (upgrade flow shows counts and the leftovers)

## 4. Never damage a paragraph

- [ ] 4.1 `whatIsInTheWay(paragraphOoxml)` — the element list in D4
- [ ] 4.2 Every write checks it; the whole-document run skips and lists
- [ ] 4.3 The write re-reads and compares text in the same batch (D5)
- [ ] 4.4 Multi-paragraph selections refused for marks; per-paragraph for rules
- [ ] 4.5 Tests: unit (one fixture per element kind, real OOXML as Word writes
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

- [ ] 6.1 Theme from `officeTheme`, then `prefers-color-scheme`; live on change;
      `forced-colors`
- [ ] 6.2 Layout per D8: status line, grouped icon tools with swatches, rules
      collapsible, "This document" only when needed
- [ ] 6.3 Register stored in document settings
- [ ] 6.4 Tests: component (theme chosen from each input; sections shown only
      when needed; every control labelled), browser `check:word:pane` (light,
      dark, high contrast × 300/320/400/600 px: no clip, no sideways scroll,
      contrast ≥ 4.5:1 for every text pair), live (Word dark and light)

## 7. The right-click menu and the ribbon menu

- [ ] 7.1 Manifest: `ContextMenuText` submenu and a ribbon menu, both valid in
      Microsoft's validator for all three hosts
- [ ] 7.2 Function file sharing the model; the commands of the spec
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
- [ ] 9.5 Windows install: the site and `word-install.mjs` register a network
      share (or the Developer key), verified on a desktop Word

## 10. Symbols, and insertions that are not sticky

- [ ] 10.1 Move the IAST palette table (`apps/web/src/editor/iast.ts`) into
      `packages/engine` so the app and the add-in share ONE table; the app
      re-imports it unchanged
- [ ] 10.2 The pane's symbol palette: the groups, each key inserting in its
      proper style; svaras attach to the letter before the caret
- [ ] 10.3 Not sticky: after every styled insertion the caret's formatting is
      the surrounding text's. The technique is MEASURED in Word on the web
      (typing after an insertion and reading the typed run's style), not
      assumed; the chosen one is recorded in design
- [ ] 10.4 Tests: unit (each key's style; attach/refuse rules), integration
      (the palette table is the app's — one module), component (palette
      renders every group, keys labelled), live (insert each kind, then type,
      then assert the typed run's style)

## 11. Sharing

- [ ] 11.1 The site's install section: per person on the web, per
      organisation by an admin, what updates by itself and what needs a
      re-upload
