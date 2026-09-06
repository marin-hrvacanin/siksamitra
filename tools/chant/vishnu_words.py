# -*- coding: utf-8 -*-
"""Per-word grammar for `gen_vishnu.py`, keyed by the surface AFTER the
anusvāra / visarga / gum transforms (`viṣṇos`, `rajāmsi`, `sarvañ`, `om`…).

`gen_vishnu.build()` fails loudly on any surface with no entry, so the grammar
can never drift out of alignment with the token stream (AUTHORING-CHANTS §5C).
Run `gen_vishnu.py --surfaces` to re-derive the key list after editing the text.

Conventions (AUTHORING-CHANTS §4):
  * `vibhakti` 1..8, 7 = locative, 8 = vocative; `purusha` 1/2/3 =
    uttama/madhyama/prathama.
  * `gana` is rendered inline as `root (gana)`, so it holds the gaṇa and
    nothing else; remarks go in `note`.
  * An upasarga on a FINITE verb gets its own entry beside the root; a preverb
    lexicalised into a nominal or participial stem stays inside that lemma with
    the derivation in `note`.
  * A sandhi-fused surface carries SEVERAL entries (`yasyoruṣu`, `hyasya`,
    `divīva`, `tenāpnoti`, `sarvasyāptyai`, `tredhorugāyo`).
  * `forms` is derived, never hand-typed.
"""
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate


def _forms(head):
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


def U(lemma, meaning, note=None):
    """upasarga"""
    e = {"lemma": lemma, "type": "upasarga", "meaning": meaning,
         "forms": _forms(lemma)}
    if note:
        e["note"] = note
    return e


M, F, N = "m", "f", "n"
EKA, DVI, BAHU = "eka", "dvi", "bahu"

# --- viṣṇu, in every case the sūktam declines it into ----------------------
_VISNU_GEN = lambda: S("viṣṇu", "Viṣṇu, the all-pervading one", M, 6, EKA,
                       stem="u-stem")


