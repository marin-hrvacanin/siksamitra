# Chant content pipeline (scripts)

The reusable helper scripts behind the **proven** "VU-styled PDF → interactive
chant" pipeline that produced **Durgā Sūktam** (`client/public/chants/durga-suktam.json`
+ per-verse audio) and the **saṅkalpa** marks (`shared/src/sankalpa-marks.ts`).

Read **[`../../docs/AUTHORING-CHANTS.md`](../../docs/AUTHORING-CHANTS.md)** first —
it is the narrative guide; this folder is the tooling it refers to. Format rationale:
[`../../docs/CHANT-FORMAT.md`](../../docs/CHANT-FORMAT.md). Saṅkalpa specifics:
[`../../docs/AUTHORING-SANKALPA.md`](../../docs/AUTHORING-SANKALPA.md).

> **These are working starting points, not a turnkey CLI.** They were copied
> verbatim out of the Durgā Sūktam session, so **paths and per-chant data are
> hard-coded** (scratch dirs, the `durga-*` output names, the section assembly in
> `parse_chant.py`, the grammar tables in `build_words.py`, the fragment
> vocabularies in `emit.py`). For a new chant, **copy the script, edit the paths
> and the chant-specific data at the top, and re-run.** Nothing here is wired into
> the app build (`npm run build`/`typecheck` never touch `.py`).

## Śiva Saṅkalpa Sūktam — a text established from six editions and a recording

`gen_shivasankalpa.py` + `shivasankalpa_words.py` + `align_shivasankalpa.py` are
the reference for a **compiled** document: thirty-nine mantras whose printed
witnesses disagree, with the recitation used as a witness in its own right.

    PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
    "$PY" gen_shivasankalpa.py                 # -> client/public/chants/shiva-sankalpa-suktam.json
    "$PY" gen_shivasankalpa.py --surfaces      # re-derive the grammar keys
    "$PY" gen_shivasankalpa.py --lines         # every rendered line (no-wrap check)
    "$PY" align_shivasankalpa.py --audio <mp3>         # VERIFY: per-mantra spans, gaps, scores
    "$PY" align_shivasankalpa.py --audio <mp3> --cut   # write the per-mantra clips
    "$PY" pack_chants.py                       # minify, like every other chant

What is worth copying from it:

* the base edition's accented line travels in the generator as `w` and the
  document's own word-split spelling as `t`; `vishnu_convert.respace` carries
  the accents from one onto the other and **asserts** that every letter-level
  difference falls in a declared class (docs/AUTHORING-CHANTS.md §5I);
* declared departures from the base edition are string substitutions on `w`, so
  each one is visible, justified in the module docstring, and cannot silently
  move an accent;
* homographs are resolved per `(verse id, word index)` through `OVERRIDES`, the
  same mechanism `puja_words.py` uses;
* the alignment output is the **text check**, not just the audio cutter — see
  AUTHORING-CHANTS §5J.

## Prerequisites

- **Python:** the Śikṣāmitra venv, which already has `torch`/`torchaudio` (CPU),
  `indic_transliteration`, and the alignment helpers:
  `D:/Projects/siksamitra/.venv/Scripts/python.exe`.
- **Śikṣāmitra repo** (sibling, `D:/Projects/siksamitra/`) — provides:
  - `pdf_import.convert_pdf_to_html(path)` — extracts marked Quill HTML from a
    VU-styled IAST PDF (holdings, svara, change-style, pauses, svarabhakti, `<sup>`,
    candrabindu, verse numbers, translations).
  - `align_roman.to_phones(text)` + `align_ctc.py` / `align_service.py` — the
    MMS forced-aligner (`torchaudio.pipelines.MMS_FA`). See
    `D:/Projects/siksamitra/documents/audio-editing-and-matching.md`.
- **ffmpeg / ffprobe** on `PATH` (trim + re-encode + measure clips).
- **yt-dlp** on `PATH` (download the reference recitation), only for the audio step.

Set `PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"` and run each script with it.

## The scripts (run in this order)

