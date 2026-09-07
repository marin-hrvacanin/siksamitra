# Chant format (v1) — source-of-truth for Vedic recitation texts

The data model behind the chant reader at **`/tests/purusha-suktam`** (a template that
will back all chants site-wide). The guiding rule: **the format holds meaning, not looks.**
Every rendering — plain reading, śloka-by-śloka practice, any script, audio karaoke, word
details, export — is *derived* from this one source. Presentation lives in the renderer
([`client/src/pages/tests/PurushaSuktam.tsx`](../client/src/pages/tests/PurushaSuktam.tsx)
+ `chant.css`), never in the data.

This v1 is deliberately small and pragmatic; it already inverts every weakness of the legacy
Śikṣāmitra `.smdoc` (presentation-coupled HTML, inline base64 audio, implicit hierarchy,
single-script, no grammar slots). The exhaustive, adversarially-verified format design is a
separate, larger planning effort; this doc describes what the working template uses today.

## File layout
```
client/public/tests/purusha-suktam/
  data.json            # the document (this format)
  audio/<id>.mp3        # one clip per verse (+ intro/closing), stored SEPARATELY (never inline)
```

## Shape
```jsonc
{
  "format": "vedaunion.chant", "version": 1,
  "id": "purusha-suktam",
  "title": "puruṣa sūktam", "subtitle": "Hymn of the Cosmic Man",
  "titleForms": { "iast": "...", "devanagari": "...", "telugu": "...", "tamil": "..." },
  "source": "kṛṣṇayajurveda",          // recension — drives śikṣā derivation rules
  "primaryScript": "iast",
  "scripts": ["iast","devanagari","telugu","tamil"],
  "sections": [ Section ],             // arbitrary-depth structure (here: 2 levels)
  "recording": { "byVerse": { "<verseId>": { "file": "...mp3", "duration": "…", "label": "1.1" } } }
}
```

### Section / Verse
```jsonc
Section = { "id","label", "audio?": {file,duration,label}, "verses": [ Verse ] }
Verse   = { "id","n?": "1.1", "audioId?": "...", "tokens": [ Token ], "translation?": { "en": "…" },
            "words?": [ { "surface", "entries": [ Gram ] } ],   // per-word subanta/tiṅanta (v2)
            "lineBreak?": "source"|"hemistich"|"pada"|"none" }   // per-śloka override (see below)
Doc     = { …, "lineBreak?": "source"|"hemistich"|"pada"|"none" }  // per-chant default (general rule)
```
Structure is an explicit **named, arbitrary-depth** tree (a short mantra has one level; a text
like Devī Māhātmyam would nest adhyāya → śloka → pāda). Groupings like "5×5 lessons" are
*derived views*, not stored. Verse numbering is data (`n`), not glyphs baked into the text.