WORDS = {
    # ---- praṇava and śānti ------------------------------------------------
    "oṁ": [A("oṁ", "the praṇava, the syllable of the absolute")],
    "śāntiś": [S("śānti", "peace", F, 1, EKA, stem="i-stem",
                 note="visarga assimilated to the following ś-")],
    "śāntiḥ": [S("śānti", "peace", F, 1, EKA, stem="i-stem")],

    # ---- verse 1 ----------------------------------------------------------
    "viṣṇoḥ": [_VISNU_GEN()],
    "viṣṇor": [_VISNU_GEN()],
    "viṣṇos": [_VISNU_GEN()],
    "viṣṇoś": [_VISNU_GEN()],
    "viṣṇo": [S("viṣṇu", "O Viṣṇu", M, 8, EKA, stem="u-stem")],
    "viṣṇur": [S("viṣṇu", "Viṣṇu", M, 1, EKA, stem="u-stem")],
    "viṣṇus": [S("viṣṇu", "Viṣṇu", M, 1, EKA, stem="u-stem")],
    "viṣṇave": [S("viṣṇu", "to Viṣṇu", M, 4, EKA, stem="u-stem")],
    "nu": [A("nu", "now, indeed")],
    "kaṁ": [A("kam", "verily (an emphasising particle)",
              note="the old accusative of ka-, used adverbially in the Veda")],
    "vīryāṇi": [S("vīrya", "heroic deeds, powers", N, 2, BAHU, stem="a-stem")],
    "pra": [U("pra", "forth, forward")],
    "vocaṁ": [T("vac", "I proclaim", "2 (adādi)", "luṅ", 1, EKA,
                note="aorist a-vocam; the augment is lost after pra in "
                     "recitation")],
    "yaḥ": [S("yad", "who", M, 1, EKA, stem="pronoun")],
    "yo": [S("yad", "who", M, 1, EKA, stem="pronoun")],
    "pārthivāni": [S("pārthiva", "earthly, terrestrial (spaces)", N, 2, BAHU,
                     stem="a-stem")],
    "vimame": [U("vi", "apart, out"),
               T("mā", "he measured out", "2 (adādi)", "liṭ", 3, EKA,
                 note="perfect ātmanepada")],
    "rajāmsi": [S("rajas", "spaces, worlds, realms of mist", N, 2, BAHU,
                  stem="s-stem")],
    "askabhāyad": [T("skabh", "he propped up, made fast", "9 (kryādi)", "laṅ",
                     3, EKA, note="imperfect a-skabhāyat")],
    "uttaram": [S("uttara", "upper, higher", N, 2, EKA, stem="a-stem")],
    "sadhasthaṁ": [S("sadhastha", "dwelling-place, seat", N, 2, EKA,
                     stem="a-stem")],
    "vicakramāṇas": [S("vicakramāṇa", "striding out", M, 1, EKA,
                       stem="perfect middle participle of vi-√kram")],
    "tredhorugāyo": [A("tredhā", "in three ways, threefold"),
                     S("urugāya", "the wide-striding one", M, 1, EKA,
                       stem="a-stem",
                       note="tredhā + urugāyaḥ; the visarga becomes -o before "
                            "the voiced v- of viṣṇoḥ")],

    # ---- verse 2 (the yajus) ----------------------------------------------
    "arāṭam": [S("arāṭa", "the edge, rim", N, 1, EKA, stem="a-stem",
                 note="a Vedic word of uncertain sense, glossed in the ritual "
                      "commentaries as an edge or forepart of the pressing "
                      "apparatus; the rendering is provisional")],
    "asi": [T("as", "you are", "2 (adādi)", "laṭ", 2, EKA)],
    "pṛṣṭham": [S("pṛṣṭha", "back, ridge", N, 1, EKA, stem="a-stem")],
    "śnaptre": [S("śnaptra", "the two jaws", N, 1, DVI, stem="a-stem",
                  note="VedaVMS prints the palatalised recitation śñaptre; the "
                       "standard reading is śnaptra-")],
    "stho": [T("as", "you two are", "2 (adādi)", "laṭ", 2, DVI,
               note="sthaḥ; the visarga becomes -o before the voiced v-")],
    "syūr": [S("syū", "seam, stitching", F, 1, EKA,
               note="syūḥ; visarga → r before the following vowel")],
    "dhruvam": [S("dhruva", "fixed, firm point", N, 1, EKA, stem="a-stem")],
    "vaiṣṇavam": [S("vaiṣṇava", "belonging to Viṣṇu", N, 1, EKA,
                    stem="a-stem")],
    "tvā": [S("yuṣmad", "thee", M, 2, EKA, stem="pronoun")],
}

