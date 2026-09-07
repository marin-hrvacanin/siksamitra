# Authoring Chants (the interactive reader format)

How to build a **chant** in Veda Union's source-of-truth format so the interactive
reader renders it correctly in every script, with recitation marks, per-verse
audio, verbatim translation and word-by-word grammar. Written so a future agent
(or human) can produce a new chant that matches **Puruṣa Sūktam** without guesswork.

Pairs with **[`CHANT-FORMAT.md`](./CHANT-FORMAT.md)** (format rationale),
**[`AUTHORING-DOCUMENTS.md`](./AUTHORING-DOCUMENTS.md)** (how a chant is embedded in a
Library document) and **[`AUTHORING-SANKALPA.md`](./AUTHORING-SANKALPA.md)** (the related
offline saṅkalpa marking). The renderer is **`client/src/components/chant/ChantReader.tsx`**
(+ `ChantSettings.tsx`, `ChantEmbed.tsx`, `chant.css`). Reference data:
**`client/public/chants/purusha-suktam.json`** and **`durga-suktam.json`** — copy their
shape exactly. For a text assembled from several printed editions and checked
against a recording, the reference is **`shiva-sankalpa-suktam.json`**
(`tools/chant/gen_shivasankalpa.py`, §5J). The **reusable pipeline scripts** live in
[`tools/chant/`](../tools/chant/) (see its `README.md`); §5 explains the flow.

---

## 0. Non-negotiable rules (read first)

1. **Translations come from the owner's source document when there is one — VERBATIM.**
   Never paraphrase or summarise a translation the owner supplied. Puruṣa Sūktam's
   translations come from the owner's *"puruSha sUktam & durgA sUktam v9.11 IAST.pdf"*.
   **When the source has none (or the owner asks for a better one), produce a
   RESEARCHED NEUTRAL translation** — grounded in established scholarly/traditional
   sources (Arsha Vidya / Swami Dayananda publications, sanskritdocuments.org,
   Monier-Williams via ambuda.org, reputable Upaniṣad / Purāṇa translations), rendering
   what the Sanskrit says with no sectarian gloss, no devotional embroidery and no
   interpretive expansion. Do **not** copy a long passage verbatim out of one
   copyrighted translation — synthesise from several. Where a researched reading
   disagrees with the owner's own English, prefer the accurate one and **report the
   divergence**. Never invent a translation you cannot ground. Word-for-word glosses
   (in `words[].entries[].meaning`) may always be authored.
2. **Every word gets a complete, correct grammatical parse.** No blank `words` entries.
   Disambiguate by context. subanta → liṅga/vibhakti/vacana/prātipadika; tiṅanta →
   puruṣa/vacana/lakāra/dhātu(+gaṇa); avyaya/upasarga where they apply.
3. **Exact provenance at every level.** `Doc.source` + each `Section.source` name the
   precise recension/veda/part (e.g. `Ṛgveda 10.90 · Taittirīya Āraṇyaka 3.12`). This is
   shown under each section head and is *important to the owner*.
4. **Marks land on the SPECIFIC letter** they belong to, never "the whole
   syllable". Holdings can span several letters via a shared group id. **Which
   letter carries a holding, and whether it is short or long, is DERIVED — not a
   judgement call.** The complete rule set (holdings, svara registers, anusvāra
   per recension, visarga, svarabhakti, the order of operations, the
   verification checklist) is [`MARKING-RULES.md`](./MARKING-RULES.md). Read it
   before you mark anything.
5. **Never re-derive marks for text that already exists in a VU document.** The
   owner's `.docx` / `.smdoc` / marked PDF is the ground truth and contains
   hand-placed marks the algorithm does not produce — copy them run by run. The
   derivation is for text that has never been marked.
6. **Scripts + grammar-forms are DERIVED, not hand-typed** — use `indic-transliteration`
   (§5). The owner's own multi-script output is not trusted.

---

## 1. File layout

- Chant JSON → **`client/public/chants/<slug>.json`** (served at `/chants/<slug>.json`).
- Audio (optional) → **`client/public/tests/<slug>/audio/*.mp3`**; point `Doc.audioBase`
  (`"/tests/<slug>/audio/"`) at that folder.
- Standalone preview route → a lazy page under **`client/src/pages/tests/<Slug>.tsx`**
  (a thin wrapper over `<ChantReader>`) + a `/tests/<slug>` route in `App.tsx`
  (see `PurushaSuktam.tsx` / `DurgaSuktam.tsx`).
- Pipeline scripts → **[`tools/chant/`](../tools/chant/)** (§5).
- The reader is generic: `<ChantReader src="/chants/<slug>.json" embedded />`.

---

## 2. JSON schema (exact — mirror `ChantReader.tsx` types)

```jsonc
{
  "format": "vedaunion.chant", "version": 2,
  "id": "purusha-suktam",
  "title": "puruṣa sūktam",
  "subtitle": "Hymn of the Cosmic Being",
  "source": "Ṛgveda 10.90 · Taittirīya Āraṇyaka 3.12",   // doc-level provenance
  "audioBase": "/tests/purusha-suktam/audio/",            // optional; default is that path
  "titleForms": { "iast": "puruṣa sūktam", "devanagari": "पुरुष सूक्तम्",
                  "telugu": "…", "tamil": "…" },
  "scripts": ["iast","devanagari","telugu","tamil"],
  "lineBreak": "source",                                   // doc default; per-verse override allowed
  "recording": { "byVerse": { "1.1": { "file": "a1-1.mp3" } } },  // optional
  "sections": [
    {
      "id": "anuvaka-1", "label": "Anuvāka I.",
      "source": "Ṛgveda 10.90 · Taittirīya Āraṇyaka 3.12",  // section-level provenance
      "audio": { "file": "anuvaka-1.mp3" },                 // optional section audio
      "verses": [
        {
          "id": "v-3", "n": "1.1", "audioId": "a1-1",
          "lineBreak": "source",
          "tokens": [ /* Syl | sp | pause | bar | br | danda | num — see §3 */ ],
          "translation": { "en": "Thousand-headed is the Man, …" },  // VERBATIM
          "words": [ { "surface": "sahasra", "entries": [ /* Gram — see §4 */ ] } ]
        }
      ]
    }
  ]
}
```

