# Authoring Library Documents (and their covers)

How the **Documents / Library** system works and how to create a new document —
including the **"PDF → document → researched cover image"** pipeline — so a future agent
(or human) can do it correctly without guesswork.

Pairs with **`../../image-gen/HANDOFF.md`** (the cover-image generation guide; `image-gen/`
is a sibling of `app/`, outside this repo). Read both for the end-to-end flow.

---

## 1. The idea — what a "Document" is

A **Document** is a Library entry for a piece of sacred text: a **mantra, sūkta, śloka,
stotra, sahasranāma, sādhana, upaniṣad, saṅgraha**, etc. It is the canonical home for that
text on vedaunion.org, at `/library/<slug>`.

A document bundles:
- a **block-based body** (intro, meaning, context — rendered from JSON, with an HTML snapshot
  for SEO);
- **attachments**: the text as **PDFs in multiple scripts** (IAST / Devanāgarī / Telugu / …),
  **audio** (often one track per anuvāka, grouped), **YouTube** video/playlist references,
  and **external links**;
- a **cover image** (`/library/<slug>-cover.png`, in the house illuminated style);
- **tags** in three namespaces (`type` / `deity` / `topic`), IAST labels + ASCII slugs;
- **relations**: bidirectional "see also" links to other documents, and links from calendar
  events;
- **revisions** (every edit snapshots title + body).

The public page (`client/src/components/document/DocumentPage.tsx`) uses **layout C — a
"scholarly rail"**: a sticky **left rail** (cover · type · title · subtitle · deity chip ·
Texts & PDFs) beside the **reading column** (intro prose + any embedded chant reader + tags +
related). It stacks (rail above column) on tablet/phone. The Library shell (`PublicLibrary.tsx`)
lists documents under Featured / Documents / Videos / Series / Resources.

A document can **embed the interactive chant reader** via the `chant` block — see
[`AUTHORING-CHANTS.md`](./AUTHORING-CHANTS.md) and §"Embedding a chant" below.

All Sanskrit shown to users is **IAST with diacritics**; **slugs stay lowercase ASCII**
(e.g. tag slug `shiva`, label `śiva`; document slug `purusha-suktam`, title `Puruṣa Sūktam`).

---

## 2. Data model (exact, from `server/src/db/schema.ts`)

- **`documents`** — `id`, `slug` (unique), `title`, `subtitle?`, `excerpt?`, `coverImage?`
  (`/library/<slug>-cover.png`), `contentJson` (`{version:1, blocks:[]}`), `contentHtml`,
  `templateKey` (`blank`|`mantra-page`|`sukta-page`|`shloka-page`|`sadhana-guide`|`compilation`),
  `status` (`draft`|`review`|`published`|`archived`), `visibility` (`public`|`members`),
  `pinnedAt?` (non-null = Featured), `authorId?`, `editorId?`, `publishedAt?`, timestamps.
- **`documentAttachments`** — `documentId`, `kind` (`pdf`|`audio`|`video`|`youtube_video`|
  `youtube_playlist`|`external_link`), `label`, `description?`, `script?` (for PDFs:
  `iast`|`devanagari`|`telugu`|…), `fileUrl?` (pdf/audio/video), `externalUrl?`,
  `youtubeVideoId?`, `youtubePlaylistId?`, `durationSec?`, `bytes?`, `mime?`, `groupKey?`
  (groups e.g. audio "anuvāka 1..N"), `sortOrder`.
- **`documentTags`** — `namespace` (`type`|`deity`|`topic`), `slug` (ASCII), `label` (IAST),
  `description?`, `sortOrder`. Unique per (namespace, slug).
- **`documentTagAssignments`** — (`documentId`, `tagId`) many-to-many.
- **`documentRevisions`** — snapshot per edit (`versionNumber`, title/json/html, `note`).
- **`documentRelations`** — bidirectional (`documentId`, `relatedDocumentId`) "see also".
- **`eventDocuments`** — links calendar events ↔ documents.
- **`media`** — durable record for uploaded/imported files (`url`, `storageKey`, `kind`,
  `mime`, `bytes`, dims…). Static `/library/*.pdf` seed files do NOT need a media row.

---

## 3. Three ways to create a document