WORDS.update({
    # ---- verse 3 (TB 2.4.6.2) --------------------------------------------
    "tad": [S("tad", "that", N, 2, EKA, stem="pronoun")],
    "asya": [S("idam", "of this one, his", M, 6, EKA, stem="pronoun")],
    "priyam": [S("priya", "dear, beloved", N, 2, EKA, stem="a-stem")],
    "abhi": [U("abhi", "towards, unto")],
    "pātho": [S("pāthas", "place, pasture, abode", N, 2, EKA, stem="s-stem",
                note="pāthaḥ; visarga → -o before the following vowel")],
    "aśyām": [T("aś", "may I reach, may I attain", "5 (svādi)", "liṅ", 1, EKA,
                note="optative (āśīrliṅ)")],
    "naro": [S("nara", "men", M, 1, BAHU, stem="a-stem")],
    "yatra": [A("yatra", "where")],
    "devayavo": [S("devayu", "devoted to the gods, god-seeking", M, 1, BAHU,
                   stem="u-stem")],
    "madanti": [T("mad", "they rejoice, they are glad", "1 (bhvādi)", "laṭ",
                  3, BAHU)],
    "urukramasya": [S("urukrama", "of the wide-strider", M, 6, EKA,
                      stem="a-stem", note="uru- + krama-, an epithet of Viṣṇu")],
    "sa": [S("tad", "he, that one", M, 1, EKA, stem="pronoun")],
    "hi": [A("hi", "for, indeed")],
    "bandhur": [S("bandhu", "kinship, bond", M, 1, EKA, stem="u-stem")],
    "itthā": [A("itthā", "thus, truly")],
    "pade": [S("pada", "step, station", N, 7, EKA, stem="a-stem")],
    "parame": [S("parama", "highest", N, 7, EKA, stem="a-stem")],
    "madhva": [S("madhu", "of honey, of sweetness", N, 6, EKA, stem="u-stem",
                 note="madhvaḥ; visarga lost before the following vowel")],
    "utsaḥ": [S("utsa", "spring, fountain", M, 1, EKA, stem="a-stem")],

    # ---- verse 4 (TB 2.4.3.4) --------------------------------------------
    "stavate": [T("stu", "is praised", "2 (adādi)", "laṭ", 3, EKA,
                  note="ātmanepada with passive sense")],
    "vīryāya": [S("vīrya", "for heroic power", N, 4, EKA, stem="a-stem",
                  note="the Taittirīya reading; a Ṛgveda edition has the "
                       "instrumental vīryeṇa")],
    "mṛgo": [S("mṛga", "wild beast", M, 1, EKA, stem="a-stem")],
    "na": [A("na", "like, as (comparative particle in the Veda)")],
    "bhīmaḥ": [S("bhīma", "fearsome, dread", M, 1, EKA, stem="a-stem")],
    "kucaro": [S("kucara", "roaming, wandering where it will", M, 1, EKA,
                 stem="a-stem")],
    "giriṣṭhāḥ": [S("giriṣṭhā", "mountain-dwelling", M, 1, EKA,
                    note="giri- + -sthā")],
    "yasyoruṣu": [S("yad", "in whose", M, 6, EKA, stem="pronoun"),
                  S("uru", "wide, broad", N, 7, BAHU, stem="u-stem",
                    note="yasya + uruṣu")],
    "triṣu": [S("tri", "three", N, 7, BAHU, stem="numeral")],
    "vikramaṇeṣu": [S("vikramaṇa", "strides, steps", N, 7, BAHU,
                      stem="a-stem")],
    "adhikṣiyanti": [U("adhi", "over, upon"),
                     T("kṣi", "they dwell, they abide", "2 (adādi)", "laṭ",
                       3, BAHU)],
    "bhuvanāni": [S("bhuvana", "worlds, beings", N, 1, BAHU, stem="a-stem")],
    "viśvā": [S("viśva", "all", N, 1, BAHU, stem="a-stem")],

    # ---- verse 5 (TB 2.8.3.2) --------------------------------------------
    "paro": [A("paras", "beyond, past",
               note="paraḥ used adverbially with the instrumental mātrayā")],
    "mātrayā": [S("mātrā", "measure", F, 3, EKA, stem="ā-stem")],
    "tanuvā": [S("tanū", "body, form", F, 3, EKA, stem="ū-stem",
                 note="the Taittirīya reading; a Ṛgveda edition has tanvā")],
    "vṛdhāna": [S("vṛdhāna", "O you who grow, waxing great", M, 8, EKA,
                  note="present middle participle of √vṛdh")],
    "te": [S("yuṣmad", "your, to you", M, 6, EKA, stem="pronoun")],
    "mahitvam": [S("mahitva", "greatness", N, 2, EKA, stem="a-stem")],
    "anvaśnuvanti": [U("anu", "after, along"),
                     T("aś", "they reach, they attain", "5 (svādi)", "laṭ",
                       3, BAHU)],
    "ubhe": [S("ubha", "both", N, 2, DVI, stem="a-stem")],
    "vidma": [T("vid", "we know", "2 (adādi)", "liṭ", 1, BAHU,
                note="perfect with present sense")],
    "rajasī": [S("rajas", "the two realms", N, 2, DVI, stem="s-stem")],
    "pṛthivyā": [S("pṛthivī", "of the earth", F, 6, EKA, stem="ī-stem")],
    "deva": [S("deva", "O god", M, 8, EKA, stem="a-stem")],
    "tvam": [S("yuṣmad", "you", M, 1, EKA, stem="pronoun")],
    "paramasya": [S("parama", "of the highest", N, 6, EKA, stem="a-stem")],
    "vitse": [T("vid", "you know, you possess", "6 (tudādi)", "laṭ", 2, EKA,
                note="ātmanepada, governing the genitive")],
})

