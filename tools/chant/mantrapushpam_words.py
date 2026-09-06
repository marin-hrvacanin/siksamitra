# -*- coding: utf-8 -*-
"""Per-word grammar for `gen_mantrapushpam.py`, keyed by the surface AFTER the
anusvāra / visarga / gum transforms. The builder fails loudly on any surface
with no entry, so grammar cannot drift out of alignment with the tokens.

Run `gen_mantrapushpam.py --surfaces` to re-derive the keys after editing.
Conventions: AUTHORING-CHANTS §4 (vibhakti 1..8, 7 = locative, 8 = vocative;
`gana` holds only the gaṇa; a sandhi-fused surface carries SEVERAL entries).
"""
from vishnu_words import S, T, A, U, M, F, N, EKA, DVI, BAHU   # noqa: F401

# The refrain nouns, built once — this text is almost entirely repetition.
AYATANAM = lambda: S("āyatana", "seat, resting-place, abode", N, 1, EKA,
                     stem="a-stem")
AYATANAM_2 = lambda: S("āyatana", "the seat", N, 2, EKA, stem="a-stem")
APAM = lambda: S("ap", "of the waters", F, 6, BAHU, stem="root noun",
                 note="the Vedic ap- 'waters' is plural throughout")
VEDA = lambda: T("vid", "he knows", "2 (adādi)", "liṭ", 3, EKA,
                 note="perfect with present sense — the standard Vedic 'knows'")
BHAVATI = lambda: T("bhū", "becomes, is", "1 (bhvādi)", "laṭ", 3, EKA)
AYATANAVAN = lambda: S("āyatanavat", "possessed of a seat, established",
                       M, 1, EKA, stem="vat-suffix possessive")