| Path | When | How |
|---|---|---|
| **Seed** (recommended for canonical texts) | content known at build time; should exist on every DB | add a `SeedDocument` to `DOCS` in `server/src/lib/seed-documents.ts`; PDFs live in `client/public/library/`; runs on boot |
| **Dashboard / API** | a user/admin authoring interactively, or programmatic one-off | `POST /api/documents` (perm `documents.create`) with `DocumentInput`; attachments via the attachment manager / `POST /api/documents/:id/attachments` |
| **Bulk import** | many docs whose files live on the remote media volume | `server/src/scripts/import-documents.ts` (`npm run -w server db:import-docs`), SSH-uploads files, makes `media` rows. Needs `MEDIA_REMOTE_*` env. **Use canonical slugs** — divergent slugs created the old `vu-sadhana`/`veda-union-sadhana` duplicate. |

**For agent automation from a PDF, use the Seed path** — it's in-repo, reviewable, idempotent,
and the boot `reconcileDocuments()` keeps the cover wired. Steps in §6.

### The `SeedDocument` shape (`seed-documents.ts`)
```ts
interface SeedDocument {
  slug: string;          // lowercase ASCII, e.g. 'purusha-suktam'
  title: string;         // IAST, e.g. 'Puruṣa Sūktam'
  subtitle: string;
  excerpt: string;       // 1–3 sentences for cards/preview
  templateKey: 'sukta-page' | 'mantra-page' | 'sadhana-guide' | 'blank';
  typeTag: string;       // a `type` tag SLUG (see §4)
  deityTag?: string;     // a `deity` tag SLUG (§4). OMIT for a deity-neutral doc
  coverImage?: string | null;  // default '/library/<slug>-cover.png'; pass null
                               // when no cover exists yet (avoids a 404 cover)
  body: { version: 1; blocks: Block[] };   // built with doc() (§5)
  attachments: SeedAttachment[];
}
interface SeedAttachment {
  script: 'iast' | 'devanagari' | 'telugu';
  url: string;           // '/library/<slug>-<script>.pdf'
  bytes: number;         // exact file size (e.g. `wc -c` / Get-Item .Length)
  label?: string;        // override default label
  sortOrder?: number;    // override default (iast 0, devanagari 1, telugu 2)
}
```
`seedDocuments()` is **create-only** (skips an existing slug — never clobbers edits). It inserts
the row, attachments, one `type` + one `deity` tag (looked up by namespace+slug; skipped with a
warning if absent), and a v1 revision. `reconcileDocuments()` then force-sets the cover and drops
known legacy duplicates on every boot.

---

## 4. Tags (use these exact slugs)

Seeded on boot (`server/src/lib/document-tags.ts`). Pick **one `type`** and **one `deity`**
slug for a seed doc (the API accepts multiple tag IDs).

- **type**: `mantra, sukta, shloka, stotra, sahasranama, namavali, sadhana, puja, yajna,
  samskara, upanishad, kirtana, bhajana, patha, sangraha, karyakrama, darshana`.
- **deity**: `shiva, vishnu, brahma, ganesha, durga, kali, lakshmi, saraswati, parvati,
  hanuman, rama, krishna, surya, agni, indra, skanda, gayatri, shakti, ganga, annapurna,
  narasimha`.
- **topic**: none seeded; admins add on demand.

If a text's deity isn't in the list, add a new tag to `TAG_SEEDS` (slug ASCII, label IAST) and
it'll seed on boot; or pick the closest principle (e.g. a Nārāyaṇa hymn → `vishnu`).

---

## 5. The body: the `doc()` builder (`server/src/lib/seed-kit.ts`)

Chain block methods, finish with `.build()` → `{version:1, blocks:[]}`. Available blocks:

| Method | Use |
|---|---|
| `.h(text, level=1, eyebrow?)` | heading (level 1 = page title) |
| `.p(html, variant?)` | paragraph; raw inline HTML ok (`<em>`,`<strong>`); variants `lead`/`drop-cap` |
| `.list(items[], ordered=false)` | bulleted / numbered list; each item is inline HTML |
| `.verse(deva, iast, english?, source?)` | **the house mantra block** — Devanāgarī · IAST · English · source |
| `.objectives(title, items[])` | a goals/points box |
| `.keyTerms(title, [[term, def], …])` | glossary |
| `.table(caption, rows[][])` | first row is the header |
| `.image(src, alt, caption?, opts?)` | image |
| `.exercise(title, html, hint?)` | practice block |
| `.callout(title, html, variant?)` | note/warning box; variants `note`/`warning`/`saying`/`insight`/`tip`/`question` |
| `.divider(variant?)` | `rule` / `violet` / `ornament` (❦) |