| # | Script | Input → Output | What it does |
|---|--------|----------------|--------------|
| 1 | *(Śikṣāmitra)* `pdf_import.convert_pdf_to_html(pdf)` | `<slug>-iast.pdf` → `durga.html` | Marked Quill HTML from the VU IAST PDF. Run it as a one-liner with the venv python and save the string. |
| 2 | **`parse_chant.py`** | `durga.html` → `client/public/chants/<slug>.json` | Parse the marked HTML → **chant format v2** (letter-level `units[]` + typed marks, `sp`/`pause`/`bar`/`danda`/`num`/`br` tokens, sections→verses). Derives `deva`/`tel`/`tam` per syllable with `indic_transliteration` (Vedic accents stripped before transliterating; svara stays a data field). Marks map: `ql-holding-short/long`→`hold`, `U+0331/030D/030E`→svara anudātta/svarita/dīrgha-svarita, `ql-change-style`→`change`, `<sup>`→`sup`, candrabindu→`candra`, `·`→`sbhakti`. **Edit the title/subtitle/source/section assembly at the bottom for a new chant.** |
| 3 | **`extract.py`** | chant JSON → `extract.json` (+ stdout) | Per-verse **word surfaces** (runs of `syl` tokens — matches `ChantReader.chunkVerse`), plain IAST, and per-pāda IAST. Feeds both alignment (step 4) and the word-count assertions in `build_words.py` (step 7). |
| 4 | **`align.py`** | `<slug>-full.mp3` + `extract.json` → `align_out.json` | **MMS forced alignment** of the known per-pāda IAST to the recitation window → monotonic per-verse `[start,end]` spans. Run it *from this folder* so `extract.py` doesn't shadow stdlib `inspect`. Trim the sūkta window with ffmpeg first; set `W0/W1`. |
| 5 | **`cut.py`** *(preferred)* | `align_out.json` + window wav → `client/public/tests/<slug>/audio/durga-N.mp3` + `durations.json` | Snaps each inter-verse boundary to the local **energy dip** (the recitation is a continuous drone with no true silences), enforces monotonic non-overlapping cuts, re-encodes per-verse mono 64 k mp3, verifies measured durations. |
| 5b | **`split_audio.py`** *(fallback — inferior)* | window wav → per-verse mp3 | **Proportional** split by syllable count, snapped to local minima. Only use when alignment is unavailable; it drifts. Prefer `cut.py`. |
| 6 | *(hand)* paste `recording.byVerse` | `durations.json` → chant JSON | Add `{file,duration,label}` per verse under `recording.byVerse` and set `audioBase: "/tests/<slug>/audio/"`. |
| 7 | **`build_words.py`** | grammar tables + `extract.json` → chant JSON `words[]` | Attach per-word `words:[{surface,entries:[Gram]}]`, **asserting count == surfaces** so it always matches `chunkVerse` (word = maximal run of `syl` tokens). Sandhi-fused surfaces carry multiple entries; a word crossing a line break carries analysis on both halves. `forms{deva,tel,tam}` per headword via `indic_transliteration`. **The `W` dict is the durga content — replace it, grounded in Monier-Williams; flag uncertainty in `note`.** |

### No marked PDF? — `gen_puja.py` + `puja_words.py`

| Script | Output | What it does |
|--------|--------|--------------|
| **`gen_puja.py`** | `client/public/chants/puja-vidhi.json` | Builds a whole chant from **plain IAST typed into the script** — the case where no VU-styled PDF exists (Pūjā Vidhi came from a class slide-deck). Marks holdings + anusvāra + visarga with `gen_marks.mark()`, maps its `{t:'punct'}` to the reader's `danda`/`br`/`num` tokens, derives `deva`/`tel`/`tam` per syllable, applies **svara by the owner's positional convention** to the verses tagged `meter="anustubh"`/`"tristubh"` (all-or-nothing per verse; prose formulae are tagged `None` and take no svara), attaches `words[]` from the glossary, and asserts word count == `syl`-run count. `--surfaces` lists every distinct word surface with counts — the way to re-derive the glossary keys after editing the text. |
| **`puja_words.py`** | *(data)* | The per-word grammar for `gen_puja.py`, keyed by the **surface after** the anusvāra/visarga transforms (`devānāṅ`, `gurur`, `yas`, …). `gen_puja.py` fails loudly on any surface with no entry, so grammar cannot drift out of alignment with the tokens. `forms{deva,tel,tam}` derived per headword. |