WORDS.update({
    # ---- verse 6 (TB 2.4.3.5 · RV 7.100.4) --------------------------------
    "vicakrame": [U("vi", "apart, out"),
                  T("kram", "he strode out", "1 (bhvādi)", "liṭ", 3, EKA,
                    note="perfect ātmanepada")],
    "pṛthivīm": [S("pṛthivī", "the earth", F, 2, EKA, stem="ī-stem")],
    "eṣa": [S("etad", "this one", M, 1, EKA, stem="pronoun")],
    "etām": [S("etad", "this", F, 2, EKA, stem="pronoun")],
    "kṣetrāya": [S("kṣetra", "for a field, for a dwelling-ground", N, 4, EKA,
                   stem="a-stem")],
    "manuṣe": [S("manus", "for man", M, 4, EKA, stem="s-stem")],
    "daśasyann": [S("daśasyant", "granting, bestowing", M, 1, EKA,
                    note="present participle of the denominative daśasya-; "
                         "the doubled -nn is the Taittirīya pāda-final form")],
    "dhruvāso": [S("dhruva", "steadfast, firm", M, 1, BAHU, stem="a-stem",
                   note="Vedic nom. pl. in -āsaḥ")],
    "kīrayo": [S("kīri", "singers, praisers", M, 1, BAHU, stem="i-stem")],
    "janāsaḥ": [S("jana", "people, folk", M, 1, BAHU, stem="a-stem",
                  note="Vedic nom. pl. in -āsaḥ")],
    "urukṣitim": [S("urukṣiti", "wide dwelling-place", F, 2, EKA,
                    stem="i-stem", note="uru- + kṣiti-; the short u is the "
                                        "reading of both accented witnesses")],
    "sujanimā": [S("sujaniman", "of good birth, well-created", N, 2, EKA,
                   stem="n-stem")],
    "cakāra": [T("kṛ", "he made", "8 (tanādi)", "liṭ", 3, EKA)],

    # ---- verse 7 (TB 2.4.3.5 · RV 7.100.3) --------------------------------
    "trir": [A("tris", "thrice, three times")],
    "devaḥ": [S("deva", "the god", M, 1, EKA, stem="a-stem")],
    "śatarcasaṁ": [S("śatarcas", "of a hundred hymns, hundredfold-praised",
                     N, 2, EKA, stem="s-stem")],
    "mahitvā": [S("mahitva", "by greatness", N, 3, EKA, stem="a-stem")],
    "astu": [T("as", "let him be", "2 (adādi)", "loṭ", 3, EKA)],
    "tavasas": [S("tavas", "than the strong one", N, 5, EKA, stem="s-stem",
                  note="ablative of comparison with the comparative tavīyān")],
    "tavīyān": [S("tavīyas", "mightier", M, 1, EKA, stem="comparative of tavas")],
    "tveṣam": [S("tveṣa", "awesome, impetuous", N, 1, EKA, stem="a-stem")],
    "hyasya": [A("hi", "for, indeed"),
               S("idam", "of him, his", M, 6, EKA, stem="pronoun",
                 note="hi + asya")],
    "sthavirasya": [S("sthavira", "of the firm, enduring one", M, 6, EKA,
                      stem="a-stem")],
    "nāma": [S("nāman", "name", N, 1, EKA, stem="n-stem")],

    # ---- verse 8 (RV 1.22.16) --------------------------------------------
    "ato": [A("atas", "from there, therefore")],
    "devā": [S("deva", "the gods", M, 1, BAHU, stem="a-stem")],
    "avantu": [T("av", "let them favour, let them protect", "1 (bhvādi)",
                 "loṭ", 3, BAHU)],
    "no": [S("asmad", "us", M, 2, BAHU, stem="pronoun",
             note="the enclitic naḥ; visarga → -o before the voiced y-")],
    "yato": [A("yatas", "from where, whence")],
    "pṛthivyās": [S("pṛthivī", "of the earth", F, 6, EKA, stem="ī-stem",
                    note="pṛthivyāḥ; visarga assimilated to the following s-")],
    "sapta": [S("saptan", "seven", N, 3, BAHU, stem="numeral",
                note="in agreement with dhāmabhiḥ")],
    "dhāmabhiḥ": [S("dhāman", "by the stations, abodes", N, 3, BAHU,
                    stem="n-stem")],

    # ---- verse 9 (TS 1.2.13.1-2 · RV 1.22.17) -----------------------------
    "idaṁ": [S("idam", "this", N, 2, EKA, stem="pronoun")],
    "tredhā": [A("tredhā", "in three ways, threefold")],
    "ni": [U("ni", "down")],
    "dadhe": [T("dhā", "he set down", "3 (juhotyādi)", "liṭ", 3, EKA,
                note="perfect ātmanepada, with the preverb ni")],
    "padam": [S("pada", "step, footstep", N, 2, EKA, stem="a-stem")],
    "padaṁ": [S("pada", "step, footstep", N, 2, EKA, stem="a-stem")],
    "samūḍham": [S("samūḍha", "gathered up, heaped together", N, 1, EKA,
                   stem="past passive participle of sam-√vah")],
    "pāmsure": [S("pāṁsu", "in the dust", M, 7, EKA, stem="u-stem")],

    # ---- verse 10 (TB 2.4.6.1 · RV 1.22.18) -------------------------------
    "trīṇi": [S("tri", "three", N, 2, BAHU, stem="numeral")],
    "padā": [S("pada", "steps", N, 2, BAHU, stem="a-stem",
               note="Vedic nom./acc. pl. in -ā")],
    "gopā": [S("gopā", "guardian, herdsman", M, 1, EKA,
               note="go- + -pā, a root-noun compound")],
    "adābhyaḥ": [S("adābhya", "not to be deceived, inviolable", M, 1, EKA,
                   stem="a-stem")],
    "tato": [A("tatas", "thence, from that",
               note="the Taittirīya reading; the Ṛgveda has ataḥ. A recension "
                    "difference, not an error")],
    "dharmāṇi": [S("dharman", "ordinances, upholdings", N, 2, BAHU,
                   stem="n-stem")],
    "dhārayann": [S("dhārayant", "upholding, sustaining", M, 1, EKA,
                    note="present participle of the causative of √dhṛ; the "
                         "doubled -nn is the Taittirīya pāda-final form")],
})