`.verse()` collapses newlines (the render is a single `<p>` per script), so keep each
script on **one line** and mark pādas with daṇḍas (`।` / `॥`, or `|` / `||` in IAST).

`blocksToHtml()` renders the same blocks to the `contentHtml` snapshot (the seed does this for
you). Keep bodies factual and sourced: what the text is, its Vedic source, the deity/meaning,
when/how it's chanted. Don't paste the full verse text into the body — the **PDF attachment** is
the canonical text; the body is context.

---

## 6. The PDF → document → cover pipeline (step by step)

Given an IAST PDF of a chant:

1. **Read the PDF** (title, source line, deity/subject, verses, translation). Choose a canonical
   **slug** (lowercase ASCII, e.g. `purusha-suktam`).

2. **Stage the PDF**: copy it to `app/client/public/library/<slug>-iast.pdf` (add
   `-devanagari.pdf` / `-telugu.pdf` if you have them). Record exact **bytes**
   (`wc -c <file>` in Git Bash, or `(Get-Item file).Length`).

3. **Add the `SeedDocument`** to `DOCS` in `server/src/lib/seed-documents.ts`: slug, IAST title,
   subtitle, a 1–3 sentence excerpt, `templateKey: 'sukta-page'` (for a sūkta), `typeTag`,
   `deityTag` (§4), a `body` built with `doc()` (intro paragraphs citing the source — §5), and
   the PDF `attachments` (with the byte sizes). Cover is implicit (`/library/<slug>-cover.png`).

4. **Research the iconography** of the document's deity/subject (dhyāna śloka + 2–3 sources) and
   **write `SUBJECTS["<slug>"]`** in `image-gen/gen-covers.py` per the rules in HANDOFF.md §5
   (exact arm count stated structurally, each attribute by VIEWER side, distinct objects
   described by shape, complexion/mount/seat, forbid the common confusion). **Triple-check this
   spec before generating — a wrong description means paying to redo the image.**

5. **Generate the cover** (HANDOFF.md §1–4): from the repo root,
   `export GEMINI_KEY=… && python image-gen/gen-covers.py <slug> --n 2 --outdir image-gen/out/try`.
   It auto-anchors to purnakumbha + Dhanvantari + Rudra for the house style.

6. **Verify by eye** (count arms, check each attribute, complexion, mount, aura, the pencil-grid
   shading + vivid colour). Re-roll only a true miss. Pick the best; copy to
   `app/client/public/library/<slug>-cover.png` (1024×1024 RGB) and keep a copy in
   `image-gen/out/covers/<slug>.png`.

7. **Verify build**: `cd app && npm run typecheck`.

8. **Ship**: commit in the **owner's name** (no Claude/Anthropic attribution), push to **dev AND
   main** (`git push origin dev && git push origin dev:main`). On the deploy boot, `seedDocuments()`
   creates the row and `reconcileDocuments()` wires the cover. Give it a few minutes, hard-refresh.