WORDS = {
    # ---- the refrain -----------------------------------------------------
    "veda": [VEDA()],
    "bhavati": [BHAVATI()],
    "āyatanavān": [AYATANAVAN()],
    "āyatanam": [AYATANAM()],
    "āyatanaṁ": [AYATANAM_2()],
    "apām": [APAM()],
    "āpo": [S("ap", "the waters", F, 1, BAHU, stem="root noun",
              note="āpaḥ; visarga → -o before a voiced sound")],
    "ya": [S("yad", "he who", M, 1, EKA, stem="pronoun")],
    "yaḥ": [S("yad", "he who", M, 1, EKA, stem="pronoun")],
    "yo": [S("yad", "he who", M, 1, EKA, stem="pronoun")],
    "evaṁ": [A("evam", "thus, so")],
    "vai": [A("vai", "indeed (an emphasising particle)")],
    "vā": [A("vā", "indeed, verily",
             note="the Vedic asseverative vai/vā, not the disjunctive 'or'")],

    # ---- khaṇḍa 1: the flower of the waters ------------------------------
    "yo'pāṁ": [S("yad", "he who", M, 1, EKA, stem="pronoun"), APAM()],
    "yo'pām": [S("yad", "he who", M, 1, EKA, stem="pronoun"), APAM()],
    "yo'pāmāyatanaṁ": [S("yad", "he who", M, 1, EKA, stem="pronoun"),
                       APAM(), AYATANAM_2()],
    "apāmāyatanam": [APAM(), AYATANAM()],
    "puṣpaṁ": [S("puṣpa", "flower", N, 2, EKA, stem="a-stem")],
    "puṣpam": [S("puṣpa", "flower", N, 1, EKA, stem="a-stem")],
    "puṣpavān": [S("puṣpavat", "possessed of flowers", M, 1, EKA,
                   stem="vat-suffix possessive")],
    "prajāvān": [S("prajāvat", "possessed of offspring", M, 1, EKA,
                   stem="vat-suffix possessive")],
    "paśumān": [S("paśumat", "possessed of cattle", M, 1, EKA,
                  stem="vat-suffix possessive")],
    "candramā": [S("candramas", "the moon", M, 1, EKA, stem="s-stem")],
    "candramasa": [S("candramas", "of the moon", M, 6, EKA, stem="s-stem",
                     note="candramasaḥ; the visarga is lost before the "
                          "following vowel")],
    "yaścandramasa": [S("yad", "he who", M, 1, EKA, stem="pronoun"),
                      S("candramas", "of the moon", M, 6, EKA, stem="s-stem")],

    # ---- khaṇḍa 2: agni --------------------------------------------------
    "agnirvā": [S("agni", "fire", M, 1, EKA, stem="i-stem"),
                A("vā", "indeed")],
    "agnerāyatanam": [S("agni", "of fire", M, 6, EKA, stem="i-stem"),
                      AYATANAM()],
    "yo'gnerāyatanaṁ": [S("yad", "he who", M, 1, EKA, stem="pronoun"),
                        S("agni", "of fire", M, 6, EKA, stem="i-stem"),
                        AYATANAM_2()],

    # ---- khaṇḍa 3: vāyu --------------------------------------------------
    "vāyurvā": [S("vāyu", "wind", M, 1, EKA, stem="u-stem"),
                A("vā", "indeed")],
    "vāyorāyatanam": [S("vāyu", "of the wind", M, 6, EKA, stem="u-stem"),
                      AYATANAM()],
    "vāyorāyatanaṁ": [S("vāyu", "of the wind", M, 6, EKA, stem="u-stem"),
                      AYATANAM_2()],

    # ---- khaṇḍa 4: yonder burning one ------------------------------------
    "asau": [S("adas", "yonder one", M, 1, EKA, stem="pronoun")],
    "tapannapāmāyatanam": [S("tapat", "burning, giving heat", M, 1, EKA,
                             note="present participle of √tap, of the sun"),
                           APAM(), AYATANAM()],
    "amuṣya": [S("adas", "of yonder one", M, 6, EKA, stem="pronoun")],
    "tapata": [S("tapat", "of the burning one", M, 6, EKA,
                 note="tapataḥ; the visarga is lost before the following vowel")],
    "yo'muṣya": [S("yad", "he who", M, 1, EKA, stem="pronoun"),
                 S("adas", "of yonder one", M, 6, EKA, stem="pronoun")],

    # ---- khaṇḍa 6: the lunar mansions ------------------------------------
    "nakṣatrāṇi": [S("nakṣatra", "the lunar mansions, the stars", N, 1, BAHU,
                     stem="a-stem")],
    "nakṣatrāṇāmāyatanam": [S("nakṣatra", "of the mansions", N, 6, BAHU,
                              stem="a-stem"), AYATANAM()],
    "nakṣatrāṇāmāyatanaṁ": [S("nakṣatra", "of the mansions", N, 6, BAHU,
                              stem="a-stem"), AYATANAM_2()],

    # ---- khaṇḍa 7: the rain-cloud ----------------------------------------
    "parjanyo": [S("parjanya", "the rain-cloud, the rain-god", M, 1, EKA,
                   stem="a-stem")],
    "parjanyasyā''yatanam": [S("parjanya", "of the rain-cloud", M, 6, EKA,
                               stem="a-stem"), AYATANAM()],
    "parjanyasyā''yatanaṁ": [S("parjanya", "of the rain-cloud", M, 6, EKA,
                               stem="a-stem"), AYATANAM_2()],

    # ---- khaṇḍa 8: the year, and the boat --------------------------------
    "saṁvatsaro": [S("saṁvatsara", "the year", M, 1, EKA, stem="a-stem")],
    "saṁvatsarasyā''yatanam": [S("saṁvatsara", "of the year", M, 6, EKA,
                                 stem="a-stem"), AYATANAM()],
    "yassaṁvatsarasyā''yatanaṁ": [S("yad", "he who", M, 1, EKA, stem="pronoun"),
                                  S("saṁvatsara", "of the year", M, 6, EKA,
                                    stem="a-stem"), AYATANAM_2()],
    "yo'psu": [S("yad", "he who", M, 1, EKA, stem="pronoun"),
               S("ap", "in the waters", F, 7, BAHU, stem="root noun")],
    "nāvam": [S("nau", "boat, ship", F, 2, EKA, stem="root noun")],
    "pratiṣṭhitāṁ": [S("pratiṣṭhita", "set firm, established", F, 2, EKA,
                       stem="past passive participle of prati-√sthā")],
    "pratyeva": [A("prati", "in return, correspondingly"),
                 A("eva", "indeed", note="prati + eva")],
    "tiṣṭhati": [T("sthā", "stands, stands firm", "1 (bhvādi)", "laṭ", 3, EKA)],
}