### Token types (`tokens[]`)
- **Syllable**: `{ "t":"syl", "units":[Unit], "iast":"sa", "deva":"स", "tel":"స", "tam":"ஸ" }`
  — `iast` is the clean base (no marks) for word assembly; `deva/tel/tam` are the whole-akṣara
  shaped forms for the secondary scripts (derive them, §5).
- **Space** `{ "t":"sp" }` · **pause** `{ "t":"pause","len":"short"|"long" }` (renders `|` / `‖`)
  · **bar** `{ "t":"bar" }` (`|`) · **break** `{ "t":"br" }` (source line break — where the reader
  starts a new line under `lineBreak:"source"`) · **daṇḍa** `{ "t":"danda","s":"।" }`
  · **number** `{ "t":"num","s":"1" }` (the ॥N॥ verse number; rendered in the active script's digits).

### Unit (one written letter — marks attach HERE)
```jsonc
{ "c":"s",            // IAST grapheme (vowel / consonant / anusvāra ṁ / visarga ḥ / f)
  "hold":"short"|"long",  "hg": 4,   // holding on THIS letter; adjacent same-hg letters = ONE box
  "svara":"anudatta"|"svarita"|"dirgha-svarita",  // pitch accent on THIS letter (udātta = unmarked)
  "change": true,     // grammar-derived transform (anusvāra/visarga variant) — renders in the "change" colour
  "sup":"i",          // IAST-only superscript reading aid (svarabhakti colour, jñ→jgñ…); NOT shown in Indic scripts
  "candra": true,     // Vedic candrabindu (nasal) on this letter
  "sbhakti": true }   // svarabhakti — a bold dot rendered BEFORE this letter, outside any holding box
```

`Doc.lineBreak` / `Verse.lineBreak`: `"source"` (break only at `br`), `"hemistich"` (also at daṇḍa),
`"pada"` (every bar/daṇḍa/pause), `"none"`. **Lines must never be forced to wrap** — keep each
rendered line short enough; the reader is wide (min 80rem) and words are atomic.

---

## 3. The marking vocabulary (the owned VU look)

> The table below is the *rendering* summary. The **derivation rules** — where a
> holding lands, when it is long, the recension-specific anusvāra and visarga
> tables, the metre presets, the order of operations and the verification
> procedure — live in **[`MARKING-RULES.md`](./MARKING-RULES.md)**, transcribed
> from Śikṣāmitra's `sanskrit_rules.js` with line references. Do not mark from
> memory or by eye.

| mark | means | data | renders as |
| --- | --- | --- | --- |
| svarita | high accent | `svara:"svarita"` | one vertical stroke above the letter (madder red) |
| dīrgha-svarita | long high | `svara:"dirgha-svarita"` | two strokes above |
| anudātta | low accent | `svara:"anudatta"` | a line below the letter |
| udātta | — | (nothing) | unmarked |
| holding | prolongation (derived — a consonant cluster, host letter picked by rule; long/short from the PRECEDING vowel) | `hold` + shared `hg` | a box around the held letter(s), equal air above and below — botanical green |
| svarabhakti | epenthetic vowel | `sbhakti:true` | a bold filled circle before the letter (madder) |
| change | sandhi variant | `change:true` | the letter in indigo-blue |
| candra | Vedic nasal | `candra:true` | candrabindu над the akṣara |

Colours are global tokens (`--color-svara/-hold/-change/-pause-*`, light+dark in `index.css`) so
they flip with the site theme; the secondary-script line washes them out proportionally.

### 3.1 Where svara comes from — two registers

**Vedic saṃhitā material: svara is DATA, taken from an accented source.** Puruṣa Sūktam
and Durgā Sūktam carry the accents of their recension; they come out of the marked PDF /
`.smdoc` (§5A) and are never guessed. **Never invent svara for genuinely Vedic text** —
including a Vedic verse quoted inside a Purāṇic rite (Pūjā Vidhi's camphor verse is Kaṭha
Upaniṣad 2.2.15). Tag such a verse with an explicit **hard-refusal register**
(`meter=VEDIC` in `gen_puja.py`) rather than relying on it happening not to scan: a later
re-lineation of its pādas must not be able to make the positional pattern apply by accident.

**Purāṇic / stotra material: svara may be "invented" — applied by CONVENTION — when the
owner asks for it.** Ślokas from the Purāṇas and āgamic stotras carry no attested accent,
but they are traditionally chanted "as if Vedic". The owner has sanctioned marking them
from a fixed **positional pattern** on the syllables of a half-verse (the same convention
Śikṣāmitra's "automatic svaras" tool applies, verified against the owner's own marked
Lalitā Sahasranāma):

| metre | unit | svarita on | anudātta on |
| --- | --- | --- | --- |
| **anuṣṭubh** 16\|16 | the 16-syllable **half-verse** | 2, 4, 8, 14 | 6, 9, 11 |
| **gāyatrī** 8\|8 | the 8-syllable **pāda** | 2, 4, 8 | 6 |
| **triṣṭubh** 11\|11 | the 11-syllable **pāda** | 2, 4, 8, 11 | 6, 9 |
| **jagatī** 12\|12 | the 12-syllable **pāda** | 2, 4, 8, 11 | 6, 9, 12 |

udātta is unmarked — emit no `svara` key for it. (Śikṣāmitra also ships gāyatrī 8|8 and
jagatī 12|12 presets; see `D:/Projects/siksamitra/dialog-autosvara.html` ~L96–135 and
`editor-quill.js` `applyAutomaticSvaras()` ~L8547.)

**Counting rule — a syllable is a VOWEL NUCLEUS.** Hyphens are orthographic and neither
add nor reset a count (`cida-gni` = ci·da·gni, so the svarita at position 2 sits on `da`);
a consonant cluster is one nucleus (`mbhu`, `nda`, `jñi`, `kṣu`, `ñca` each count once).
A `syl` token produced by `tools/chant/gen_marks.py` is exactly one nucleus, so counting
`syl` tokens per segment is the count.

Rules for applying it:

- **Classify every mantra deliberately, and record the classification** in the generator
  (a per-verse `meter=` tag), never as a hand-edit of the emitted JSON.
- **NEVER blanket-apply by syllable count.** `āsanaṁ samarpayāmi` also counts 8 and would
  wrongly match the gāyatrī plan — it is a prose offering formula, not a metre. This is
  the worked warning: matching on count alone produces false positives.
- **Verify the count before marking.** If a half-verse / pāda does not scan to the
  expected number, do **not** force the pattern: leave the whole verse unmarked (a
  half-marked śloka reads as a bug) and report it.
- A leading **praṇava** (`oṁ`) stands outside the metre — exclude it from the count, or a
  16-syllable hemistich reads as 17 and matches nothing.
- For a small corpus the positions may be placed **by hand** from an explicit table; no
  generator is required. What matters is that the decision is explicit and re-runnable.

**Prose / āgamic formulae are a THIRD register.** The `…ṁ samarpayāmi` offerings, the
`svāhā` oblations, the saṅkalpa, the ācamana names, āvāhana / udvāsana — these are spoken
prose. They take holdings + anusvāra + visarga only (the saṅkalpa rule, §"Marking" in
[`AUTHORING-SANKALPA.md`](./AUTHORING-SANKALPA.md)). Their **traditional chanting contour
is still to be supplied by the owner**; until it is, they ship with no svara. Keep the
register classification in one place in the generator so it is a one-line change plus a
re-run when the contour arrives.

---

## 4. Grammar (`words[].entries[]` — `Gram`)

One chunk (a run of syllables between spaces) → one `WordGram` with 1+ `entries` (sandhi can pack
several underlying words). Each entry:

```jsonc
{ "lemma":"puruṣa", "type":"subanta"|"tinanta"|"avyaya"|"upasarga"|"other",
  "meaning":"the cosmic Man",              // gloss (may be authored)
  // subanta:
  "gender":"m"|"f"|"n", "vibhakti":1..8, "vacana":"eka"|"dvi"|"bahu", "stem":"a-stem",
  // tiṅanta:
  "root":"jan", "gana":"4 (divādi)", "lakara":"laṅ", "purusha":1|2|3, "vacana":"eka",
  "note":"sandhi note",
  "forms": { "deva":"पुरुष", "tel":"పురుష", "tam":"புருஷ" }  // §5 — DERIVED
}
```

- `vibhakti` 1..8 (7 = locative, 8 = vocative). `purusha` stored 1/2/3 = uttama/madhyama/prathama.
- **`gana` is rendered inline as `root (gana)`** (`ChantReader.tsx` ~L755), so it must hold the
  gaṇa — `"1 (bhvādi), caus. sam-arpaya-"`, not `"caus. sam-arpaya- (√ṛ)"`. Anything that is a
  remark (the sandhi, the preverb derivation, an uncertainty) belongs in `note`.
- **Upasarga policy: an upasarga on a FINITE verb (tiṅanta) always gets its own `upasarga`
  entry** beside the root, so the reader shows preverb and root as separate rows with their own
  dictionary links — `samarpayāmi` → `sam` + `√ṛ`, exactly as `anubhāti` → `anu` + `√bhā`. A
  preverb lexicalised into a **nominal, participial or gerund** stem (`āvāhita`, `prokta`,
  `praṇamya`, `upavīta`, `ācamanīya`, `sannidhi`) stays inside that entry's `lemma` with the
  derivation in `note`. Do not split one and fold another.
- `forms` is the **headword** (root for tiṅanta, else lemma) in each Indic script, so the popover
  shows it in the reader's chosen script. The dictionary link always uses the IAST `lemma`/`root`
  (ambuda.org Monier-Williams — see [[reference-sanskrit-dictionary]]).

---

## 5. The pipeline (raw source → JSON + audio)

This is the **proven** pipeline that produced **Durgā Sūktam** end-to-end from the owner's
IAST PDF (Puruṣa Sūktam was built the same way except its marks came from the legacy
Śikṣāmitra `.smdoc` instead of the PDF importer). The reusable scripts are in
**[`tools/chant/`](../tools/chant/)**; run them with the Śikṣāmitra venv python
(`D:/Projects/siksamitra/.venv/Scripts/python.exe`), which already has `torch`/`torchaudio`
and `indic_transliteration`. **The scripts are per-chant starting points** — copy, edit the
paths/data at the top, re-run.

### 5A. VU-styled PDF → marked HTML → chant v2 JSON

1. **Extract marked HTML** from the VU IAST PDF with Śikṣāmitra's
   **`pdf_import.convert_pdf_to_html(path)`** (`D:/Projects/siksamitra/pdf_import.py`). It
   emits Quill HTML carrying every VU mark: holdings, svara, change-style, pauses, svarabhakti,
   `<sup>`, candrabindu, verse numbers and translations.
2. **Parse the HTML → chant format v2** with **`tools/chant/parse_chant.py`**. It builds the
   letter-level `units[]` + typed marks and the `sp`/`pause`/`bar`/`danda`/`num`/`br` tokens,
   groups syllables into sections→verses, and derives `deva/tel/tam` per syllable with
   `indic_transliteration`. **Marks map** (HTML → data):

   | HTML source | → data |
   | --- | --- |
   | `ql-holding-short` / `ql-holding-long` | `hold: "short"/"long"` (+ shared `hg`) |
   | `U+0331` / `U+030D` / `U+030E` combining | `svara: anudatta / svarita / dirgha-svarita` |
   | `ql-change-style` | `change: true` |
   | `<sup>…</sup>` | `sup` (IAST-only reading aid) |
   | candrabindu marker | `candra: true` |
   | `·` (middle dot) | `sbhakti: true` |
   | `॥ N ॥` run | `danda` + `num` + `danda` |

   **Derive scripts by stripping the Vedic accents first**, then transliterating the clean base
   — svara stays a *data field*, never a glyph:
   ```python
   from indic_transliteration import sanscript
   sanscript.transliterate("puruṣa", sanscript.IAST, sanscript.DEVANAGARI)  # पुरुष (also TELUGU, TAMIL)
   ```
   **Validate the produced marks against an existing chant JSON** (holding runs box the right
   letters, svara on the right vowels, sbhakti dots outside boxes).

### 5A-bis. No marked PDF? → mark plain IAST with the saṅkalpa engine

**Pūjā Vidhi** (`client/public/chants/puja-vidhi.json`) had no VU-styled PDF at all — only
a class slide-deck of plain Devanāgarī + IAST. Its generator,
**`tools/chant/gen_puja.py`** (+ **`puja_words.py`** for the grammar), is the reference for
that case and the starting point to copy:

1. Write each mantra's IAST **in its underlying form** — an un-assimilated `ṁ`, an
   un-sandhied `ḥ` — one string per source line, `|` / `||` for the daṇḍas. Vowel sandhi
   the engine does not model (`aḥ` → `o`, `a` + `a` → `ā`) is written already applied.
2. `gen_marks.mark(line)` derives holdings + the anusvāra + the visarga variant
   (`ś/ṣ/s/r`, upadhmānīya `sup:"f"`) and paints them `change`. It **REPLACES** the
   `ṁ`/`ḥ` with the letter actually recited rather than merely colouring it — `paraṁ
   brahma` renders `param brahma`. Puruṣa Sūktam and Durgā Sūktam do the same, so all the
   chants agree; **there is no divergence here to "fix"**. The anusvāra rule in full:

   | before | result |
   | --- | --- |
   | a stop (k/c/ṭ/t/p class) | the homorganic nasal — `ṅ ñ ṇ n m` — `change: true` |
   | a sibilant, semivowel, `h`, a nasal, or a pause | the anusvāra `ṁ` is kept, unmarked |
   | a **vowel** | plain `m` (word-final -m is never anusvāra), `change: true` |
   | — after a praṇava / bīja (`oṁ`, `hrīṁ`, …) | never assimilated at all |

   `gen_marks` implements the first two rows; the vowel row is finished by
   `gen_puja._anusvara_before_vowel()`. **Get it wrong and the scripts disagree**:
   Devanāgarī and Telugu print the anusvāra sign where Tamil resolves it to `ம்`, so a
   missed case shows up as `देवं / దేవం / தேவம்` for one and the same syllable.
3. Map `gen_marks`' `{t:'punct'}` to the reader's typed tokens: `|` → `{t:'danda',s:'।'}`,
   `||` → `{t:'danda',s:'॥'}`; insert `{t:'br'}` between source lines yourself, and append
   `{t:'num',s:'N'}` + `{t:'danda',s:'॥'}` for a verse number. `gen_marks` also emits
   `{t:'pause',len:'short'}` after an initial praṇava — pass it straight through; it is a
   real token *and* a holding barrier (MARKING-RULES §2.1), so dropping it
   silently re-marks every `oṁ …` mantra.
4. Apply svara per §3.1 (register-tagged, all-or-nothing per verse).
5. Derive `deva`/`tel`/`tam` per syllable (`ṁ` → `ṃ` first; `oṁ` → `ॐ/ఓం/ௐ`).
6. Grammar is a **surface-keyed glossary** (`puja_words.py`): the builder looks up every
   word surface from the token stream and fails loudly if one is missing, which keeps the
   `words[]` count equal to the `syl`-run count by construction (§5C).

### 5A-ter. A nāmāvalī (aṣṭottara / sahasranāma) — `gen_lakshmi.py`

**Śrī Lakṣmī Aṣṭottara Śatanāmāvalī** (`client/public/chants/lakshmi-ashtottara.json`,
generator `tools/chant/gen_lakshmi.py` + `lakshmi_words.py`) is the reference for a text
that is **one construction repeated** — `oṁ <name in the dative> namaḥ`, 108 times, behind
its dhyāna. Three things it settles, which the next aṣṭottara should copy rather than
re-decide:

1. **The register is decided ONCE, for the whole document, and named in a constant.**
   `SVARA = None` in the generator, with the reasoning beside it. A nāmāvalī is prose
   (§3.3, the `oṁ sumukhāya namaḥ` register), and the dhyāna ślokas here are
   śārdūlavikrīḍita and puṣpitāgrā — metres §3.2 has no preset for, so §3.2 rule 3 leaves
   them unmarked. Both roads lead to *no svara anywhere*, which is the outcome to want:
   a document that is uniformly unmarked reads as a decision, a document that is marked in
   patches reads as a bug.
2. **Sections are the ślokas of the source stotra, and that is what makes the count
   checkable.** The names are the accusatives of the stotra's fourteen ślokas; grouping
   them that way gives every section an exact citation (`śloka 4 (anugrahapradāṁ buddhim
   anaghāṁ harivallabhām)`) *and* turns "is it really 108?" into an assertion —
   8+12+9+8+7+8+7+9+8+8+7+6+6+5, checked in `build()` against the printed edition's own
   decade marks. A nāmāvalī that silently ships 107 names is the characteristic failure
   here, and this is the guard against it.
3. **The anusvāra register is `smriti`, so there is no *gum*.** Purāṇic/āgamic material
   keeps the anusvāra before a sibilant and leaves it unpainted (`puja-vidhi.json`,
   114/114). `gen_vishnu.apply_vedic_anusvara` is the *Taittirīya* layer (§5H) and must
   not be imported into a smārta text.

The praṇava's short pause applies as everywhere else: `oṁ | prakṛtyai namaḥ`, the pause
inserted before holdings are derived (§5A-bis step 3, MARKING-RULES §2.1).

**Mark a whole verse in ONE `line_tokens` call**, passing ` // ` for each line break —
never one call per line with `{"t":"br"}` stitched between the results. A line break is
*not* a saṁyukta barrier (MARKING-RULES §2.3 measured that and rejected it) and *not* an
anusvāra barrier (`durga-suktam.json` v-2 assimilates `…haṁ` / break / `prapadye`), so
marking line by line silently drops every cross-line mark. Here it cost three: the
holdings on `hastābhyām` and `pārśve`, whose clusters begin on the line before, and the
`m` of `sevitām`. **`gen_vishnu.py` still marks per line** and `vishnu-suktam.json` is
missing the same two boxes — a separate change, and `diverge.py` must be re-run after it.

**Svarabhakti is not in `gen_marks`** (see MARKING-RULES §6), so every generated chant
lacks it until a generator adds the pass. `gen_lakshmi.apply_svarabhakti` is the opt-in
one, applying the rule measured off the owner's own files — a dot on a `ś ṣ h` directly
preceded by `r`, which reproduces all 8 of his dots and adds none he does not have.

### 5B. Audio → per-verse clips via forced alignment

3. **Download + trim**: `yt-dlp` the reference recitation → **ffmpeg** trim to the sūkta window.
4. **Forced-align** the known IAST to the audio with **`tools/chant/align.py`** — Śikṣāmitra's
   **MMS aligner** (`torchaudio.pipelines.MMS_FA`; `align_ctc.py`, `align_roman.to_phones`,
   `align_service.py`; see `siksamitra/documents/audio-editing-and-matching.md`). It runs
   directly in the venv (torch/torchaudio CPU — no PyQt isolation needed outside the editor).
   Feed it the per-pāda IAST from **`tools/chant/extract.py`** → monotonic, non-overlapping
   per-verse `[start,end]`.
5. **Cut**: **`tools/chant/cut.py`** (preferred) snaps each inter-verse boundary to the local
   **energy dip** — the recitation is a continuous drone with no real silences — enforces
   monotonic non-overlapping cuts, and ffmpeg-re-encodes one mono 64 k mp3 per verse into
   `client/public/tests/<slug>/audio/`. (`tools/chant/split_audio.py` is a **proportional-split
   fallback — inferior**; it drifts. Use only when alignment is unavailable.)
6. **Wire it up**: add `recording.byVerse["<id>"] = {file,duration,label}` (durations from the
   cutter) and set `Doc.audioBase = "/tests/<slug>/audio/"`.

### 5C. Word-for-word grammar

7. **Attach `words[]`** with **`tools/chant/build_words.py`**. A word = a maximal run of `syl`
   tokens (exactly `ChantReader.chunkVerse`); the script **asserts its entry count equals the
   surface count** from `extract.json`, so grammar can never drift out of alignment with the
   tokens. Sandhi-fused surfaces carry **multiple `entries`**; a word spanning a line break
   carries analysis on **both halves**. Ground every parse in Monier-Williams + standard Vedic
   grammar (§0.2), flag genuine uncertainty in `note`, and derive `forms{deva,tel,tam}` per
   headword with `indic_transliteration`.

### 5D. Verbatim translation, provenance, publish

8. **Attach the VERBATIM translation** per verse (§0.1) and set **exact provenance** on the doc
   and every section (§0.3).
9. **Write** `client/public/chants/<slug>.json`; add the standalone `/tests/<slug>` route
   (§1) and **embed into the Library document** via the `.chant('/chants/<slug>.json', {title,note})`
   seed builder (§6); verify (§7).

**Shareable URL params**: the standalone reader syncs `?s=<primary>&s2=<secondary>&m=<mode>&v=<verseId>`;
the embedded reader opens fullscreen from a document `#chant` anchor.

A future **grammar/marking skill** (see [[project-grammar-skill]]) should automate 5A/5C and be
checked with a lighter model against the live rendered chant.

---

## 5E. Variable slots (the `deity` slot, and any future one)

A `{"t":"slot","name":"deity","tokens":[…]}` token renders its own `tokens` unless the
reader supplies a replacement (`ChantReader`'s `slots` prop). Three rules govern it.

**1. Substitution is precomputed PER VERSE, never per word.** A holding, an anusvāra and a
visarga are all decided from the letters *touching* the letter they mark, and that reach is
**radius 1**: the word before the slot and the word after it can have their marks changed by
what the slot is filled with (`āvāhitaṁ śrīdevaṁ` vs `…śrīgaṇeśaṁ`, `devaṁ dhyāyāmi` vs
`devīṁ dhyāyāmi`). Marking the slot word in isolation and pasting it in is therefore only
correct when the pipeline also declares that sandhi is **not** assimilated across the slot
boundary — which is what `gen_puja.py`'s `slotify` does today, and what
[`AUTHORING-SANKALPA.md`](./AUTHORING-SANKALPA.md) §2 states. If you ever want true
assimilation, precompute the whole verse once per candidate value; do not try to patch marks
at render time. **There is no runtime marking engine and there must not be one.**

**2. A slot counts as exactly ONE word.** `words[]` is aligned to the count of maximal `syl`
runs (§7's assert). Filling a slot with a two-word deity name must not shift the grammar
table by one, so `ChantReader.chunkVerse` gives every chunk inside a slot `wi = -1` and
increments the word index exactly once for the slot as a whole — and `gen_puja.py`'s
`surfaces_of` counts it the same way. Anything that emits a slot must preserve that
invariant, or every word popover after the slot describes the wrong word.

**3. An untouched preference is not a choice.** The pipeline emits the slot's own base
wording (`devaṁ`), and the reader must keep it until a reader has *actively* chosen. The
saṅkalpa's default deity (`parameśvara`) is a default, not a choice; letting it fill the
pūjā's slots rewrote the owner's liturgy to `śrī parameśvaraṁ dhyāyāmi` when his source
deck reads `asmin bimbe śrī devaṁ (or the chosen deity)`. Never let a default silently
re-voice authored text.

---

## 5G. Protected readings — **do not "correct" these**

A recension's own form often looks like a typo to anyone who knows another recension.
Every such form in a shipped chant is deliberate, and the generator carries a comment
beside it. Never normalise one silently; if you believe one is wrong, verify it against
an accented saṁhitā witness and change the **generator**, never the JSON.

The tradition here is **Taittirīya**. The page states one authentic source and no
cross-recension apparatus — the comparisons live in the generator, where they stop a
future agent from "fixing" the text, and nowhere else.

Currently protected in `tools/chant/gen_puja.py`:

| reading | where | status |
| --- | --- | --- |
| `vṛṣṇiyam` (`āpyāyasva…`) | `a-ksira` | **under verification** — may be a metrically restored Ṛgvedic form (van Nooten–Holland) mis-attributed to the Taittirīya. Frozen. |
| `dadhikrāvṇṇo` | `a-dadhi` | **under verification** — the geminate is a genuine Taittirīya intervocalic phenomenon and is probably right. Frozen. |
| `utoṣasi` | `a-madhu-2` | **under verification** — a locative where a Ṛgveda edition reads the ablative `utoṣaso`. Frozen. |
| `suvaḥ`, not `svaḥ` | `p-pranayama-vyahrti`, `p-pranayama-siras` | **under verification** — the Taittirīya reading. Frozen. |
| the praṇava's nasal before a sibilant | `p-pranayama-vyahrti` | printed Taittirīya spells it as the *gum* (`og̠ṁ suvaḥ`, `og̠ṁ satyam`). VU has no separate glyph for the gum — it **is** the anusvāra, and the engine paints it as one, so the source line is written `oṁ suvaḥ`. Writing `og̠ṁ` literally would be read as an anudātta on the `g`. |
| `śivatamo rasas … mātaraḥ` | `a-suddha-2` | settled — four saṁhitā witnesses to two against the ritual compilations. |
| Ṛgvedic `svāduḥ pavasva` in Taittirīya recitation dress | `a-sarkara` | settled — a Taittirīya reciter says it that way inside a Yajurvedic rite. |
| `maheśvara`, `tad astu te` | `c-kshama` | settled — the class deck's reading, and the manual teaches what he teaches. |

---

## 5H. The recension layer — Taittirīya anusvāra (the *gum*), DERIVED

`gen_marks.apply_anusvara` implements only the rule common to every recension:
`ṁ` assimilates to the homorganic nasal before a stop, and is otherwise kept.
The **recension-specific** layer of [`MARKING-RULES.md`](./MARKING-RULES.md) §4
had no implementation until **Viṣṇu Sūktam**, because the saṅkalpa and Pūjā
Vidhi are `smriti` register, where there is none.

`tools/chant/gen_vishnu.py` adds it as **`apply_vedic_anusvara()`** — opt-in, so
nothing already generated moves. Before `ś ṣ s h r` the Taittirīya recites the
anusvāra as the *gum*: `m̐` + superscript `gṁ` when a vowel follows, `g` when a
consonant follows, `gg` when a consonant follows **and** the preceding vowel is
a short `a i u`. Before `v` / `y` / `l` it keeps the anusvāra and takes the
reading aid `u` / `i` / `l`. It is **derived, never authored** — the rule
reproduces `purusha-suktam.json`'s stored shapes exactly, and reproduces the
witnesses' own `tveṣagg hy asya`.

**A praṇava or bīja is never assimilated** (§4, last row). That guard has to be
repeated in this pass — without it `oṁ śāntiḥ` came out as `om̐gṁ śāntiḥ`, which
no witness writes and which Puruṣa Sūktam contradicts.

**Feed it the UNDERLYING `ṁ`, never a pre-formed `m̐`.** The pass keys on the
anusvāra, so a candrabindu that is already in the source slips past it and ships
a gum with no reading aid. Accented Devanāgarī writes the gum as U+A8F3 `ꣳ`, so
any Devanāgarī import MUST map `ꣳ`/`ँ` → `ṁ` before the text reaches the
pipeline — see MARKING-RULES §"The Vedic anusvāra", which now sets out the
authored path and the derived path separately. The check that catches it: every
`sup`/`candra` shape a new chant emits should already occur in
`purusha-suktam.json`; a bare `{c:'m', candra:true}` with no `sup` does not.

**Deciding the recension is a real decision, not a default.** Viṣṇu Sūktam's
verses all stand in the Ṛgveda too, and a Ṛgvedic reading would forbid every
g-form. The evidence that it is Taittirīya is the gum itself: every witness
prints `rajā(gṁ)si`, `urukṣiti(gṁ)`, `tveṣa(gg) hy asya`. Record the evidence in
the generator, not just the conclusion.

## 5I. Carrying accents as DATA, not by eye

Svara for attested material is a transcription, and transcribing combining marks
by hand is the one step in this pipeline with no safety net. **`vishnu_convert.py`**
is the pattern to copy: it folds a witness's notation into VU's
(U+0332 → U+0331 and the letters), then **`respace()`** carries the witness's
accents onto a word-split **typed without accents**, and **reports every letter
where the two differ**. Each difference then has to be a declared decision.

For Viṣṇu Sūktam that produced exactly 22 differences in four classes and
nothing else: 18 × an underlying visarga restored so the marking engine
re-derives the sandhi itself (§5A-bis step 1); one recension spelling
(`śñaptre` → `śnaptre`); one word-final `-m` before a pause; one root-initial
`n` the witness spells as an anusvāra. Anything outside a declared class is a
transcription error, and this is how you see it.

## 5J. Verifying the TEXT against the recording — forced alignment as evidence

§5B uses forced alignment to *cut* the audio. It is also the only tool in this
pipeline that can tell you whether the text you have written is the text the
reciter actually says, and for a compiled document — where the printed editions
disagree with each other — it is the decisive witness. **Śiva Saṅkalpa Sūktam**
(`tools/chant/align_shivasankalpa.py`) is the reference for that use.

Three signals, in order of strength:

1. **The GAPS between consecutive mantras.** Align the whole track against the
   whole text and print `start`/`end` per mantra. A recitation at a steady pace
   produces a *constant* inter-mantra gap — 1.04–1.26 s across all thirty-nine
   here. **An outlier is a defect in the text, not in the audio.** A +3.10 s gap
   before mantra 37 was the first sign that the base edition orders mantras 36
   and 37 the other way round from the reciter.
2. **The per-mantra CONFIDENCE.** A mantra whose mean score collapses relative
   to its neighbours (here: .45 against a .78 median) is misaligned, which
   means its text is wrong.
3. **A/B RE-SCORING of the two readings.** This is what settles it. Take the
   window the aligner placed the mantra in, force-align *each* candidate reading
   against that window, and compare mean scores. The reading the reciter says
   scores higher, often by a wide margin (.786 vs .437 for the 36/37 order).
   `variant_test`-style scripts are a few lines around `MMS_FA.get_aligner()`.

### Checking the SVARA against the recitation — pitch, not phonemes

Forced alignment cannot see svara at all: MMS is a phonetic model with no notion
of tone. But **svara is pitch** — anudātta below the reciting tone, udātta on
it, svarita above — so the accents can be measured the same way the letters are.
`tools/chant/svara_check.py` is the tool: it aligns every SYLLABLE (one MMS
"word" per syllable), tracks F0 with `librosa.pyin`, takes the median over each
syllable's span, and converts it to semitones relative to the median of that
mantra, which is the reciting tone.

Read the OUTPUT AS A WHOLE first, not syllable by syllable. On Śiva Saṅkalpa's
1 672 syllables the stored anudātta measured low 86% of the time and high under
3%, and the stored udātta measured on the tone 86% of the time — that is the
transcription being confirmed, and it is what licenses trusting the residual.
**Do not read a low svarita agreement as an error rate**: the svarita is a
falling contour whose median sits near the tone, and in Taittirīya practice it
is often level with the udātta, so it scores ~46% by construction.

Then use it to rank, never to decide. Two queries earn their keep:

1. **The same word accented two ways inside one mantra.** Most such pairs are
   genuine — an enclitic `ca` is accented in one position and not in another —
   and the pitch track confirms them one by one. The one that does NOT track is
   the error. On this document that scan returned sixteen words and the pitch
   confirmed fifteen; the sixteenth was `parāt`, which the base edition marks
   dīrgha-svarita twice and anudātta the third time in the same śloka, and which
   the reciter sings alike all three times (+0.2 / +0.4 / +0.2 semitones against
   neighbouring anudāttas at −1.9 to −2.8). The owner heard it before the
   measurement did; the measurement is what made it safe to change.
2. **Syllables where an independent accented witness ALSO disagrees.** A single
   mark that both a saṁhitā and the pitch put elsewhere is a real error. A mark
   that only the saṁhitā puts elsewhere is a recension fork — record it, do not
   merge it (see §5K).

Octave errors are the pitch tracker's characteristic failure; anything beyond
about ±4 semitones is almost always a halving, not a finding.

### 5K. One recension, faithfully — and the fork recorded beside it

A compiled document will contain mantras that also stand in an accented saṁhitā,
and the saṁhitā will accent some of them differently from the way the rite
recites them. **Do not merge the two.** Śiva Saṅkalpa's six Vājasaneyi mantras
and seven Mahānārāyaṇa ones diverge from their saṁhitā witnesses on about eleven
syllables (`tāyáte`, `kṛṇvánti`, `suptásya`, …); adopting the saṁhitā accents
would produce a text nobody chants, and adopting a saṁhitā WORD without its own
accented witness in the right recension puts a mark on the wrong syllable — the
reason `ajiram` is recorded and not adopted at mantra 5. Follow one edition,
record the fork on the verse itself, and cite every coordinate the mantra has
(Vedic locus · Khila · Upaniṣad · the rite's own numbering) so a reader can see
which tradition they are in.

A fourth, weaker signal is a **greedy CTC decode** of the emissions with the
star token suppressed — a rough romanised transcript of what is on the tape. It
is very noisy (the MMS alphabet has no `v`/`ś`/`ṣ`/`ḥ`, so `viśvam` decodes as
`visbam`), and it is **evidence, never text**: use it to break a tie between two
candidate readings, never to author one.

**The editorial rule this produces**, which any compiled document should state:
follow ONE base edition; depart from it only where the reading is corroborated
AND the change moves no accent — that is, where it substitutes or drops letters
without changing the vowel-nucleus count, because the accents are the base
edition's and are indexed by nucleus (§5I). Anything that would add or remove a
nucleus stays with the base edition and is *recorded* instead. Record every
departure and every rejected variant beside the text.

**Do not put a mantra the recording does not contain into the aligned text.**
Śiva Saṅkalpa's closing hṛdaya nyāsa is printed in the editions but is not on
the Challakere Brothers track; including it dragged mantra 39's refrain into
1.2 s and pulled every boundary near the end. It ships in the document with no
audio, and the generator names it in `NOT_RECITED`.

**Cut gaplessly.** The clips should tile the recording — mantra N ends exactly
where N+1 begins — so a reader working through the reader hears no dead air and
no clipped syllable. `align_shivasankalpa.py --cut` snaps each boundary to the
local energy dip between the two aligned spans and enforces monotonicity.

---

### 5L. The second export family — when the PDF has *lost* letters

Not every VU-styled PDF is the CalibriLight family `pdf_marks.py` is calibrated
for. `gaNapatyatharvashIrSham v3.3 - IAST.pdf` is **Arial + URWPalladioITU**,
and four things differ — every one of which changes the DATA, not the looks. Its
reader is [`tools/chant/pdf_marks_gana.py`](../tools/chant/pdf_marks_gana.py);
the output shape is identical, so a generator written against one reads the other.

| | Calibri family (`pdf_marks`) | Arial family (`pdf_marks_gana`) |
| --- | --- | --- |
| grammar-engine transformation | blue `#0070C0` | **italic**, black |
| pause pipe | coloured `\|` | italic `\|` — the glyph disambiguates |
| candrabindu | a font-private code read back as `U+0001` | same code, different font |
| raised reading aid | superscript flag | `Arial,Italic` at **~10.3pt** — size, not colour |
| headings vs notes | gray vs black | **16pt vs 11pt** — a heading is never gray |

**Check which family a PDF belongs to before writing anything**: open it and
print the span fonts. Two minutes here saves an afternoon.

#### Letters flattened to outlines

The serious one. In this export **93 letters are missing from the text layer
entirely** — the exporter converted them to filled vector paths, so PyMuPDF's
`get_text` skips them and the sequence numbers simply jump. It reads
`tār[?]ṣyo`, `oṁ [?]ān[?]iḥ`, `vāṅ[?]ayas`, and in their place sits a blank of
the letter's own advance width. The letters are still perfectly legible; they
are just not text.

The tell: **the 93 are exactly the letters wearing a LONG holding box**, which
is also the check that the recovery is complete — the finished JSON must have
`hold: "long"` on precisely 93 units, and `_inject` raises if a recovered letter
lands anywhere but inside a long box.

How to read them back, and it is fast:

1. Enumerate every non-green filled path inside the body band and cluster the
   rects that touch — one cluster is one glyph (or one aspirate digraph).
2. **Replay each cluster's path onto a blank page and rasterise it.** This gives
   a pristine bitmap of just that glyph — no green box, no accent, no
   neighbours.
3. Tile them into one **contact sheet** with an index per cell and read it. 93
   letters at 3× fits on one image and takes a minute.
4. Cross-check every reading against the Sanskrit the context demands
   (`paśyemā-**k**ṣabhir`, `bhūr**bh**uvas`, `vāñ**ch**ita`). Two independent
   confirmations — the shape and the language — should agree on all of them. If
   they disagree anywhere, look again; do not average them.
5. Emit the table **from the reading**, keyed by the position the extractor
   computes `(page, round(y0), round(x0)) -> letter`, so no coordinate is typed
   by hand and a key collision is impossible. `extract()` asserts every entry
   fires, so a re-exported PDF fails loudly instead of shifting a letter into
   the wrong word.

Do not try to recover them from glyph IDs: a subset font extracted from a PDF
routinely has **no usable cmap** (`Font.has_glyph` returns 0 for every letter),
so it cannot be used to synthesise templates either. The paths are the source of
truth, and your eyes on a contact sheet are the reader.

#### The placeholder blank

The exporter leaves a space glyph occupying the missing letter's advance, so
naive re-insertion yields `paśyemā- kṣabhir`. The holding box wraps exactly that
advance, which is what identifies it: a blank lying inside the box is the slot
and is dropped; one that starts clearly to the LEFT of the box is a real word
space the exporter merged with the slot, and is kept and truncated.

---

## 5F. Step figures (the procedural drawings)

A step may carry an illustration of what it asks you to *do*. It is an ITEM of the step,
not part of any sentence — `{"t":"figure","ref":"<id>"}` — and its position in the item
list is the only ordering mechanism there is. A drawing that belongs to ONE mantra rather
than to the step goes immediately before that mantra (`gen_puja.py`'s `V(..., fig=…)`);
a drawing of the step as a whole stands at its head (`S(..., figure=…)`). Declare each one
once in `ChantDoc.figures` and address it by `ref`, so a drawing used at two steps ships
once.

**The house treatment**, identical for every one of them (`SFIG()` in `gen_puja.py`):

| axis | value | why |
| --- | --- | --- |
| file | transparent PNG under `client/public/figures/<doc>/` | it sits on the page ground |
| size on disk | **512 px on the long edge**, palette-quantised to **96 colours** | ~1 MB source → 20–65 KB |
| `frame` | `none`, `rounded: true` | no card, no plate, no border — the owner rejected those |
| `flow` / `size` | `start` / `small` | floats left of the mantra ≥768 px, full width below 520 px |
| `crop` | `square` for a square drawing, `auto` **with** `width`/`height` otherwise | reserves the aspect box before the file loads, so a figure never pushes the mantra being read down the screen |
| `alt` | what the drawing actually SHOWS | required, non-empty, never a repeat of the caption |

Install with the exact recipe the shipped figures were made by — it is reproducible byte
for byte:

```python
im = Image.open(src).convert("RGBA")
s  = 512.0 / max(im.size)
im = im.resize((round(w*s), round(h*s)), Image.LANCZOS)
im.quantize(colors=96, method=Image.FASTOCTREE).save(dst, optimize=True)
```

**Do not draw an outline for the dark theme.** These read by BODY COLOUR; an indigo contour
is only 1.5:1 on the dark ground, which is why there is no `srcDark` and no frame.

**Never show a picture of the wrong object.** The incense drawing at Dhūpam is not the lamp
at Dīpam and not the camphor at Karpūra-nīrājanam, however similar the gesture — each ārati
has its own drawing, and a step with no drawing of its own ships with none. The same rule
retired the ācamana drawing (it showed two people, and water cupped where it cannot be
sipped from) and keeps the pañcāmṛta plate away from madhuparkam.

**Inline for one step, its own line for several, and never the same drawing twice in a
row.** A drawing of a single step floats beside that step's text (`flow: start`). A drawing
that covers a GROUP or a sequence — the pañcāmṛta plate, which shows all five substances of
the seven-part abhiṣeka; the spoon-and-cup, which is pādya, arghya and ācamanīya alike —
must not float beside the first member's mantra, or it reads as a picture of that one
mantra. Give it `flow: block`, put it once at the head of the run, and let it introduce
what follows. **A figure repeated on consecutive steps reads as a rendering fault**, never
as instruction; the generator's own check is that no two adjacent figure items share a
`ref`.

---

## 6. Embedding in a Library document

Use the `chant` block (see [`AUTHORING-DOCUMENTS.md`](./AUTHORING-DOCUMENTS.md)):
in the seed builder (`server/src/lib/seed-kit.ts`) — `.chant('/chants/<slug>.json', { title, note })`;
the block renders a compact **track entry** that opens the full reader in a **fullscreen overlay**.
Seeded chant-bearing documents are **seed-owned**: `reconcileDocuments` re-syncs their body from the
seed on boot when it changes (list the slug in `CHANT_DOCS`). Standalone preview route:
`/tests/<slug>` (thin wrapper over `<ChantReader>`; `?embed=1` previews the in-document card).

---

## 7. Verification checklist

- `npm run build` + `npm run typecheck` pass.
- The JSON's shape matches `ChantReader.tsx`'s interfaces **field for field** (compare against
  `purusha-suktam.json`): token key sets, `Unit` keys, `Gram` keys, `hold` always paired with `hg`.
- **Word count per verse == number of `syl` runs in that verse** — assert it programmatically
  (`build_words.py` / `gen_puja.py` both do).
- Every `Section` has a `label`; svara appears **only** on verses classified metrical (§3.1).
- **No rendered line is long enough to wrap.** With `lineBreak: "source"` the reader breaks
  only at `{"t":"br"}`, so a long prose mantra with a single trailing daṇḍa becomes one line —
  assert a max IAST length per rendered line (~60 chars; Puruṣa Sūktam's p90 is 49) and insert
  `br` at a sense boundary. Changing the doc-level policy does not help: `"hemistich"` breaks at
  the daṇḍa, which is already at the end.
- A mantra that is **recited as a formula** ships with its frame spelled out — `oṁ sumukhāya
  namaḥ`, not a bare `sumukhāya` with the frame described in the section label. You must be able
  to chant straight from the reader.
- Reader renders in **all four scripts** (IAST/Devanāgarī/Telugu/Tamil): holdings box the right
  letters; svara strokes on the right vowels; svarabhakti dots OUTSIDE boxes; IAST superscripts do
  NOT appear in Indic scripts; secondary-script marks wash out with the grey text.
- **Check the Indic scripts by eye, not just IAST.** A rendering defect can be invisible in
  Latin and catastrophic in Devanāgarī/Telugu: the fixed-baseline holding box clipped 184/199
  Devanāgarī and 150/199 Telugu clusters while IAST was 1/29 clean, and every review that
  looked only at IAST passed it. The ink-overflow check is scriptable — measure each held
  cluster with a canvas (`actualBoundingBox*`) and assert it sits inside the drawn box.
- **Check at the largest font scale too** (`--fs: 1.8`), not only the default: a px-based
  stroke stops distinguishing short from long as the type grows.
- **No line is forced to wrap** on desktop; verse numbers never orphan.
- Every verse has a **verbatim** translation; every word has a **complete** parse; the popover
  headword shows in the selected script.
- Every section shows its **exact source**; the doc-level `source` is correct.
- Screenshot light + dark, desktop + tablet + phone (Puppeteer + Edge; see prior sessions).
