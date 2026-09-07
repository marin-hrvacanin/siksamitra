# Recitation marks — the exact rules

The **derivation spec** for Veda Union's recitation marking: holdings, svaras,
anusvāra, visarga, svarabhakti, virāma. Every rule here is transcribed from the
implementation the owner's own documents were produced with — Śikṣāmitra's
`sanskrit_rules.js` — with the file/line references so a future agent can check
it rather than trust it.

Read this before authoring or repairing any marked text:
[`AUTHORING-CHANTS.md`](./AUTHORING-CHANTS.md) (the reader format and pipeline),
[`AUTHORING-DOCUMENTS.md`](./AUTHORING-DOCUMENTS.md) (Library documents),
[`AUTHORING-SANKALPA.md`](./AUTHORING-SANKALPA.md) (the offline saṅkalpa),
and the skill [`.claude/skills/vu-chant-marking/`](../.claude/skills/vu-chant-marking/SKILL.md).

> **Rule zero — never re-derive marks for text that already exists in a VU
> document.** The owner's marked files (`.docx`, `.smdoc`, the IAST PDFs) are
> the ground truth, and they contain hand-placed marks the algorithm does not
> produce. Copy them run by run, letter by letter. The algorithm below is for
> text that has **never been marked** — and even then its output is a draft to
> be checked against a comparable marked passage.
>
> Worked example of a hand-placed mark the algorithm will not give you: in the
> owner's Youth Wing sādhanā, `guṁ | gurubhyo̱ namaḥ` carries a **holding on the
> `g` of `gurubhyo`**. There is no consonant cluster there (`g` + `u`), and the
> pause `|` before it terminates any cluster scan — so `findAllHoldings` emits
> nothing for it. It is the owner's reading of the gemination after the bīja.
> Reproduce it; do not "fix" it.

---

## 1. The vocabulary

| mark | means | IAST encoding | Word character style | reader data | drawn as |
| --- | --- | --- | --- | --- | --- |
| svarita | raised pitch | `U+030D` (◌̍) | `Svara` | `svara:"svarita"` | one vertical stroke above the letter |
| dīrgha-svarita | long raised pitch | `U+030E` (◌̎) | `Svara` | `svara:"dirgha-svarita"` | two vertical strokes above |
| anudātta | lowered pitch | `U+0331` (◌̱) | `Svara` | `svara:"anudatta"` | a line below the letter |
| udātta | the unmarked tone | *(nothing)* | — | *(omit the key)* | nothing |
| holding (short) | prolonged consonant | *(style only)* | `Holding` | `hold:"short"` + `hg` | a thin box round the letter(s) |
| holding (long) | prolonged, after a long vowel | *(style only)* | `2Holding` | `hold:"long"` + `hg` | a thicker box round the letter(s) |
| anusvāra / variant | the recited nasal | `ṁ`, or the letter it becomes | `Anusvara`, `VedicAnusvara` | `change:true` | the letter in indigo-blue |
| superscript aid | āgama `g`, upadhmānīya `f`, `u`/`i`/`l` | a raised letter | `Anusvara` + superscript | `sup:"…"` | small raised letter, same blue |
| svarabhakti | epenthetic vowel | `·` before the letter | `Svara` | `sbhakti:true` | a filled dot before the letter, outside the box |
| virāma | the final clipped stop | `U+02CE` (ˎ) | `Virama` | (rendered inline) | a small low tick |
| pause | phrase break | `|` short, `।`/`॥` daṇḍa | `Pause` / plain | `pause` / `danda` | upright stroke — **never italic** |
| comment | an editorial note in the source | plain text | `Comment` | *(dropped)* | not rendered |

**Input normalisation** — Devanāgarī-style accents are folded to the IAST
combining marks before anything else (`sanskrit_rules.js` ~L293–297):

```
U+0951 (॑ udātta sign) → U+030D      U+0952 (॒ anudātta sign) → U+0331
U+0332 → U+0331        U+0320 → U+0331        U+0321 → U+0331
```

Recognised svara/annotation characters are exactly
`{U+0331, U+030D, U+030E, U+02CE, ·}` (`SVARA_MARKS`, ~L28). Anything else
combining is treated as part of the letter.

---

## 2. Holdings — where the box goes

A holding marks a consonant that is **held** in recitation. It is *not* a
per-syllable ornament and it is *not* free choice: Śikṣāmitra derives it, and
the owner's documents follow that derivation except where he has overridden it
by hand (rule zero).

### 2.1 The algorithm

`findAllHoldings` → `findHoldingPosition` → `collectSamyukta` +
`selectHoldingComponent` (`sanskrit_rules.js` L649–731).

> **Before step 1 — the bīja mantra's short pause is already in the text.** An
> initial `oṁ`, and a bīja mantra generally, is followed by a short pause; the
> owner's `pūrṇakumbha mantra.smdoc` opens
> `<p>oṁ <span class="ql-short-pause">|</span> na kar…`. It must be inserted
> **before** holdings are derived, because a pause ends a saṁyukta (step 2).
>
> **Why a pause ends a cluster.** A holding marks a consonant that is
> *prolonged in recitation*. The cluster exists only because the sounds are
> contiguous — that contiguity is the whole reason the first consonant has to
> be held into the second. A pause makes them non-contiguous, so a box there
> would mark a prolongation that is not performed. This is not a tokenising
> convenience: it is the phonetic content of the mark. The owner settled it
> explicitly (2026-08): **“No holding after bīja mantra short pause
> (praṇava).”** It applies to any pause, not only the praṇava's — see the
> `'bhivadan | yadāste` case in §2.3.
>
> The rule makes two look-alike strings come out differently:
>
> | text | cluster? | holding |
> | --- | --- | --- |
> | `oṁ \| sumukhāya namaḥ` | no — the pause ends the run | **none** |
> | `upavītaṁ samarpayāmi` | yes — `ṁ` + space + `s` | **short on `s`** |
>
> In the same document `oṁ \| na karmaṇā` gets no holding on that `n` either,
> though `ṁ`+`n` would otherwise fall back to it. Insert the pause first, or
> every bīja-initial mantra is marked one holding too many.
>
> **Puruṣa Sūktam's box after the praṇava is the mistake**, not the engine's
> silence — `purusha-suktam.json` carries both the pause and a holding on the
> following letter in `oṁ | tac chaṁyor…` and `oṁ | śāntiś…`. Nothing needs
> re-deriving: what is live is already correct.