WORDS.update({
    # ---- śānti pāṭha ------------------------------------------------------
    "oṁ": [A("oṁ", "the praṇava, the syllable of the absolute")],
    "bhadram": [S("bhadra", "what is auspicious, good", N, 2, EKA,
                  stem="a-stem")],
    "bhadraṅ": [S("bhadra", "what is auspicious, good", N, 2, EKA,
                  stem="a-stem",
                  note="bhadram; the anusvāra assimilates before k-")],
    "karṇebhiś": [S("karṇa", "with the ears", M, 3, BAHU, stem="a-stem",
                    note="Vedic instr. pl. in -ebhiḥ; the visarga assimilates "
                         "to the following ś-")],
    "śṛṇuyāma": [T("śru", "may we hear", "5 (svādi)", "liṅ", 1, BAHU,
                   note="optative")],
    "devāḥ": [S("deva", "O gods", M, 8, BAHU, stem="a-stem")],
    "paśyemākṣabhiryajatrāḥ": [
        T("dṛś", "may we see", "1 (bhvādi)", "liṅ", 1, BAHU,
          note="paśyema, optative; the suppletive present paśya- serves √dṛś"),
        S("akṣi", "with the eyes", N, 3, BAHU, stem="i-stem"),
        S("yajatra", "O worshipful ones", M, 8, BAHU, stem="a-stem",
          note="paśyema + akṣabhiḥ + yajatrāḥ")],
    "sthirairaṅgaistuṣṭuvāmsastanūbhiḥ": [
        S("sthira", "with steady", N, 3, BAHU, stem="a-stem"),
        S("aṅga", "with limbs", N, 3, BAHU, stem="a-stem"),
        S("tuṣṭuvas", "having praised", M, 1, BAHU,
          note="perfect active participle of √stu"),
        S("tanū", "with bodies", F, 3, BAHU, stem="ū-stem",
          note="sthiraiḥ + aṅgaiḥ + tuṣṭuvāṁsaḥ + tanūbhiḥ")],
    "vyaśema": [T("aś", "may we obtain, may we enjoy", "5 (svādi)", "liṅ",
                  1, BAHU, note="vi-√aś, optative")],
    "devahitaṁ": [S("devahita", "allotted by the gods", N, 2, EKA,
                    stem="a-stem")],
    "yadāyuḥ": [S("yad", "which", N, 1, EKA, stem="pronoun"),
                S("āyus", "life, span of life", N, 1, EKA, stem="s-stem",
                  note="yat + āyuḥ")],
    "svasti": [S("svasti", "well-being, welfare", N, 2, EKA, stem="i-stem")],
    "na": [S("asmad", "to us", M, 4, BAHU, stem="pronoun",
             note="the enclitic naḥ; visarga lost before the following vowel")],
    "naḥ": [S("asmad", "to us", M, 4, BAHU, stem="pronoun")],
    "no": [S("asmad", "to us", M, 4, BAHU, stem="pronoun",
             note="naḥ; visarga → -o before a voiced sound")],
    "indro": [S("indra", "Indra", M, 1, EKA, stem="a-stem")],
    "vṛddhaśravāḥ": [S("vṛddhaśravas", "of wide renown", M, 1, EKA,
                       stem="s-stem")],
    "pūṣā": [S("pūṣan", "Pūṣan, the nourisher", M, 1, EKA, stem="n-stem")],
    "viśvavedāḥ": [S("viśvavedas", "all-knowing, possessing all", M, 1, EKA,
                     stem="s-stem")],
    "nastārkṣyo": [S("asmad", "to us", M, 4, BAHU, stem="pronoun"),
                   S("tārkṣya", "Tārkṣya, the celestial bird", M, 1, EKA,
                     stem="a-stem", note="naḥ + tārkṣyaḥ")],
    "ariṣṭanemiḥ": [S("ariṣṭanemi", "whose course is unhindered", M, 1, EKA,
                      stem="i-stem")],
    "bṛhaspatirdadhātu": [S("bṛhaspati", "Bṛhaspati", M, 1, EKA, stem="i-stem"),
                          T("dhā", "let him grant, let him bestow",
                            "3 (juhotyādi)", "loṭ", 3, EKA)],
    "śāntiś": [S("śānti", "peace", F, 1, EKA, stem="i-stem",
                 note="visarga assimilated to the following ś-")],
    "śāntiḥ": [S("śānti", "peace", F, 1, EKA, stem="i-stem")],

    # ---- the Kubera portion ----------------------------------------------
    "rājādhirājāya": [S("rājādhirāja", "to the king of kings", M, 4, EKA,
                        stem="a-stem")],
    "prasahyasāhine": [S("prasahyasāhin", "the conqueror who prevails by force",
                         M, 4, EKA, stem="in-stem")],
    "namo": [S("namas", "salutation", N, 2, EKA, stem="s-stem",
               note="namaḥ; visarga → -o before a voiced sound")],
    "namaḥ": [S("namas", "salutation", N, 2, EKA, stem="s-stem")],
    "vayaṁ": [S("asmad", "we", M, 1, BAHU, stem="pronoun")],
    "vaiśravaṇāya": [S("vaiśravaṇa", "to Vaiśravaṇa, the son of Viśravas",
                       M, 4, EKA, stem="a-stem", note="an epithet of Kubera")],
    "vaiśravaṇo": [S("vaiśravaṇa", "Vaiśravaṇa", M, 1, EKA, stem="a-stem")],
    "kurmahe": [T("kṛ", "we make, we offer", "8 (tanādi)", "laṭ", 1, BAHU,
                  note="ātmanepada")],
    "sa": [S("tad", "he", M, 1, EKA, stem="pronoun")],
    "me": [S("asmad", "to me, my", M, 4, EKA, stem="pronoun")],
    "kāmānkāmakāmāya": [S("kāma", "desires", M, 2, BAHU, stem="a-stem"),
                        S("kāmakāma", "to one who desires desires", M, 4, EKA,
                          stem="a-stem", note="kāmān + kāmakāmāya")],
    "mahyam": [S("asmad", "to me", M, 4, EKA, stem="pronoun")],
    "kāmeśvaro": [S("kāmeśvara", "the lord of desires", M, 1, EKA,
                    stem="a-stem")],
    "dadātu": [T("dā", "let him give", "3 (juhotyādi)", "loṭ", 3, EKA)],
    "kuberāya": [S("kubera", "to Kubera", M, 4, EKA, stem="a-stem")],
    "mahārājāya": [S("mahārāja", "to the great king", M, 4, EKA,
                     stem="a-stem")],
})