WORDS.update({
    # ---- verses 11-13 (TS 1.3.6.2 · RV 1.22.19-21) ------------------------
    "karmāṇi": [S("karman", "works, deeds", N, 2, BAHU, stem="n-stem")],
    "paśyata": [T("dṛś", "behold!", "1 (bhvādi)", "loṭ", 2, BAHU,
                  note="the suppletive present paśya- serves √dṛś")],
    "vratāni": [S("vrata", "sacred observances, ordinances", N, 2, BAHU,
                  stem="a-stem")],
    "paspaśe": [T("spaś", "he has kept watch over, has beheld", "1 (bhvādi)",
                  "liṭ", 3, EKA, note="perfect ātmanepada")],
    "indrasya": [S("indra", "of Indra", M, 6, EKA, stem="a-stem")],
    "yujyas": [S("yujya", "fit to be yoked with, suitable", M, 1, EKA,
                 stem="a-stem",
                 note="yujyaḥ; visarga assimilated to the following s-")],
    "sakhā": [S("sakhi", "companion, friend", M, 1, EKA, stem="i-stem",
                note="irregular nom. sg. sakhā")],
    "paramam": [S("parama", "highest", N, 1, EKA, stem="a-stem")],
    "sadā": [A("sadā", "always, for ever")],
    "paśyanti": [T("dṛś", "they behold", "1 (bhvādi)", "laṭ", 3, BAHU)],
    "sūrayaḥ": [S("sūri", "the wise, the seers", M, 1, BAHU, stem="i-stem")],
    "divīva": [S("div", "in heaven", M, 7, EKA, stem="root noun"),
               A("iva", "like, as", note="divi + iva")],
    "cakṣur": [S("cakṣus", "eye", N, 1, EKA, stem="s-stem")],
    "ātatam": [S("ātata", "stretched out, spread wide", N, 1, EKA,
                 stem="past passive participle of ā-√tan")],
    "viprāso": [S("vipra", "the inspired ones, the seers", M, 1, BAHU,
                  stem="a-stem", note="Vedic nom. pl. in -āsaḥ")],
    "vipanyavo": [S("vipanyu", "praise-loving, eager to laud", M, 1, BAHU,
                    stem="u-stem")],
    "jāgṛvāmsas": [S("jāgṛvas", "wakeful, ever-watchful", M, 1, BAHU,
                     note="perfect active participle of √jāgṛ")],
    "samindhate": [U("sam", "together, fully"),
                   T("indh", "they kindle", "7 (rudhādi)", "laṭ", 3, BAHU,
                     note="ātmanepada")],
    "yat": [S("yad", "which", N, 1, EKA, stem="pronoun")],

    # ---- verse 14: the closing brāhmaṇa prose -----------------------------
    "paryāptyā": [S("paryāpti", "by full attainment, by sufficiency", F, 3,
                    EKA, stem="i-stem", note="pari-√āp; the witnesses read the "
                                             "instrumental paryāptyā")],
    "anantarāyāya": [S("anantarāya", "for freedom from interruption", M, 4,
                       EKA, stem="a-stem",
                       note="an- + antarāya; the anusvāra is written "
                            "un-assimilated in the source and the engine "
                            "derives the n")],
    "sarvastomo": [S("sarvastoma", "the sarvastoma (a soma rite in which every "
                     "stoma is employed)", M, 1, EKA, stem="a-stem")],
    "'tirātra": [S("atirātra", "the atirātra, the overnight soma rite",
                     M, 1, EKA, stem="a-stem",
                     note="the initial a- is elided after -o and written with "
                          "the avagraha")],
    "uttama": [S("uttama", "last, uttermost", N, 1, EKA, stem="a-stem",
                 note="uttamam; the final -m is carried over to the next word "
                      "in the recited division uttama mahar")],
    "mahar": [S("ahar", "day", N, 1, EKA, stem="r/n-stem",
                note="uttamam ahar, recited and written as uttama mahar")],
    "bhavati": [T("bhū", "becomes, is", "1 (bhvādi)", "laṭ", 3, EKA)],
    "sarvasyāptyai": [S("sarva", "of all", N, 6, EKA, stem="pronominal a-stem"),
                      S("āpti", "for the winning, for the obtaining", F, 4,
                        EKA, stem="i-stem", note="sarvasya + āptyai")],
    "sarvasya": [S("sarva", "of all", N, 6, EKA, stem="pronominal a-stem")],
    "jittyai": [S("jiti", "for the conquest", F, 4, EKA, stem="i-stem",
                  note="the geminate -tty- is the reading of both witnesses "
                       "for this passage and is kept; the grammatical form is "
                       "jityai")],
    "sarvam": [S("sarva", "all", N, 2, EKA, stem="pronominal a-stem")],
    "eva": [A("eva", "indeed, just so")],
    "tenāpnoti": [S("tad", "by that, thereby", N, 3, EKA, stem="pronoun"),
                  T("āp", "one obtains", "5 (svādi)", "laṭ", 3, EKA,
                    note="tena + āpnoti")],
    "sarvañ": [S("sarva", "all", N, 2, EKA, stem="pronominal a-stem",
                 note="sarvam; the anusvāra assimilates to the palatal nasal "
                      "before j-")],
    "jayati": [T("ji", "one conquers", "1 (bhvādi)", "laṭ", 3, EKA)],
})