1. **Scan** the line left to right. Skip annotation characters and the pause
   mark `|` entirely.
2. At each consonant, **collect the saṁyukta**: the maximal run of consonants
   starting there. While collecting:
   - svara marks, other combining marks and annotation characters between
     consonants are stepped over (they do not break the run);
   - **whitespace does not break it** — a cluster may span a word boundary
     (`tat savitur` → `t`+`s`), and the crossing is remembered;
   - a pause mark `|` **does** end the run;
   - `m̐` (m + `U+0310`) and candrabindu superscript helpers are skipped as
     annotation, not counted as cluster members.
3. **Fewer than two consonants → no holding.** A single consonant between
   vowels never gets a box. This is the rule most often broken by hand-marking.
3b. **A verse/line-INITIAL cluster is never boxed.** The owner's ruling
   (2026-08): "we never box the initial clusters". `tripādūrdhva`, `brāhmaṇo`,
   `prajāpatiś`, `hrīś`, `pratnoṣi`, `prātar` all open a line and all stand bare
   in his files. The cluster must *begin at the line's first letter* — a cluster
   that merely reaches into the line's first word from a preceding word-final
   consonant is an ordinary cross-word cluster and is boxed normally. **This is
   NOT in `sanskrit_rules.js`**, which boxes them; it is his ruling on top.
4. **Choose the host letter** (`selectHoldingComponent`, L610–647), in order:
   1. **SAME POINT OF ARTICULATION → the FIRST of the pair.** The owner's
      ruling (2026-08), in his words:

      > "if we have consonant cluster with the same (c+c, t+t) or (t+th, c+ch)
      > and so on, then it always goes on the first one… even if the consonant
      > cluster is split between two words. Otherwise, if consonant cluster is
      > split between two words, holding falls on the second word's beginning.
      > That's it."

      So this is **one** test, not two: a pair is *same-point* when the two
      consonants are **identical** (`nn`, `tt`, `ll`, `yac|ca` — the old
      "dvivarcana") **or differ only by aspiration** (`tac|chaṁ` c/ch,
      `śarad|dhaviḥ` d/dh, `t+th`). Dvivarcana is the degenerate case, not a
      separate rule. The word boundary is irrelevant — it applies inside a word
      and across a join alike, and it names the host outright (no step-forward
      walk follows). **Not in `sanskrit_rules.js`**, which has only the
      identical-pair case and decides a cross-word cluster like an intra-word
      one;
   2. otherwise start at the **first consonant of the second word** if the
      cluster crosses a word boundary, else at the first consonant;
   3. from there, step forward over any consonant that **cannot host** a
      holding — `SKIP_CONSONANTS` = `ṅ ñ ṇ n m ṁ ṃ r ś ṣ s` (L9) — **unless**
      it is a sibilant (`ś ṣ s`) that begins the second word of a cross-word
      cluster, which *can* host. A **word-final** `ḥ` cannot host either
      (`durgiḥ pracodayāt` boxes the `p`); inside a word it can (`duḥkha`),
      which is why `ḥ` is not in `SKIP_CONSONANTS`;
   4. if everything was skipped, fall back to the **last** consonant of the
      cluster.

   **Voicing is NOT part of the rule as shipped.** `t+d`, `k+g`, `t+dh` share a
   varga but differ in voicing; they are treated as an ordinary split cluster
   and host on the second word's initial. The wider reading is available as
   `RULES['crossword_host'] = 'homorganic'` and measures an exact tie — see
   §2.3.
5. **Short or long** — decided by the **vowel immediately before the host
   letter**, not by the consonant:
   `LONG_VOWELS` = `ā ī ū ṝ ḹ e ai o au` (L24) → **`2Holding` (long)**;
   anything else → **`Holding` (short)**. When looking back, `ṁ ṃ ḥ` are
   skipped over, and if the search is blocked by a word space it is retried
   across the space.
6. **Grouping** — adjacent held letters that belong to the same decision are
   ONE box (`hg` in the reader; consecutive same-style runs in Word). Two
   separate decisions stay two boxes, even when they touch.

#### The four ways this has been got wrong

Every one of these shipped at some point and every one produced holdings that
looked plausible and were wrong. Re-check them against `--selftest` before
touching `selectHoldingComponent`.

1. **The sibilant exception tested the wrong cluster member.** Step 4.3's
   "unless it is a sibilant that begins the second word" is a property of the
   *candidate being stepped over*, not of the cluster or of its first member.
   Testing the cluster's first consonant makes `upavītaṁ samarpayāmi` lose its
   box on `s`.
2. **No fallback to the last consonant.** When every member is in
   `SKIP_CONSONANTS` the loop runs off the end (step 4.4). Returning "no
   holding" there silently drops `naḥ parṣadati` → `ṣ`, `varṇāṁ tapasā` →
   `ṇ`, `karma` → `m`.
3. **Long/short measured from the start of the cluster, not from the host.**
   Step 5 looks back from the letter that *hosts* the box. Measuring from the
   cluster's first member gives the wrong vowel whenever the host is not the
   first member — which, after step 4.3, is most cross-word clusters.
4. **Anusvāra/visarga applied before holdings.** §7 fixes the order. Substitute
   first and `ṛcaḥ sāmāni` becomes `ṛcas sāmāni`, a false dvivarcana, and the
   box moves one letter left. The same trap bites anyone *comparing* against a
   stored file — see §2.3.