### Token (the atom)
A verse is an ordered token list. The core token is the **syllable (akṣara)** — script-neutral,
carrying its śikṣā marks as *data*:
```jsonc
{ "t":"syl",
  "iast":"śā", "deva":"शा", "tel":"శా", "tam":"ஶா",   // the syllable in each script (derived)
  "hold?": "short" | "long",          // saṁyukta holding (VU marking)
  "svara?": "anudatta"|"svarita"|"udatta"|"dirgha-svarita",
  "sup?": "gṁ",                       // superscript insertion (āgama g / upadhmānīya f / …)
  "change?": true,                    // grammar-derived / variant glyph (provenance)
  "candra?": true,                    // candrabindu nasalisation
  "sbhakti?": true }                  // svarabhakti (epenthetic ·)
```
Other tokens: `{"t":"sp"}` (word gap), `{"t":"pause","len":"short"|"long"}`,
`{"t":"bar"}` (metrical `|`), `{"t":"danda","s":"॥"}`, `{"t":"num","s":"1"}`,
`{"t":"br"}` (a source line break — the reciter's hemistich boundary).

### Line breaks — general rule + per-śloka exceptions
Where the display starts a new line is a **policy**, not baked into the text. The general rule is
a per-chant default (`Doc.lineBreak`); any single śloka may override it (`Verse.lineBreak`):
- **`source`** (default) — break only at `{"t":"br"}` (the reciter's own hemistich structure, as
  in the VU documents; e.g. an anuṣṭubh renders as its 2 lines). Verified to match the legacy VU
  Puruṣa Sūktam document.
- **`hemistich`** — also break at daṇḍa (`।`/`॥`).
- **`pada`** — break at every bar `|` / daṇḍa / pause (one pāda per line).
- **`none`** — never break; one flowing line.

Bars, daṇḍas and the verse number **always stay inline**; words never break mid-word or
mid-syllable. This lets different chants (or specific ślokas) be laid out differently by data
alone, with no engine change.

> **Note (v2):** the live engine now carries marks at the **letter (unit) level** — each syllable
> is `{ "t":"syl", "units":[ {c, hold?, hg?, change?, svara?, sup?, candra?, sbhakti?} ], iast, deva, tel, tam }`
> — with holdings as *groups* (multi-letter capable) and per-word grammar in `words`. The single-field
> syllable below is the earlier v1 shape; this doc is mid-migration to v2.

> **The rules for *which* mark goes *where* are in
> [`MARKING-RULES.md`](./MARKING-RULES.md)** — holdings (cluster → host letter →
> long/short from the preceding vowel), the two svara registers, the anusvāra and
> visarga tables per recension, and the verification checklist. This file only
> describes how a mark is *stored*.

**Marks are never baked into the text** — they are typed fields on the syllable, so the renderer
can draw them consistently in *any* script (svara as a CSS stroke/line, holding as a box, etc.)
and toggle them on/off. This is why the same source renders identically in IAST, Devanāgarī,
Telugu and Tamil, and why svara colour/position never depend on a font's combining-mark support.

## How it's produced
Extracted from the Śikṣāmitra `.smdoc` (the marked IAST + cut audio) → parsed into
script-neutral syllables + typed marks → other scripts derived with
[`indic-transliteration`](https://pypi.org/project/indic-transliteration/) (clean, well-tested;
Śikṣāmitra's own multi-script output is not trusted). Pipeline lives in the session scratch
(`parse_to_format.py`); it is the seed of the future "raw source → correct VU document" skill.

## Renderer capabilities (all derived from the above)
Plain reading · śloka-by-śloka practice · light/dark · primary + secondary script (secondary
shown smaller/dimmer) · mātrā-weighted audio karaoke highlight · per-verse & sequential playback
· tap-a-word details (all scripts + śikṣā marks + mātrā + gloss) · translation show/hide ·
fully responsive, mobile-native.

## Embeddable reader (`components/chant/`)
The renderer now lives in a **reusable container** — `components/chant/ChantReader.tsx`
(`<ChantReader src embedded />`) styled by `components/chant/chant.css`:

- **Generic**: give it a `src` (a chant JSON at a public URL, e.g. `/chants/purusha-suktam.json`)
  and it renders. Not tied to any one text.
- **Theme-inheriting**: `chant.css` maps its private `--c-*` onto the global design tokens
  (index.css `@theme` + `[data-theme]`), so the reader flips light/dark with the site. The
  chant recitation-mark palette (`--color-svara/-hold/-change/-pause-*`) is a global token set.
- **Settings = a floating gear** in the container's corner (no top bar). The panel reuses
  `components/chant/ChantSettings.tsx`, bound to the user's saved chant preferences
  (`UserPreferences.chant` in shared) — so a reader inherits the platform defaults and any tweak
  persists. `embedded` gives it a card look (no full-viewport height) for placing inside a document.
- **In documents**: the `chant` block type (`editor/blocks.tsx`, registered in `documentConfig`)
  embeds `<ChantReader>` from a `src`. Seeded into the Puruṣa Sūktam document via
  `seed-documents.ts` (create-only) + a one-time `reconcileDocuments` force-embed on boot.
- **Data extras**: `Doc.source` + per-`Section.source` carry provenance (shown inline under each
  section head); `Doc.audioBase` overrides the audio folder so the JSON can live anywhere.

The `/tests/purusha-suktam` route is now a thin wrapper over `<ChantReader>` (`?embed=1` previews
the embedded card variant). `/tests/puja-vidhi` adds `?doc=1`, which previews the Pūjā Vidhi
*document* composition (two slices + the saṅkalpa module) without needing the database.

## The marked-text contract (`shared/src/chant.ts`) — one source, three kinds

The TypeScript description of this format lives in **[`shared/src/chant.ts`](../shared/src/chant.ts)**
and is shared by the reader, the document blocks and the composed modules. Three kinds of
source satisfy it, and `ChantReader` renders all three identically:

```tsx
<ChantReader src="/chants/purusha-suktam.json" />                  // a whole marked text
<ChantReader src="…" select={{ from: "v-3", to: "v-5" }} />        // PART of one
<ChantReader doc={composeSankalpa(coords, opts).doc} />            // a composed module
```

**Selection (`ChantSelection`)** narrows a document to a section, some verses, or an inclusive
verse range. Fields compose, applied in order `sections → exclude → verses → from/to`; a
selection that matches nothing renders the whole document rather than a blank card. Slicing is
one pure step (`sliceChantDoc`) at the load seam, so every downstream index — Contents, the
practice cursor, audio lookup — is computed on the slice. The `chant` block stores it as
`data.select`, and the seed kit takes it as `.chant(src, { select })`.

**Two further tokens** beyond the list above, for texts that are not fully fixed:

```jsonc
{ "t":"text", "s":"Krnjak", "fill":true }          // free text the reader supplied —
                                                   // never marked, never transliterated
{ "t":"text", "s":"…", "deva":"…" }                // plain text that carries no marks
{ "t":"slot", "name":"deity", "tokens":[ … ] }     // a VARIABLE slot; `tokens` is its default
```

A **slot** renders its own `tokens` unless the host supplies a replacement. `ChantReader`
resolves the `deity` slot from `preferences.sankalpa.deity`, so choosing a deity anywhere
re-voices every mantra in every reader that names one. A slot counts as exactly **one word** in
the per-word grammar table however many words it renders as, and carries no grammar popover
(the table describes the slot's default, not the substitution).

**Capabilities (`Doc.features`)** — `{ audio?, grammar?, translation? }`. A composed module has
no recording and no per-word grammar table; declaring `false` makes the reader hide the controls
that would otherwise do nothing. Absent means capable.
