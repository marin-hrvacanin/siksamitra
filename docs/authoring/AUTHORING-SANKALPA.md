# Authoring the Saṅkalpa (the first variable module)

How the **saṅkalpa** — the ritual statement of intent recited before an observance —
is composed, marked and rendered.

Two things make it different from a chant, and both matter more than they sound:

1. It is **variable**. A chant is a file; the saṅkalpa is *composed at render time*
   from the day's pañcāṅga, the reciter's own details and a handful of enum choices.
2. It is nevertheless **not a second renderer**. It composes a `ChantDoc` — the same
   marked-text contract a chant JSON satisfies ([`shared/src/chant.ts`](../shared/src/chant.ts))
   — and hands it to the one `ChantReader`. It therefore looks *identical* to every
   other Veda Union text, because it is drawn by the same code.

> **Why that second point is stated so firmly.** The first version had its own
> renderer (`MarkedText.tsx`) and its own CSS. Its line style set a hanging indent
> (`text-indent: -1.1em`), which inherits into every descendant block box — including
> each `.hold` holding box, an `inline-block`. An inline-block's shrink-to-fit width
> is its content width *plus* the text-indent, so every box computed to zero width
> and printed its letters on top of the preceding word. In Devanāgarī, where every
> akṣara is an inline-block, the entire text collapsed into an unreadable pile.
> Marked text is the reader's job. Do not grow a second path.

Surfaces:

| What | Where |
| --- | --- |
| Composer + vocabularies + levels | [`shared/src/sankalpa.ts`](../shared/src/sankalpa.ts) |
| Marked-text contract (tokens, slices, slots) | [`shared/src/chant.ts`](../shared/src/chant.ts) |
| Precomputed fragment marks (generated) | [`shared/src/sankalpa-marks.ts`](../shared/src/sankalpa-marks.ts) |
| Precomputed pañcāṅga coordinate marks (generated, **server-only**) | [`shared/src/sankalpa-coord-marks.ts`](../shared/src/sankalpa-coord-marks.ts) |
| Coordinate builder | [`server/src/lib/sankalpa/coordinates.ts`](../server/src/lib/sankalpa/coordinates.ts) |
| The module (controls + reader) | [`client/src/components/sankalpa/SankalpaModule.tsx`](../client/src/components/sankalpa/SankalpaModule.tsx) |
| Standalone page | [`client/src/pages/Sankalpa.tsx`](../client/src/pages/Sankalpa.tsx) — `/sankalpa`, a "secret" route omitted from nav |
| Document block | `Sankalpa` in [`client/src/components/editor/blocks.tsx`](../client/src/components/editor/blocks.tsx); seed helper `.sankalpa()` in [`server/src/lib/seed-kit.ts`](../server/src/lib/seed-kit.ts) |
| Offline generators | [`tools/chant/`](../tools/chant/) — `gen_marks.py`, `tokens.py`, `emit.py`, `coords.py` |

---

## 1. Shape — three levels, one set of fragments

A **fixed template** with **user-selectable enum fragments**, a few **computed
coordinates**, and some **free text**. It comes in three lengths, and each level is a
strict superset of the one before it — built from the same fragments, never from three
near-duplicate templates:

```
simple    [kartṛ resolve] · śrī-[devatā]-prīty-arthaṃ · śrī-[devatā]-[karma]ṃ kariṣye ||

standard  [maṅgalācaraṇa] · oṃ śubhe śobhane muhūrte
          · [deśa — place]
          · [kāla — saṃvatsara, ayana, ṛtu, māsa, pakṣa, tithi, vāra, nakṣatra,
             yoga, karaṇa]                                              (all locative)
          · evaṃ guṇa-viśeṣaṇa-viśiṣṭāyāṃ asyāṃ śubha-puṇya-tithau
          · [gotra] gotrotpannaḥ [nāma] nāmā ahaṃ                       ← FREE TEXT
          · mama upātta-samasta-durita-kṣaya-dvārā śrī-[devatā]-prīty-arthaṃ
          · [kāmanā] · [frame] śrī-[devatā]-[karma]ṃ kariṣye ||

maha      standard + the cosmic-time preamble
          (ādya brahmaṇo dvitīya-parārdhe … kali-prathama-caraṇe)
```

`simple` is the short form said in daily pūjā — it is exactly what the Pūjā Vidhi class
material teaches at preparatory step 3, which is why the Pūjā Vidhi manual embeds the
module **at that level**. It needs **no pañcāṅga at all**, so it renders with no network
request; a higher level asked for before the coordinates arrive degrades to `simple`
rather than rendering nothing.

- **Fixed clauses** (`MANGALA`, `MUHURTA`, `PREAMBLE`, …) and **option vocabularies**
  (`TRADITIONS`, `DEITIES`, `KARMAS`, `KAMANAS`, place templates) are enumerated in
  `sankalpa.ts`. Each is a `SankalpaTerm { iast, deva, marks? }`.