### 2.2 Reading the rule off the owner's file

`parameṣṭhi` → cluster `ṣ` + `ṭh`; `ṣ` is in `SKIP_CONSONANTS`, so the host is
`ṭh`; the vowel before it is `e` (long) → **`2Holding` on `ṭh`**. That is exactly
what the owner's document has. `gurubhyo` → cluster `bh` + `y`; `bh` can host;
the vowel before it is `u` (short) → **`Holding` on `bh`**. Also exactly as in
his file. Use these two as your calibration pair.

### 2.3 Cross-checked against the owner's own chants

The port in `tools/chant/gen_marks.py` was diffed letter by letter against the
holdings in `purusha-suktam.json`, `durga-suktam.json` and `bhagya-suktam.json`
— the owner's own marks, re-derived from the text they carry.

**Run it with `python tools/chant/diverge.py`** — the harness is committed, so
this measurement is never re-derived by hand again. `--modes` prints the table
below, `--detail` lists every divergent letter in context.

**510 of his 534 boxes agree (95.5 %)** — the metric to quote, and the one a rule
change must not lower. Counted in BOTH directions (every letter either side
boxes) it is **3847 / 3888 letters agreeing**, i.e. **41 divergent letters**: 24
boxes of his the engine does not place, 17 it places that he does not. Neither
residue is *by itself* a reason to change either side without the owner's word —
he has said his Puruṣa Sūktam may itself contain errors. (Counts quoted in this
section before 2026-08-19 came from an ad-hoc script and run ±1 against
`diverge.py`; the committed harness is the authority.) How the diff must be run,
and what the residue sorts into:

> **Quote both numbers.** The 534 denominator is *his* boxes, so a rule that
> only ever REMOVES engine boxes — never-box-a-line-initial-cluster is exactly
> that — cannot raise it and can only be judged on the two-directional count.
> Rule 3b removed 10 wrong boxes and cost 2 of his (see the table): 508→506 on
> the one-directional metric, 508/564 → 506/554 on the two-directional one.

> **Feed the engine the PRE-sandhi letters.** §7 places holdings before the
> anusvāra and visarga substitutions, so a comparison that reads the stored
> (post-substitution) letters back in is measuring a different input, not a
> different engine. `ṛcaḥ sāmāni` is stored as `ṛcas sāmāni`; fed back in,
> `s`+`s` looks like a dvivarcana and the box moves a letter. Invert every unit
> carrying `change` first (`ṅ ñ ṇ n m` → `ṁ`, `ś ṣ s r` → `ḥ`). Skipping
> this inflates the disagreement count from 26 to 61.