### A whole marked PDF — `pdf_marks.py` + `gen_rudram.py` + `verify_rudram.py`

The path that produced **Śrī Rudram** (`client/public/chants/sri-rudram.json`) —
40 pages, 36 sections, 198 verses, 6 355 syllables, 1 900 holdings — straight
from the owner's own export, with no HTML round-trip and no re-derived marks.

| Script | Output | What it does |
|--------|--------|--------------|
| **`pdf_marks.py`** | *(library)* | **VU-styled IAST PDF → paragraphs of marked events.** Reads PyMuPDF at character granularity, clusters rows, lifts the green holding boxes out of the vector layer and the coloured pause pipes out of the text layer, and splits the owner's 11pt gray-italic ANNOTATIONS (mudrā directions, per-verse loci, marking remarks) out of the 16pt chant rows — a structural split, not a regex. Run it directly for a summary of any VU PDF. |
| **`gen_rudram.py`** | `client/public/chants/sri-rudram.json` | Assembles the events into **chant v3**: parts from the PDF's title rows, sections from its subtitles, verses closed by prose / a blank line / a per-line direction, translations joined across wrapped lines and bound 1:1 to the nyāsa mantras, annotations mapped through one hand-built `ANN` table (closed — an unlisted annotation raises). |
| **`verify_rudram.py`** | *(report)* | **Round-trips the JSON back to text and diffs it against the PDF, row by row.** 553/554 identical; the one difference is the documented `॥ 11.11॥` → `॥ 11.10॥` correction. Also checks mark totals, that no aspirate digraph got split, and that every syllable has all four scripts. |


### The *other* export family — `pdf_marks_gana.py` + `gen_ganapati.py`

The path that produced **Gaṇapati Atharvaśīrṣa**
(`client/public/chants/ganapati-atharvashirsham.json`) — 7 pages, 9 sections,
20 verses, 1 248 syllables, 405 holdings, 458 fully-parsed words — from
`gaNapatyatharvashIrSham v3.3 - IAST.pdf`.

That PDF is **Arial + URWPalladioITU**, not the CalibriLight family `pdf_marks`
is calibrated for, and it differs in four ways that change the DATA: the
transformation is set in *italic* rather than blue, the raised reading aid is
told apart by SIZE (~10.3pt) rather than colour, headings are 16pt where notes
are 11pt, and — the one that loses data — **93 letters are flattened to vector
outlines and are missing from the text layer entirely**. The full calibration,
and how the 93 were read back off a contact sheet of their own paths, is in
[`../../docs/AUTHORING-CHANTS.md`](../../docs/AUTHORING-CHANTS.md) §5L and in
the `pdf_marks_gana` docstring.

| Script | Output | What it does |
|--------|--------|--------------|
| **`pdf_marks_gana.py`** | *(library)* | The Arial-family sibling of `pdf_marks`. Same output shape, so a generator written against one reads the other. Re-inserts the 93 flattened letters from the closed `OUTLINED` table, keyed by `(page, y0, x0)`; `extract()` asserts every entry fires, and `_inject` raises if a recovered letter does not land inside a LONG holding box. Run it directly for a summary. |
| **`gen_ganapati.py`** | `client/public/chants/ganapati-atharvashirsham.json` | Assembles the events into **chant v3**. Sections come from the source's own two 16pt headings and five 11pt italic labels (`LABELS`, closed); one division is EDITORIAL and declared as such (`SPLIT_AFTER` opens *phalaśruti* after mantra 10). Annotations map through `ANN` — the loci become `verse.source`, the `p.b.` variant readings become verse notes, the svarabhakti markers are dropped because the dot itself is in the data. `--surfaces` lists every word surface for `ganapati_words.py`. |
| **`ganapati_words.py`** | *(table)* | 301 surfaces / 458 words. Carries two things this source forces: compounds the owner writes with a space (first member gets an `other` entry, the member with the ending gets the parse), and `tuṣṭuvāṁsas`, which the gum breaks in two — both halves share ONE entry. |