- **Declension is AUTHORED DATA, never derived.** `KARMAS.puja.iast` is `'pūjāṃ'`
  (accusative, the object of *kariṣye*), not `'pūjā'` + a rule. Likewise every deity
  carries an `acc` — its accusative singular — for the standalone `deva` slot in the
  pūjā mantras. Do not add morphology generation. Add the form by hand and mirror it in
  `emit.py`.
- **Time/place coordinates** depend only on date + location and are computed
  **server-side from the pañcāṅga**; they arrive as ready locative phrases. See §3.1.
- **Free text** — the reciter's name, gotra, place — is **never marked and never
  transliterated**. It renders as a `{"t":"text","fill":true}` token: a `.fill` dotted
  underline that says "your input", identical in every script.

---

## 2. The marking rule (what differs from a chant)

Saṅkalpa marks apply **holdings + anusvāra + visarga only**:

- **holdings** (`hold` + shared `hg`) — the tight box, exactly as in the chant reader;
- **anusvāra** (`ṁ`) — homorganic assimilation to the following stop (→ `ṅ/ñ/ṇ/n/m`),
  rendered in the **change** colour;
- **visarga** (`ḥ`) — sandhi to `ś/ṣ/s/r` (or upadhmānīya `sup:"f"` before `p/ph`),
  in the change colour;
- **NO svara**, no svarabhakti, no `jñ/sv/vy` reading insertions. A saṅkalpa is spoken
  prose, not a metrically-accented recitation (MARKING-RULES §3.3).

> The same `gen_marks.mark()` engine is reused outside the saṅkalpa: **Pūjā Vidhi**
> (`client/public/chants/puja-vidhi.json`, built by `tools/chant/gen_puja.py`) marks its
> mantras with exactly this rule, and then applies svara as a **separate** pass on the
> metrical ślokas only — see [`AUTHORING-CHANTS.md`](./AUTHORING-CHANTS.md) §3.1.

### 2.1 Fragments are pieces of a line, and the JOINS are precomputed

A fragment is marked on its own so the vocabularies stay independently editable — but
a fragment is **a piece of a line, not a line**, and marking it blind to its neighbours
used to get two things wrong. Both are now handled, and neither needs a runtime engine.

**The join.** `pūjāṃ` + `kariṣye` is not `pūjāṁ kariṣye`: the anusvāra assimilates to
the following stop and the cluster that straddles the space takes a box — it is recited
**`pūjāṅ kariṣye`**, with the holding on the `k`. `emit.py` therefore marks every
adjacent pair the composer can produce (its `adjacency()` mirrors `composeSankalpa`)
and emits the two boundary syllables that change into **`SANKALPA_JOINS`**, keyed
`"left|right"`. `lineTokens` swaps them in as it assembles the line: the left
fragment's last syllable and the right fragment's first. The patch is per pair and
never reaches past those two syllables (`emit.py` fails the build if it ever does), so
a chain — `śrī · [devatā] · [karma] · kariṣye` — composes correctly pair by pair.
There are 38 such joins today; most are `[karma]ṃ + kariṣye` and the long/short
correction on a fragment whose first cluster now has a preceding vowel to measure from.

**The line-initial cluster.** The owner's rule — a verse/line-initial cluster is never
boxed (MARKING-RULES §2.1 step 3b) — is a property of the LINE, which a fragment cannot
know: `prīty-arthaṃ` opens a line in one place and sits mid-clause in another. So both
generators mark with `gen_marks.RULES['no_initial_box'] = False` (`emit.py`,
`coords.py`), and the composer applies the suppression exactly once, to whichever
fragment actually opens the rendered line (`dropInitialClusterBox` in `sankalpa.ts`).

**What is still marked blind:** a variable **slot** (§4) whose replacement is dropped
into a pre-marked mantra, and a fragment adjacent to **free text** (a join cannot be
precomputed against a name the reciter types). Both are accepted.

> **A daṇḍa is a word, and is spaced like one.** Every chant JSON stores it as
> `sp · danda · sp`; `gen_marks.emit_tokens` now does the same. Without the spaces the
> reader printed `namaḥ।hariḥ`.

---

## 3. How the marks are produced (offline)

Marks are **generated offline and are byte-deterministic**. There is **no runtime
marking engine** anywhere in the app.

The pipeline is three files:

- **`tools/chant/gen_marks.py`** — the marking engine (holdings + anusvāra + visarga),
  a faithful port of Śikṣāmitra's `sanskrit_rules.js`. See [`MARKING-RULES.md`](./MARKING-RULES.md).
- **`tools/chant/tokens.py`** — the ONE place an IAST fragment becomes reader tokens:
  derives the Devanāgarī / Telugu / Tamil form of every syllable with
  `indic_transliteration`, finishes the anusvāra rules, and emits the reader's typed
  daṇḍa. `emit.py`, `coords.py` and `gen_puja.py` all go through it, so every marked
  text in the app is produced by the same code.
- **`tools/chant/emit.py`** — marks every saṅkalpa fragment and writes
  **`shared/src/sankalpa-marks.ts`** (`SANKALPA_MARKS`, an auto-generated file — never
  hand-edit). It also validates the holding derivation against the owner's own chants
  before writing.

Run with the Śikṣāmitra venv python (needs `indic_transliteration`):
```bash
"D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/emit.py
```