| class | letters | who is right |
| --- | --- | --- |
| a pause ends the cluster (§2.1) — praṇava ×6, and `'bhivadan \| yadāste` | 7 | **engine** (owner's ruling) |
| word-initial sibilant: he lets `s` host in `svasti`, `syāma`; the engine steps to `v`/`y` | 8 | **engine** (his own `.smdoc` has `svāhā` → `v`) |
| cross-word sibilant: he steps past it when the cluster has another candidate (`paśūṁ stāṁ`, `jyāyāṁ śca`) | 6 | open |
| mid-line cluster his file simply leaves unboxed | 6 | open |
| **line-initial cluster he DID box** — `prātar` (bhagya v-1), `kṣāmad` (durga v-5). His hand contradicts his own rule 3b; rule zero says his hand wins, so these two stay divergent | 2 | open |
| dvivarcana: which of the identical pair (`yac \| ca` → he takes the second, every other geminate the first) | 2 | open |
| two boxes on ONE saṁyukta (`dadan naḥ`, `ij johavīmi`, `ucchantu`) | 3 | **engine** (step 6: one holding per cluster) |
| a box where no saṁyukta exists — `kātyāyanāya`'s `k` | 1 | **engine** (step 3) |
| long vs short on the same letter — `brāhmaṇo`'s `h` after `ā` | 1 | **engine** (step 5) |
| **data defect, not a disagreement**: a missing `change` flag makes a false geminate. `śāntiś śāntiś*` — only the second is flagged; `idhmaś śarad` — neither. Flag them and the engine reproduces his box. | 6 | — |

Note that `purusha-suktam.json` v-1 and v-27 are the same śānti-pāṭha, so a
third of the residue is that text counted twice.

**Rules tested and REJECTED on this evidence** — every one looked plausible:

| candidate | result |
| --- | --- |
| flag a cluster-initial consonant as word-initial, so a word-initial sibilant can host | 498/534 |
| no same-point rule at all — identical pairs only (`crossword_host = False`) | 507/534 |
| the owner's cross-word ruling read BROADLY — *every* differing pair hosts on the first word's final (`crossword_host = 'all'`) | **487/534** (fixes 16 letters, breaks 60: `tasmād yajñāt`, `yat puruṣaṁ`, `tat puruṣasya`, `prāṇād vāyur` … he boxes the second word's initial throughout) |
| the same-point rule widened to the whole varga, i.e. **voicing too** (`t+d`, `k+g`; `crossword_host = 'homorganic'`) | **510/534 — an exact tie** with the shipped rule, and the same 3847/3888 two-directional. Not evidence: **no voicing pair occurs across a word join anywhere in the three chants**, so the corpus cannot decide it. Left unshipped pending the owner's word; it is a one-word change in `RULES`. It is not inert elsewhere — it would move the saṅkalpa's `mat + dāna` and `mat + dhyāna` onto the `t` |
| treat a line break as a saṁyukta barrier (like a pause) | 500/534 — he boxes clusters that span a line break, so `br` is a plain word space |

None of these is a rule; each would have been an overfit to a handful of
hand-marked words. **Measure before you ship**: `RULES` at the top of
`gen_marks.py` exists so a candidate can be switched on and re-measured.

**Do not "fix" the three chant files from this table.** The owner reviews the
divergences himself; rule zero (his hand overrides the derivation) still stands.

### 2.3a One box, one letter

Step 4 chooses **a** host letter, singular, and that is what the format stores:
across the whole shipped library — `purusha`, `durga`, `bhagya`, `vishnu`,
`mantra-pushpam`, `puja-vidhi`, both nāmāvalīs — **every** `hg` group covers
exactly one `ChantUnit`, with a single exception (`cch` in `bhagya-suktam`, an
artefact of its HTML import path). A digraph (`dh`, `ṭh`, `bh`) is one letter and
therefore one unit, so it is not a counter-example.

**A marked PDF can disagree, and the owner's own `rudram v1.6` does**: 71 of its
2 081 green boxes are drawn around a *pair* — `nn`, `tt`, `cc`, `jj`, `ll`, `yy`,
`ddh`, `cch`, `kkh`, and one cross-word `n n`. Every one of them is a **same-point
pair**, which is precisely the case step 4.1 settles outright: the host is the
FIRST of the pair. So narrowing such a box is not a re-derivation of the
owner's marking — it is the marking he follows everywhere else, applied to a box
that was drawn wide.

Do it **at the import boundary** (`tools/chant/pdf_marks.py:_narrow_boxes`), and
**assert the pair is same-point**: a wide box over a cluster that is *not* a
same-point pair has no host without re-deriving the whole cluster, and guessing
one is how boxes end up off by a letter (§2.1, *The four ways this has been got
wrong*).

### 2.4 Drawing the box

A rendering rule, not a data rule, but it is what makes a document look right —
and what a reviewer will notice first.

**The box is sized from the glyph's INK BOX, not from the baseline.**

Until 2026-08 this section asked for two things that cannot both hold: "the same
air above as below", and a frame at a *fixed* distance from the baseline
(`0.94 em` above, `0.22 em` below — the web reader shipped `0.948` / `0.271`).
A fixed baseline frame gives every letter the same box, so the air it leaves is
whatever the letter happens to be: measured in Gentium Book Plus, `p` got
`0.485 em` above and `0.040 em` below, `b` got `0.176` / `0.271`. Worse, the
constants were read off Latin type, so every script that writes outside them was
clipped — **184/199 Devanāgarī and 150/199 Telugu** held clusters had ink
outside the frame (worst `ङ्कु`, `+0.252 em` below the bottom edge), while IAST
was fine (1/29) and so the defect was invisible to anyone reading in IAST.

Measuring the ink resolves both at once, and is what the rest of this section
now specifies:

- **enclose the whole letter, with the same air all round.** Measure the held
  cluster's ink box in the font that will actually draw it, and place the frame
  `0.1 em` outside it above and below, `0.07 em` left and right. Equal air is
  then true by construction, and nothing can fall outside the box in any script.
  Box heights therefore differ from letter to letter (`p` reaches below the
  baseline, `v` does not) — that is the point, not a bug.
- **no horizontal offset** — the box stays centred on the letter's own ink; it
  is never nudged left or right to line up with anything else.
- the box has **air on both sides** — `0.12 em` of clear space between the box's
  own edge and the neighbouring letter (owner's call, 2026-08: flush against its
  neighbours, a thin box reads as part of the letters around it rather than as a
  mark on one of them). Measured from the *box edge*, so a cluster whose vowel
  sign overhangs its advance width does not weld its box to the next letter.
  Applied equally to short and long: unequal spacing would make it a second cue
  for telling them apart, and the next rule says weight is the only one.
- long and short boxes differ by **stroke weight only** — `0.075 em` vs
  `0.032 em`, a ratio of 2.34 — never by size and never by spacing. **The weight
  must be in em.** The web reader shipped `1.7px` / `1px` (ratio 1.7), which at
  the reader's largest font scale (`--fs: 1.8`) made both a hairline and erased
  the only distinction between a short and a long stop. A `1px` floor is
  allowed, and only so a short box does not fade below one device pixel at the
  smallest sizes.
- svarabhakti dots sit **outside** the box; svara strokes sit **above** it.

Web reader: `client/src/components/chant/holdBox.ts` measures the ink with a
canvas (`actualBoundingBox*` for the ink, `fontBoundingBox*` to locate the
element's own content box) and hands the CSS four custom properties;
`chant.css` draws the frame as a pseudo-element. The measurement is redone when
the webfonts finish loading, and falls back to the old fixed frame if an engine
cannot report ink metrics.

See [`.claude/skills/vu-pptx/`](../.claude/skills/vu-pptx/SKILL.md) for the
measured constants and the renderer.

---

## 3. Svara — two registers, never mixed

### 3.1 Attested (Vedic saṁhitā) — svara is DATA

Ṛgveda, Yajurveda, Sāmaveda, the Brāhmaṇas, the Āraṇyakas, the Vedic
Upaniṣads: the accent belongs to the recension and is **transcribed from an
accented source**, never derived. If you do not have an accented text, you do
not have the svara — say so and stop.

This holds for **a Vedic verse quoted inside a non-Vedic rite** too (the
camphor verse in Pūjā Vidhi is Kaṭha Upaniṣad 2.2.15). Tag such verses with an
explicit hard-refusal register in the generator so no positional pattern can
ever be applied to them by accident.

Where to find accented sources: the owner's own marked files first; then
[VedaVMS](https://www.vedavms.in/) (Taittirīya, accented PDFs),
[TITUS](http://titus.uni-frankfurt.de/) and
[GRETIL](https://gretil.sub.uni-goettingen.de/) (accented ṛk saṁhitā text),
[sanskritdocuments.org](https://sanskritdocuments.org/) (accented Devanāgarī for
many sūktas). Record which one you used in `Doc.source` / `Section.source`.

### 3.2 Conventional (Purāṇic, smārta, stotra) — svara by PATTERN

Ślokas from the Purāṇas, the Smṛtis and the āgamic stotras carry **no attested
accent**, but are traditionally chanted as if Vedic. The owner has sanctioned
marking them from a fixed positional pattern — the same presets Śikṣāmitra's
"automatic svaras" applies (`dialog-autosvara.html` L100–110). The plan strings
there decode as:

| metre | unit | svarita `U+030D` on | anudātta `U+0331` on |
| --- | --- | --- | --- |
| **anuṣṭubh** 16 \| 16 | the 16-syllable half-verse | 2, 4, 8, 14 | 6, 9, 11 |
| **gāyatrī** 8 \| 8 | the 8-syllable pāda | 2, 4, 8 | 6 |
| **triṣṭubh** 11 \| 11 | the 11-syllable pāda | 2, 4, 8, 11 | 6, 9 |
| **jagatī** 12 \| 12 | the 12-syllable pāda | 2, 4, 8, 11 | 6, 9, 12 |

udātta is unmarked — emit nothing for it.

**Provenance of the two sets we use.** The anuṣṭubh set (svarita 2, 4, 8, 14 ·
anudātta 6, 9, 11) and the triṣṭubh set (svarita 2, 4, 8, 11 · anudātta 6, 9)
were checked position by position against the owner's own marked Lalitā
Sahasranāma and agree with it. The gāyatrī and jagatī rows come from
Śikṣāmitra's presets and have **not** been cross-checked against a marked file
of his; verify before relying on them.

### 3.2a A metre with no preset — read it off his own files

The four presets above are not the whole of what he chants. A **dhyāna śloka**
is almost never in one of them, and by rule 3 below it would ship unmarked —
which is the right default and the wrong answer for a verse that is chanted.
His ruling (2026-08) is to mark such a verse **as the Rudram dhyānam is
marked**, and that is checkable, because the Rudram dhyānam is one of his own
marked files.

**The method, and it is the point:** every VU-styled IAST PDF in
`client/public/library/` carries the svaras as real combining characters
(U+030D / U+0331), and each metrical section is LABELLED by him with its
chandas — `(śārdūlavikrīḍitaṁ chandaḥ, 19 syllables per pāda, yatiḥ after the
12th, and 19th)`. So the preset for a metre can be MEASURED off his documents
instead of invented: extract, split into pādas, count nuclei, record where the
accents fall. **Validate the harness on a known answer first** — run it over
his anuṣṭubh material and it reproduces the table above from 35 of his
half-verses, 35/35, every position.

Two presets have been established this way and are in use:

| metre | unit | svarita on | anudātta on |
| --- | --- | --- | --- |
| **śārdūlavikrīḍita** 19 | the pāda, odd (1, 3) | 17 | 1, 2, 13, 15, 19 |
| | the pāda, even (2, 4) | 17 | 1, 13, 15 |
| **puṣpitāgrā** 12 \| 13 | the pāda, odd (12 nuclei) | 10 | 1, 9, 12 |
| | the pāda, even (13 nuclei) | 12 | 1, 10 |

*śārdūlavikrīḍita* — **8 pādas across two independent files agree letter for
letter**: the Rudram's dhyānam (`sri-rudram-iast.pdf`, `oṁ | āpātāla nabhas
sthalānta…`) and the sādhanā's Gaṇeśa dhyānam (`veda-union-sadhana-iast.pdf`,
`oṁ | bījāpūra gadekṣu kārmuka…`). He labels the first, in his own words,
*"meditation, artificial svaras"* — which is this whole register's sanction, in
his hand, and the reason it may be applied to a verse he has not marked.

*puṣpitāgrā* — from `shankaracharya-stotrani-iast.pdf`, the verse `sarasija
nilaye sarojahaste…` closing the Kanakadhārā Stotram. **One verse, four pādas**
— enough to copy that verse (rule zero) and thin for anything else. Widen it
before applying it to a verse he has not marked.

The odd/even split in both is real, not noise: it is in the same places in
every witness, and it is the anuṣṭubh convention's half-verse alternation
showing up per pāda.

> **This does not licence inventing a preset.** It licences *measuring* one,
> from his files, for a metre he has marked, with the harness checked against a
> known answer first. A metre he has never marked still falls under rule 3:
> leave the verse unmarked and report it.

**The sanction, and its limit.** The owner has sanctioned *inventing* svara for
Purāṇic / stotra material on request — this register has no accent to
transcribe, so the pattern is the tradition, not a guess dressed up as data.
That sanction stops dead at §3.1: **genuinely Vedic text may never be marked by
convention**, however well the syllables happen to scan. If a verse is Vedic and
you have no accented source, it ships unmarked. Tag it with a hard-refusal
register in the generator (`meter=VEDIC` in `gen_puja.py`) so no later
re-lineation can make a positional pattern apply to it by accident.

**Counting rule: one syllable = one vowel nucleus.**
- a consonant cluster is part of one nucleus (`mbhu`, `nda`, `jñi`, `kṣu`,
  `ñca` each count once);
- hyphens are orthographic — they neither add nor reset the count
  (`cida-gni` = ci·da·gni, so position 2 is `da`);
- a leading praṇava (`oṁ`) stands **outside** the metre; exclude it or a
  16-syllable hemistich reads as 17 and matches nothing.

**Rules for applying it**
1. **Classify each verse deliberately and record the classification** in the
   generator (`meter=` per verse), never as a hand-edit of emitted JSON.
2. **Never blanket-apply by syllable count.** `āsanaṁ samarpayāmi` counts 8 and
   would falsely match gāyatrī — it is a prose offering formula, not a metre.
3. **Verify the count first.** If a half-verse does not scan to the expected
   number, leave the **whole verse** unmarked and report it. A half-marked
   śloka reads as a bug.
4. All-or-nothing per verse, and the same decision every re-run.

### 3.3 Prose and āgamic formulae — a third register

`…ṁ samarpayāmi` offerings, `svāhā` oblations, the saṅkalpa, the ācamana names,
āvāhana/udvāsana: spoken prose. They take **holdings + anusvāra + visarga
only**. Their traditional contour is the owner's to supply; until he does, they
ship with **no svara**. Keep the register in one place in the generator so
adding the contour later is a one-line change plus a re-run.

---

## 4. Anusvāra — by recension

`applyAnusvaraTransformations` (`sanskrit_rules.js` L737–880). The source is set
per document: `rigveda`, `yajurveda` / `kṛṣṇayajurveda`, or `smriti` (default:
`kṛṣṇayajurveda`). Every transformed letter is painted `change`
(`Anusvara`/`VedicAnusvara` in Word, `change:true` in the reader).

**Common to all recensions** — the anusvāra is *replaced by the letter actually
recited*, not merely coloured:

| `ṁ` before | becomes |
| --- | --- |
| a stop of the k / c / ṭ / t / p class | the homorganic nasal `ṅ ñ ṇ n m` (`CONSONANT_GROUPS`, L~30) |
| a vowel | plain `m` (a word-final `-m` is never an anusvāra) |
| `jñ` or `ghn` (`SPECIAL_SEQUENCES`) | left as `ṁ`, highlighted only |
| after a praṇava or bīja (`oṁ`, `hrīṁ`, `guṁ`, `paṁ` …) | **never assimilated** |

**Kṛṣṇa / Śukla Yajurveda** (`yajurveda`, `kṛṣṇayajurveda`), before
`ś ṣ s h` (`SPECIAL_NON_VOWELS`) or `r`:

| context | becomes |
| --- | --- |
| that letter is followed by a vowel | `m̐` + superscript `g` + superscript `ṁ` |
| that letter is followed by another consonant (lupta-āgama) | `m̐` + superscript `g` |
| … and the **preceding** vowel is a short `a i u` (`BASIC_SHORT_VOWELS`) | `m̐` + superscript `g` + superscript `g` |
| before `v` | `ṁ` + superscript `u` |
| before `l` | `ṁ` + superscript `l` |
| before `y` | `ṁ` + superscript `i` |

**Ṛgveda** (`rigveda`) — the mark's own type is preserved (anusvāra stays
anusvāra, candrabindu stays candrabindu) and **no `g`-forms are generated**:
before `ś ṣ s h r` it is kept and only highlighted; the `v`/`l`/`y`
superscripts still apply, on the original character.

**Smṛti / default** (`smriti`) — the anusvāra is kept and highlighted; no Vedic
forms at all.

> Getting this wrong shows up immediately in the multi-script reader:
> Devanāgarī and Telugu print the anusvāra sign where Tamil resolves it to
> `ம்`, so one missed case renders as `देवं / దేవం / தேவம்` for the same syllable.

---

## 5. Visarga

`applyVisargaTransformations` (`sanskrit_rules.js` L973–1030). Checked in this
order — first match wins:

| `ḥ` before | becomes | note |
| --- | --- | --- |
| `p` | `ḥ` + superscript `f` | upadhmānīya |
| `ś ṣ s` | that sibilant | assimilation |
| a voiced consonant (`g gh j jh ḍ ḍh d dh b bh` · the nasals `ṅ ñ ṇ n m` · the semivowels `y r l v` · `h`) or any vowel | `r` | **only if** the preceding vowel is *not* `a`/`ā` (`ADVAYA`) |
| `kṣ` | `ḥ:` + superscript of the **preceding** vowel | `VISARGA_SPECIAL_SEQUENCE` |
| `c ch` | `ś` | `VISARGA_GROUPS` |
| `ṭ ṭh` | `ṣ` | |
| `t th` | `s` | |
| anything else | `ḥ` unchanged | highlighted only |

> **The voiced row is the whole voiced series, not just the stops.** Until
> 2026-08 this table listed only `g gh j jh ḍ ḍh d dh b bh m`, which reads as
> though `ḥ` before `y r l v h` or a nasal other than `m` were left alone. It is
> not: `gen_marks.VOICED` has the full set, that is ordinary visarga sandhi, and
> the shipped chants depend on it — `vishnu-suktam.json` turns `ḥ` to `r` before
> `n`, `v` and `y`; `puja-vidhi.json` before `n`, `v`, `m` and `j`; the Lakṣmī
> dhyāna's `maṇigaṇaiḥ nānāvidhaiḥ` and `-nidhibhiḥ yuktāṁ` need `n` and `y`.
> The table was the incomplete thing, not the engine.

---

## 5b. Pauses — where they come from

`findAllPauses` (`sanskrit_rules.js` L1033-1100). THREE rules, not one. Only the
first was written down here before, and the other two were missing from the
pipeline entirely as a result — the owner caught it on `vāyur vā apām`.

| # | context | pause |
| --- | --- | --- |
| 1 | after a praṇava / bīja followed by a word (`oṁ ‖ sumukhāya`) | **short** |
| 2 | a **long** vowel, a word boundary, then a **short** vowel | **long** |
| 3 | any other vowel + word boundary + vowel | **short** |

Rules 2 and 3 are **vowel hiatus**: two vowels meeting across a word join
without coalescing. `vāyur vā apām` keeps `ā` and `a` apart, and because the
first is long and the second short it takes the **long** pause; `ya evaṁ`
(short + long) and `tapata āyatanaṁ` (short + long) take the short one. Note the
test is on the two vowels themselves, in that order — not on which word is
longer, and not on whether sandhi *could* have applied.

`LONG_VOWELS` = `ā ī ū ṝ ḹ e ai o au`; the short set is `a i u ṛ ḷ`.

**Order matters: pauses go in BEFORE holdings** (§7), because a pause is a
saṁyukta barrier. In practice a hiatus pause can never move a box — a cluster
spanning that point would need consonants on both sides of it, and by
definition there are vowels there — and that was verified rather than assumed:
adding rules 2-3 left the holding count of Mantra Puṣpam (218), Viṣṇu Sūktam
(160) and Pūjā Vidhi (1488) **identical**, and changed no word count.

**CORROBORATED BY THE OWNER'S OWN MARKED CHANTS — 35 of 35.** Every hiatus
pause in `purusha-suktam.json` (21), `durga-suktam.json` (6) and
`bhagya-suktam.json` (8) agrees with the rule, with **no disagreement**. Those
files also carry 8 further pauses that are not hiatus at all — the praṇava's,
and authored phrase breaks — which is why a check must classify a pause before
judging it.

> An earlier revision of this section claimed the opposite: that his corpus
> contained no hiatus and so could not corroborate the rule. That was a broken
> detector, not a fact about his files — it required `syl · sp · syl` and his
> layout is `syl · sp · pause · sp · syl`, so every hiatus he had already marked
> was skipped by the very scan looking for them. **A measurement that returns
> zero is a claim like any other; check it against a case you know exists
> before writing it down.**

**LAYOUT — the two pause kinds are set differently, and it is visible.**
His files put a hiatus pause between TWO spaces (`śa ne ␣ «long» ␣ a bhi`) and
the praṇava's pause with none after it (`oṁ ␣ «short» tac`). Emitting the
hiatus one without its trailing space glues it to the next syllable — the same
fault as the reported `namaḥ।harir oṁ`.

## 6. Svarabhakti and the virāma tick

- **Svarabhakti** — an epenthetic vowel heard between a consonant and a
  following `s ś ṣ h ṛ` (`SVARABHAKTI_TRIGGERS`, L~70). Written as `·`
  **before** the letter and drawn as a filled dot **outside** any holding box.

  **Taken literally that trigger set is far too wide, and the owner's own files
  say so.** It would fire on `kṣ`, `sm`, `śś`, `ts` and he marks none of them —
  `lakṣmīś` in `purusha-suktam.json` v-26 is bare on the very line that carries
  a dot elsewhere, and `k`+`ṣ` stands unmarked 46 times across his three chants.
  Measured across `purusha-suktam.json`, `durga-suktam.json` and
  `bhagya-suktam.json`, **all 8** of his svarabhakti dots sit on a `ś ṣ h`
  immediately preceded by **`r`**, and no `r` + `ś/ṣ/h` contact in those files
  is left unmarked — 8 for 8, no counter-example available:

  | | | |
  | --- | --- | --- |
  | `rṣā` purusha v-3 | `rhi` purusha v-10 | `rṣṇo` purusha v-17 |
  | `rśve` purusha v-26 | `rṣa` durga v-1 | `rṣi` durga v-4 |
  | `rṣa` durga v-5 | `rṣa` bhagya v-8 | |

  **`gen_marks` does not implement svarabhakti at all** (its docstring says so),
  so every generated chant is missing it. `gen_lakshmi.apply_svarabhakti` is the
  opt-in pass that applies the measured rule — the same shape as
  `gen_vishnu.apply_vedic_anusvara`, kept per-generator so nothing already
  generated moves. **`puja-vidhi.json` has three unmarked `r` + `ś` contacts**
  (`p-guru-akhanda`, `u-dipam`, `u-karpura`) for this reason; fixing them means
  re-running `gen_puja.py` and its variant files, which is its own change.
- **Virāma** `U+02CE` (ˎ) — the clipped final stop at the end of a pāda
  (`…caturbhujamˎ।`). Style `Virama`; it is part of the text, never a pause
  token. **Store it**, as a CODA unit of the syllable it closes — the owner's
  ruling (2026-08), and what "part of the text" means in the chant format: the
  IAST then reads `caturbhujamˎ` exactly as he sets it. Strip it before
  transliteration only: Devanāgarī already writes that final consonant with its
  own halanta (`चतुर्भुजम्`), so there is nothing for the tick to add and no
  codepoint to carry it. `sri-rudram.json` keeps its 35; the eight older chants
  drop theirs (`parse_chant.DROP_CHARS` calls it a "typographic artifact"),
  which is a defect in those files, not a convention.

---

## 7. Order of operations

The order Śikṣāmitra's "autorun" uses (`editor-quill.js` L~9200–9270), and the
order to follow by hand or in a generator:

1. normalise the raw text (fold `U+0951`/`U+0952`, strip stray marks)
2. insert `u` in `vy` (the reading aid)
3. svarabhakti
4. pauses — the praṇava's short pause (§2.1 point 1b) **and the vowel-hiatus pauses** (§5b)
5. **holdings**
6. **anusvāra**
7. **visarga**
8. recension-specific svarita adjustments (Ṛgveda)
9. svara — attested transcription, or the positional preset (§3)

Holdings run **before** the anusvāra/visarga substitutions, so a box lands on
the letter as written; the substitutions then recolour letters without moving
the boxes. Doing it the other way round shifts boxes by one letter — that is
the classic "everything is off by one" failure.

### Step 2 in detail — which reading aids are actually used

`sanskrit_rules.js` offers **three** insertions (L1104-1145): `g` inside `jñ`
(`findJnaInsertions`), `u` inside `vy` (`findVyInsertions`), `u` inside `sv`
(`findSvInsertions`). They are not equally used, and the question was settled by
MEASURING the owner's four hand-marked chants (`purusha-suktam`, `durga-suktam`,
`bhagya-suktam`, `sri-rudram`):

| pair | aid | with | without | ruling |
| --- | --- | --- | --- | --- |
| `vy` | raised `u` | **29** | 0 | unanimous — always applied |
| `jñ` | raised `g` | 14 | 18 | split: all 14 in Puruṣa Sūktam, none of Śrī Rudram's 18. **The owner ruled (2026-08): the `g` is inserted.** |
| `sv` | raised `u` | 2 | 28 | **not** the house habit — deliberately NOT implemented |
| `ghn` | — | 0 | 3 | `ghn` is in `SPECIAL_SEQUENCES` for the **anusvāra** rule only; the engine has no insertion for it |

`gen_marks.apply_reading_aids` implements the first two and nothing else.

It runs **after** the holdings rather than at step 2, and that is not a
re-ordering: in Śikṣāmitra the aid is a CHARACTER inserted into the text, here
it is a FLAG on a unit, invisible to the saṁyukta scan — the same treatment as
svarabhakti (§6). The owner's own data shows the two are equivalent:
`bhavyam` in `purusha-suktam.json` carries `sup:"u"` **and** the holding on the
same `v`, so the raised letter never breaks the cluster it sits inside.

> **A missing aid is a generator bug, not a variant.** All five generated chants
> were re-run when this went in; the diff was exactly 33 new `sup` values on
> `j`/`v` and nothing else — no holding, no svara and no letter moved. The
> PDF-parsed chants (`purusha-suktam`, `durga-suktam`, `bhagya-suktam`,
> `sri-rudram`) are path-A transcriptions of hand-marked sources and are **not**
> re-derived (AUTHORING-CHANTS §0.5), which is why Śrī Rudram still prints its
> eighteen `jñ` bare.

---

## 8. Verification — the part that is not optional

Do all of this, and record the result:

1. **Round-trip against the owner's file.** Unzip the `.docx`
   (`word/document.xml`), read the runs with their `w:rStyle`, and diff your
   marks against his, letter by letter:

   ```python
   import re
   X = open('word/document.xml', encoding='utf-8').read()
   for p in re.findall(r'<w:p\b.*?</w:p>', X, re.S):
       runs = [(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', r)),
                (re.search(r'<w:rStyle w:val="([^"]+)"/>', r) or [None, None])[1],
                'vertAlign w:val="superscript"' in r)
               for r in re.findall(r'<w:r\b.*?</w:r>', p, re.S)]
       print([r for r in runs if r[0]])
   ```

2. **Counts.** Same number of `Holding` + `2Holding` boxes per line, same
   number of svara marks, same superscripts, in the same places.
3. **Both registers present?** No svara on prose formulae; no invented svara on
   Vedic text; positional svara only where a `meter=` tag says so.
4. **Scripts agree.** Derive Devanāgarī / Telugu / Tamil from the *clean* base
   (accents stripped first) and check the anusvāra/visarga rows above render
   consistently in all three.
5. **Look at it.** Render and read it: boxes centred on their letters with equal
   air above and below, no offsets, pauses upright, superscripts legible,
   nothing clipped. A marked line that is *correct* in the data and *wrong* on
   the page is still wrong.
6. **Report divergences** from the owner's file rather than silently
   normalising them — his hand-marks are decisions, not errors.

## The Vedic anusvāra (the *gum*) — and when it applies

Anusvāra before a sibilant or `h` is written and recited in the **Kṛṣṇa
Yajurveda / Taittirīya** tradition as the *gum*: `og̠ṁ suvaḥ`, `og̠ṁ satyam`.

**It is SOURCE-DEPENDENT, not universal.** `sanskrit_rules.js` branches on
`this.source`: for `rigveda` it preserves candrabindu and never converts between
it and anusvāra; other sources convert. So do not apply the gum to Ṛgvedic
material. Both VU texts that carry it are Taittirīya — the prāṇāyāma passage is
TA 10.35, and Puruṣa Sūktam is the TA 3.12 recension.

**AUTHORED or DERIVED — and which one depends on where the text came from.**
This used to say only "authored", which is true of the legacy path and false of
the other, and the gap cost a shipped defect (see the warning below).

**A. Text copied from a hand-marked VU source** (`.smdoc`, the owner's marked
PDFs) — the gum is AUTHORED, because rule zero says his marks are ground truth.
Write it exactly as Śikṣāmitra does: `m` + U+0310, optionally followed by the
reading aid `g`, `gg` or `gṁ` (`sanskrit_rules.js` L386-408). `parse_letters`
keeps that run as ONE letter and `L` splits it into the base `m`,
`candra: true`, and `sup` for the g-run, giving `{c:'m', candra:true,
sup:'gṁ'}` — byte-identical to how `purusha-suktam.json` stores it.

**B. Text newly imported from an accented edition** (a printed saṁhitā, an
accented Devanāgarī e-text) — the gum is DERIVED. The source line carries the
**underlying anusvāra `ṁ`**, and `apply_vedic_anusvara`
(`tools/chant/gen_vishnu.py`, AUTHORING-CHANTS §5H) supplies the base, the
candrabindu and the right reading aid from what follows. Deriving it is what
gets `g` vs `gg` vs `gṁ` right; authoring it by hand from an edition that does
not print the aid cannot.

> **NORMALISE THE VEDIC ANUSVĀRA SIGN ON IMPORT — this is the trap.**
> Accented Devanāgarī writes the gum as **U+A8F3 `ꣳ`** (sometimes `ँ`).
> Transliterating it straight yields a pre-formed `m̐`, which path B's
> derivation then **skips**, because that pass looks for an underlying `ṁ`. The
> result ships a bare candrabindu with **no reading aid at all** — visibly wrong
> beside every other Taittirīya text in the Library. Map `ꣳ`/`ँ` → `ṁ` at the
> import boundary and let the engine do the rest. This shipped in
> `mantra-pushpam.json` (`tuṣṭuvāṁsas`, `ṛtaṁ`, `tvaṁ rudra`) and was caught by
> the owner, not by review.

**The `ॐ` ligature cannot carry an accent, and printed editions exploit that.**
U+0950 is a single glyph with no room for U+0951/U+0952/U+1CDA, so an edition
that sets `oṁ` as `ॐ` silently drops any accent the syllable has in recitation.
Mantra Puṣpam's `oṁ tad brahma …` carries a **dīrgha-svarita** on every one of
its six praṇavas in the recitation witnesses, and importing from the ligature
lost all six. When a source prints `ॐ`, check an accented recitation witness
before assuming the syllable is unaccented.

Do NOT spell the gum `ogṁ` in the text; that was tried and is wrong, because the
`g` then reads as a consonant.
