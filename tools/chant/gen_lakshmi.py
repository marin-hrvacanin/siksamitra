# -*- coding: utf-8 -*-
"""Śrī Lakṣmyaṣṭottaraśatanāmāvaliḥ -> client/public/chants/lakshmi-ashtottara.json

NEVER hand-edit the JSON. Edit this file and re-run; the output is
byte-deterministic (run it twice and `cmp`).

    python3 tools/chant/gen_lakshmi.py

WHAT THIS TEXT IS — and what it is NOT
--------------------------------------
"The 108 names of Lakṣmī" in living use is the nāmāvalī that opens
`oṁ prakṛtyai namaḥ · oṁ vikṛtyai namaḥ · oṁ vidyāyai namaḥ`. It is the
ARCHANĀ form of the **Śrī Lakṣmyaṣṭottaraśatanāma Stotram**, whose ślokas run
`prakṛtiṁ vikṛtiṁ vidyāṁ sarvabhūtahitapradām …`: each accusative of the stotra
becomes a dative framed by `oṁ … namaḥ`, one name per flower offered.

Several DIFFERENT Lakṣmī aṣṭottaras circulate and must not be conflated:
  * `mahālakṣmyaṣṭottaraśatanāmāvaliḥ` (`śuddhalakṣmyai · buddhilakṣmyai …`),
    edited by S. V. Radhakrishna Śāstrī — a different text entirely;
  * `lakṣmyaṣṭottaraśatanāmastotram` marked `nāradīyopapurāṇāntargatam`
    (`brahmajā brahmasukhadā …`), an aṅga of a Lakṣmī-sahasranāma;
  * the Aṣṭalakṣmī and the form-specific (ādi-, gaja-, dhānya-, dhairya-,
    aiśvarya-, vidyā-, santāna-, vijaya-) nāmāvalīs.
This file is the first of those only.

THREE REGISTERS IN ONE DOCUMENT (MARKING-RULES §3)
---------------------------------------------------
The 108 names are **prose invocation formulae** — §3.3, exactly like Pūjā
Vidhi's `oṁ sumukhāya namaḥ`. Holdings + anusvāra + visarga only. Their
traditional chanting contour is the owner's to supply; until he does they ship
with no svara, and the colophon with them.

The two dhyāna ślokas are chanted, and each takes a different register:

  **dhy-2 is ATTESTED.** It is Ṛgveda Khila 2.6.23, the śrī sūkta phalaśruti —
  genuinely Vedic, so its accent is real data. And the owner has already marked
  it: `client/public/library/shankaracharya-stotrani-iast.pdf`, where it closes
  the Kanakadhārā Stotram. Rule zero — his marks are copied run by run, not
  re-derived, and three of his READINGS correct the stotra witnesses (see the
  note on the verse).

  **dhy-1 is CONVENTIONAL.** No accented witness exists for it, and §3.2 ships
  no preset for its metre — so by the letter of §3.2 rule 3 it would ship
  unmarked. The owner's ruling is to mark it as the Rudram dhyānam is marked,
  and `SVARA_POS` below is that preset, MEASURED off two of his own marked
  dhyāna ślokas rather than invented. He labels the Rudram's, in his own words,
  "meditation, artificial svaras" — which is what sanctions the register.

What is NOT done: no positional pattern is ever applied to the names (a count
is not a metre — §3.2 rule 2), and `apply_convention` is all-or-nothing per
verse, so a pāda that does not scan leaves the whole verse bare and says so.

The anusvāra source is `smriti` (MARKING-RULES §4, last block): the anusvāra is
kept and highlighted, and **no gum / g-forms are generated**. Do NOT import
`gen_vishnu.apply_vedic_anusvara` here — that is the Taittirīya layer, and this
text is not Taittirīya.

SOURCES — four witnesses, and what each settled
-----------------------------------------------
1. **Thanjavur Mahārāja Serfoji's Sarasvatī Mahal Library Series No. 367**
   (*Vratamahimā · Vināyakādi Vrataśataka Kathā*), pp. 67–68 — PRIMARY, and
   the only one that is a PRINTED NĀMĀVALĪ rather than a web transcription.
   Devanāgarī, names numbered by tens (10 padmālayā, 20 vibhāvarī,
   30 anugrahapradā, 40 lokamātṛ, 50 devī, 60 caturbhujā), closing
   `iti śrīlakṣmyaṣṭottaraśatanāmāvaliḥ`. Scanned at archive.org
   (`vrat-mahima-vinayakadi-vrat-shatak-katha-series-no.-367-thanjavur-
   sarasvati-mahal-series`), leaves 72–73, and cited by sanskritdocuments.org
   as the source of its own file.
2. **sanskritdocuments.org** `lakshmi108.itx` — the nāmāvalī, transliterated by
   Devi Kumar, proofread by Devi Kumar / Sunder Hattangadi / Easwaran / Tanvir
   Chowdhury. Agrees with the print name for name, including the two `devī`s.
3. **sanskritdocuments.org** `laxmi108naama.itx` — the STOTRA, proofread by
   Ravin Bhalekar. The authority for the two dhyāna ślokas and for how the
   names group into ślokas (which is what the sections below are).
4. **Vaidika Vignanam** (vignanam.org), both the stotra and its own nāmāvalī —
   an independent recitation witness. It splits the seam near name 89
   differently (see below) and prints a handful of variants.

Where they disagreed, and who won:
  * `anugrahapradāyai` (30) — print + vignanam's STOTRA. sanskritdocuments'
    stotra reads `anugrahapadāṁ` (a dropped `r`), vignanam's nāmāvalī
    `anugrahaparāyai`. Two independent witnesses to the stotra text settle it.
  * `krodhasambhavāyai` (29) — print + both stotra witnesses. The widely
    circulated `kāmāyai · kṣīrodasambhavāyai` ("born of the ocean of milk") is
    a real and old VARIANT, recorded by sanskritdocuments and vignanam as
    such; it splits one name into two and so needs a compensating merge
    elsewhere. The print's reading is kept; the variant is named on the page.
  * `puṣṭyai` (65), `tuṣṭyai` (71) — the print, and the stotra's own
    `puṣṭiṁ` / `tuṣṭiṁ` (i-stems). sanskritdocuments' nāmāvalī prints
    `puṣṭāyai`/`tuṣṭāyai` with the i-stem datives as its recorded variants;
    vignanam has `puṣṭyai` and `tuṣṭaye`. Note 19 is a different word:
    `nityapuṣṭāyai`, an ā-stem, in every witness.
  * `straiṇasaumyāyai` (87) — print + both stotras' primary reading;
    `sadā saumyāṁ` is recorded as the variant by sanskritdocuments and
    vignanam alike.
  * `nṛpaveśmagatānandāyai` (89) as ONE name, and `devyai` (102) as a name in
    its own right — the print and sanskritdocuments. Vignanam instead splits
    89 into `nṛpaveśmagatāyai` + `nandāyai` and drops the second `devī`; both
    routes reach 108, and this file follows the printed nāmāvalī throughout
    rather than mixing the two.
  * `maṅgalādevyai` (96) — the print writes it as ONE compound, which is what
    makes the count come out at 108 against the stotra's `namāmi maṅgalāṁ
    devīṁ`. Splitting it would give 109.
  * `brahmaviṣṇuśivātmikāyai` (106) — both stotra witnesses and vignanam's
    nāmāvalī. The print appears to read `brahmā-`; `brahma-` is the regular
    compounding stem and the reading of the majority.
  * `udārāṅgāyai` (82) — the printed NĀMĀVALĪ (the stotra witnesses read
    `udārāṅgīṁ` / `udārāṅgāṁ`; a nāmāvalī is what we are publishing).
  * `śubhapradāyai` (88) — the print. sanskritdocuments' nāmāvalī reads
    `śubhapradāye`, which is not a form: an ā-stem takes `-āyai` in the dative,
    and the same file writes `-pradāyai` at 4, 30 and 91. A typo, not a variant.
  * `nityapuṣṭāyai` (19) — every witness. sanskritdocuments additionally
    records `nityapuṣṭyai`; the stotra's `nityapuṣṭāṁ` decides it.

A diff of all 108 names against sanskritdocuments returns exactly four
differences, and they are the four decisions above (65, 71, 88, 106). Re-run it
whenever the text is touched — anything outside that set is a transcription
error.

THE COUNT IS VERIFIED TWO WAYS, and the sections are the verification
----------------------------------------------------------------------
Every section below is one śloka of the stotra, and its names are that śloka's
accusatives in order. The 14 groups come to 8+12+9+8+7+8+7+9+8+8+7+6+6+5 = 108,
and the running total lands on the printed nāmāvalī's own decade marks
(10, 20, 30, 40, 50, 60). `build()` asserts both — the total and each section's
first index — so a future edit cannot silently drop or double a name.

STILL OPEN — reported, not papered over
  The stotra has **no purāṇic locus**. It is transmitted as a Śiva–Pārvatī
  dialogue with its own tantric viniyoga, and the catalogues record it as
  such: StotraSamhita lists composer and source as unknown, sanskritdocuments
  files it under "Author: Traditional", and the printed witness prints it
  inside a vrata compendium with no citation. Editions and websites that
  assign it to the Padma or Skanda Purāṇa give no chapter, and no such chapter
  could be found. It is therefore cited for what it verifiably is — an
  Īśvara–Devī saṁvāda, in the Sarasvatī Mahal printing — and NOT given a
  purāṇa reference it may not have. A manufactured citation would be worse
  than an honest one. (Commentators expound the names from the **Lakṣmī
  Tantra** and the **Śrī Sūkta**; that is exegesis, not provenance, and is
  described as exegesis on the document page.)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tokens import derive, line_tokens                            # noqa: E402
from gen_puja import (ATTESTED, VOWEL_C, apply_attested,          # noqa: E402
                      strip_accents, surfaces_of)
from lakshmi_words import WORDS                                   # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "..", "client", "public", "chants",
                   "lakshmi-ashtottara.json")

SLUG = "lakshmi-ashtottara"
TITLE = "śrī lakṣmyaṣṭottaraśatanāmāvaliḥ"
SUBTITLE = "The garland of the hundred and eight names of Lakṣmī"
DOC_SOURCE = ("Śrī Lakṣmyaṣṭottaraśatanāma Stotram · īśvara–devī saṁvāda · "
              "Sarasvatī Mahal Series 367, pp. 67–68")

# The single register decision for this document (see the module docstring).
# `None` = holdings + anusvāra + visarga only. Nothing here is metrical in a
# metre the presets cover, and nothing here is Vedic, so no verse takes svara.
REGISTER = []            # (verse, register, [(pāda, nuclei, matched?)])


# --------------------------------------------------------------------------
# the dhyāna
# --------------------------------------------------------------------------
# Lines are written in the UNDERLYING form (AUTHORING-CHANTS §5A-bis step 1):
# an un-assimilated `ṁ`, an un-sandhied `ḥ`. The marking engine derives the
# letter actually recited and paints it `change` — `maṇigaṇaiḥ nānāvidhaiḥ`
# renders `maṇigaṇair nānāvidhair`, `-bhiḥ sevitāṁ` renders `-bhis sevitāṁ`.
# Writing the sandhi already applied would move the holdings by a letter
# (MARKING-RULES §7).
# The owner's OWN marked dhyāna. `V2` carries his accents INLINE, in VU's three
# code points; `V1` carries none, and takes the convention below.
DHYANA = [
    ("dhy-1", "shardulavikridita",
     ["vande padmakarāṁ prasannavadanāṁ saubhāgyadāṁ bhāgyadāṁ",
      "hastābhyām abhayapradāṁ maṇigaṇaiḥ nānāvidhaiḥ bhūṣitām |",
      "bhaktābhīṣṭaphalapradāṁ hariharabrahmādibhiḥ sevitāṁ",
      "pārśve paṅkajaśaṅkhapadmanidhibhiḥ yuktāṁ sadā śaktibhiḥ ||"],
     "śārdūlavikrīḍita · svara by the owner's convention for the metre",
     "I bow to her who holds the lotus, whose face is gracious, who gives good "
     "fortune and gives destiny; who with her two hands grants fearlessness, "
     "adorned with jewels of every kind; who grants the wish of her devotees, "
     "served by Hari, Hara, Brahmā and the rest; attended at her side, always, "
     "by the lotus, the conch, the padma treasure and her powers."),
    # ATTESTED, and copied run by run from the owner's own marked file —
    # `client/public/library/shankaracharya-stotrani-iast.pdf`, where it closes
    # the Kanakadhārā Stotram and is cited `ṚVKh 2.6.23 śrīsūkta phalaśruti`.
    # It is a Ṛgveda KHILA verse, so the accent is real data, not convention.
    # Rule zero: his marks, not a re-derivation.
    #
    # THREE READINGS COME FROM HIM AND CORRECT WHAT THE STOTRA WITNESSES GAVE:
    #   `sarasija nilaye`  — not `sarasijanayane`. sanskritdocuments' NĀMĀVALĪ
    #                        reads `nilaye` too; only its stotra file has
    #                        `nayane`, and a lotus ABODE is what the phalaśruti
    #                        says and what his English renders.
    #   `dhavalatama-`     — the superlative ("the whitest"), not the
    #                        comparative `dhavalatara-`.
    #   `manojgñe`         — the `jñ` reading aid, printed as a superscript `g`
    #                        on the `j`. AUTHORED, exactly as the gum is
    #                        (MARKING-RULES §"The Vedic anusvāra"): written into
    #                        the source here and lifted to `sup` by `_jgna()`,
    #                        never derived — `yajña` in his own Rudram is
    #                        printed WITHOUT it, so there is no general rule to
    #                        be had.
    ("dhy-2", ATTESTED,
     ["sa̱rasija nilaye saro̱ja̍ haste̱",
      "dha̱valatamāṁśuka gandha mā̱lya śo̍bhe |",
      "bha̱gavati hari vallabhe̱ ma̍nojgñe̱",
      "tri̱bhuvana bhūti kari prasī̱da ma̍hyam ||"],
     "Ṛgveda Khila 2.6.23 · śrī sūkta phalaśruti",
     "In a lotus abode, lotus in hand, resplendent in the whitest garment, in "
     "fragrance and flower garlands; O blessed one, dear to Hari, O lovely "
     "one, maker of the wellbeing of the three worlds — be gracious to me."),
]


# --------------------------------------------------------------------------
# svara by the owner's convention — READ OFF HIS OWN MARKED DHYĀNA VERSES
# --------------------------------------------------------------------------
# MARKING-RULES §3.2 ships positional presets for anuṣṭubh, gāyatrī, triṣṭubh
# and jagatī only, and says a verse in any other metre ships UNMARKED. That is
# the right default and the wrong answer for a dhyāna śloka, which is chanted.
# The owner's ruling (2026-08) is to mark it "as the Rudram dhyānam" — so the
# preset was MEASURED off his own files rather than invented:
#
#   `sri-rudram-iast.pdf`         dhyānam, `oṁ | āpātāla nabhas sthalānta…`
#   `veda-union-sadhana-iast.pdf` dhyānam, `oṁ | bījāpūra gadekṣu kārmuka…`
#
# Both are labelled by him "(śārdūlavikrīḍitaṁ chandaḥ, 19 syllables per pāda,
# yatiḥ after the 12th, and 19th)" — and the first is labelled, in his words,
# "meditation, ARTIFICIAL SVARAS", which is the sanction for this whole
# register in his own hand. All EIGHT pādas across the two files agree, letter
# for letter, on the placement below. (The same harness reproduces §3.2's
# anuṣṭubh preset from 35 of his half-verses, 35/35 — so the method is checked
# against a known answer before being trusted on an unknown one.)
#
# The odd/even split is real, not noise: it is present in both files, in the
# same places, and it is the same shape as the anuṣṭubh convention operating
# per half-verse.
SVARA_POS = {
    "shardulavikridita": (19, {
        "odd": {1: "anudatta", 2: "anudatta", 13: "anudatta", 15: "anudatta",
                17: "svarita", 19: "anudatta"},
        "even": {1: "anudatta", 13: "anudatta", 15: "anudatta",
                 17: "svarita"},
    }),
}


def apply_convention(toks, meter):
    """Mark in place, ALL-OR-NOTHING per verse (MARKING-RULES §3.2 rule 3).

    Returns [(pāda, nuclei, matched?)] for the run report. A pāda that does not
    scan to the expected count leaves the WHOLE verse unmarked — a half-marked
    śloka reads as a bug, and forcing the pattern onto a mis-lineated verse is
    exactly the failure §3.2 rule 2 warns about.
    """
    expect, plan = SVARA_POS[meter]
    padas, cur = [], []
    for tk in toks:
        if tk["t"] == "syl":
            cur.append(tk)
        elif tk["t"] == "br":
            padas.append(cur)
            cur = []
    if cur:
        padas.append(cur)
    report_ = [(i + 1, len(p), len(p) == expect) for i, p in enumerate(padas)]
    if not all(ok for _, _, ok in report_):
        return report_
    for i, pada in enumerate(padas):
        for position, svara in plan["odd" if i % 2 == 0 else "even"].items():
            for u in pada[position - 1]["units"]:
                if u["c"] in VOWEL_C:
                    u["svara"] = svara
                    break
    return report_


# --------------------------------------------------------------------------
# the 108 names
# --------------------------------------------------------------------------
# (dative surface as printed, researched neutral gloss). The order and the
# spelling are the printed nāmāvalī's; the groups below are the stotra's
# ślokas. Glosses render what the Sanskrit says — no devotional expansion.
NAMES = [
    ("prakṛtyai", "Nature herself — the primordial ground out of which all things unfold"),
    ("vikṛtyai", "the transformation of that nature — the manifest, changing world"),
    ("vidyāyai", "knowledge"),
    ("sarvabhūtahitapradāyai", "she who bestows the welfare of all beings"),
    ("śraddhāyai", "faith — the trust that makes an act fruitful"),
    ("vibhūtyai", "abundance; manifest power and pervading presence"),
    ("surabhyai", "the fragrant one; Surabhi, the cow that yields every wish"),
    ("paramātmikāyai", "she whose very nature is the supreme Self"),
    ("vāce", "speech"),
    ("padmālayāyai", "she whose dwelling is the lotus"),
    ("padmāyai", "the lotus one"),
    ("śucaye", "the pure, the clear"),
    ("svāhāyai", "Svāhā — the call by which an oblation reaches the gods"),
    ("svadhāyai", "Svadhā — the call by which an offering reaches the ancestors"),
    ("sudhāyai", "the nectar of immortality"),
    ("dhanyāyai", "the fortunate; she who makes fortunate"),
    ("hiraṇmayyai", "made of gold"),
    ("lakṣmyai", "Lakṣmī — good fortune itself"),
    ("nityapuṣṭāyai", "ever nourished, never diminished"),
    ("vibhāvaryai", "the shining one; night lit with stars"),
    ("adityai", "Aditi, the boundless — mother of the gods"),
    ("dityai", "Diti — mother of the daityas"),
    ("dīptāyai", "the blazing"),
    ("vasudhāyai", "she who yields wealth; the earth"),
    ("vasudhāriṇyai", "she who upholds wealth, and upholds the earth"),
    ("kamalāyai", "Kamalā, of the lotus"),
    ("kāntāyai", "the lovely; the beloved"),
    ("kāmākṣyai", "she whose eyes grant what is desired"),
    ("krodhasaṁbhavāyai", "she who arises out of wrath"),
    ("anugrahapradāyai", "the giver of grace"),
    ("buddhaye", "understanding, discernment"),
    ("anaghāyai", "the faultless, the sinless"),
    ("harivallabhāyai", "the beloved of Hari"),
    ("aśokāyai", "she in whom there is no sorrow"),
    ("amṛtāyai", "the deathless; the nectar of immortality"),
    ("dīptāyai", "the blazing"),
    ("lokaśokavināśinyai", "she who destroys the grief of the world"),
    ("dharmanilayāyai", "she in whom dharma has its dwelling"),
    ("karuṇāyai", "compassion"),
    ("lokamātre", "mother of the world"),
    ("padmapriyāyai", "she to whom the lotus is dear"),
    ("padmahastāyai", "she who holds a lotus in her hand"),
    ("padmākṣyai", "lotus-eyed"),
    ("padmasundaryai", "beautiful as a lotus"),
    ("padmodbhavāyai", "risen out of the lotus"),
    ("padmamukhyai", "lotus-faced"),
    ("padmanābhapriyāyai", "beloved of the lotus-navelled one"),
    ("ramāyai", "Ramā — she who delights and is delighted in"),
    ("padmamālādharāyai", "wearing a garland of lotuses"),
    ("devyai", "the goddess"),
    ("padminyai", "she of the lotuses; the lotus pool"),
    ("padmagandhinyai", "fragrant with the scent of lotus"),
    ("puṇyagandhāyai", "whose fragrance is holy"),
    ("suprasannāyai", "wholly serene, wholly gracious"),
    ("prasādābhimukhyai", "turned toward the giving of grace"),
    ("prabhāyai", "radiance"),
    ("candravadanāyai", "moon-faced"),
    ("candrāyai", "the moon-like"),
    ("candrasahodaryai", "sister of the moon"),
    ("caturbhujāyai", "four-armed"),
    ("candrarūpāyai", "whose form is the moon"),
    ("indirāyai", "Indirā — the resplendent"),
    ("induśītalāyai", "cool as the moon"),
    ("āhlādajananyai", "mother of gladness"),
    ("puṣṭyai", "nourishment; thriving fullness"),
    ("śivāyai", "the auspicious"),
    ("śivakaryai", "she who makes all auspicious"),
    ("satyai", "the true, the faithful"),
    ("vimalāyai", "the stainless"),
    ("viśvajananyai", "mother of the universe"),
    ("tuṣṭyai", "contentment"),
    ("dāridryanāśinyai", "she who destroys poverty"),
    ("prītipuṣkariṇyai", "the lotus pool of delight"),
    ("śāntāyai", "the peaceful"),
    ("śuklamālyāmbarāyai", "garlanded and robed in white"),
    ("śriyai", "Śrī — splendour and prosperity itself"),
    ("bhāskaryai", "shining like the sun"),
    ("bilvanilayāyai", "she who dwells in the bilva tree"),
    ("varārohāyai", "of beautiful form"),
    ("yaśasvinyai", "the renowned"),
    ("vasundharāyai", "bearer of treasure; the earth"),
    ("udārāṅgāyai", "of noble body"),
    ("hariṇyai", "the tawny-golden one"),
    ("hemamālinyai", "garlanded with gold"),
    ("dhanadhānyakaryai", "she who brings wealth and grain"),
    ("siddhaye", "attainment, accomplishment"),
    ("straiṇasaumyāyai", "gentle with all the grace of womanhood"),
    ("śubhapradāyai", "the giver of good"),
    ("nṛpaveśmagatānandāyai", "the joy that enters a king's house"),
    ("varalakṣmyai", "Lakṣmī who grants boons"),
    ("vasupradāyai", "the giver of wealth"),
    ("śubhāyai", "the auspicious, the good"),
    ("hiraṇyaprākārāyai", "she whose rampart is gold"),
    ("samudratanayāyai", "daughter of the ocean"),
    ("jayāyai", "victory"),
    ("maṅgalādevyai", "the goddess who is all good fortune"),
    ("viṣṇuvakṣaḥsthalasthitāyai", "she who abides on Viṣṇu's breast"),
    ("viṣṇupatnyai", "the consort of Viṣṇu"),
    ("prasannākṣyai", "of gracious eyes"),
    ("nārāyaṇasamāśritāyai", "she who has taken her whole refuge in Nārāyaṇa"),
    ("dāridryadhvaṁsinyai", "she who shatters poverty"),
    ("devyai", "the goddess"),
    ("sarvopadravavāriṇyai", "she who wards off every calamity"),
    ("navadurgāyai", "she who is the nine Durgās"),
    ("mahākālyai", "the great Kālī"),
    ("brahmaviṣṇuśivātmikāyai", "she whose Self is Brahmā, Viṣṇu and Śiva"),
    ("trikālajñānasaṁpannāyai", "possessed of the knowledge of the three times"),
    ("bhuvaneśvaryai", "sovereign of the worlds"),
]

# One section per śloka of the stotra: (count, the śloka's incipit).
# The incipit is what makes the citation checkable — it names the exact half
# verse these names are the accusatives of.
SLOKAS = [
    (8, "prakṛtiṁ vikṛtiṁ vidyāṁ sarvabhūtahitapradām"),
    (12, "vācaṁ padmālayāṁ padmāṁ śuciṁ svāhāṁ svadhāṁ sudhām"),
    (9, "aditiṁ ca ditiṁ dīptāṁ vasudhāṁ vasudhāriṇīm"),
    (8, "anugrahapradāṁ buddhim anaghāṁ harivallabhām"),
    (7, "namāmi dharmanilayāṁ karuṇāṁ lokamātaram"),
    (8, "padmodbhavāṁ padmamukhīṁ padmanābhapriyāṁ ramām"),
    (7, "puṇyagandhāṁ suprasannāṁ prasādābhimukhīṁ prabhām"),
    (9, "caturbhujāṁ candrarūpām indirām induśītalām"),
    (8, "vimalāṁ viśvajananīṁ tuṣṭiṁ dāridryanāśinīm"),
    (8, "bhāskarīṁ bilvanilayāṁ varārohāṁ yaśasvinīm"),
    (7, "dhanadhānyakarīṁ siddhiṁ straiṇasaumyāṁ śubhapradām"),
    (6, "śubhāṁ hiraṇyaprākārāṁ samudratanayāṁ jayām"),
    (6, "viṣṇupatnīṁ prasannākṣīṁ nārāyaṇasamāśritām"),
    (5, "navadurgāṁ mahākālīṁ brahmaviṣṇuśivātmikām"),
]

# The colophon the printed nāmāvalī closes with. It is part of what is
# recited, so it lives in the reader rather than in the document body — and it
# is a SECTION of its own, not a 109th verse of the last group, because it is
# not a name: the assertions below count names, and a colophon sitting inside
# `sec-14` would make that group claim six names where the stotra has five.
#
# The print reads `॥ इति श्रीलक्ष्म्यष्टोत्तरशतनामावलिः ॥`. `saṁpūrṇā` is
# added from the stotra's own closing formula (`iti … stotraṁ sampūrṇam`) and
# is FEMININE here — it agrees with `āvaliḥ`, a feminine i-stem, not with the
# neuter `stotram` of that formula.
COLOPHON = ("iti śrīlakṣmyaṣṭottaraśatanāmāvaliḥ saṁpūrṇā ||",
            "Thus the garland of the hundred and eight names of Śrī Lakṣmī "
            "is complete.")

# The decade marks printed in the Sarasvatī Mahal nāmāvalī, as
# {name number: the name that carries it}. `build()` checks every one, so a
# dropped or doubled name shows up as a failed assertion rather than as a
# silently 107-name garland.
PRINTED_DECADES = {
    10: "padmālayāyai", 20: "vibhāvaryai", 30: "anugrahapradāyai",
    40: "lokamātre", 50: "devyai", 60: "caturbhujāyai",
    108: "bhuvaneśvaryai",
}


def _jgna(toks):
    """`jgñ` in a source line -> the `g` becomes a superscript on the `j`.

    AUTHORED, like the gum: `parse_letters` reads the `g` as an ordinary letter,
    so it arrives as its own unit between `j` and `ñ`, and this lifts it onto
    the `j` as the IAST-only reading aid the owner's file prints. It is NOT
    derived from `jñ` — his own Rudram prints `yajña` bare, so there is no rule
    here, only his spelling.
    """
    for tk in toks:
        if tk["t"] != "syl":
            continue
        u = tk["units"]
        for i in range(len(u) - 2, -1, -1):
            if u[i]["c"] == "j" and i + 2 < len(u) + 1 and \
               i + 1 < len(u) and u[i + 1]["c"] == "g" and \
               i + 2 < len(u) and u[i + 2]["c"] == "ñ":
                u[i]["sup"] = "g"
                del u[i + 1]
    return toks


def dhyana_tokens(lines, meter):
    """A dhyāna śloka: the owner's accents when he has marked it, the
    convention for the metre when he has not.

    Same one-fragment rule as `verse_tokens` — ` // ` for each line break, so a
    cluster or a sandhi spanning the break is seen (MARKING-RULES §2.3)."""
    cleans, accs = [], []
    for ln in lines:
        clean, acc = strip_accents(ln)
        cleans.append(clean)
        accs.append(acc)
    toks = line_tokens(" // ".join(cleans))
    _jgna(toks)
    rep = None
    if meter == ATTESTED:
        # his marks, indexed by nucleus WITHIN each line; the counter restarts
        # at every `br`, and every recorded accent must find a vowel.
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
                f"dhyāna line {i + 1}: {len(acc)} accents recorded but {n} "
                f"attached — the syllable count moved")
        counts, k = [], 0
        for tk in toks:
            if tk["t"] == "syl":
                k += 1
            elif tk["t"] == "br":
                counts.append(k); k = 0
        counts.append(k)
        rep = [(i + 1, n, True) for i, n in enumerate(counts)]
    else:
        assert not any(accs), "a verse marked by convention must carry no accents"
        rep = apply_convention(toks, meter)
    return toks, rep


def verse_tokens(lines, num=None):
    """Source lines -> reader tokens.

    THE WHOLE VERSE IS MARKED AS ONE FRAGMENT, with ` // ` standing for each
    line break. Marking line by line and stitching `{"t":"br"}` between the
    pieces looks equivalent and is not: it makes the break a hard barrier for
    both the saṁyukta scan and the anusvāra, and MARKING-RULES §2.3 measured
    that and rejected it. In this text it cost three marks in the first dhyāna
    śloka alone — the holdings on `hastābhyām` and `pārśve` (whose clusters
    begin on the line before) and the assimilation of `sevitāṁ` to `sevitām`
    before `pārśve`.

    Order of operations is MARKING-RULES §7 and lives inside `line_tokens`:
    the praṇava's short pause first (it is a saṁyukta barrier), then holdings,
    then anusvāra, then visarga, then svarabhakti — §6, a
    property of a letter, which moves no box — and it now comes from the engine
    (`gen_marks.apply_svarabhakti`), so it is not applied here. There is no
    svara pass at all (see SVARA above).
    """
    toks = line_tokens(" // ".join(lines))
    if num:
        toks.append({"t": "num", "s": num})
    return toks


def _words_for(vid, toks, missing):
    words = []
    surfaces = surfaces_of(toks)
    for s in surfaces:
        if s not in WORDS:
            missing.append((vid, s))
            words.append({"surface": s, "entries": []})
        else:
            words.append({"surface": s, "entries": WORDS[s]})
    # the invariant the whole format rests on (AUTHORING-CHANTS §7)
    assert len(words) == len(surfaces), (vid, len(words), len(surfaces))
    return words


def build():
    missing = []
    sections = []

    verses = []
    for vid, meter, lines, src, tr in DHYANA:
        toks, rep = dhyana_tokens(lines, meter)
        REGISTER.append((vid, meter, rep))
        verses.append({
            "id": vid, "n": None, "lineBreak": "source", "tokens": toks,
            "source": src,
            "translation": {"en": tr},
            "words": _words_for(vid, toks, missing),
        })
    sections.append({
        "id": "sec-dhyana", "label": "Dhyānam",
        "source": "the dhyāna ślokas recited before the names",
        "verses": verses,
    })

    assert sum(c for c, _ in SLOKAS) == len(NAMES) == 108, \
        "the garland must be 108 names — see the module docstring"

    i = 0
    for k, (count, incipit) in enumerate(SLOKAS, start=1):
        verses = []
        first = i + 1
        for _ in range(count):
            i += 1
            name, gloss = NAMES[i - 1]
            vid = "n-%d" % i
            line = "oṁ %s namaḥ |" % name
            toks = verse_tokens([line])
            verses.append({
                "id": vid, "n": str(i), "lineBreak": "source", "tokens": toks,
                "translation": {"en": "Homage to her who is %s." % gloss},
                "words": _words_for(vid, toks, missing),
            })
        sections.append({
            "id": "sec-%d" % k,
            "label": "Nāmāni %d–%d" % (first, i),
            "source": "Śrī Lakṣmyaṣṭottaraśatanāma Stotram, śloka %d "
                      "(%s)" % (k, incipit),
            "verses": verses,
        })
    assert i == 108, i

    toks = verse_tokens([COLOPHON[0]])
    sections.append({
        "id": "sec-iti", "label": "Iti",
        "source": "the colophon of the printed nāmāvalī",
        "verses": [{
            "id": "iti", "n": None, "lineBreak": "source", "tokens": toks,
            "translation": {"en": COLOPHON[1]},
            "words": _words_for("iti", toks, missing),
        }],
    })

    for n, expected in PRINTED_DECADES.items():
        assert NAMES[n - 1][0] == expected, (
            "name %d is %r, but the printed nāmāvalī marks %r there"
            % (n, NAMES[n - 1][0], expected))

    if missing:
        print("MISSING GRAMMAR (%d):" % len(missing))
        seen = set()
        for vid, s in missing:
            if s in seen:
                continue
            seen.add(s)
            print("    %-28s %s" % (s, vid))
        raise SystemExit("every word needs a parse — AUTHORING-CHANTS §0.2")

    return {
        "format": "vedaunion.chant", "version": 2,
        "id": SLUG, "title": TITLE, "subtitle": SUBTITLE, "source": DOC_SOURCE,
        "primaryScript": "iast",
        "scripts": ["iast", "devanagari", "telugu", "tamil"],
        "titleForms": {
            "iast": TITLE,
            "devanagari": " ".join(derive(w)[0] for w in TITLE.split()),
            "telugu": " ".join(derive(w)[1] for w in TITLE.split()),
            "tamil": " ".join(derive(w)[2] for w in TITLE.split()),
        },
        "lineBreak": "source",
        "sections": sections,
    }


def report(doc):
    nv = sum(len(s["verses"]) for s in doc["sections"])
    nw = sum(len(v["words"]) for s in doc["sections"] for v in s["verses"])
    holds = svaras = changes = pauses = dots = 0
    lines = []
    for s in doc["sections"]:
        for v in s["verses"]:
            cur = []
            for tk in v["tokens"]:
                if tk["t"] == "syl":
                    cur.append(tk["iast"])
                    for u in tk["units"]:
                        holds += 1 if u.get("hold") else 0
                        svaras += 1 if u.get("svara") else 0
                        changes += 1 if u.get("change") else 0
                        dots += 1 if u.get("sbhakti") else 0
                elif tk["t"] == "sp":
                    cur.append(" ")
                elif tk["t"] == "pause":
                    pauses += 1
                elif tk["t"] == "br":
                    lines.append("".join(cur))
                    cur = []
            lines.append("".join(cur))
    longest = max(lines, key=len)
    print("sections %d · verses %d · words %d" % (len(doc["sections"]), nv, nw))
    print("holdings %d · change %d · pauses %d · svarabhakti %d · svara %d"
          % (holds, changes, pauses, dots, svaras))
    for vid, meter, rep in REGISTER:
        ok = all(m for _, _, m in rep)
        print("  %-6s %-18s pādas %s  %s"
              % (vid, meter, [n for _, n, _ in rep],
                 "marked" if ok else "!! DID NOT SCAN — left unmarked"))
        assert ok, f"{vid}: the metre did not scan; reported, not forced"
    print("longest rendered line: %d chars — %s" % (len(longest), longest))
    # AUTHORING-CHANTS §7: no rendered line may be long enough to wrap.
    assert len(longest) <= 60, "line too long to render without wrapping"


def main():
    if "--surfaces" in sys.argv:
        # the way to re-derive the glossary keys after editing the text
        seen = {}
        for _, lines, _tr in DHYANA:
            for s in surfaces_of(verse_tokens(lines)):
                seen[s] = seen.get(s, 0) + 1
        for name, _g in NAMES:
            for s in surfaces_of(verse_tokens(["oṁ %s namaḥ |" % name])):
                seen[s] = seen.get(s, 0) + 1
        for s in sorted(seen):
            print("%-30s %d%s" % (s, seen[s], "" if s in WORDS else "   <- NO GRAMMAR"))
        print("%d distinct surfaces" % len(seen))
        return
    doc = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        # MINIFIED, the house delivery format (`gen_puja.py`, and what
        # `pack_chants.py` rewrites every chant to): `indent=1` made whitespace
        # half the file, and the browser parses every byte before a syllable
        # renders. This file is generated — read the generator, not the JSON.
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    report(doc)
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