Verification: the JSON round-trips to **106/106 identical rows** against the PDF
(the only differences are marks the format stores as flags rather than
characters — the pause pipe, the candra letter, the svarabhakti dot), holdings
are 312 short + **93 long — exactly the 93 recovered letters**, every box covers
exactly one letter, no aspirate digraph is split, and all four scripts are
present on every syllable.


**Two things `pdf_import.convert_pdf_to_html` gets wrong for this purpose**, both
of which change the data and both of which `pdf_marks` fixes:

1. it **re-sorts each row by x-coordinate**, and in this export the accent glyph
   sits a hair to the right of the letter after it — so `śuklā̍m` becomes
   `śuklām̍`. **111 of 1 214 rows** carried at least one displaced mark. Document
   order is correct; `pdf_marks` keeps it and never sorts. Verified 1 214/1 214
   against PyMuPDF's own text layer;
2. it lets a **holding box cover two consonants** — 71 of the 2 081 boxes here.
   Every box in every shipped VU chant covers exactly ONE letter, and
   MARKING-RULES §2.1 step 4.1 names the host for this case, so the box is
   narrowed to the first consonant of the pair at the import boundary.

`bhagya-suktam.json` still carries one such box (`cch`) from the older HTML path
— the only one left in the library.

### Audio for a long text, from two takes — the Śrī Rudram pipeline

The Namakam and the Camakam are separate recordings (Challakere Brothers,
19:52 and 10:36) covering different halves of one 198-verse document. 136 clips
in `client/public/tests/sri-rudram/audio/`; 62 verses have no recitation and
correctly carry no audio.

```bash
PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
# 1. carve the part each take actually contains, dropping what is not sung
"$PY" align_subset.py --chant ../../client/public/chants/sri-rudram.json     --out namakam.json --sections srirudraprasnah-01 …     --drop srirudraprasnah-08-v1 srirudraprasnah-srirudraprasnasyopasamhara-v8
# 2. align (per-line, adaptive; the alignment-tuned model, NOT the default)
"$PY" align_sanskrit.py --chant namakam.json --audio "<take>.mp3"     --audio-out <dir> --slug sri-rudram --report mms-report.json     --model MahmoudAshraf/mms-300m-1130-forced-aligner
# 3. gate on the checks a confidence number hides
"$PY" drift_check.py --report mms-report.json --syllables namakam.json     --compare rb-nam.json
# 4. byVerse from the REPORT (traceable to the run that cut the mp3s), then merge
"$PY" byverse_from_report.py --report mms-report.json --into namakam.json     --slug sri-rudram --audio-dir <dir>
MSYS_NO_PATHCONV=1 "$PY" merge_recording.py     --into ../../client/public/chants/sri-rudram.json     --from namakam.json camakam.json --audio-base "/tests/sri-rudram/audio/"
```

**Establish what the take CONTAINS before aligning it.** Greedy-decode the
acoustic model at the head, the middle and the tail and read it — a forced
aligner cannot skip, so text that is not in the audio is squeezed to nothing and
*steals time from its neighbours*. Two passages of the owner's Rudram are not
sung on these takes (`oṁ hara hara hara hara hara oṁ` opening the eighth
anuvāka, and the shortened repeat `namo rudrāya viṣṇave mṛtyurme pāhi`), and one
parenthesised word (`(śaṅkarāya)`) is not either.

**Low confidence is not the same as bad timing.** The Camakam's eleventh anuvāka
— the numeral list `ekā ca me tisraś ca me…` — scores 0.20–0.34, the worst in
either take, and its clips are exactly right: a repetitive numeral string is what
a CTC model scores badly while aligning correctly. Decode the clip before
"fixing" it.

**Two traps, both now closed in the tools:**

1. **`align_robust.py` used to patch the chant JSON unconditionally.** Run as a
   cross-check it therefore *overwrote the aligner-under-test's own* `byVerse`
   and clip filenames, in the very file about to be merged. It now needs
   `--write`, like `align_sanskrit.py`. This is also why step 4 rebuilds
   `byVerse` from the report and verifies each mp3's duration against it.
