## 1. Branch and workspace foundation

- [x] 1.1 Create the orphan `v2` branch, preserving all gitignored user data (`Library/`, `.venv/`, `cache/`, `media/`)
- [x] 1.2 Write the v2 `.gitignore`, root `package.json` with npm workspaces, and `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`)
- [x] 1.3 Initialise OpenSpec with the project context and the governing conventions
- [x] 1.4 Write the bootstrap proposal, design and capability specs
- [x] 1.5 Create the package skeleton: `packages/{format,engine,render,interop,cli}`
- [x] 1.6 Root vitest config and TypeScript project references — `npx tsc -b` green across five packages
- [ ] 1.7 Restore `exactOptionalPropertyTypes` — it was switched on at the start and switched off again, because turning on a new strictness flag DURING a behaviour-preserving move meant editing ~40 call sites in code whose entire value is that it is verified. It is worth having; it is its own change.

## 2. The format package

- [x] 2.1 Move the chant document types and schemas out of the platform's shared package, leaving platform-only schemas behind
- [x] 2.2 Move `normalizeChantDoc`, `sliceChantDoc`, `parseChantSelect`, `canonicalJson`
- [x] 2.3 Move `ChantProfileKey` / `ChantProfileRef` OUT of the engine and into format, generically — a document must be able to name its register without dragging in the rule model
- [x] 2.4 Verify the package builds standalone with no platform imports

## 3. The engine package

- [x] 3.1 Move `shared/src/marking/` wholesale: alphabet, lex, normalize, syllable, pipeline, emit, geometry, profile, words, script tables
- [x] 3.2 Move the rule registry and all rule modules (holdings, sandhi, svara, aids)
- [x] 3.3 Move the engine test suite — **83 tests pass unchanged**
- [x] 3.4 Move the corpus (11 documents) and `engine-baseline.json`; wire the ratchet
- [x] 3.5 Confirm no engine module imports anything outside format

## 4. The renderer package

- [x] 4.1 Move the mark render primitives, the chant stylesheet and the generated mark geometry
- [x] 4.2 Move the mark palettes and the generated theme tokens
- [x] 4.3 Move the reader, including lazy section mounting
- [x] 4.4 Move the print stylesheet so paper and screen share one implementation
- [x] 4.5 Extract the platform coupling into a **render host** (`RenderHostProvider`) — preferences, URL resolution and coordinates are supplied by whoever embeds the reader, with working defaults so a bare `<ChantReader>` renders with no provider
- [x] 4.6 Move the reading preferences (script choice, marks, font scale) into the renderer, where they belong — they are display, not document
- [x] 4.7 Move the saṅkalpa and nāmāvalī variable modules
- [ ] 4.8 Re-wire the theme token generator (`gen-tokens.mjs`) to v2 paths and prove `check:tokens`
- [ ] 4.9 Move the render-check surface and its measuring harness
- [ ] 4.11 **The renderer splits a geminate box that the format reader merges.** `renderIastUnits` scans per SYLLABLE, so one authored `hg` spanning `dan·naḥ` draws as two adjacent boxes; `holdingSpans` now merges it, because the group id is the author's intent. Two readings of one document inside one codebase — the renderer must join a run continued into the next syllable. Found by the holding-invariant suite on bhagya-suktam v-3 and v-5.
- [ ] 4.10 Replace the saṅkalpa-shaped hole in the host contract with a general module registry — `HostCoordinates` currently names one module by type, which is honest but not general

## 5. The interop package

- [x] 5.1 Move Word import and export and the measured style table
- [x] 5.2 Move the portable package reader and writer
- [x] 5.3 Move the two calibrated Python PDF readers into `tools/chant/`
- [ ] 5.4 Write the v1 container reader (LZMA, zlib, plain JSON, selected by magic bytes)
- [ ] 5.5 Write the v1 markup-to-token converter, recovering implicit hierarchy
- [ ] 5.6 Extract v1 embedded audio to package assets
- [ ] 5.7 Score the v1 importer against texts that exist in both formats and record the baseline

## 6. The CLI package

- [x] 6.1 Move the headless CLI; repoint its version stamp and corpus paths
- [x] 6.2 Structured output on every verb, human output on the error stream (inherited, unchanged)
- [x] 6.3 Transliteration gate runs — **31 762 / 31 762, 100 %**
- [x] 6.4 Corpus re-derivation ratchet runs — **15 506 / 16 021 syllables, 96.79 %, all 11 documents at or above baseline**
- [ ] 6.5 Wire the Word round-trip gate (copied, not yet verified against the reference document)
- [ ] 6.6 Wire the PDF import gate
- [ ] 6.7 Wire the v1 import gate
- [ ] 6.8 Rename the binary and its verbs from `vu-chant` to `siksamitra` / `sm`

## 7. The storage interface

- [ ] 7.1 Define the `ChantStore` interface: list, open manifest, read section, write section, assets
- [ ] 7.2 Implement the local file store over the portable package and a library index
- [ ] 7.3 Implement atomic section writes
- [ ] 7.4 Implement the platform store against the platform's chants API
- [ ] 7.5 Prove the editor constructs against either store with no conditional logic

## 8. The editor

