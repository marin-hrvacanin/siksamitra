# śikṣāmitra

A workbench for Vedic and classical Sanskrit text.

It marks recitation according to the śikṣā rules — holdings, svaras, anusvāra
and visarga treatments, reading aids, svarabhakti — and renders them in IAST,
Devanāgarī, Telugu and Tamil, with every script losslessly convertible to every
other. It reads and writes Word and PDF, works entirely offline, and ships every
font it needs inside the application.

**This is `main`, and it is v2 — a rewrite.** The v1 program it replaces is
kept, frozen, on **`legacy-v1`**: a behavioural reference, sharing no history
with this branch and never merged.

---

## Why there is a v2

v1 works and is unmaintainable, for reasons that are architectural rather than
incidental.

A marking in v1 is a CSS-classed `<span>` inside Quill's `.ql-editor` innerHTML.
"Is this holding correct?" is therefore a question about a DOM blob, and there is
nowhere to assert it. The marks are produced in four places — a 720 KB
`editor-quill.js`, `custom-blots.js`, `smdoc-format.js`, and viewer HTML
generated inside a 180 KB `editor.py`. When two disagree, nothing can say which
is right.

Three measured consequences of that one cause:

| | v1 | v2 |
| --- | --- | --- |
| Puruṣa Sūktam on disk | **38.8 MB** after LZMA preset 9 — audio base64'd into the content string | assets referenced, never inlined |
| A long document | one Quill delta over one contenteditable, every syllable an inline-block with a span per letter — it lags and crashes | sections mount lazily; off-screen sections have no DOM at all |
| A logic defect | untraceable: four producers, no arbiter | `derive(source, profile)` is pure, so a defect is an input/output pair |

Five engine defects were found by re-deriving eleven documents letter by letter
and comparing. All five are still in v1.

---

## Its own project

śikṣāmitra is not a tool belonging to vedaunion.org. The platform is one
**integration**: śikṣāmitra exports a format the platform reads, and can
optionally sign in to it for editing documents in place. Neither project depends
on the other, in either direction — separate repositories, separate hosting,
separate deploys.

What they share is a format, written down in
[`docs/INTERCHANGE.md`](docs/INTERCHANGE.md) and arbitrated by a conformance
fixture suite both projects can run, because two independent readers of one
format drift and no compiler catches it.

Intended to grow well past marking: more writing systems, accents, etymology and
dictionary lookup, automatic sandhi, grammatical analysis, and eventually a
corpus library. That is why most of the codebase is registries rather than
switch statements — see *Extension points* in [`CLAUDE.md`](CLAUDE.md).

---

## State

Everything here is measured by running it. `npm run check`:

```
typecheck                six packages + two apps, 0 errors
check:web                the app itself, which the typecheck used to skip
tests                    328, across four tiers
check:modules            no file over 400 lines except 6 inherited, ratcheted
check:tokens             3 theme axes generated, in step
check:literals           430 literals, ratcheted; ZERO in the app
check:fixtures           19 interchange fixtures current
check:conformance        152 DERIVED assertions
check:transliteration    31 762 / 31 762  (Devanāgarī + Telugu)
check:lossless           5 of 5 scripts round-trip exactly
check:engine             15 678 / 15 980 syllables = 98.11 %, 11 documents
```

With a Chromium and `npm run dev` running:

```
tools/interaction.mjs    21 checks — driven with real mouse moves and real
                         key presses, asserted against the BROWSER's own
                         selection and the document's own text, never against
                         our own geometry: typing before anything is clicked,
                         the caret and the model moving together, drag-select,
                         one undo per burst, cut and paste through the model,
                         and a composed character landing once
tools/interaction-views  6 checks — rule zero in the verse actually clicked,
                         and every page of the paged view editable while the
                         off-screen measuring copy is not
tools/responsive.mjs     15 widths x 4 tabs, nothing unreachable, no sideways
                         scroll at any of them
tools/theme-matrix.mjs   84 chrome × document × mode combinations, all legible
tools/smoke.mjs          flow, pages and web views, no console errors
```

Read the transliteration figure precisely: 15 881 syllables in **two** verified
scripts, two assertions each. **Tamil is carried and unreviewed** — the owner has
confirmed those forms were never checked. ITRANS is registered read-only.

**Built:** the format, the engine, the renderer, the layout engine (pagination,
zoom, anchoring), the three-axis design system, Word and `.vuchant` interop, the
CLI and all the gates, the storage interface, the web application with three
view modes and a responsive ribbon, vendored fonts, the packaging script — and
the editing surface: one continuous caret over a section, marks placed by hand
as overrides the rules cannot overwrite, undo that is byte-exact, and rule zero
enforced where an edit is attempted rather than apologised for afterwards.

**The corpus can now be edited.** It could not before, and the reason is worth
stating: all 573 shipped verses were marked tokens with no record of the letters
they came from, so by the format's own rule they were transcriptions and the
editor was right to refuse them. `sm attach-src` reconstructs the source,
re-derives, and attaches the source layer **only where the derivation reproduces
the verse exactly** — 466 of 573 verses. The other 107 stay frozen, each with a
named reason, and those reasons are engine questions the owner has not settled
rather than architecture.

**Not built yet:** the `.smdoc` importer, online mode, and no installer has yet
been produced from this repository. [`openspec/changes/bootstrap-v2/tasks.md`](openspec/changes/bootstrap-v2/tasks.md)
is accurate about all of it, deliberately.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5273
npm run check      # everything above
npm run package    # an installer for this platform
```

Needs Node 22+. `npm run package` additionally needs a Rust toolchain.

---

## Layout

```
packages/format    the document model, and the reader obligations
packages/engine    derivation, the rules, the script registry. Never leaves.
packages/render    the one renderer: tokens -> screen and paper
packages/layout    pure: pagination, zoom, anchoring, view modes
packages/edit      what an edit IS — caret, source surgery, marks, undo
packages/tokens    every design value, three theme axes
packages/interop   Word, PDF, .vuchant
packages/storage   the ChantStore interface + local files
packages/cli       the headless SDK and the gates
apps/web           the application
apps/desktop       the Tauri shell — four commands, knows nothing about documents
assets/fonts       11 vendored OFL families
corpus             11 verified documents + the interchange fixtures
```

---

## Contributing

[`CLAUDE.md`](CLAUDE.md) is the map: what to read for a given task, the ten rules
that are not negotiable, and where the extension points are.
[`tests/README.md`](tests/README.md) says which tier a test belongs in and what
each tier may not do.

## Licence

**Not yet chosen** — see [`docs/LICENSING.md`](docs/LICENSING.md), which lays out
what the choice turns on. Until then the code is all rights reserved.

The bundled fonts are settled and unaffected: all eleven families are SIL OFL
1.1, with notices in `assets/fonts/LICENSES.md`.
