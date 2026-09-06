# -*- coding: utf-8 -*-
"""Per-word grammar for `gen_lakshmi.py`, keyed by the surface AFTER the
anusvāra / visarga transforms (`padmakarām`, `maṇigaṇair`, `hariharabrahmādibhis`,
`viṣṇuvakṣassthalasthitāyai`, `trikālajñānasampannāyai`, …).

`gen_lakshmi.build()` fails loudly on any surface with no entry, so the grammar
can never drift out of alignment with the token stream (AUTHORING-CHANTS §5C).
Run `gen_lakshmi.py --surfaces` to re-derive the key list after editing the text.

Conventions (AUTHORING-CHANTS §4):
  * `vibhakti` 1..8, 7 = locative, 8 = vocative; `purusha` 1/2/3 =
    uttama/madhyama/prathama.
  * `gana` is rendered inline as `root (gana)`, so it holds the gaṇa and
    nothing else; remarks go in `note`.
  * An upasarga on a FINITE verb gets its own entry beside the root
    (`prasīda` -> `pra` + `√sad`); a preverb lexicalised into a nominal or
    participial stem stays inside that lemma with the derivation in `note`.
  * `forms` is derived, never hand-typed.

THE SHAPE OF THIS TEXT: 108 of the 135 surfaces are one and the same
construction — `oṁ <name in the dative> namaḥ`, "homage to her who is X". Every
name is therefore FEMININE, CATURTHĪ (dative), EKAVACANA, and `N()` below
writes exactly that, so the one thing a reader has to look at per name is its
stem class and its compound analysis. The stems fall into four classes and the
dative ending is what tells them apart in the reader:

    ā-stem   vidyā       -> vidyāyai        ī-stem   devī     -> devyai
    i-stem   buddhi      -> buddhaye        ṛ-stem   lokamātṛ -> lokamātre
    (śrī, a monosyllabic ī-stem, takes śriyai; vāc, a consonant stem, vāce)

That is also where the two easiest mistakes in this nāmāvalī live, and both are
settled by the stotra the names are the accusatives of (gen_lakshmi docstring):
`puṣṭi`/`tuṣṭi` are i-stems (stotra: `puṣṭiṁ`, `tuṣṭiṁ`) and give `puṣṭyai` /
`tuṣṭyai`, while `nityapuṣṭā` is a different word, an ā-stem participle
(`nityapuṣṭāṁ`), giving `nityapuṣṭāyai`.
"""
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate


def _forms(head):
    if head in ("oṁ", "oṃ", "om"):
        return {"deva": "ॐ", "tel": "ఓం", "tam": "ௐ"}
    b = head.replace("ṁ", "ṃ")
    return {"deva": transliterate(b, sanscript.IAST, sanscript.DEVANAGARI),
            "tel": transliterate(b, sanscript.IAST, sanscript.TELUGU),
            "tam": transliterate(b, sanscript.IAST, sanscript.TAMIL)}


def S(lemma, meaning, gender, vibhakti, vacana, stem=None, note=None):
    """subanta"""
    e = {"lemma": lemma, "type": "subanta", "meaning": meaning,
         "gender": gender, "vibhakti": vibhakti, "vacana": vacana,
         "forms": _forms(lemma)}
    if stem:
        e["stem"] = stem
    if note:
        e["note"] = note
    return e


def T(root, meaning, gana, lakara, purusha, vacana, note=None):
    """tiṅanta"""
    e = {"lemma": root, "type": "tinanta", "meaning": meaning, "root": root,
         "gana": gana, "lakara": lakara, "purusha": purusha, "vacana": vacana,
         "forms": _forms(root)}
    if note:
        e["note"] = note
    return e


def A(lemma, meaning, note=None):
    """avyaya"""
    e = {"lemma": lemma, "type": "avyaya", "meaning": meaning,
         "forms": _forms(lemma)}
    if note:
        e["note"] = note
    return e


def U(lemma, meaning):
    """upasarga"""
    return {"lemma": lemma, "type": "upasarga", "meaning": meaning,
            "forms": _forms(lemma)}


