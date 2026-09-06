## Context

The verified assets exist and are measured. Any design that re-implements them
is strictly worse than one that moves them.

| asset | state | evidence |
| --- | --- | --- |
| marking engine | ~10 k lines pure isomorphic TS | 53 tests |
| transliteration | four scripts, lossless | 31 762 / 31 762 |
| corpus re-derivation | 11 documents, letter by letter | 15 506 / 16 021 syllables = 96.79 %, ratcheted |
| Word interop | measured off the owner's own 4.5 MB file | 340 verses / 11 360 syllables / 3 411 holdings / 4 644 accents round-trip; `styles.xml` byte-identical |
| PDF import | two calibrated readers | 553/554 Calibri family, 106/106 Arial family, 93 letters recovered from vector paths |
| `.vuchant` | no asset ever inlined | Sri Rudram 1554 KB to 124 KB |
| desktop shell | Tauri 2, gate D1 passing on Windows | 16 MB installer, against Electron's 103 MB |

The constraint that shaped all of it, and must survive the move: **one
implementation of each thing, within one codebase**. It is why PDF export goes
through the same CSS the screen uses instead of a `pdf-lib` writer, and why the
desktop shell is four commands that know nothing about chants. Across the two
projects the arrangement is different and deliberate — see D1.

## Goals / Non-Goals

**Goals:**

- Siksamitra owns the engine, the format, its own renderer and all interop.
- Siksamitra exports the interchange format vedaunion.org reads, and imports what
  the platform produces.
- A conformance fixture suite arbitrates between the two independent
  implementations.
- One editor, two front ends (Tauri desktop, web), one storage interface with
  two implementations (local files, platform API).
- Every verified gate moves with the code it verifies.
- v1 documents open in v2.

**Non-Goals:**

- Re-implementing the engine "properly on a clean branch". It is already the
  proper implementation; a third one would arrive with none of the gates.
- Porting v1's UI code. v1's UI is the reference for *which features exist*, not
  for how they are built.
- A React Native or Electron shell (see Decisions).
- Authoring courses, articles or news. Those stay on the platform, block-based.
- Auto-alignment in the first release. The manual cutter ships; the aligner is a
  downloaded pack.

## Decisions

### D1. Two independent projects, joined by a format

Veda Union and siksamitra are different products with different audiences: a
membership platform versus a tool someone installs without an account. They are
separately hosted, separately deployed, and separately owned code.

**Decision (owner, ruling):** neither project depends on the other. Veda Union
keeps its own renderer and its own reader for the interchange format.
Siksamitra exports that format. Nothing is published from here for the platform
to consume, and nothing is imported from there.

| siksamitra owns | vedaunion.org owns |
| --- | --- |
| the engine, the rules, the profiles | its own renderer and reader |
| authoring, interop, the CLI, the gates | storage, publishing, the block-based site |
| export of the interchange format | import of the interchange format |

The two are kept agreed by the OWNER changing one side and then the other,
against a written contract — not by a package version. Either side may gain a
construct first.

*Rejected:* siksamitra publishing `format` and `render` as packages the platform
consumes. It couples two independently hosted deployments through a release
process, and it makes every format experiment on either side a publish. The
owner runs both projects; a written contract plus fixtures is the lighter and
more honest coupling.

*Rejected:* Veda Union storing pre-rendered HTML so it needs no renderer of its
own. That is exactly the presentation-coupling of `.smdoc`, which is the defect
being escaped.

**The risk this creates, and what answers it.** Two independent renderers can
disagree, and there is no compiler to catch it. That is the real cost of this
decision and it is accepted deliberately. What replaces the shared library as
arbiter is the **conformance fixture suite** (capability `interchange`): a set
of documents covering every construct the format defines, each with its expected
interpretation, that BOTH projects can be run against. A construct added without
a fixture is a construct that will drift silently, so the rule is that a format
change and its fixture land together.

Note the scope of the one-implementation rule, which is otherwise the spine of
this design: it applies WITHIN a codebase. v1 produced marks in four places
inside one program and could not say which was right. Two deliberate
implementations in two programs, with a fixture suite between them, is a
different arrangement and not the same defect — provided the fixtures exist.

### D2. Move the engine; do not port it

"Port the vedaunion fixes into a fresh v2 engine" would produce the third
implementation of the rules. The five defects the corpus gate found were
invisible to inspection: `Profile.pauses` declared and read by nothing; 469
hyphens silently deleted on re-derivation; the anusvara opening the next
syllable where the corpus writes it closing the previous one, 418 occurrences to
0; the semivowel reading aid unconditional where it actually splits 102:3 Vedic
against 0:40 smarta. A fresh implementation would reintroduce that class of bug
and arrive with no gate to catch it.

**Decision:** `shared/src/marking/`, `shared/src/interop/`, `tools/vu-chant.ts`,
`tools/chant/` and `engine-baseline.json` move wholesale, with their tests.