- [ ] 8.1 Port the marked-line surface and the source map
- [ ] 8.2 Replace modal per-verse editing with a continuous caret bounded by the section
- [ ] 8.3 Selection across verses, select-all scoped to the section, multi-verse paste
- [ ] 8.4 Command log with inverses; one gesture is one undo step
- [ ] 8.5 Attested-verse protection with explicit confirmation
- [ ] 8.6 Rebuild the v1 feature set as tool chrome: ribbon, dialogs, keyboard, autorun, autosvara
- [ ] 8.7 Port the audio cutter
- [ ] 8.8 In-canvas caret editing for the Indic scripts (reverse transliteration per keystroke, caret mapped through shaping)

## 9. The applications

- [ ] 9.0 **Rethink the v1 surfaces before rebuilding them** (owner, 2026-09-06): keep the visual design, question the structure. v1 has BOTH a Recents list and a Library browser — two answers to one question — in a tool whose documents are files the OS already catalogues. Decide what each surface is for, or that it is not needed, before any of it is ported.
- [ ] 9.1 Web application entry over the editor
- [ ] 9.2 Tauri 2 shell: window, menu, file dialogs, association, launch arguments, single instance — its own identity, NOT the platform's
- [ ] 9.3 Least-privilege capability configuration
- [ ] 9.4 Run the render check on WKWebView and WebKitGTK and record the measurements
- [ ] 9.5 Python sidecar packaging for PDF import
- [ ] 9.6 Auto-alignment pack, downloaded on demand

## 10. Online mode

- [ ] 10.1 Sign-in against the platform's non-browser token model
- [ ] 10.2 Platform library listing alongside the local library
- [ ] 10.3 Read-only presentation where permissions require it
- [ ] 10.4 Conflict detection on section save, preserving local work

## 11. Interchange with vedaunion.org

- [x] 11.1 Write the interchange contract — `docs/INTERCHANGE.md`, version 4, binding on both sides
- [x] 11.2 Build the conformance fixture suite — 15 constructs MINED from the verified corpus, not hand-authored
- [x] 11.3 A conformance gate that runs offline with no platform present — **90 assertions, 15 fixtures, passing**
- [x] 11.4 Report unexercised constructs every run — `cj` is modelled by the format and occurs nowhere in the corpus, so neither implementation is being held to it
- [x] 11.5 Confirm the repository builds and every gate passes with no access to the platform
- [ ] 11.6 Run the fixture suite against vedaunion.org's own reader and record the result
- [ ] 11.7 Preserve-and-report unmodelled constructs through an import/edit/export round trip

## 12. Scripts as modules (design D8)

- [x] 12.1 Record the requirement and the design — measured starting point, root cause, and cost
- [ ] 12.2 Extract a script-neutral phoneme inventory: sound + classification, no glyph in any script
- [ ] 12.3 Turn each writing system into a module: id, name, kind, phoneme-to-form map, signs, virama, pranava, reversibility, gaps
- [ ] 12.4 Register IAST as a module like any other, ending its double role as substrate
- [ ] 12.5 Replace the closed `ChantScriptKey` union with an open id resolved against the registry
- [ ] 12.6 Delete `AnyScriptKey` and promote ITRANS to a first-class registered script
- [ ] 12.7 Move representational gaps and approximations into each script module; remove the named Tamil branches from shared code
- [ ] 12.8 Change the document shape: `Record<ScriptId, string>` per syllable, plus a declared script list
- [ ] 12.9 Migrate the eleven corpus documents to the new shape with both ratchets held
- [ ] 12.10 Raise the interchange contract version and regenerate the conformance fixtures
- [ ] 12.11 Extend the transliteration gate to every registered script, each with its own baseline
- [ ] 12.12 Add a second Indic script (Kannada) as the proof that adding one costs a module and a registration
- [ ] 12.13 Authoring in any reversible script; read-only registration for those that are not

## 13. Design system (nothing hardcoded)

- [x] 13.1 Record the requirements — tokens, themes, fonts, shared components, one renderer
- [ ] 13.2 One machine-readable token source; generate the CSS, the TS module, the print sheet and the Word style table from it
- [ ] 13.3 A **token gate** that scans for literal colours, sizes, families and durations outside the token source and fails on any it finds
- [ ] 13.4 Themes as data — adding one is one entry, and no component names a theme
- [ ] 13.5 Fonts declared once by ROLE, with fallbacks and loading strategy; components may not name a family
- [ ] 13.6 The shared component library: buttons, fields, menus, dialogs, tabs, status bar, icons
- [ ] 13.7 Prove the one-renderer rule by adding a surface that displays documents and contains no mark-drawing code

## 14. Performance (measured, ratcheted)

- [x] 14.1 Record the budgets, and how "100x" is being made falsifiable
- [ ] 14.2 Build the measurement harness; record baselines with the machine they were taken on
- [ ] 14.3 Measure v1 on the same documents, so the comparison is real rather than rhetorical
- [ ] 14.4 Time-to-first-verse independent of document size
- [ ] 14.5 Live node count proportional to what has been viewed, not to the document
- [ ] 14.6 Keystroke derive-and-repaint within one frame, one verse only
- [ ] 14.7 Code and asset splitting; packaged size recorded and ratcheted
- [ ] 14.8 One-section saves that merge rather than replace document-level data
- [ ] 14.9 Prove no path can base64 an asset into a document, package or payload

## 15. Distribution

- [ ] 15.1 Windows Authenticode certificate
- [ ] 15.2 Apple Developer ID and notarisation
- [ ] 15.3 A macOS machine for the universal build
- [ ] 15.4 Updater keypair, generated outside the repository
- [ ] 15.5 Publish installers, and a download reference from vedaunion.org