def C(lemma, meaning, stem=None, note=None):
    """An uninflected PRIOR MEMBER of a compound that the owner writes as its
    own word — `sarasija nilaye`, `hari vallabhe`, `tribhuvana bhūti kari`. It
    carries no ending of its own, so it gets no vibhakti rather than a guessed
    one; the inflected member beside it is where the case lives."""
    e = {"lemma": lemma, "type": "other", "meaning": meaning,
         "forms": _forms(lemma)}
    if stem:
        e["stem"] = stem
    e["note"] = note or "uninflected prior member of the compound"
    return [e]


def V(lemma, meaning, stem, note=None):
    """A feminine vocative singular — the dhyāna addresses her throughout."""
    return [S(lemma, meaning, "f", 8, "eka", stem, note)]


def N(lemma, meaning, stem, note=None):
    """One of the 108 names: feminine, dative singular, one entry."""
    return [S(lemma, meaning, "f", 4, "eka", stem, note)]


ANUS = ("the anusvāra assimilates to the following stop and is rendered in the "
        "change colour")
VIS_R = "the visarga becomes r before the voiced sound that follows"
VIS_S = "the visarga assimilates to the following sibilant"

OM = A("oṁ", "oṁ — the praṇava, the sacred syllable that opens the invocation")
NAMAS = S("namas", "salutation, homage", "n", 1, "eka",
          "consonant stem (-as)",
          note="the nominative standing as an exclamation — 'homage (be) to…', "
               "with the name it salutes in the dative")

