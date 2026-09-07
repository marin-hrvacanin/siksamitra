# śikṣāmitra

A workbench for Vedic and classical Sanskrit text.

It marks recitation according to the śikṣā rules — holdings, svaras, anusvāra
and visarga treatments, reading aids, svarabhakti — and renders them in IAST,
Devanāgarī, Telugu and Tamil, with every script losslessly convertible to every
other. It reads and writes Word and PDF, works entirely offline, and ships every
font it needs inside the application.

**This is the `v2` branch, a rewrite.** It shares no history with `main`, which
is frozen v1 — kept as a behavioural reference, never merged.

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
typecheck                five packages + two apps, 0 errors
tests                    185, across four tiers
check:modules            no file over 400 lines except 7 inherited, ratcheted
check:tokens             3 theme axes generated, in step
check:literals           495 literals, ratcheted, none new
check:fixtures           19 interchange fixtures current
check:conformance        152 DERIVED assertions
check:transliteration    31 762 / 31 762  (Devanāgarī + Telugu)
check:lossless           5 of 5 scripts round-trip exactly
check:engine             15 506 / 16 021 syllables = 96.79 %, 11 documents
```

Read the transliteration figure precisely: 15 881 syllables in **two** verified
scripts, two assertions each. **Tamil is carried and unreviewed** — the owner has
confirmed those forms were never checked. ITRANS is registered read-only.

**Built:** the format, the engine, the renderer, the layout engine (pagination,
zoom, anchoring), the three-axis design system, Word and `.vuchant` interop, the
CLI and all the gates, the storage interface, the web application with three
view modes and a responsive ribbon, vendored fonts, and the packaging script.

**Not built yet:** the editing surface itself (a continuous caret over the token
stream), the `.smdoc` importer, online mode, and no installer has yet been
produced from this repository. [`openspec/changes/bootstrap-v2/tasks.md`](openspec/changes/bootstrap-v2/tasks.md)
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