What is genuinely rebuilt feature-by-feature from v1 `main` is the **UI**: the
ribbon, the dialogs, the keyboard, the audio editor, the document manager,
autorun and autosvara.

### D3. Tauri 2, not Electron, not PyQt

*PyQt (v1):* two runtimes, and marks living in `.ql-editor` innerHTML. It is the
direct cause of the untraceability this change exists to end.

*Electron:* measured at 103 MB against Tauri's 16 MB for the same bundle.

**Decision:** Tauri 2. The fallback is a stated criterion, not a preference: if
gate D1 shows WKWebView or WebKitGTK rendering the marks wrongly, switch to
Electron, roughly a week, because only the shell changes.

*Rejected:* React Native, for a shared "one framework everywhere" story. The
marks are CSS geometry measured to the pixel: `1px` against `1.62px` stroke
weights, four distinct glyph advances confirmed by measurement. React Native has
no CSS box model, so it would be a **third** renderer for exactly the thing that
must have one.

### D4. A custom editor over the token stream, not Quill, not Tiptap

The model of Quill is a flat delta of text plus inline attributes. It cannot
represent a letter-level unit inside a syllable carrying four script forms, a
holding *group* spanning units, and a `words[]` array aligned to syllable runs.
That mismatch is why `.smdoc` is presentation-coupled, single-script, and has
implicit hierarchy (flat `<p>` plus literal danda-numbered text).

**Decision:** the marked surface is a custom controlled editor over the token
stream, reusing the primitives of the renderer. The source text is
authoritative; the marked view is a projection; `srcMap` is the map between
them. A keystroke edits the source at the mapped offset and re-derives that
verse only.

Tiptap stays for prose fields: translations, instructions, notes.

### D5. The caret is continuous within a SECTION

v1 gives one caret over the whole document, and crashes on large ones. The
platform editor gives one caret per verse, which is why it reads as a CMS form
rather than an editor.

Both are wrong, in opposite directions, and the section is the correct unit
because it is already the unit of loading: the platform API sends the section
index alone so a 1.73 MB document opens instantly, and the reader mounts the DOM
of a section only within a screenful and a half of the viewport, because the
puja manual is ~10 k DOM nodes and a Devi Mahatmyam would be well over 100 k.

**Decision:** continuous caret (select across verses, paste a whole anuvaka,
arrow-down crosses boundaries) bounded by the section. A document-wide caret
would force the whole document resident and give back exactly the property that
makes large documents openable.

*Note:* `content-visibility: auto` was tried for this and removed: it suppresses
the IntersectionObserver inside a skipped subtree, so lazy contents could fail to
mount at all. Two mechanisms, one job, only one able to see its own trigger.

### D6. Storage is one interface with two implementations

The only platform-coupled import in the editor is `lib/chants`, the API hooks.
Everything else it touches is pure.

**Decision:** a `ChantStore` interface. `FileStore` reads and writes `.vuchant`
and a JSON library index; `PlatformStore` speaks to `/api/chants`. Online mode
is a store swap, not a second editor. Section-at-a-time loading maps onto files
as naturally as onto rows.

### D7. `.smdoc` import is scored, not trusted

v2 replaces v1, so it must open the existing Library of the user, the 38.8 MB
Purusa Suktam included. Reading it is mechanical: magic bytes, LZMA (`SMDI`) or
zlib (`SMDC`) or plain JSON, then Quill HTML to tokens.

The HTML-to-tokens step is the part that can silently be wrong. Several
documents exist in **both** formats, the `.smdoc` and the shipped v2 JSON, so
the importer is scored against them by the same letter-by-letter comparison the
corpus gate uses, and ratcheted.

## Risks / Trade-offs

- **Two independent readers of one format can drift.** This is the standing
  cost of D1 and it is permanent. There is no build step that catches it: a
  construct siksamitra starts emitting is simply not understood by the platform
  until the platform is taught it. Mitigated by three things and no more — the
  written contract, `CHANT_FORMAT_VERSION` with `docHash` (which refuses a
  mismatch rather than repairing it), and the conformance fixtures, which are
  the only mechanism here that actively DETECTS drift rather than documenting
  it. If the fixtures are allowed to fall behind the format, this risk has
  nothing left holding it.
- **Two front ends can drift.** Mitigated by making the web build and the
  desktop build the same editor entry with a different shell and a different
  store, never two editors.
- **A Python sidecar for PDF import costs ~50 MB on a 16 MB installer.** The
  calibration is why it stays Python: one reader recovers 93 letters that an
  exporter flattened into vector paths, absent from the text layer entirely. The
  wrapper already runs wherever Python and PyMuPDF exist, so the sidecar is an
  install-size decision, not a capability one.
- **`main` and `v2` share no history.** Deliberate: an orphan branch is the
  honest form of "this is a rewrite". `main` stays checked-out-able as the
  behavioural reference. It is never merged.
- **Signing remains unsolved and blocks distribution, not development.** macOS
  refuses an unsigned app outright rather than warning; Windows SmartScreen
  warns until the binary earns reputation. Neither can be produced from a repo.
