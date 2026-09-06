# -*- coding: utf-8 -*-
"""Viṣṇu Sūktam -> client/public/chants/vishnu-suktam.json (format v2).

NEVER hand-edit the JSON. Edit this file and re-run; the output is
byte-deterministic (run it twice and `cmp`).

    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/gen_vishnu.py

RECENSION — this is KṚṢṆA YAJURVEDA (Taittirīya), not Ṛgveda
------------------------------------------------------------
It matters, because MARKING-RULES §4 branches on it: `rigveda` keeps the
anusvāra bare before `ś ṣ s h r` and generates NO g-forms, while the Taittirīya
recites it as the *gum*. The evidence that this text is Taittirīya is the gum
itself — every witness writes `rajāṁsi`, `uttaraṁ`, `padaṁ`, `urukṣitiṁ`,
`jāgṛvāṁsaḥ` with `(gm)` and `tveṣaṁ hyasya` with `gg`. A Ṛgvedic reciter
produces none of those. The loci are Taittirīya throughout (TS 1.2.13, TS 1.3.6,
TB 2.4.3, TB 2.4.6, TB 2.8.3); the constituent ṛcs also stand in the Ṛgveda, but
the Ṛgveda is the PARALLEL, not the source of this recitation. Same recension as
`purusha-suktam.json`, which carries the same `sup: "g"/"gṁ"`.

SOURCES — four witnesses, and what each settled
-----------------------------------------------
1. **VedaVMS** accented Latin Taittirīya books (`TS 1`, `TB 2.1-2.4`,
   `TB 2.5-2.8`) — PRIMARY. Already writes svara in Veda Union's own three code
   points, needing only U+0332 -> U+0331 (MARKING-RULES §1).
2. **sanskritdocuments.org** `doc_veda/vishnusukta.itx` — accented Ṛgveda.
   NOTE it is a DIFFERENT, longer compilation (RV 1.22/154/155/156, 6.69, 7.99,
   7.100), not this sūktam; used only to cross-check the ṛcs' accents. It
   corrected four readings and fixed the RV numbering.
3. **vignanam.org** (Vaidika Vignanam) — the sūktam as recited, fully accented.
   The only witness for v-8, v-13 and the closing prose.
4. The owner's supplied PDF — wording cross-check. It has three typos the other
   three witnesses agree against (`samūham`, `paspṛśe`, `vidmā`).

Where they disagreed, and who won:
  * `rajāṁsi` not `rājāṁsi`      — VedaVMS + sanskritdocuments (vignanam, PDF wrong)
  * `adhikṣiyanti` not `-kṣayanti` — VedaVMS + sanskritdocuments (vignanam wrong)
  * `urukṣitiṁ` short u          — VedaVMS + sanskritdocuments
  * `deva tvam` two words        — VedaVMS + sanskritdocuments (vignanam joins it)
  * `pṛthivyāḥ`                  — sanskritdocuments (vignanam prints it assimilated)
  * `tato dharmāṇi` not `ato`    — all three Taittirīya witnesses; the Ṛgveda
                                   reads `ato`, and that is a RECENSION difference,
                                   not an error. Do not "fix" it.

PROTECTED READINGS — do not normalise (AUTHORING-CHANTS §5G)
  `tanuvā`   (v-5) Taittirīya/restored; a Ṛgveda edition reads `tanvā`
  `vīryāya`  (v-4) Taittirīya; the Ṛgveda reads `vīryeṇa`
  `jittyai`  (v-14) the geminate is in vignanam AND StotraNidhi independently
  `itthā`    (v-3) a real geminate — an earlier de-gemination pass ate a `t`
  `daśasyann`, `dhārayann` — the Taittirīya pāda-final doubling

HOUSE NORMALISATIONS (declared, applied deliberately)
  VedaVMS's own recitational gemination is undone: `pārtthivāni` -> `pārthivāni`,
  `maddhya` -> `madhya`. Read off the owner's OWN Taittirīya files, which print
  `madhye` / `sādhyā`. `ths` -> `ts` (`uthsaḥ` -> `utsaḥ`) for the same reason.
  `śñaptre` -> `śnaptre`: the standard reading; VedaVMS spells the palatalised
  recitation.

HOW THE SOURCE LINES WERE MADE — accents are DATA, never retyped
  `vishnu_convert.py` maps the witness notation to VU's, then `respace()` carries
  the witness's ACCENTS onto a word-split typed WITHOUT accents, and REPORTS
  every letter where the two differ. All 22 differences are in four declared
  classes and nothing else: (a) 18 × an underlying visarga restored, so the
  marking engine re-derives the sandhi itself (AUTHORING-CHANTS §5A-bis step 1);
  (b) `śnaptre`; (c) a word-final `-m` before a pause (`ātatam`); (d) a
  root-initial `n` the witness spells as an anusvāra (`samindhate`, confirmed by
  sanskritdocuments).

STILL OPEN — reported, not papered over
  The closing prose (`paryāptyā … sarvaṁ jayati`, v-14) is brāhmaṇa prose whose
  exact locus I could NOT verify. TS 7.4 / 7.5 and TB 3.8.17 were checked and are
  not it. It is cited as what it is. A manufactured citation would be worse.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_marks import LONG_V                                      # noqa: E402
from tokens import derive, line_tokens                            # noqa: E402
from gen_puja import (VOWEL_C, strip_accents,                     # noqa: E402
                      surfaces_of)
from vishnu_words import WORDS                                    # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "..", "client", "public", "chants", "vishnu-suktam.json")

SLUG = "vishnu-suktam"


# --------------------------------------------------------------------------
# The Taittirīya (Kṛṣṇa Yajurveda) anusvāra — MARKING-RULES §4
# --------------------------------------------------------------------------
# `gen_marks.apply_anusvara` implements the rule COMMON to every recension: `ṁ`
# assimilates to the homorganic nasal before a stop, and is otherwise kept.
# What it does not implement is the recension-specific layer, because the
# saṅkalpa and Pūjā Vidhi (its only callers until now) are `smriti` register,
# where there is none. This text is Taittirīya, so the layer applies — and it is
# DERIVED here rather than authored, exactly as the docs require: nothing in a
# chant JSON may be a hand-typed mark.
#
# Before `ś ṣ s h` or `r`, the Taittirīya recites the anusvāra as the *gum*:
#   the letter is followed by a VOWEL      -> m̐ + superscript `gṁ`
#   the letter is followed by a CONSONANT  -> m̐ + superscript `g`
#     …and the vowel BEFORE it is a short a/i/u -> superscript `gg`
# Before the semivowels it takes a reading aid instead, on the anusvāra itself:
#   before `v` -> superscript `u`     before `y` -> superscript `i`
#   before `l` -> superscript `l`
#
# Verified against the owner's own `purusha-suktam.json`, the same recension,
# which stores exactly these shapes:
#   {"c":"m","change":true,"candra":true,"sup":"gṁ"}   (`idaṁ sarvam`)
#   {"c":"m","change":true,"candra":true,"sup":"g"}    (`jyāyāṁ śca`)
#   {"c":"ṁ","change":true,"sup":"u"}                  (`bhūmiṁ vi-`)
#   {"c":"ṁ","change":true,"sup":"i"}                  (`tac chaṁyor`)
# and against the witnesses, which print `tveṣagg hyasya` — `h` followed by the
# consonant `y`, short `a` before it -> `gg`. The rule reproduces that.
GUM_TRIGGERS = {"ś", "ṣ", "s", "h", "r"}
SEMIVOWEL_AID = {"v": "u", "y": "i", "l": "l"}
SHORT_AV = {"a", "i", "u"}
PRANAVA_FORMS = {"oṁ", "oṃ", "om"}


def apply_vedic_anusvara(tokens):
    """Taittirīya realisation of a surviving `ṁ`. Mutates units in place."""
    flat = []                       # (unit, is_barrier)
    for tk in tokens:
        if tk["t"] == "syl":
            # A PRAṆAVA / BĪJA IS NEVER ASSIMILATED (MARKING-RULES §4, last row).
            # Without this guard `oṁ śāntiḥ` came out as the gum `om̐gṁ śāntiḥ`,
            # which no witness writes and which purusha-suktam.json — the same
            # recension — contradicts: it keeps a bare `ṁ` on the praṇava.
            # `gen_marks.apply_anusvara` has the same guard via its BIJA set;
            # this pass is a second place the rule has to hold.
            if tk["iast"] in PRANAVA_FORMS:
                flat.extend(None for _ in tk["units"])
                continue
            flat.extend(tk["units"])
        elif tk["t"] in ("danda", "pause", "br"):
            flat.append(None)
        # `sp` is NOT a barrier: the gum happens across a word join
    for i, u in enumerate(flat):
        if u is None or u.get("c") != "ṁ":
            continue
        # `k` is where the next LETTER actually is, which is not `i + 1` when a
        # line break, a pause or a daṇḍa sits between the two. `after` used to
        # be read from `flat[i + 2:]`, and in that case `flat[i + 2]` IS the
        # sibilant — so the rule saw "a consonant follows" and emitted `g`/`gg`
        # where the letter after the sibilant is a vowel and the aid is `gṁ`.
        # It cost `pañcādaśa śata(gg)` ‖ `sahasram` in the Śiva Saṅkalpa, where
        # every witness prints the `gṁ`. Nothing else in the shipped corpus
        # breaks a line between an anusvāra and a following sibilant, so this
        # fixes one syllable and changes nothing else — but the fault is generic.
        k = next((j for j in range(i + 1, len(flat)) if flat[j] is not None),
                 None)
        if k is None:
            continue                   # phrase-final: stays a bare anusvāra
        nxt = flat[k]
        n = nxt["c"]
        if n in SEMIVOWEL_AID:
            u["sup"] = SEMIVOWEL_AID[n]
            u["change"] = True
            continue
        if n not in GUM_TRIGGERS:
            continue
        after = None
        for x in flat[k + 1:]:
            if x is not None:
                after = x["c"]
                break
        prev = None
        for x in reversed(flat[:i]):
            if x is not None and x["c"] in VOWEL_C:
                prev = x["c"]
                break
        u["c"] = "m"
        u["candra"] = True
        u["change"] = True
        # The engine keys the short form on "a CONSONANT immediately follows the
        # sibilant" (`hasImmediateConsonantAfterSpecial`), so nothing-following
        # falls through to `gṁ` — not to `g`/`gg`. Matching that exactly.
        if after is None or after in VOWEL_C:
            u["sup"] = "gṁ"
        elif prev in SHORT_AV:
            u["sup"] = "gg"
        else:
            u["sup"] = "g"


def rebuild_iast(tokens):
    """`apply_vedic_anusvara` rewrites letters, so the syllable's own IAST and
    its three derived scripts have to be rebuilt from the units — the same
    contract `tokens.line_tokens` keeps."""
    for tk in tokens:
        if tk["t"] != "syl":
            continue
        iast = "".join(u["c"] for u in tk["units"])
        if iast == tk["iast"]:
            continue
        tk["iast"] = iast
        tk["deva"], tk["tel"], tk["tam"] = derive(iast)


# --------------------------------------------------------------------------
# the content
# --------------------------------------------------------------------------
def V(vid, lines, n=None, src=None, rv=None, tr=""):
    """One verse.

    `lines`   source IAST, accents inline in VU's three code points. Svara is
              ATTESTED — transcribed from an accented witness, never derived and
              never placed by the positional convention (MARKING-RULES §3.1);
              this is genuinely Vedic saṁhitā/brāhmaṇa text, where that would be
              forbidden.
    `src`     the exact locus, shown under the verse in the reader.
    `rv`      the Ṛgvedic parallel, appended to `src`. It is a PARALLEL — the
              recitation is Taittirīya (see the module docstring).
    `tr`      a researched, neutral English rendering (AUTHORING-CHANTS §0.1):
              written for this document, not copied from any one translation.
    """
    source = src if not rv else "%s · parallel: %s" % (src, rv)
    return {"id": vid, "lines": lines, "n": n, "source": source, "tr": tr}


VERSES = [
    V("v-1",
      ["viṣṇo̱ḥ nu ka̍ṁ vī̱ryā̍ṇi̱ pra vo̍ca̱ṁ",
       "yaḥ pārthi̍vāni vima̱me rajāṁ̍si̱",
       "yo aska̍bhāya̱d utta̍raṁ sa̱dhastha̍ṁ",
       "vicakramā̱ṇaḥ tre̱dhoru̍gā̱yo"],
      n="1", src="Taittirīya Saṁhitā 1.2.13.3",
      rv="Ṛgveda 1.154.1",
      tr="I now proclaim the heroic deeds of Viṣṇu, who measured out the earthly spaces, who propped up the upper dwelling-place, striding wide three times."),
    V("v-2",
      ["viṣṇo̍ḥ a̱rāṭa̍m asi̱ viṣṇo̎ḥ pṛ̱ṣṭham a̍si̱",
       "viṣṇo̱ḥ śnaptre̎ stho̱ viṣṇo̱ḥ syūḥ a̍si̱",
       "viṣṇo̎ḥ dhru̱vam a̍si vaiṣṇa̱vam a̍si̱",
       "viṣṇa̍ve tvā ||"],
      n="2", src="Taittirīya Saṁhitā 1.2.13.3",
      rv=None,
      tr="You are Viṣṇu's edge; you are Viṣṇu's back; you two are Viṣṇu's jaws; you are Viṣṇu's seam; you are Viṣṇu's firm point. You belong to Viṣṇu — you, for Viṣṇu."),
    V("v-3",
      ["tad a̍sya pri̱yam a̱bhi pātho̍ aśyām |",
       "naro̱ yatra̍ deva̱yavo̱ mada̍nti |",
       "u̱ru̱kra̱masya̱ sa hi bandhu̍ḥ i̱tthā |",
       "viṣṇo̎ḥ pa̱de pa̍ra̱me madhva̱ utsa̍ḥ"],
      n="3", src="Taittirīya Brāhmaṇa 2.4.6.2",
      rv="Ṛgveda 1.154.5",
      tr="May I reach that dear pasture of his, where men devoted to the gods rejoice; for there is the true kinship with the wide-strider — in Viṣṇu's highest step is a spring of honey."),
    V("v-4",
      ["pra tad viṣṇu̍ḥ stavate vī̱ryā̍ya |",
       "mṛ̱go na bhī̱maḥ ku̍ca̱ro gi̍ri̱ṣṭhāḥ |",
       "yasyo̱ruṣu̍ tri̱ṣu vi̱krama̍ṇeṣu |",
       "adhi̍kṣi̱yanti̱ bhuva̍nāni̱ viśvā"],
      n="4", src="Taittirīya Brāhmaṇa 2.4.3.4",
      rv="Ṛgveda 1.154.2",
      tr="For this is Viṣṇu praised, for his heroic power — dread as a roaming beast that haunts the mountains, in whose three wide strides all the worlds have their dwelling."),
    V("v-5",
      ["pa̱ro mātra̍yā ta̱nuvā̍ vṛdhāna |",
       "na te̍ mahi̱tvam anva̍śnuvanti |",
       "u̱bhe te̍ vidma̱ raja̍sī pṛthi̱vyā viṣṇo̍ deva̱ tvam |",
       "pa̱ra̱masya̍ vitse"],
      n="5", src="Taittirīya Brāhmaṇa 2.8.3.2",
      rv="Ṛgveda 7.99.1",
      tr="Grown beyond all measure in your body — none attain your greatness. We know both your realms, of earth and of heaven; O Viṣṇu, O god, you know the highest."),
    V("v-6",
      ["vica̍krame pṛthi̱vīm e̱ṣa e̱tām |",
       "kṣetrā̍ya̱ viṣṇu̱ḥ manu̍ṣe daśa̱syann |",
       "dhru̱vāso̍ asya kī̱rayo̱ janā̍saḥ |",
       "u̱ru̱kṣi̱tiṁ su̱jani̍mā cakāra"],
      n="6", src="Taittirīya Brāhmaṇa 2.4.3.5",
      rv="Ṛgveda 7.100.4",
      tr="This one strode across this earth, that Viṣṇu might grant it as a dwelling-field for man; steadfast are his singers, his people; he made a wide abode and a good birth."),
    V("v-7",
      ["trir de̱vaḥ pṛ̍thi̱vīm e̱ṣa e̱tām |",
       "vica̍krame śa̱tarca̍saṁ mahi̱tvā |",
       "pra viṣṇu̍ḥ astu ta̱vasa̱ḥ tavī̍yān |",
       "tve̱ṣaṁ hya̍sya̱ sthavi̍rasya̱ nāma"],
      n="7", src="Taittirīya Brāhmaṇa 2.4.3.5",
      rv="Ṛgveda 7.100.3",
      tr="Three times this god strode across this earth, of hundredfold-hymned greatness. Let Viṣṇu be mightier than the mighty, for awesome is the name of him, the enduring one."),
    V("v-8",
      ["ato̍ de̱vā a̍vantu no̱ yato̱ viṣṇu̍ḥ vicakra̱me |",
       "pṛ̱thi̱vyāḥ sa̱pta dhāma̍bhiḥ"],
      n="8", src="Ṛgveda 1.22.16 · in Taittirīya recitation",
      rv="Ṛgveda 1.22.16",
      tr="From there may the gods protect us — from where Viṣṇu strode out, through the seven stations of the earth."),
    V("v-9",
      ["i̱daṁ viṣṇu̱ḥ vica̍krame tre̱dhā ni da̍dhe pa̱dam |",
       "samū̍ḍham asya pāṁsu̱re"],
      n="9", src="Taittirīya Saṁhitā 1.2.13.1–2",
      rv="Ṛgveda 1.22.17",
      tr="Viṣṇu strode across this world; three times he set down his step; it lies gathered up in his dust."),
    V("v-10",
      ["trīṇi̍ pa̱dā vica̍krame viṣṇu̍ḥ go̱pā adā̎bhyaḥ |",
       "tato̱ dharmā̍ṇi dhā̱rayann"],
      n="10", src="Taittirīya Brāhmaṇa 2.4.6.1",
      rv="Ṛgveda 1.22.18",
      tr="Three steps Viṣṇu strode, the guardian none may deceive, upholding thence the ordinances."),
    V("v-11",
      ["viṣṇo̱ḥ karmā̍ṇi paśyata̱ yato̎ vra̱tāni̍ paspa̱śe |",
       "indra̍sya̱ yujya̱ḥ sakhā̎"],
      n="11", src="Taittirīya Saṁhitā 1.3.6.2",
      rv="Ṛgveda 1.22.19",
      tr="Behold the works of Viṣṇu, by which he has kept watch over the sacred observances — Indra's fitting companion."),
    V("v-12",
      ["tad viṣṇo̎ḥ para̱maṁ pa̱daṁ sadā̍ paśyanti sū̱raya̍ḥ |",
       "di̱vīva̱ cakṣu̱ḥ āta̍tam"],
      n="12", src="Taittirīya Saṁhitā 1.3.6.2",
      rv="Ṛgveda 1.22.20",
      tr="That highest step of Viṣṇu the seers behold for ever, set wide like an eye in heaven."),
    V("v-13",
      ["tad viprā̍so vipa̱nyavo̍ jāgṛ̱vāṁsa̱ḥ samin̍dhate |",
       "viṣṇo̱ḥ yat pa̍ra̱maṁ pa̱dam"],
      n="13", src="Ṛgveda 1.22.21 · in Taittirīya recitation",
      rv="Ṛgveda 1.22.21",
      tr="That which the inspired, the praise-loving, the ever-wakeful kindle — that highest step of Viṣṇu."),
    V("v-14",
      ["paryā̎ptyā̱ anaṁ̍tarāyāya̱ sarva̍stomo 'tirā̱tra",
       "u̍tta̱ma maha̍r bhavati",
       "sarva̱syāptyai̱ sarva̍sya̱ jittyai̱",
       "sarva̍m e̱va tenā̎pnoti̱ sarvaṁ̍ jayati"],
      n=None, src="Brāhmaṇa prose · locus not verified — see NOTES",
      rv=None,
      tr="For full attainment, for freedom from interruption, the sarvastoma atirātra becomes the final day — for the winning of all, for the conquest of all; by it one wins all, one conquers all."),
    V("v-15",
      ["oṁ śānti̱ḥ śānti̱ḥ śānti̍ḥ"],
      n=None, src="śānti pāṭha",
      rv=None,
      tr="Oṁ. Peace, peace, peace."),]


# One section per movement of the recitation. Every verse ALSO carries its own
# `source` (the owner's requirement: the exact locus next to each), because the
# loci differ verse by verse and a section source could only run them together
# in prose.
SECTIONS = [
    ("sec-1", "Viṣṇu Sūktam",
     "Kṛṣṇa Yajurveda · Taittirīya Saṁhitā 1.2.13 · Taittirīya Brāhmaṇa 2.4, 2.8",
     ["v-%d" % i for i in range(1, 8)]),
    ("sec-2", "Viṣṇoḥ karmāṇi — the six ṛcs",
     "Taittirīya Saṁhitā 1.2.13, 1.3.6 · Taittirīya Brāhmaṇa 2.4.6 · "
     "parallel: Ṛgveda 1.22.16–21",
     ["v-%d" % i for i in range(8, 14)]),
    ("sec-3", "Phalaśruti and śānti",
     "Brāhmaṇa prose · śānti pāṭha",
     ["v-14", "v-15"]),
]

TITLE = "viṣṇu sūktam"
SUBTITLE = "Hymn to Viṣṇu — the three strides that measure out the worlds"
DOC_SOURCE = ("kṛṣṇayajurveda · Taittirīya Saṁhitā 1.2.13, 1.3.6 · "
              "Taittirīya Brāhmaṇa 2.4, 2.8")


def verse_tokens(v):
    """Source lines -> reader tokens, with the accents re-attached.

    THE WHOLE VERSE IS ONE FRAGMENT, with ` // ` for each line break. Marking
    line by line and stitching `{"t":"br"}` between the pieces makes the break
    a hard barrier for the saṁyukta scan — and MARKING-RULES §2.3 measured that
    and rejected it ("he boxes clusters that span a line break, so `br` is a
    plain word space"; 500/534 against 510/534). It cost this document two of
    the owner's boxes: `pravocaṁ` / `yaḥ` in v-1 and `sadhasthaṁ` /
    `vicakramāṇaḥ` in v-1, whose clusters begin on the line before.

    Order of operations is MARKING-RULES §7: pauses, holdings, anusvāra,
    visarga, svarabhakti (all inside `line_tokens`), THEN the recension layer,
    and svara last — it is a data field and never moves a box.
    """
    cleans, accs = [], []
    for ln in v["lines"]:
        clean, acc = strip_accents(ln)
        cleans.append(clean)
        accs.append(acc)
    toks = line_tokens(" // ".join(cleans))
    # `strip_accents` indexes each accent by its nucleus WITHIN its own line, so
    # the counter restarts at every `br`. Asserting that every recorded accent
    # was consumed is what catches a line whose syllable count moved: the
    # accents are transcribed data (§5I), and one silently dropped is a wrong
    # recitation with nothing on screen to show for it.
    line = nucleus = 0
    used = [0] * len(accs)
    for tk in toks:
        if tk["t"] == "br":
            line += 1
            nucleus = 0
            continue
        if tk["t"] != "syl":
            continue
        svara = accs[line].get(nucleus)
        if svara:
            for u in tk["units"]:
                if u["c"] in VOWEL_C:
                    u["svara"] = svara
                    used[line] += 1
                    break
            else:
                raise SystemExit(f"no vowel to accent in {tk['iast']!r}")
        nucleus += 1
    for i, (acc, n) in enumerate(zip(accs, used)):
        assert len(acc) == n, (
            f"{v['id']} line {i + 1}: {len(acc)} accents recorded but {n} "
            f"attached — the syllable count moved")
    apply_vedic_anusvara(toks)
    rebuild_iast(toks)
    if v["n"]:
        toks.append({"t": "num", "s": v["n"]})
        toks.append({"t": "danda", "s": "॥"})
    return toks


def build():
    by_id = {v["id"]: v for v in VERSES}
    missing = []
    sections = []
    for sid, label, ssrc, vids in SECTIONS:
        verses = []
        for vid in vids:
            v = by_id[vid]
            toks = verse_tokens(v)
            surfaces = surfaces_of(toks)
            words = []
            for s in surfaces:
                if s not in WORDS:
                    missing.append((vid, s))
                    words.append({"surface": s, "entries": []})
                else:
                    words.append({"surface": s, "entries": WORDS[s]})
            # the invariant the whole format rests on (AUTHORING-CHANTS §7)
            assert len(words) == len(surfaces), (vid, len(words), len(surfaces))
            verses.append({
                "id": vid, "n": v["n"], "lineBreak": "source",
                "tokens": toks, "source": v["source"],
                "translation": {"en": v["tr"]}, "words": words,
            })
        sections.append({"id": sid, "label": label, "source": ssrc,
                         "verses": verses})
    if missing:
        print("MISSING GRAMMAR (%d):" % len(missing))
        seen = set()
        for vid, s in missing:
            if s in seen:
                continue
            seen.add(s)
            print("    %-22s %s" % (s, vid))
        raise SystemExit("every word needs a parse — AUTHORING-CHANTS §0.2")
    return {
        "format": "vedaunion.chant", "version": 2,
        "id": SLUG, "title": TITLE, "subtitle": SUBTITLE, "source": DOC_SOURCE,
        "primaryScript": "iast",
        "scripts": ["iast", "devanagari", "telugu", "tamil"],
        "titleForms": {
            "iast": TITLE,
            "devanagari": derive("viṣṇu")[0] + " " + derive("sūktam")[0],
            "telugu": derive("viṣṇu")[1] + " " + derive("sūktam")[1],
            "tamil": derive("viṣṇu")[2] + " " + derive("sūktam")[2],
        },
        "lineBreak": "source",
        "sections": sections,
    }


def report(doc):
    nv = sum(len(s["verses"]) for s in doc["sections"])
    nw = sum(len(v["words"]) for s in doc["sections"] for v in s["verses"])
    holds = svaras = gum = 0
    longest = 0
    for s in doc["sections"]:
        for v in s["verses"]:
            line = []
            for tk in v["tokens"]:
                if tk["t"] == "syl":
                    line.append(tk["iast"])
                    for u in tk["units"]:
                        holds += 1 if u.get("hold") else 0
                        svaras += 1 if u.get("svara") else 0
                        gum += 1 if u.get("candra") else 0
                elif tk["t"] == "sp":
                    line.append(" ")
                elif tk["t"] == "br":
                    longest = max(longest, len("".join(line)))
                    line = []
            longest = max(longest, len("".join(line)))
    print("sections %d · verses %d · words %d" % (len(doc["sections"]), nv, nw))
    print("holdings %d · svara %d · gum %d" % (holds, svaras, gum))
    print("longest rendered line: %d chars (keep under ~60)" % longest)


def main():
    if "--surfaces" in sys.argv:
        # the way to re-derive the glossary keys after editing the text
        seen = {}
        for v in VERSES:
            for s in surfaces_of(verse_tokens(v)):
                seen[s] = seen.get(s, 0) + 1
        for s in sorted(seen):
            print("%-24s %d%s" % (s, seen[s], "" if s in WORDS else "   <- NO GRAMMAR"))
        print("%d distinct surfaces" % len(seen))
        return
    doc = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    report(doc)
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