# ---- the optional extended recitation (Mahānārāyaṇa passages) -------------
# Long sandhi-fused surfaces here carry one entry per underlying word, which is
# what the reader's popover walks (AUTHORING-CHANTS §4).
WORDS.update({
    "tadbrahma": [S("tad", "that", N, 1, EKA, stem="pronoun"),
                  S("brahman", "brahman, the absolute", N, 1, EKA,
                    stem="n-stem")],
    "tadvāyuḥ": [S("tad", "that", N, 1, EKA, stem="pronoun"),
                 S("vāyu", "the wind", M, 1, EKA, stem="u-stem")],
    "tadātmā": [S("tad", "that", N, 1, EKA, stem="pronoun"),
                S("ātman", "the Self", M, 1, EKA, stem="n-stem")],
    "tatsatyam": [S("tad", "that", N, 1, EKA, stem="pronoun"),
                  S("satya", "the truth, the real", N, 1, EKA, stem="a-stem")],
    "tatsarvam": [S("tad", "that", N, 1, EKA, stem="pronoun"),
                  S("sarva", "all", N, 1, EKA, stem="pronominal a-stem")],
    "tatpurornamaḥ": [S("tad", "that", N, 4, EKA, stem="pronoun"),
                      S("puru", "to the full, the abundant one", N, 4, EKA,
                        stem="u-stem",
                        note="puroḥ, read by the commentators as the fullness "
                             "of brahman"),
                      S("namas", "salutation", N, 1, EKA, stem="s-stem")],
    "antaścarati": [A("antar", "within"),
                    T("car", "moves, ranges", "1 (bhvādi)", "laṭ", 3, EKA)],
    "bhūteṣu": [S("bhūta", "among beings", N, 7, BAHU, stem="a-stem")],
    "guhāyāṁ": [S("guhā", "in the cave, in the secret place", F, 7, EKA,
                  stem="ā-stem", note="the cave of the heart")],
    "viśvamūrtiṣu": [S("viśvamūrti", "in all forms", F, 7, BAHU,
                       stem="i-stem")],
    "tvaṁ": [S("yuṣmad", "you", M, 1, EKA, stem="pronoun")],
    "tvam": [S("yuṣmad", "you", M, 1, EKA, stem="pronoun")],
    "tvan": [S("yuṣmad", "you", M, 1, EKA, stem="pronoun",
               note="tvam; the final nasal assimilates before the following t-")],
    "yajñastvaṁ": [S("yajña", "the sacrifice", M, 1, EKA, stem="a-stem"),
                   S("yuṣmad", "you", M, 1, EKA, stem="pronoun")],
    "vaṣaṭkārastvamindrastvam": [
        S("vaṣaṭkāra", "the vaṣaṭ-call", M, 1, EKA, stem="a-stem"),
        S("yuṣmad", "you", M, 1, EKA, stem="pronoun"),
        S("indra", "Indra", M, 1, EKA, stem="a-stem"),
        S("yuṣmad", "you", M, 1, EKA, stem="pronoun")],
    "rudrastvaṁ": [S("rudra", "Rudra", M, 1, EKA, stem="a-stem"),
                   S("yuṣmad", "you", M, 1, EKA, stem="pronoun")],
    "viṣṇustvaṁ": [S("viṣṇu", "Viṣṇu", M, 1, EKA, stem="u-stem"),
                   S("yuṣmad", "you", M, 1, EKA, stem="pronoun")],
    "brahma": [S("brahman", "brahman", N, 1, EKA, stem="n-stem")],
    "prajāpatiḥ": [S("prajāpati", "Prajāpati, lord of creatures", M, 1, EKA,
                     stem="i-stem")],
    "tadāpa": [S("tad", "that", N, 1, EKA, stem="pronoun"),
               S("ap", "the waters", F, 1, BAHU, stem="root noun",
                 note="tat + āpaḥ; the visarga is lost before the vowel")],
    "jyotī": [S("jyotis", "light", N, 1, EKA, stem="s-stem",
                note="jyotiḥ, lengthened in recitation before the vowel")],
    "raso'mṛtaṁ": [S("rasa", "essence, savour", M, 1, EKA, stem="a-stem"),
                   S("amṛta", "the deathless", N, 1, EKA, stem="a-stem",
                     note="rasaḥ + amṛtam; the elided a- is written with the "
                          "avagraha")],
    "bhūrbhuvas": [A("bhūr bhuvaḥ", "earth, mid-air",
                     note="the first two of the three vyāhṛtis")],
    "suvarom": [A("suvar", "heaven", note="the third vyāhṛti"),
                A("oṁ", "the praṇava")],
    "īśānas": [S("īśāna", "the ruler", M, 1, EKA, stem="a-stem",
                 note="īśānaḥ; the visarga assimilates before the following s-")],
    "sarvavidyānāmīśvaras": [
        S("sarvavidyā", "of all learning", F, 6, BAHU, stem="ā-stem"),
        S("īśvara", "lord", M, 1, EKA, stem="a-stem",
          note="the visarga assimilates before the following s-")],
    "sarvabhūtānāṁ": [S("sarvabhūta", "of all beings", N, 6, BAHU,
                        stem="a-stem")],
    "brahmādhipatirbrahmaṇo'dhipatirbrahmā": [
        S("brahman", "of the sacred word", N, 6, EKA, stem="n-stem"),
        S("adhipati", "overlord", M, 1, EKA, stem="i-stem"),
        S("brahman", "of brahman", N, 6, EKA, stem="n-stem"),
        S("adhipati", "overlord", M, 1, EKA, stem="i-stem"),
        S("brahman", "brahman", M, 1, EKA, stem="n-stem")],
    "śivo": [S("śiva", "auspicious, gracious", M, 1, EKA, stem="a-stem")],
    "astu": [T("as", "let it be", "2 (adādi)", "loṭ", 3, EKA)],
    "sadāśivom": [S("sadāśiva", "the ever-auspicious one", M, 1, EKA,
                    stem="a-stem"), A("oṁ", "the praṇava")],
    "ṛtam": [S("ṛta", "the cosmic order, truth", N, 1, EKA, stem="a-stem")],
    "satyam": [S("satya", "the true, the real", N, 1, EKA, stem="a-stem")],
    "param": [S("para", "supreme, highest", N, 1, EKA, stem="a-stem")],
    "puruṣaṅ": [S("puruṣa", "the Puruṣa, the cosmic person", M, 2, EKA,
                  stem="a-stem",
                  note="puruṣam; the anusvāra assimilates before k-")],
    "kṛṣṇapiṅgalam": [S("kṛṣṇapiṅgala", "dark and tawny", M, 2, EKA,
                        stem="a-stem")],
    "ūrdhvaretaṁ": [S("ūrdhvaretas", "of upward-turned seed, the perfect "
                      "celibate", M, 2, EKA, stem="s-stem")],
    "virūpākṣaṁ": [S("virūpākṣa", "of many-formed eyes", M, 2, EKA,
                     stem="a-stem")],
    "viśvarūpāya": [S("viśvarūpa", "to him of universal form", M, 4, EKA,
                      stem="a-stem")],
})