2. **`align_sanskrit.py` named clips by the last segment of the verse id.** Fine
   for a one-section sūkta (`v-3` → `3`); in a document whose sections each
   restart at `v1` it collapsed 79 clips onto 18 filenames. It falls back to the
   full verse id when the short form collides.

Measured on these takes: median 0.374 s/syllable (Namakam) and 0.338 (Camakam),
mean confidence 0.70 for both, monotonic, no tempo outliers, tempo trend +12.5%
and +5.0% across the takes (ordinary recitation, not drift).

### A nāmāvalī — `gen_lakshmi.py` + `lakshmi_words.py`

| Script | Output | What it does |
|--------|--------|--------------|
| **`gen_lakshmi.py`** | `client/public/chants/lakshmi-ashtottara.json` | The **Śrī Lakṣmī Aṣṭottara Śatanāmāvalī** — 2 dhyāna ślokas + the 108 names as `oṁ <name in the dative> namaḥ`. The pattern to copy for **any aṣṭottara / sahasranāma**, where the whole text is one repeated construction. Its own contributions: the **register decision lives in one constant** (`SVARA = None`) with the reasoning beside it, because a nāmāvalī is prose-register (MARKING-RULES §3.3) and the dhyāna's metres (śārdūlavikrīḍita, puṣpitāgrā) have no positional preset — so the document ships with *no* svara at all, rather than half-marked; and the **section per śloka of the source stotra**, which is what makes the count checkable — 8+12+9+8+7+8+7+9+8+8+7+6+6+5 = 108, asserted in `build()` together with the printed edition's decade marks. Writes minified, like `gen_puja.py`. |
| **`lakshmi_words.py`** | *(data)* | The per-word grammar, keyed by the post-sandhi surface (`viṣṇuvakṣassthalasthitāyai`, `hariharabrahmādibhis`, `maṇigaṇair`, …). 108 of the 135 surfaces are the same shape — feminine, caturthī, ekavacana — so the helper `N()` writes that once and each entry differs only by stem class and compound analysis. |

**A nāmāvalī is its own document, and the pūjā RESOLVES it.** Never copy names
into `gen_puja.py`. Each garland is a chant document of its own; the pūjā
carries ONE nāmāvalī step (`upa-11-namavali`) holding an embed with
`src={"module":"namavali"}` and no `select`, and the reader looks the chosen
deity up in `shared/src/namavali.ts` and renders that whole document — dhyāna
included, because a nāmāvalī's dhyāna belongs to it.

**Publishing the next deity's garland is: generate the document, add one line
to `shared/src/namavali.ts`, seed its Library page.** Nothing in `gen_puja.py`
changes and nothing in the reader does. Gaṇapati's eighteen names are still
AUTHORED in `gen_puja.py` (`GANESHA_NAMAVALI`) because that is where the
owner's deck put them, but they are built by the same pipeline and lifted out
by `write_namavali()` into `/chants/ganesha-ashtottara.json`, so there is one
copy of that text and not two.

**Svarabhakti is now in the engine.** `gen_marks.mark()` applies it (a dot on a
`ś ṣ h` directly preceded by `r` — the rule measured off the owner's own files,
8/8 of his dots reproduced, no false positive available). It moves no box, so
`--selftest` stays 29/29 and `diverge.py` stays 510/534. **`emit.py` is the one
generator that cannot currently be re-run** — it aborts on a pre-existing
self-check (`join 'oṃ' + 'śubhe śobhane muhūrte': unexpected joined shape`,
identical before this change) *before* writing `shared/src/sankalpa-marks.ts`,
so that table is stale by six svarabhakti dots (`pārśve` in the BHARATA
fragment, `varṣā`, `mārgaśīrṣa`, `harṣaṇa`). `coords.py` runs clean and is
current.

