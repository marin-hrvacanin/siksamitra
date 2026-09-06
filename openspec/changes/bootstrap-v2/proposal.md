## Why

śikṣāmitra v1 works and is unmaintainable, and the reasons are architectural
rather than incidental.

A marking in v1 is a CSS-classed `<span>` inside Quill's `.ql-editor`
innerHTML. So "is this holding correct?" is a question about a DOM blob, and
there is nowhere to assert it. Worse, the marks are produced in at least four
places — `editor-quill.js` (a single 720 KB file), `custom-blots.js`,
`smdoc-format.js`'s `toHTML`, and the viewer/export HTML generated inside
`editor.py` (180 KB). When two disagree, nothing in the system can say which is
right. That is why v1's logical defects are untraceable: there are only outputs,
no arbiter.

Three measured consequences follow from the same cause:

- **Size.** Puruṣa Sūktam as `.smdoc` is 38.8 MB *after* LZMA preset 9 EXTREME,
  because audio is base64'd into the content string. Opening verse 1 means
  decompressing all of it.
- **Scale.** Quill holds the whole document as one delta over one
  contenteditable. A marked document is enormous in NODES, not bytes — every
  syllable is an inline-block with a span per letter — so v1 lags and crashes on
  large documents.
- **Correctness.** Five engine defects were found by re-deriving eleven
  documents letter by letter and comparing. All five are still in v1.

Meanwhile a correct engine, renderer, format and interop layer already exist and
are verified, inside the vedaunion.org repo, where they do not belong: the
platform is a website, and an authoring engine is not a website's business.

This change founds v2 as a standalone product and moves that verified work into
it, so that śikṣāmitra owns authoring and Veda Union owns publishing.

## What Changes

- A new orphan branch `v2` holding an npm-workspaces monorepo:
  `packages/{format,engine,render,interop,cli}` + `apps/{desktop,web}`.
- The marking engine, the document format, the renderer, the Word/PDF/`.vuchant`
  interop and the headless CLI **move from vedaunion.org**, with their tests and
  their ratchet gates, and are re-published as `@siksamitra/*` packages.
- A new `.smdoc` importer, so v2 opens the v1 Library it replaces.
- A new editing model: a continuous caret over the token stream within a
  section, replacing v1's whole-document contenteditable and replacing the
  platform editor's modal per-verse rows.
- A new interchange contract: siksamitra exports the format vedaunion.org
  reads, with a conformance fixture suite as the arbiter between two
  independent implementations. Neither project depends on the other.
- Two front ends over one editor: the Tauri desktop app, and a web build served
  at `vedaunion.org/siksamitra`.
- Optional online mode: sign in with a Veda Union account, open and save chants
  on the platform directly from the desktop app.

## Capabilities

### New Capabilities
- `format`: the presentation-independent document format — hierarchy, provenance, multi-script, marks as data
- `engine`: derivation of marks from source text and a profile; the rule registry; the profile parametrization
- `render`: the ONE renderer from tokens to screen and paper, in four scripts
- `interop/word`: `.docx` import and export against the owner's own style table
- `interop/pdf`: PDF import from the vector layer, and PDF export through the renderer
- `interop/package`: the `.vuchant` portable package
- `interop/smdoc`: reading v1 `.smdoc` documents, including their embedded audio
- `editor`: the authoring surface — continuous caret, token-model editing, never HTML
- `library-storage`: the local, file-first document library
- `desktop-shell`: the Tauri 2 shell — windows, menus, files, associations
- `cli`: the headless SDK and CLI, the agentic authoring surface
- `online-mode`: authenticated read/write against a Veda Union account
- `interchange`: the format contract between two independent projects, and the fixtures that arbitrate it

### Modified Capabilities
<!-- None. v2 is founded on this branch; there are no existing v2 specs to modify. -->

## Impact

- **New repo branch:** `siksamitra@v2`, orphaned from `main`. `main` is frozen as
  the reference implementation to diff behaviour against, not a merge target.
- **vedaunion.org:** unchanged by this change, and gains no dependency. It
  keeps its own renderer and its own reader for the format. Separately, and at
  the owner's discretion, it may drop the authoring surfaces it no longer needs
  — the engine, the interop layer and the chant editor pages. Verified
  precondition for that later cleanup: the platform server imports the engine in
  **zero** files and the client in **four**, all authoring surfaces;
  `ChantReader` imports none of it.
- **Users:** v1 `.smdoc` documents must keep opening. The importer is scored
  against documents that exist in both formats.
- **The format becomes a written contract** between two independently built
  programs rather than an assumption inside one. `CHANT_FORMAT_VERSION` and
  `docHash` already exist to carry the version and the integrity check; the
  conformance fixtures are what prove the two readings agree.