> Editing an **existing** document's body/tags later: the seed is create-only, so change it via
> the dashboard/API, **not** by editing the seed (a seed edit won't apply to an existing row).
> Covers are the exception — `reconcileDocuments()` force-sets `/library/<slug>-cover.png` each
> boot, so replacing the PNG file is enough.

---

## 7. Boot order (`server/src/index.ts`)

`runStartupMigrations()` → `seedRbac()` → `seedDocumentTags()` → **`seedDocuments()`** (create-only)
→ `mergeRudramSvahakara()` (one-time merge) → **`reconcileDocuments()`** (force covers, drop
`vu-sadhana` duplicate) → `seedCourses()` (version-gated + non-destructive course-cover reconcile).

---

## 8. Permissions & API quick-ref

- `POST /api/documents` (perm `documents.create`) — body = `DocumentInput` (`shared/src/index.ts`):
  `title` + `contentJson` + `contentHtml` required; `slug` (else derived via `lib/slug.ts`
  `uniqueSlug`), `subtitle?`, `excerpt?`, `coverImage?`, `templateKey?`, `status?`, `visibility?`,
  `tagIds: number[]` (look up via `GET /api/document-tags?namespace=type|deity`),
  `relatedDocumentIds: number[]`, `revisionNote?`. Publishing needs `documents.publish`; pinning
  needs `documents.pin`.
- `PATCH /api/documents/:id` — same fields; a new revision is snapshotted when title/body changes;
  `tagIds` and `relatedDocumentIds` replace wholesale.
- Attachments via the dashboard attachment manager (uploads → `media` → attachment) or seed.

---

## Embedding a chant reader (the `chant` block)

A document can host the full interactive reader (marks, script switch, translation, word grammar,
per-verse audio). It is a first-class block, so it works in the dashboard editor too.

> **RULE — a VU document's Sanskrit text lives in the READER, never in the document body.**
> Body blocks are context: what to prepare, who is worshipped, provenance, procedural notes.
> The text itself goes in `client/public/chants/<slug>.json` and is reached through
> `.chant()`. **The failure this rule exists to prevent:** the first version of Pūjā Vidhi
> pasted all 49 mantras into the body as plain `.verse()` blocks — Devanāgarī + IAST with no
> recitation marks, no script switch, no word grammar, no dictionary links — and was rejected
> outright. `.verse()` is for a line quoted inside prose, never for material a reciter reads
> from. There is exactly one renderer for marked text (`components/chant/ChantReader.tsx`);
> anything that bypasses it ships unmarked.

1. **Author the chant JSON** → `client/public/chants/<slug>.json` (see
   [`AUTHORING-CHANTS.md`](./AUTHORING-CHANTS.md) — verbatim translations, exact provenance,
   grammar for every word, derived scripts).
2. **Client block**: `chant` is registered in `client/src/components/editor/blocks.tsx`
   (`Chant`) + `documentConfig.ts`. It stores `{ src, title?, note? }` and renders
   `<ChantEmbed>` — a compact **track entry** that opens `<ChantReader src embedded>` in a
   **fullscreen overlay** (portal to `<body>`; Esc/Close/scroll-lock). In the editor canvas it
   shows a lightweight placeholder (the interactive reader never mounts there).
3. **Seed**: in `server/src/lib/seed-kit.ts` the `doc()` builder has
   `.chant('/chants/<slug>.json', { title, note })`; `blocksToHtml` emits an SEO fallback.
   Add it to the document's `body` in `server/src/lib/seed-documents.ts`.
4. **Reconcile (seed-owned docs)**: `seedDocuments` is create-only, so to update an *existing*
   document's body add the slug to `SEED_OWNED_BODIES` in `reconcileDocuments` — it re-syncs the
   body from the seed on boot **when the HTML snapshot changes** (idempotent otherwise) and records
   a revision. Puruṣa Sūktam and Pūjā Vidhi use this.
5. Heading text is plain (`.h('Read & recite')`) — never HTML-encode `&` (it renders literally).

The reader **inherits the site theme** and reads/writes the user's saved chant preferences
(`UserPreferences.chant` in `shared`), so its settings persist and match the platform defaults.

---

## Manuals (step-by-step guides)

A **manual** is a document for a rite performed in order — many short mantras with a
direction attached to each, rather than one continuous text. The first is **Pūjā Vidhi**
(`/library/puja-vidhi`, `server/src/lib/seed-puja-vidhi.ts`), the sixteen-step pūjā.

**The mantras go in the chant reader, not in the body** — see the rule under *Embedding a
chant reader* above, and the rejection that produced it. The standard to match is
`/library/purusha-suktam#chant`.

Conventions a manual establishes:

- **Own module.** Keep the `SeedDocument` in `server/src/lib/seed-<slug>.ts`, imported into
  `DOCS` — the same split the course seeds use. `seed-documents.ts` stays readable.
- **The rite is a chant document.** One `Section` per step. Because `Section` is only
  `{ id, label, source?, audio?, verses[] }`, the **step number + name + the concise action**
  go in `label` (`"6 · Ghaṇṭā pūjā — ring the bell while chanting"`) and the gloss or textual
  provenance goes in `source` (`"Preparatory steps · worship of the bell, to purify the
  atmosphere"`). Do not invent new fields on `Section`/`Verse`.
- **Body = preparation + framing + the `.chant()` block.** What to prepare, who is worshipped,
  any step that carries *no* text (e.g. prāṇāyāma), longer procedural notes, and an "About
  this manual" provenance section. Then `.h('Read & recite', 2)` +
  `.chant('/chants/<slug>.json', { title, note })`.
- **Seed-owned body.** Add the slug to `SEED_OWNED_BODIES` in `reconcileDocuments` so later
  edits to the seed actually reach the live row (the seed itself is create-only).
- **`templateKey: 'sadhana-guide'`**, `typeTag` from §4 (`puja`, `sadhana`, …). Omit `deityTag`
  when the rite is deity-neutral.
- Standalone preview route `/tests/<slug>` (`client/src/pages/tests/<Slug>.tsx` + a route in
  `App.tsx`), exactly like `/tests/purusha-suktam`.

### Known engine gaps (as of the first manual)

- **`Section` has no field for a step's direction.** The action has to be crammed into
  `label`, which makes long labels; a real `Section.direction` (or a step block) is the
  obvious next engine addition.
- **No per-step images**, and no compound "step" primitive.
- ~~**No variables/templating.**~~ **Solved.** The marked-text contract
  (`shared/src/chant.ts`) now carries a `{"t":"slot","name":…}` token, and the reader fills it
  — the `deity` slot from `preferences.sankalpa.deity`, so one choice re-voices every mantra
  that names the deity (Pūjā Vidhi's āvāhana mantras). Declined forms stay **authored data**
  (`DEITIES[k].acc` in `shared/src/sankalpa.ts`), marked offline like everything else. The
  saṅkalpa itself is now a **document block** (`.sankalpa()` in `seed-kit.ts`), not a
  page-only composer — see [`AUTHORING-SANKALPA.md`](./AUTHORING-SANKALPA.md).
- **Embedding part of a text** is also solved: `.chant(src, { select })` narrows a reader to a
  section, some verses, or an inclusive verse range, so a document can carry a slice without a
  second copy of the text. **Inside the reader** the same thing is a step ITEM —
  `{"t":"embed","embed":{src,select,title,fallback}}` (`ChantEmbed` in `shared/src/chant.ts`).
  Failure is isolated to the item — the step keeps its number, title and direction — and the
  `fallback` says what to do meanwhile.
  **An embed's `src` may name a MODULE instead of a document**, and then the reader picks the
  document at render time. Pūjā Vidhi's `upa-11-namavali` is the case: `{ module: 'namavali' }`,
  resolved through `shared/src/namavali.ts` against the reader's chosen deity, so one step
  serves every deity and publishing the next garland is one line in that registry. This is the
  saṅkalpa's pattern — the document says where the step stands, the reader supplies what fills
  it — and it replaced three sections and three `onlyDeity` groups whose lists had to partition
  the fifteen deities exactly.
- **The reading column clamps the whole body** to 420 px behind a "Read more" toggle whenever a
  document has **no** `chant` block (`DocumentPage.tsx` → `CollapsibleProse`). A manual with an
  embedded reader escapes this, but a text-only guide still hits it.

---

## Footguns (each of these has bitten us)

**`coverImage: null` in a `SeedDocument` suppresses the cover forever.** `coverFor()`
(`seed-documents.ts`) reads `null` as "this document opts out", and `reconcileDocuments`
re-forces that value onto the row on **every boot** — so dropping the art in at
`/library/<slug>-cover.png` later changes nothing, and the document keeps showing a blank
card with no error anywhere. Omit the field to get the canonical
`/library/<slug>-cover.png`; use `null` only when you genuinely mean "no cover, ever".

**Typing a preference field as `z.enum` makes ONE stale value wipe ALL preferences.**
`resolvePreferences` (`server/src/lib/public-user.ts`) and `readGuest`
(`client/src/lib/preferences.tsx`) both do `UserPreferences.safeParse(…)` and return
`DEFAULT_PREFERENCES` wholesale on failure. Zod fails the *whole object* on one bad member,
so removing or renaming a single enum value silently resets that user's theme, date format,
script choice and everything else — stored rows and localStorage alike. When you change an
enum: keep old values accepted (or `.catch(default)` the field) rather than removing them,
and never rename an enum member in place.