**Reading a preset off the owner's PDFs.** Every `client/public/library/*-iast.pdf`
carries the svaras as real combining characters and labels each section with its
chandas, so a positional preset for a metre he has marked can be MEASURED
rather than invented — see MARKING-RULES §3.2a, which is how the
śārdūlavikrīḍita and puṣpitāgrā presets got there. Validate any such harness on
his anuṣṭubh material first: it must reproduce the documented preset 35/35.
Caveat learned the hard way: **the PDF text layer drops the letters inside
holding boxes**, so an extraction is trustworthy for svaras and not for
holdings.

**Anusvāra register matters more than it looks.** This text is smārta/āgamic, so `smriti`: the anusvāra assimilates before a stop and is otherwise **kept and unpainted** (matching `puja-vidhi.json`, 114/114). Do **not** reach for `gen_vishnu.apply_vedic_anusvara` — the *gum* is the Taittirīya layer and applying it here would invent g-forms no witness writes.

See [`../../docs/AUTHORING-CHANTS.md`](../../docs/AUTHORING-CHANTS.md) §3.1 (the two svara
registers + the positional pattern) and §5A-bis (this pipeline, step by step).

**Never hand-edit `puja-vidhi.json`.** It is generated; edit `gen_puja.py` /
`puja_words.py` and re-run. The output must be **byte-deterministic** — run it twice and
`cmp` the two files before committing.

**`gen_marks.py --selftest`** is the holding regression suite (14 cases read off the owner's
own files). Run it before and after any change to `selectHoldingComponent`. It pins the four
ways cross-word holdings have been got wrong — see MARKING-RULES §2.1, *The four ways this
has been got wrong* — and the rule that **a pause ends a cluster**, so `oṁ | sumukhāya`
takes no holding while `upavītaṁ samarpayāmi` takes one on the `s`.

**Comparing against an existing chant JSON?** Invert the anusvāra/visarga substitutions
first (`change: true` units: `ṅ ñ ṇ n m` → `ṁ`, `ś ṣ s r` → `ḥ`). The files store the
post-sandhi letters, and §7 puts holdings *before* those substitutions — feeding them back
in raw turns a `ḥ`+`ś` contact into a false dvivarcana and inflates the disagreement count
from 26 to 61.

### Saṅkalpa marks (separate, offline)

| Script | Output | What it does |
|--------|--------|--------------|
| **`gen_marks.py`** | *(library)* | The offline saṅkalpa **marking engine**: applies **holdings + anusvāra + visarga** (NO svara/pauses/svarabhakti) to plain IAST fragments → `MarkToken[]`. Run directly for a self-test (`python gen_marks.py`). |
| **`emit.py`** | `shared/src/sankalpa-marks.ts` | Marks every fixed clause + option-vocabulary fragment (imports `mark` from `gen_marks.py`), validates holding counts against the live chant JSON, and writes the auto-generated `SANKALPA_MARKS` table. Re-run after editing the fragment vocabularies. |
| **`coords.py`** | `shared/src/sankalpa-coord-marks.ts` | Marks every server-computed pañcāṅga **coordinate** phrase (all 60 saṃvatsaras, ayana, ṛtu, māsa incl. adhika, pakṣa, tithi, vāra, 28 nakṣatras, 27 yogas, 11 karaṇas) on its full assembled locative form (imports `mark`/`norm` from `gen_marks.py`), and writes the auto-generated `SANKALPA_COORD_MARKS` table keyed by normalised IAST. `server/src/lib/sankalpa/coordinates.ts` looks marks up by key and attaches them. Re-run if the coordinate vocabularies in `coordinates.ts`/`prokerala/reference.ts` change. |

## Reproducing the audio step end-to-end (sketch)

```bash
PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
# 1. download the reference recitation
yt-dlp -x --audio-format mp3 -o "<slug>-full.mp3" "<youtube-url>"
# 2. parse PDF-derived HTML → JSON, then extract surfaces/padas
"$PY" parse_chant.py && "$PY" extract.py
# 3. align (from THIS dir) then cut
"$PY" align.py && "$PY" cut.py
# 4. attach grammar
"$PY" build_words.py
```

## Robust aligner (`align_robust.py`) — preferred over `align.py`