WORDS = {
    # ── the frame, repeated at all 108 names ──────────────────────────────
    "oṁ": [OM],
    "namaḥ": [NAMAS],

    # ── dhyāna 1 · vande padmakarāṁ … (śārdūlavikrīḍita) ──────────────────
    "vande": [T("vand", "I bow, I salute", "1 (bhvādi)", "laṭ", 1, "eka",
                note="ātmanepada")],
    "padmakarām": [S("padmakarā", "her who holds the lotus in her hand",
                     "f", 2, "eka", "bahuvrīhi ā-stem (padma + karā)",
                     note=ANUS)],
    "prasannavadanāṁ": [S("prasannavadanā", "her whose face is gracious",
                          "f", 2, "eka",
                          "bahuvrīhi ā-stem (prasanna + vadanā)")],
    "saubhāgyadām": [S("saubhāgyadā", "the giver of good fortune",
                       "f", 2, "eka", "tatpuruṣa ā-stem (saubhāgya + dā)",
                       note=ANUS)],
    "bhāgyadāṁ": [S("bhāgyadā", "the giver of destiny, of one's allotted share",
                    "f", 2, "eka", "tatpuruṣa ā-stem (bhāgya + dā)")],
    "hastābhyām": [S("hasta", "with her two hands", "m", 3, "dvi", "a-stem")],
    "abhayapradāṁ": [S("abhayapradā", "the giver of fearlessness",
                       "f", 2, "eka", "tatpuruṣa ā-stem (abhaya + pradā)")],
    "maṇigaṇair": [S("maṇigaṇa", "with clusters of jewels", "m", 3, "bahu",
                     "tatpuruṣa a-stem (maṇi + gaṇa)", note=VIS_R)],
    "nānāvidhair": [S("nānāvidha", "of many kinds", "m", 3, "bahu",
                      "a-stem (nānā + vidha)", note=VIS_R)],
    "bhūṣitām": [S("bhūṣitā", "adorned", "f", 2, "eka",
                   "ā-stem, ppp of √bhūṣ")],
    "bhaktābhīṣṭaphalapradāṁ": [
        S("bhaktābhīṣṭaphalapradā",
          "the giver of the fruit her devotees long for", "f", 2, "eka",
          "tatpuruṣa ā-stem (bhakta + abhīṣṭa + phala + pradā)")],
    "hariharabrahmādibhis": [
        S("hariharabrahmādi", "by Hari, Hara, Brahmā and the rest",
          "m", 3, "bahu", "i-stem (hari + hara + brahman + ādi)",
          note=VIS_S)],
    "sevitām": [S("sevitā", "served, attended upon", "f", 2, "eka",
                  "ā-stem, ppp of √sev",
                  note=ANUS + " — here across the line break, before pārśve")],
    "pārśve": [S("pārśva", "at her side", "n", 7, "eka", "a-stem")],
    "paṅkajaśaṅkhapadmanidhibhir": [
        S("paṅkajaśaṅkhapadmanidhi",
          "with the lotus, the conch and the padma treasure",
          "m", 3, "bahu",
          "dvandva i-stem (paṅkaja + śaṅkha + padmanidhi)",
          note=VIS_R)],
    "yuktāṁ": [S("yuktā", "joined with, attended by", "f", 2, "eka",
                 "ā-stem, ppp of √yuj")],
    "sadā": [A("sadā", "always, at all times")],
    "śaktibhiḥ": [S("śakti", "by her powers", "f", 3, "bahu", "i-stem")],

    # ── dhyāna 2 · sarasija nilaye … (puṣpitāgrā, ṚVKh 2.6.23) ───────────
    # The owner writes the compounds as separate words, so each prior member is
    # its own surface. Seven vocatives carry the address; the rest are
    # uninflected members standing beside them.
    "sarasija": C("sarasija", "lotus — 'pond-born'", "a-stem (saras + ja)",
                  note="prior member of sarasija-nilayā, 'she whose abode is "
                       "the lotus'"),
    "nilaye": V("nilayā", "O you whose abode it is", "ā-stem (ni + laya)"),
    "saroja": C("saroja", "lotus — 'lake-born'", "a-stem (saras + ja)",
                note="prior member of saroja-hastā, 'lotus in hand'"),
    "haste": V("hastā", "O you who hold it in your hand", "ā-stem"),
    "dhavalatamāṁśuka": C(
        "dhavalatamāṁśuka", "in the whitest garment",
        "a-stem (dhavalatama + aṁśuka)",
        note="dhavalatama is the SUPERLATIVE — the owner's reading; the "
             "comparative dhavalatara- circulates but is not his"),
    "gandha": C("gandha", "fragrance", "a-stem"),
    "mālya": C("mālya", "flower garlands", "a-stem (from mālā)"),
    "śobhe": V("śobhā", "O you who are resplendent with them", "ā-stem"),
    "bhagavati": V("bhagavatī", "O blessed one", "ī-stem, fem. of bhagavat"),
    "hari": C("hari", "Hari", "i-stem",
              note="prior member of hari-vallabhā, 'dear to Hari'"),
    "vallabhe": V("vallabhā", "O beloved one", "ā-stem"),
    "manojñe": V("manojñā", "O lovely one, pleasing to the mind",
                 "ā-stem (manas + jña)",
                 note="the owner prints the jñ reading aid — a superscript g "
                      "on the j — so it is carried as `sup` on that letter"),
    "tribhuvana": C("tribhuvana", "the three worlds", "n, a-stem (tri + bhuvana)"),
    "bhūti": C("bhūti", "wellbeing, prosperity", "i-stem (from √bhū)",
               note="prior member of bhūti-karī, 'maker of wellbeing'"),
    "kari": V("karī", "O maker of it", "ī-stem, agent noun of √kṛ"),
    "prasīda": [U("pra", "forth — here of grace going out toward one"),
                T("sad", "be gracious, be favourably disposed", "1 (bhvādi)",
                  "loṭ", 2, "eka", note="pra + √sad, prasīdati")],
    "mahyam": [S("asmad", "to me", None, 4, "eka", "pronominal (asmad)")],

    # ── the 108 names ─────────────────────────────────────────────────────
    # 1–8 · stotra 1
    "prakṛtyai": N("prakṛti",
                   "Nature herself — the primordial ground of all becoming",
                   "i-stem (pra + kṛti, from √kṛ)"),
    "vikṛtyai": N("vikṛti",
                  "transformation — nature become the changing world",
                  "i-stem (vi + kṛti, from √kṛ)"),
    "vidyāyai": N("vidyā", "knowledge", "ā-stem (from √vid)"),
    "sarvabhūtahitapradāyai": N(
        "sarvabhūtahitapradā", "the giver of the welfare of all beings",
        "tatpuruṣa ā-stem (sarva + bhūta + hita + pradā)"),
    "śraddhāyai": N("śraddhā", "faith — the trust that makes an act bear fruit",
                    "ā-stem (śrad + √dhā)"),
    "vibhūtyai": N("vibhūti", "abundance; manifest, pervading power",
                   "i-stem (vi + bhūti, from √bhū)"),
    "surabhyai": N("surabhi",
                   "the fragrant one; Surabhi, the cow that yields every wish",
                   "i-stem"),
    "paramātmikāyai": N("paramātmikā",
                        "she whose very nature is the supreme Self",
                        "ā-stem (parama + ātmikā, fem. of ātmaka)"),
    # 9–20 · stotra 2
    "vāce": N("vāc", "speech", "consonant stem (-c)"),
    "padmālayāyai": N("padmālayā", "she whose dwelling is the lotus",
                      "bahuvrīhi ā-stem (padma + ālayā)"),
    "padmāyai": N("padmā", "the lotus one", "ā-stem"),
    "śucaye": N("śuci", "the pure, the clear", "i-stem"),
    "svāhāyai": N("svāhā",
                  "Svāhā — the call by which an oblation reaches the gods",
                  "ā-stem"),
    "svadhāyai": N("svadhā",
                   "Svadhā — the call by which an offering reaches the ancestors",
                   "ā-stem"),
    "sudhāyai": N("sudhā", "the nectar of immortality", "ā-stem (su + dhā)"),
    "dhanyāyai": N("dhanyā", "the fortunate; she who makes fortunate",
                   "ā-stem (from dhana)"),
    "hiraṇmayyai": N("hiraṇmayī", "made of gold",
                     "ī-stem, fem. of hiraṇmaya (hiraṇya + -maya)"),
    "lakṣmyai": N("lakṣmī", "Lakṣmī — good fortune itself", "ī-stem"),
    "nityapuṣṭāyai": N("nityapuṣṭā", "ever nourished, never diminished",
                       "ā-stem (nitya + puṣṭā, ppp of √puṣ)"),
    "vibhāvaryai": N("vibhāvarī", "the shining one; night lit with stars",
                     "ī-stem (vi + bhā + -varī)"),
    # 21–29 · stotra 3
    "adityai": N("aditi", "Aditi, the boundless — mother of the gods",
                 "i-stem (a + diti)"),
    "dityai": N("diti", "Diti — mother of the daityas", "i-stem"),
    "dīptāyai": N("dīptā", "the blazing", "ā-stem, ppp of √dīp"),
    "vasudhāyai": N("vasudhā", "she who yields wealth; the earth",
                    "tatpuruṣa ā-stem (vasu + dhā)"),
    "vasudhāriṇyai": N("vasudhāriṇī",
                       "she who upholds wealth, and upholds the earth",
                       "ī-stem (vasu + dhāriṇī, agent noun of √dhṛ)"),
    "kamalāyai": N("kamalā", "Kamalā, of the lotus", "ā-stem"),
    "kāntāyai": N("kāntā", "the lovely; the beloved",
                  "ā-stem, ppp of √kam"),
    "kāmākṣyai": N("kāmākṣī", "she whose eyes grant what is desired",
                   "bahuvrīhi ī-stem (kāma + akṣī)"),
    "krodhasambhavāyai": N(
        "krodhasambhavā", "she who arises out of wrath",
        "bahuvrīhi ā-stem (krodha + sambhavā, from sam-√bhū)",
        note="the widely printed variant reads kāmā + kṣīrodasambhavā, "
             "'the desirable one' and 'she born from the ocean of milk'"),
    # 30–37 · stotra 4
    "anugrahapradāyai": N("anugrahapradā", "the giver of grace",
                          "tatpuruṣa ā-stem (anugraha + pradā)"),
    "buddhaye": N("buddhi", "understanding, discernment",
                  "i-stem (from √budh)"),
    "anaghāyai": N("anaghā", "the faultless, the sinless",
                   "bahuvrīhi ā-stem (an + aghā)"),
    "harivallabhāyai": N("harivallabhā", "the beloved of Hari",
                         "tatpuruṣa ā-stem (hari + vallabhā)"),
    "aśokāyai": N("aśokā", "she in whom there is no sorrow",
                  "bahuvrīhi ā-stem (a + śokā)"),
    "amṛtāyai": N("amṛtā", "the deathless; the nectar of immortality",
                  "ā-stem (a + mṛta, ppp of √mṛ)"),
    "lokaśokavināśinyai": N("lokaśokavināśinī",
                            "she who destroys the grief of the world",
                            "tatpuruṣa ī-stem (loka + śoka + vināśinī)"),
    # 38–44 · stotra 5
    "dharmanilayāyai": N("dharmanilayā",
                         "she in whom dharma has its dwelling",
                         "bahuvrīhi ā-stem (dharma + nilayā)"),
    "karuṇāyai": N("karuṇā", "compassion", "ā-stem"),
    "lokamātre": N("lokamātṛ", "mother of the world",
                   "tatpuruṣa ṛ-stem (loka + mātṛ)"),
    "padmapriyāyai": N("padmapriyā", "she to whom the lotus is dear",
                       "bahuvrīhi ā-stem (padma + priyā)"),
    "padmahastāyai": N("padmahastā", "she who holds a lotus in her hand",
                       "bahuvrīhi ā-stem (padma + hastā)"),
    "padmākṣyai": N("padmākṣī", "lotus-eyed",
                    "bahuvrīhi ī-stem (padma + akṣī)"),
    "padmasundaryai": N("padmasundarī", "beautiful as a lotus",
                        "ī-stem (padma + sundarī)"),
    # 45–52 · stotra 6
    "padmodbhavāyai": N("padmodbhavā", "risen out of the lotus",
                        "bahuvrīhi ā-stem (padma + udbhavā, from ud-√bhū)"),
    "padmamukhyai": N("padmamukhī", "lotus-faced",
                      "bahuvrīhi ī-stem (padma + mukhī)"),
    "padmanābhapriyāyai": N("padmanābhapriyā",
                            "beloved of the lotus-navelled one",
                            "tatpuruṣa ā-stem (padmanābha + priyā)"),
    "ramāyai": N("ramā", "Ramā — she who delights and is delighted in",
                 "ā-stem (from √ram)"),
    "padmamālādharāyai": N("padmamālādharā", "wearing a garland of lotuses",
                           "tatpuruṣa ā-stem (padma + mālā + dharā)"),
    "devyai": N("devī", "the goddess", "ī-stem, fem. of deva"),
    "padminyai": N("padminī", "she of the lotuses; the lotus pool",
                   "ī-stem, fem. of padmin"),
    "padmagandhinyai": N("padmagandhinī",
                         "fragrant with the scent of lotus",
                         "ī-stem, fem. of padmagandhin"),
    # 53–59 · stotra 7
    "puṇyagandhāyai": N("puṇyagandhā", "whose fragrance is holy",
                        "bahuvrīhi ā-stem (puṇya + gandhā)"),
    "suprasannāyai": N("suprasannā", "wholly serene, wholly gracious",
                       "ā-stem (su + prasannā, ppp of pra-√sad)"),
    "prasādābhimukhyai": N("prasādābhimukhī",
                           "turned toward the giving of grace",
                           "bahuvrīhi ī-stem (prasāda + abhimukhī)"),
    "prabhāyai": N("prabhā", "radiance", "ā-stem (pra + √bhā)"),
    "candravadanāyai": N("candravadanā", "moon-faced",
                         "bahuvrīhi ā-stem (candra + vadanā)"),
    "candrāyai": N("candrā", "the moon-like, the bright", "ā-stem"),
    "candrasahodaryai": N("candrasahodarī", "sister of the moon",
                          "ī-stem (candra + sahodarī)"),
    # 60–68 · stotra 8
    "caturbhujāyai": N("caturbhujā", "four-armed",
                       "bahuvrīhi ā-stem (catur + bhujā)"),
    "candrarūpāyai": N("candrarūpā", "whose form is the moon",
                       "bahuvrīhi ā-stem (candra + rūpā)"),
    "indirāyai": N("indirā", "Indirā — the resplendent", "ā-stem"),
    "induśītalāyai": N("induśītalā", "cool as the moon",
                       "ā-stem (indu + śītalā)"),
    "āhlādajananyai": N("āhlādajananī", "mother of gladness",
                        "tatpuruṣa ī-stem (āhlāda + jananī)"),
    "puṣṭyai": N("puṣṭi", "nourishment; thriving fullness",
                 "i-stem (from √puṣ)"),
    "śivāyai": N("śivā", "the auspicious", "ā-stem, fem. of śiva"),
    "śivakaryai": N("śivakarī", "she who makes all auspicious",
                    "ī-stem (śiva + karī, agent noun of √kṛ)"),
    "satyai": N("satī", "the true, the faithful",
                "ī-stem, fem. of sat (pres. part. of √as)"),
    # 69–76 · stotra 9
    "vimalāyai": N("vimalā", "the stainless",
                   "bahuvrīhi ā-stem (vi + malā)"),
    "viśvajananyai": N("viśvajananī", "mother of the universe",
                       "tatpuruṣa ī-stem (viśva + jananī)"),
    "tuṣṭyai": N("tuṣṭi", "contentment", "i-stem (from √tuṣ)"),
    "dāridryanāśinyai": N("dāridryanāśinī", "she who destroys poverty",
                          "tatpuruṣa ī-stem (dāridrya + nāśinī)"),
    "prītipuṣkariṇyai": N("prītipuṣkariṇī", "the lotus pool of delight",
                          "tatpuruṣa ī-stem (prīti + puṣkariṇī)"),
    "śāntāyai": N("śāntā", "the peaceful", "ā-stem, ppp of √śam"),
    "śuklamālyāmbarāyai": N("śuklamālyāmbarā", "garlanded and robed in white",
                            "bahuvrīhi ā-stem (śukla + mālya + ambarā)"),
    "śriyai": N("śrī", "Śrī — splendour and prosperity itself",
                "monosyllabic ī-stem"),
    # 77–84 · stotra 10
    "bhāskaryai": N("bhāskarī", "shining like the sun",
                    "ī-stem, fem. of bhāskara (bhās + kara)"),
    "bilvanilayāyai": N("bilvanilayā", "she who dwells in the bilva tree",
                        "bahuvrīhi ā-stem (bilva + nilayā)"),
    "varārohāyai": N("varārohā", "of beautiful form",
                     "bahuvrīhi ā-stem (vara + ārohā)"),
    "yaśasvinyai": N("yaśasvinī", "the renowned",
                     "ī-stem, fem. of yaśasvin"),
    "vasundharāyai": N("vasundharā", "bearer of treasure; the earth",
                       "ā-stem (vasum + dharā, from √dhṛ)"),
    "udārāṅgāyai": N("udārāṅgā", "of noble body",
                     "bahuvrīhi ā-stem (udāra + aṅgā)"),
    "hariṇyai": N("hariṇī", "the tawny-golden one",
                  "ī-stem, fem. of hariṇa"),
    "hemamālinyai": N("hemamālinī", "garlanded with gold",
                      "ī-stem, fem. of hemamālin (heman + mālin)"),
    # 85–91 · stotra 11
    "dhanadhānyakaryai": N("dhanadhānyakarī",
                           "she who brings wealth and grain",
                           "ī-stem (dhana + dhānya + karī, from √kṛ)"),
    "siddhaye": N("siddhi", "attainment, accomplishment",
                  "i-stem (from √sidh)"),
    "straiṇasaumyāyai": N(
        "straiṇasaumyā", "gentle with all the grace of womanhood",
        "ā-stem (straiṇa + saumyā)",
        note="the recorded variant reads sadā saumyā, 'ever gentle'"),
    "śubhapradāyai": N("śubhapradā", "the giver of good",
                       "tatpuruṣa ā-stem (śubha + pradā)"),
    "nṛpaveśmagatānandāyai": N(
        "nṛpaveśmagatānandā", "the joy that enters a king's house",
        "ā-stem (nṛpa + veśma + gata + ānandā)",
        note="one name in the printed nāmāvalī; a second transmission splits "
             "it into nṛpaveśmagatā and nandā"),
    "varalakṣmyai": N("varalakṣmī", "Lakṣmī who grants boons",
                      "ī-stem (vara + lakṣmī)"),
    "vasupradāyai": N("vasupradā", "the giver of wealth",
                      "tatpuruṣa ā-stem (vasu + pradā)"),
    # 92–97 · stotra 12
    "śubhāyai": N("śubhā", "the auspicious, the good",
                  "ā-stem, fem. of śubha"),
    "hiraṇyaprākārāyai": N("hiraṇyaprākārā", "she whose rampart is gold",
                           "bahuvrīhi ā-stem (hiraṇya + prākārā)"),
    "samudratanayāyai": N("samudratanayā", "daughter of the ocean",
                          "tatpuruṣa ā-stem (samudra + tanayā)"),
    "jayāyai": N("jayā", "victory", "ā-stem (from √ji)"),
    "maṅgalādevyai": N("maṅgalādevī", "the goddess who is all good fortune",
                       "karmadhāraya ī-stem (maṅgalā + devī)"),
    "viṣṇuvakṣassthalasthitāyai": N(
        "viṣṇuvakṣaḥsthalasthitā", "she who abides on Viṣṇu's breast",
        "ā-stem (viṣṇu + vakṣaḥsthala + sthitā, ppp of √sthā)",
        note="the compound's internal visarga assimilates to the following "
             "sibilant, so it is recited vakṣas-sthala-"),
    # 98–103 · stotra 13
    "viṣṇupatnyai": N("viṣṇupatnī", "the consort of Viṣṇu",
                      "tatpuruṣa ī-stem (viṣṇu + patnī)"),
    "prasannākṣyai": N("prasannākṣī", "of gracious eyes",
                       "bahuvrīhi ī-stem (prasanna + akṣī)"),
    "nārāyaṇasamāśritāyai": N(
        "nārāyaṇasamāśritā", "she who has taken her whole refuge in Nārāyaṇa",
        "ā-stem (nārāyaṇa + samāśritā, ppp of sam-ā-√śri)"),
    "dāridryadhvaṁsinyai": N("dāridryadhvaṁsinī", "she who shatters poverty",
                             "tatpuruṣa ī-stem (dāridrya + dhvaṁsinī, "
                             "from √dhvaṁs)"),
    "sarvopadravavāriṇyai": N("sarvopadravavāriṇī",
                              "she who wards off every calamity",
                              "tatpuruṣa ī-stem (sarva + upadrava + vāriṇī, "
                              "from √vṛ)"),
    # 104–108 · stotra 14
    "navadurgāyai": N("navadurgā", "she who is the nine Durgās",
                      "ā-stem (nava + durgā)"),
    "mahākālyai": N("mahākālī", "the great Kālī",
                    "karmadhāraya ī-stem (mahā + kālī)"),
    "brahmaviṣṇuśivātmikāyai": N(
        "brahmaviṣṇuśivātmikā", "she whose Self is Brahmā, Viṣṇu and Śiva",
        "bahuvrīhi ā-stem (brahma + viṣṇu + śiva + ātmikā)"),
    "trikālajñānasampannāyai": N(
        "trikālajñānasaṁpannā",
        "possessed of the knowledge of the three times",
        "ā-stem (trikāla + jñāna + saṁpannā, ppp of sam-√pad)",
        note=ANUS),
    "bhuvaneśvaryai": N("bhuvaneśvarī", "sovereign of the worlds",
                        "tatpuruṣa ī-stem (bhuvana + īśvarī)"),

    # ── the colophon ──────────────────────────────────────────────────────
    "iti": [A("iti", "thus — the particle that closes a recited text, "
                     "quoting everything before it")],
    "śrīlakṣmyaṣṭottaraśatanāmāvalis": [
        S("śrīlakṣmyaṣṭottaraśatanāmāvali",
          "the garland of the hundred and eight names of Śrī Lakṣmī",
          "f", 1, "eka",
          "tatpuruṣa i-stem (śrī + lakṣmī + aṣṭottaraśata + nāman + āvali)",
          note=VIS_S)],
    # keyed on the POST-sandhi surface, like every other entry: the source
    # writes the underlying `saṁpūrṇā` and the engine renders the `m`.
    "sampūrṇā": [S("sampūrṇā", "complete, brought to fullness", "f", 1, "eka",
                   "ā-stem, fem. of sampūrṇa, ppp of sam-√pṝ",
                   note="feminine, agreeing with āvaliḥ; " + ANUS)],
}