`sankalpa.ts` then attaches each `SANKALPA_MARKS.<KEY>` to the matching
`SankalpaTerm.marks`. Keys: the fixed-clause names, `trad:<k>:opening`,
`trad:<k>:frame`, `deity:<k>`, `deity-acc:<k>`, `karma:<k>`, `kamana:<k>`.

### 3.1 Coordinate marks (server-computed phrases)

The pañcāṅga **coordinate** terms are assembled server-side, so their marks live in a
separate generated table. **`tools/chant/coords.py`** enumerates every possible
assembled locative phrase (all 60 saṃvatsaras; ayana; ṛtu; māsa incl. `adhika-`; pakṣa;
tithi; vāra; 28 nakṣatras; 27 yogas; 11 karaṇas), marks each **full assembled phrase**
with the same engine, and writes **`shared/src/sankalpa-coord-marks.ts`**
(`SANKALPA_COORD_MARKS`), keyed by the **normalised IAST** (lower-case, ṃ→ṁ,
hyphens→spaces, collapsed).

`server/src/lib/sankalpa/coordinates.ts` normalises each term's assembled `iast` the
same way and attaches `marks` by look-up — **never marked at runtime**. Its coordinate
vocabularies (`SAMVATSARA`/`RITU`/`MASA_*`/`TITHI_LOC`/`VARA_GRAHA` + the
nakṣatra/yoga/karaṇa IAST from `server/src/lib/prokerala/reference.ts`) must mirror the
lists at the top of `coords.py`.

```bash
"D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/coords.py
```

**That table is SERVER-ONLY.** It is ~200 kB and is *not* re-exported from the
`@vedaunion/shared` barrel; it is reached through the `@vedaunion/shared/sankalpa-coords`
subpath, so it never lands in the browser bundle. The server ships only the day's ten
phrases, with their marks inline, over `GET /api/sankalpa/coordinates`.

---

## 4. Rendering, embedding, and the deity slot

`composeSankalpa(coords, opts)` returns a `ComposedSankalpa`: flat text per script (for
the Copy button) plus **`doc`**, a `ChantDoc`. `SankalpaModule` renders the controls and
hands `doc` to `<ChantReader doc={…} embedded bareControls />`. The document declares
`features: { audio: false, grammar: false, translation: false }`, so the reader hides
the controls that would do nothing for a composed module.

**Embedding.** The module is mounted in exactly two places, and they are the *same
component*: `/sankalpa` (standalone) and the `sankalpa` document block. The Pūjā Vidhi
manual uses the block at preparatory step 3 with `level: 'simple'`; see
[`server/src/lib/seed-puja-vidhi.ts`](../server/src/lib/seed-puja-vidhi.ts). To preview
that composition without a database, open **`/tests/puja-vidhi?doc=1`**.

**The deity slot.** The pūjā is deity-neutral: `{"t":"slot","name":"deity"}` marks the
place in the āvāhana mantras where the deity is named (emitted by `gen_puja.slotify`,
which marks the line whole and *then* wraps that one word, so the slot's default carries
exactly the marks it would have had in situ). `ChantReader` fills the slot from
`preferences.sankalpa.deity` — the same value the saṅkalpa uses. **One choice re-voices
the whole rite.** A slot counts as exactly one word in the per-word grammar table
however many words it renders as, and carries no grammar popover of its own (the table
describes the slot's default word, not the substitution).

**Preferences.** Every choice — level, tradition, karma, kāmanā, deity, place frame,
gotra, name — lives in `UserPreferences.sankalpa` (`shared/src/index.ts`), persisted to
the account for a signed-in user and to localStorage for a guest, through the existing
`PreferencesProvider` and the shallow-merged `PATCH /api/account/preferences`. `gotra`
and `name` are personal data: they stay in the user's own preferences record and are
never written into a shared or cached document payload. `level` is the one exception —
an embedded instance may pin a starting level (`levelOverride`) and then keep it in local
state, so raising it in place doesn't rewrite the reader's saved default.

---

## 5. Adding / changing a fragment

1. Add or edit the term in the right vocabulary in **`shared/src/sankalpa.ts`**
   (IAST + Devanāgarī; and `acc` for a deity).
2. Mirror the IAST in the matching dict in **`tools/chant/emit.py`** (`FIXED` / `TRAD` /
   `DEITIES` / `DEITIES_ACC` / `KARMAS` / `KAMANAS`).
3. **If the new term can sit next to another marked term on a line**, add that pair to
   `adjacency()` in `emit.py` — it mirrors `composeSankalpa`, and an unlisted pair
   simply gets no join (§2.1), which is how `pūjāṁ kariṣye` went out wrong.
4. Re-run `emit.py` → regenerates `sankalpa-marks.ts` (marks **and** joins). Re-run
   `coords.py` too if you touched a coordinate phrase. Both must be byte-deterministic:
   run twice and `cmp`.
5. `npm run typecheck`, then look at `/sankalpa` at all three levels and in both
   scripts before calling it done.

**Never hand-type a mark.** If a fragment renders unmarked, its key is missing from the
generated table — fix the generator, not the data.