A non-accumulating, confidence-scored replacement for the single global forced
pass in `align.py`. It (1) runs a global pass only to get verse ORDER, then
RE-ANCHORS each verse in its own padded local window (so a mis-chanted /
elongated / repeated verse cannot drag the others — error can't accumulate past
a boundary); (2) places each inter-verse cut on the lowest-energy point (the
BREATH) in a window spanning both verses' edge uncertainty, so a clip never
grabs the next verse's first word or cuts short, and the final verse extends to
end-of-voice; (3) emits per-verse CONFIDENCE, a detected LEADING GAP (an intro
oṁ the text doesn't cover, left as a gap instead of force-matched), **per-pāda
offsets** (`recording.byVerse[id].lines: [{start,end}]`, relative to the clip —
the ChantReader uses these for per-pāda play + karaoke highlight), the cut mp3s,
and a review HTML.

```bash
PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
"$PY" align_robust.py --chant ../../client/public/chants/<slug>.json \
   --audio <slug>-full.<ext> --audio-out ../../client/public/tests/<slug>/audio \
   --slug <slug> --report out.json --review review.html
```

Proven on Bhāgya Sūktam: 9 verses, 3.57 s intro correctly left as a leading gap,
mean confidence ~0.80. `parse_bhagya.py` is the Bhāgya-specific parser (a
generic-single-section variant of `parse_chant.py`).

## Sanskrit-model aligner (`align_sanskrit.py`) — PREFERRED for chant

The strongest pipeline. Forced-aligns the known text against a **Sanskrit-domain
wav2vec2 CTC model** (`MahmoudAshraf/mms-300m-1130-forced-aligner`, purpose-trained
for alignment) via pure-torch `torchaudio.functional.forced_align` — no C-extension
libs. Findings that shaped it: a generalist model (MMS_FA) and a read-speech
Sanskrit STT model (`addy88/…`, conf ~0.16) both underperform; the alignment-tuned
MMS model fits chant (conf ~0.79) and detects the intro gap.

Segmentation is **per line** and **fully ADAPTIVE — no hardcoded seconds/energies**.
Every scale comes from the signal: tempo = median syllable spacing; the systematic
**CTC emission delay is measured from this recording** (median of `ctc_onset −
nearest acoustic attack`). Each line boundary is placed at the precise onset of the
next line's first syllable: the CTC alignment says WHICH syllable, the measured
delay is removed, and it snaps to the nearest **spectral-flux ATTACK** (delay-free
ground truth). Because a **held final syllable stays high-energy, the cut lands at
the next line's attack — after the hold, never mid-hold**. Needs `transformers` in
the venv.

```bash
PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
"$PY" align_sanskrit.py --chant ../../client/public/chants/<slug>.json \
  --audio <slug>-full.<ext> --audio-out ../../client/public/tests/<slug>/audio \
  --slug <slug> --model MahmoudAshraf/mms-300m-1130-forced-aligner \
  --review review.html --write        # --write patches recording.byVerse + audioBase
```

## Alignment Studio (`align_studio.py`) — manual editor, the reliable finisher

Automatic alignment is only ever a *starting point*; continuous chant with
holdings needs a human to place the final line boundary. This is a **dev-only,
local** tool (never shipped) that any developer can run with their Claude:

```bash
python align_studio.py --chant ../../client/public/chants/<slug>.json \
    --audio "<youtube-url|local-file>" --slug <slug>
```

It (1) runs the automatic aligner for a rough cut, (2) opens a **local web editor**
(`http://127.0.0.1:8756`) where each line is rendered in the **same brand style as
the site** (it inlines `chant.css`) with a **draggable audio-cutter** under it —
drag the start/end handles, press ▶ to hear just that line — and (3) **Save &
export** re-cuts the per-verse audio from the source and writes the adjusted
`recording.byVerse` (+ per-line offsets) straight back into the chant JSON. Work
files live in `.studio/` (git-ignored). `--build-only` runs the align + writes the
editor HTML without serving (for inspection).

No secrets live in these scripts. The Prokerala/media/OAuth credentials the app uses
are unrelated to this pipeline — keep them out of anything committed here.
