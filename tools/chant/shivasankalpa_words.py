# -*- coding: utf-8 -*-
"""Per-word grammar for `gen_shivasankalpa.py`, keyed by the surface AFTER the
anusvāra / visarga / gum transforms (`manaś`, `prajānān`, `viśvañ`, `daivan`…).

`gen_shivasankalpa.build()` fails loudly on any surface with no entry, so the
grammar can never drift out of alignment with the token stream
(AUTHORING-CHANTS §5C). Run `gen_shivasankalpa.py --surfaces` to re-derive the
key list after editing the text.

Conventions (AUTHORING-CHANTS §4):
  * `vibhakti` 1..8, 7 = locative, 8 = vocative; `purusha` 1/2/3 =
    uttama/madhyama/prathama.
  * `gana` is rendered inline as `root (gana)`, so it holds the gaṇa and
    nothing else; remarks go in `note`.
  * An upasarga on a FINITE verb gets its own entry beside the root; a preverb
    lexicalised into a nominal or participial stem stays inside that lemma with
    the derivation in `note`.
  * A sandhi-fused surface carries SEVERAL entries (`yenedam`, `devāpi`,
    `hyayam`, `cāntarikṣañ`, `tathaivaiti`, `vedāham`, `ivārāḥ`).
  * `forms` is derived, never hand-typed.

HOMOGRAPHS. The table is keyed by surface, so a surface that is two different
words in two different mantras needs `OVERRIDES[(verse id, word index)]` — `na`
is the negative particle in mantra 4 and the enclitic `naḥ` of `asmad` in 29 and
30; `te` is the nominative plural of `tad` in 14 and 39 and the dative of
`yuṣmad` in 30.
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


def O(lemma, meaning, note=None):
    """A bare stem standing as the first member of a compound — no vibhakti,
    because a stem has none. `Gram.type` allows `other` for exactly this."""
    e = {"lemma": lemma, "type": "other", "meaning": meaning,
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

PRON = "pronominal"

# --- the refrain, recited after every one of the thirty-nine mantras -------
_TAT_N = lambda: S("tad", "that", N, 1, EKA, stem=PRON)
_YAD_N = lambda: S("yad", "which, that which", N, 1, EKA, stem=PRON)
_YENA = lambda: S("yad", "by which", N, 3, EKA, stem=PRON)
_IDAM_N = lambda note=None: S("idam", "this", N, 1, EKA, stem=PRON,
                              note=note)
#: The house note for a surface that two or three words have fused into: it is
#: what tells the reader why one chunk shows several grammar rows.
NOTE_FUSE = "vowel sandhi has fused %s into one recited word"
_MANAS = lambda: S("manas", "mind", N, 1, EKA, stem="s-stem")
_PRAJANAM = lambda: S("prajā", "of living beings, of creatures", F, 6, BAHU,
                      stem="ā-stem")
_CA = lambda: A("ca", "and")
_YA_NOM = lambda: S("yad", "who, he who", M, 1, EKA, stem=PRON)
_NAS = lambda: S("asmad", "us, our", None, 2, BAHU, stem=PRON,
                 note="the enclitic naḥ")


WORDS = {
    # ---- the refrain ------------------------------------------------------
    "tan": [_TAT_N()],
    "me": [S("asmad", "of me, my", None, 6, EKA, stem=PRON,
             note="the enclitic me")],
    "manaś": [S("manas", "mind", N, 1, EKA, stem="s-stem",
                note="visarga assimilated to the following ś-")],
    "śivasaṅkalpam": [S("śivasaṅkalpa",
                        "of auspicious resolve — whose saṅkalpa is śiva",
                        N, 1, EKA, stem="a-stem (bahuvrīhi)")],
    "astu": [T("as", "let it be", "2 (adādi)", "loṭ", 3, EKA)],

    # ---- mantra 1 ---------------------------------------------------------
    "yenedam": [_YENA(), _IDAM_N(NOTE_FUSE % "yena + idam")],
    "yenedaṁ": [_YENA(), _IDAM_N(NOTE_FUSE % "yena + idam")],
    "yenedañ": [_YENA(), _IDAM_N(NOTE_FUSE % "yena + idam")],
    "bhūtam": [S("bhūta", "what has come to be, the past", N, 1, EKA,
                 stem="a-stem", note="past passive participle of √bhū")],
    "bhuvanam": [S("bhuvana", "the world, what now is", N, 1, EKA,
                   stem="a-stem")],
    "bhaviṣyat": [S("bhaviṣyat", "what is to be, the future", N, 1, EKA,
                    stem="future active participle of √bhū")],
    "parigṛhītam": [S("parigṛhīta", "encompassed, taken hold of all round",
                      N, 1, EKA, stem="a-stem",
                      note="past passive participle of pari-√grah")],
    "amṛtena": [S("amṛta", "by the deathless, by immortality", N, 3, EKA,
                  stem="a-stem")],
    "sarvam": [S("sarva", "all, the whole", N, 1, EKA, stem=PRON)],
    "yena": [_YENA()],
    "yajñas": [S("yajña", "sacrifice", M, 1, EKA, stem="a-stem",
                 note="underlying yajñaḥ; the visarga becomes s before t-")],
    "tāyate": [T("tan", "is extended, is stretched out", "8 (tanādi)", "laṭ",
                 3, EKA, note="passive; Vedic tāyate")],
    "saptahotā": [S("saptahotṛ", "having seven priests — the seven-hotṛ rite",
                    M, 1, EKA, stem="ṛ-stem (bahuvrīhi)")],

    # ---- mantra 2 ---------------------------------------------------------
    "karmāṇi": [S("karman", "works, rites", N, 2, BAHU, stem="n-stem")],
    "karmāṇy": [S("karman", "works, rites", N, 2, BAHU, stem="n-stem",
                  note="karmāṇi before a vowel")],
    "pracaranti": [U("pra", "forth, forward"),
                   T("car", "they set in motion, they carry on",
                     "1 (bhvādi)", "laṭ", 3, BAHU)],
    "dhīrā": [S("dhīra", "the steadfast, the wise", M, 1, BAHU, stem="a-stem",
                note="dhīrāḥ; the visarga is lost before the voiced y-")],
    "dhīrāḥ": [S("dhīra", "the steadfast, the wise", M, 1, BAHU,
                 stem="a-stem")],
    "dhīrās": [S("dhīra", "the steadfast, the wise", M, 1, BAHU,
                 stem="a-stem",
                 note="underlying dhīrāḥ; the visarga becomes s before t-")],
    "yato": [A("yatas", "from which, whence")],
    "vācā": [S("vāc", "by speech", F, 3, EKA, stem="c-stem")],
    "manasā": [S("manas", "by the mind", N, 3, EKA, stem="s-stem")],
    "cāru": [A("cāru", "fittingly, well",
               note="the neuter used adverbially")],
    "yanti": [T("i", "they go, they proceed", "2 (adādi)", "laṭ", 3, BAHU)],
    "yat": [_YAD_N()],
    "sammitaṁ": [S("sammita", "commensurate, measured together with", N, 2,
                   EKA, stem="a-stem",
                   note="past passive participle of sam-√mā, with manaḥ as "
                        "the object of sañcaranti")],
    "manas": [S("manas", "mind", N, 2, EKA, stem="s-stem",
                note="the object of sañcaranti; the recitation has no "
                     "prāṇinaḥ to be its subject")],
    "sañcaranti": [U("sam", "together"),
                   T("car", "they move about", "1 (bhvādi)", "laṭ", 3, BAHU)],

    # ---- mantra 3 ---------------------------------------------------------
    "apaso": [S("apas", "active, skilled in work", M, 1, BAHU, stem="s-stem",
                note="apasaḥ; aḥ becomes o before a voiced sound")],
    "manīṣiṇo": [S("manīṣin", "thoughtful, wise", M, 1, BAHU, stem="in-stem",
                   note="manīṣiṇaḥ; aḥ becomes o before a voiced sound")],
    "yajñe": [S("yajña", "at the sacrifice", M, 7, EKA, stem="a-stem")],
    "kṛṇvanti": [T("kṛ", "they do, they perform", "5 (svādi)", "laṭ", 3, BAHU,
                   note="the Vedic present stem kṛṇo-/kṛṇu-")],
    "vidatheṣu": [S("vidatha", "at the ritual assemblies", N, 7, BAHU,
                    stem="a-stem")],
    "yad": [_YAD_N()],
    "apūrvaṁ": [S("apūrva", "unprecedented, without anything before it", N, 1,
                  EKA, stem="a-stem")],
    "yakṣam": [S("yakṣa", "a wondrous appearance, a mysterious power", N, 1,
                 EKA, stem="a-stem")],
    "antaḥ": [A("antar", "within, inside",
                note="antar; before p- it is written with the visarga and "
                     "recited as the upadhmānīya")],
    "prajānān": [_PRAJANAM()],

    # ---- mantra 4 ---------------------------------------------------------
    "prajñānam": [S("prajñāna", "understanding, discernment", N, 1, EKA,
                    stem="a-stem", note="from pra-√jñā")],
    "uta": [A("uta", "and, also")],
    "ceto": [S("cetas", "awareness, consciousness", N, 1, EKA, stem="s-stem",
               note="cetaḥ; aḥ becomes o before a voiced sound")],
    "dhṛtiś": [S("dhṛti", "steadfastness, holding firm", F, 1, EKA,
                 stem="i-stem",
                 note="underlying dhṛtiḥ; the visarga becomes ś before c-")],
    "ca": [_CA()],
    "yaj": [_YAD_N()],
    "jyotir": [S("jyotis", "light", N, 1, EKA, stem="s-stem",
                 note="jyotiḥ; the visarga becomes r before a vowel")],
    "antar": [A("antar", "within, inside")],
    "amṛtam": [S("amṛta", "deathless, immortal", N, 1, EKA, stem="a-stem")],
    "prajāsu": [S("prajā", "among living beings", F, 7, BAHU, stem="ā-stem")],
    "yasmān": [S("yad", "from which, than which", N, 5, EKA, stem=PRON,
                 note="yasmāt; t becomes n before n-")],
    "na": [A("na", "not")],
    "ṛte": [A("ṛte", "without, apart from", note="governs the ablative")],
    "kiñcana": [S("kiṁcana", "anything whatever", N, 1, EKA, stem=PRON,
                  note="kim + cana; ṁ becomes ñ before c-")],
    "karma": [S("karman", "act, work", N, 1, EKA, stem="n-stem")],
    "kriyate": [T("kṛ", "is done", "8 (tanādi)", "laṭ", 3, EKA,
                  note="passive, which is formed alike from any gaṇa; the "
                       "citation gaṇa is 8, while kṛṇvanti at mantra 3 is "
                       "the Vedic class-5 stem kṛṇu-")],

    # ---- mantra 5 ---------------------------------------------------------
    "suṣārathir": [S("suṣārathi", "a good charioteer", M, 1, EKA,
                     stem="i-stem",
                     note="suṣārathiḥ; the visarga becomes r before a vowel")],
    "aśvān": [S("aśva", "horses", M, 2, BAHU, stem="a-stem")],
    "iva": [A("iva", "like, as")],
    "yan": [_YAD_N()],
    "manuṣyān": [S("manuṣya", "men", M, 2, BAHU, stem="a-stem")],
    "nenīyate": [T("nī", "leads on again and again", "1 (bhvādi)", "laṭ", 3,
                   EKA, note="the intensive (yaṅanta) stem nenī-")],
    "'bhīśubhir": [S("abhīśu", "by the reins", M, 3, BAHU, stem="u-stem",
                     note="abhīśubhiḥ; the visarga becomes r before v-")],
    "vājina": [S("vājin", "swift steeds", M, 1, BAHU, stem="in-stem",
                 note="vājinaḥ; aḥ becomes a before a vowel")],
    "hṛtpratiṣṭhaṁ": [S("hṛtpratiṣṭha", "seated in the heart", N, 1, EKA,
                        stem="a-stem")],
    "acarañ": [S("acara", "not moving, motionless", N, 1, EKA, stem="a-stem",
                 note="the base edition's reading; the Vājasaneyi Saṁhitā "
                      "34.6 and the Ṛgveda Khila read ajiram, 'swift'")],
    "javiṣṭhan": [S("javiṣṭha", "swiftest", N, 1, EKA, stem="a-stem",
                    note="superlative of javas, speed")],

    # ---- mantra 6 ---------------------------------------------------------
    "yasminn": [S("yad", "in which", M, 7, EKA, stem=PRON,
                  note="yasmin; the Taittirīya doubles the final n before a "
                       "vowel")],
    "yasmin": [S("yad", "in which", M, 7, EKA, stem=PRON)],
    "yasmimś": [S("yad", "in which", M, 7, EKA, stem=PRON,
                  note="yasmin + ś-: the anusvāra is recited as the gum")],
    "ṛcas": [S("ṛc", "the ṛc verses", F, 1, BAHU, stem="c-stem",
               note="underlying ṛcaḥ; the visarga becomes s before s-")],
    "sāma": [S("sāman", "the sāman chants", N, 1, EKA, stem="n-stem",
               note="the singular stands for the collection")],
    "yajūmṣi": [S("yajus", "the yajus formulae", N, 1, BAHU, stem="s-stem",
                  note="yajūṁṣi; the Taittirīya recites the anusvāra before "
                       "ṣ- as the gum")],
    "pratiṣṭhitā": [S("pratiṣṭhita", "established, standing firm", F, 1, BAHU,
                      stem="a-stem",
                      note="past passive participle of prati-√sthā, agreeing "
                           "with ṛcaḥ")],
    "rathanābhāv": [S("rathanābhi", "in the hub of a chariot wheel", F, 7,
                      EKA, stem="i-stem",
                      note="rathanābhau; au becomes āv before a vowel")],
    "ivārāḥ": [A("iva", "like, as"),
               S("arā", "spokes", F, 1, BAHU, stem="ā-stem")],
    "cittam": [S("citta", "thought, mind", N, 1, EKA, stem="a-stem")],
    "otam": [S("ota", "woven in, interwoven", N, 1, EKA, stem="a-stem",
               note="past passive participle of ā-√ve")],

    # ---- mantra 7 ---------------------------------------------------------
    "atra": [A("atra", "here")],
    "ṣaṣṭhan": [S("ṣaṣṭha", "the sixth", N, 1, EKA, stem="a-stem (ordinal)")],
    "triśatam": [S("triśata", "three hundred", N, 1, EKA,
                   stem="a-stem (numeral)")],
    "suvīryaṁ": [S("suvīrya", "rich in strength, of good heroic power", N, 1,
                   EKA, stem="a-stem")],
    "yajñasya": [S("yajña", "of the sacrifice", M, 6, EKA, stem="a-stem")],
    "guhyaṁ": [S("guhya", "the secret, what is to be hidden", N, 1, EKA,
                 stem="a-stem (gerundive of √guh)")],
    "navanāva": [S("navanāva", "ever new, new upon new", N, 1, EKA,
                   stem="a-stem",
                   note="an obscure form; the Ṛgveda Khila 4.11.7 reads "
                        "nava-nābham, 'nine-naved', and the pāda is damaged "
                        "in every witness")],
    "māyyam": [S("māyya", "of the nature of māyā, a mystery", N, 1, EKA,
                 stem="a-stem",
                 note="uncertain in text AND in lexicon: Monier-Williams has "
                      "no entry for māyya beyond a cross-reference to "
                      "puru-māyya, and Ṛgveda Khila 4.11.7 reads ādyam, "
                      "'primal'")],
    "daśa": [S("daśan", "ten", N, 1, BAHU, stem="n-stem (numeral)")],
    "pañca": [S("pañcan", "five", N, 1, BAHU, stem="n-stem (numeral)")],
    "trimśataṁ": [S("triṁśat", "thirty", F, 2, EKA, stem="t-stem (numeral)",
                    note="triṁśatam; the Taittirīya recites the anusvāra "
                         "before ś- as the gum")],
    "paran": [S("para", "what is beyond, the highest", N, 1, EKA,
                stem="a-stem")],

    # ---- mantra 8 ---------------------------------------------------------
    "jāgrato": [S("jāgrat", "of one who is awake", M, 6, EKA,
                  stem="present participle of √jāgṛ",
                  note="jāgrataḥ; aḥ becomes o before a voiced sound")],
    "dūram": [A("dūram", "far, to a distance",
                note="the neuter accusative used adverbially")],
    "udaiti": [U("ud", "up, out"),
               T("i", "goes forth, rises", "2 (adādi)", "laṭ", 3, EKA)],
        "tat": [_TAT_N()],
    "suptasya": [S("supta", "of one who is asleep", M, 6, EKA, stem="a-stem",
                   note="past passive participle of √svap")],
    "tathaivaiti": [A("tathā", "so, in that way"), A("eva", "just, indeed"),
                    T("i", "goes", "2 (adādi)", "laṭ", 3, EKA)],
    "dūraṅgamañ": [S("dūraṁgama", "far-travelling", N, 1, EKA, stem="a-stem",
                     note="the anusvāra takes the homorganic ṅ before g-")],
    "jyotiṣāñ": [S("jyotis", "of the lights", N, 6, BAHU, stem="s-stem",
                   note="jyotiṣām; ṁ becomes ñ before j-")],
    "ekan": [S("eka", "one, single", N, 1, EKA, stem="a-stem (numeral)")],

    # ---- mantra 9 ---------------------------------------------------------
    "viśvañ": [S("viśva", "all, the whole", N, 1, EKA, stem=PRON)],
    "jagato": [S("jagat", "of the moving world", N, 6, EKA, stem="t-stem",
                 note="jagataḥ; aḥ becomes o before a voiced sound")],
    "babhūva": [T("bhū", "came to be, became", "1 (bhvādi)", "liṭ", 3, EKA,
                  note="perfect")],
    "ye": [S("yad", "who, they who", M, 1, BAHU, stem=PRON)],
    "devāpi": [S("deva", "the gods", M, 1, BAHU, stem="a-stem"),
               A("api", "also, too")],
    "mahato": [S("mahat", "of the great one", M, 6, EKA, stem="t-stem",
                 note="mahataḥ; the concord with the nominative jātavedāḥ is "
                      "loose, as often in this compilation")],
    "jātavedāḥ": [S("jātavedas", "Jātavedas, the knower of all that is born "
                    "— Agni", M, 1, EKA, stem="s-stem")],
    "tad": [_TAT_N()],
    "evāgnis": [A("eva", "indeed, just"),
                S("agni", "Agni, fire", M, 1, EKA, stem="i-stem",
                  note="agniḥ; the visarga becomes s before t-")],
    "vāyus": [S("vāyu", "Vāyu, wind", M, 1, EKA, stem="u-stem",
                note="vāyuḥ; the visarga becomes s before t-")],
    "sūryas": [S("sūrya", "the sun", M, 1, EKA, stem="a-stem",
                 note="sūryaḥ; the visarga becomes s before t-")],
    "u": [A("u", "and, now (an emphasising particle)")],
    "candramās": [S("candramas", "the moon", M, 1, EKA, stem="s-stem",
                    note="candramāḥ; the visarga becomes s before t-")],

    # ---- mantra 10 --------------------------------------------------------
    "dyauḥ": [S("div", "heaven, the sky", F, 1, EKA, stem="v-stem")],
    "pṛthivī": [S("pṛthivī", "the earth", F, 1, EKA, stem="ī-stem")],
    "cāntarikṣañ": [_CA(),
                    S("antarikṣa", "the mid-region, the space between", N, 1,
                      EKA, stem="a-stem")],
    "parvatāḥ": [S("parvata", "the mountains", M, 1, BAHU, stem="a-stem")],
    "pradiśo": [S("pradiś", "the intermediate quarters", F, 1, BAHU,
                  stem="ś-stem",
                  note="pradiśaḥ; aḥ becomes o before a voiced sound")],
    "diśaś": [S("diś", "the quarters, the directions", F, 1, BAHU,
                stem="ś-stem",
                note="underlying diśaḥ; the visarga becomes ś before c-")],
    "jagad": [S("jagat", "the moving world", N, 1, EKA, stem="t-stem",
                note="jagat; t becomes d before a voiced sound")],
    "vyāptam": [S("vyāpta", "pervaded", N, 1, EKA, stem="a-stem",
                  note="past passive participle of vi-√āp")],

    # ---- mantra 11 --------------------------------------------------------
    "mano": [S("manas", "mind", N, 1, EKA, stem="s-stem",
               note="manaḥ; aḥ becomes o before a voiced sound")],
    "hṛdayaṁ": [S("hṛdaya", "heart", N, 1, EKA, stem="a-stem")],
    "devā": [S("deva", "the gods", M, 1, BAHU, stem="a-stem",
               note="devāḥ; the visarga is lost before the voiced y-")],
    "divyā": [S("divya", "divine, heavenly", F, 1, BAHU, stem="a-stem",
                note="divyāḥ, agreeing with āpaḥ")],
    "āpo": [S("ap", "the waters", F, 1, BAHU, stem="p-stem",
              note="āpaḥ; aḥ becomes o before a voiced sound")],
    "sūryaraśmiḥ": [S("sūryaraśmi", "the ray of the sun", M, 1, EKA,
                      stem="i-stem")],
    "śrotre": [S("śrotra", "the two ears", N, 1, DVI, stem="a-stem")],
    "cakṣuṣī": [S("cakṣus", "the two eyes", N, 1, DVI, stem="s-stem")],
    "sañcarantan": [S("sañcarat", "moving about, ranging through", M, 2, EKA,
                      stem="present participle of sam-√car",
                      note="the neuter accusative of an -ant stem is the weak "
                           "sañcarat; -antam is masculine")],

    # ---- mantra 12 --------------------------------------------------------
    "acintyañ": [S("acintya", "unthinkable, not to be conceived", N, 1, EKA,
                   stem="a-stem (gerundive with the privative a-)")],
    "cāprameyañ": [_CA(),
                   S("aprameya", "immeasurable, not to be measured", N, 1,
                     EKA, stem="a-stem (gerundive of pra-√mā)")],
    "vyaktāvyaktaparañ": [S("vyaktāvyaktapara",
                            "beyond the manifest and the unmanifest", N, 1,
                            EKA, stem="a-stem")],
    "sūkṣmāt": [S("sūkṣma", "than the subtle", N, 5, EKA, stem="a-stem")],
    "sūkṣmataraṁ": [S("sūkṣmatara", "subtler", N, 1, EKA,
                      stem="a-stem (comparative)")],
    "jñeyan": [S("jñeya", "to be known", N, 1, EKA,
                 stem="a-stem (gerundive of √jñā)")],

    # ---- mantra 13 (the numeral litany) -----------------------------------
    "ekā": [S("eka", "one", F, 1, EKA, stem="a-stem (numeral)",
              note="feminine, agreeing with the iṣṭakāḥ — the bricks of the "
                   "fire-altar counted in this litany")],
    "śatañ": [S("śata", "a hundred", N, 1, EKA, stem="a-stem (numeral)")],
    "sahasrañ": [S("sahasra", "a thousand", N, 1, EKA,
                   stem="a-stem (numeral)")],
    "cāyutañ": [_CA(),
                S("ayuta", "ten thousand", N, 1, EKA,
                  stem="a-stem (numeral)")],
    "niyutañ": [S("niyuta", "a hundred thousand", N, 1, EKA,
                  stem="a-stem (numeral)")],
    "prayutañ": [S("prayuta", "a million", N, 1, EKA,
                   stem="a-stem (numeral)")],
    "cārbudañ": [_CA(),
                 S("arbuda", "ten million", N, 1, EKA,
                   stem="a-stem (numeral)")],
    "nyarbudañ": [S("nyarbuda", "a hundred million", N, 1, EKA,
                    stem="a-stem (numeral)")],

    # ---- mantra 14 --------------------------------------------------------
    "pañcādaśa": [S("pañcadaśan", "fifteen", N, 1, BAHU,
                    stem="n-stem (numeral)",
                    note="the base edition lengthens the a; the ordinary form "
                         "is pañcadaśa")],
    "śatam": [S("śata", "a hundred", N, 1, EKA, stem="a-stem (numeral)")],
    "sahasram": [S("sahasra", "a thousand", N, 1, EKA,
                   stem="a-stem (numeral)")],
    "ayutaṁ": [S("ayuta", "ten thousand", N, 1, EKA,
                 stem="a-stem (numeral)")],
    "te": [S("tad", "they, those", M, 1, BAHU, stem=PRON)],
    "agni": [O("agni", "fire — the piled fire-altar",
               note="a bare stem: the other editions read agni-cit- as the "
                    "first member of one compound. The pāda is damaged in "
                    "every witness — Ṛgveda Khila 4.11.8 reads te yajña "
                    "citta iṣṭakāt tam śarīram")],
    "citteṣṭakās": [S("citteṣṭakā", "the bricks of the piling", F, 1, BAHU,
                      stem="ā-stem",
                      note="citta + iṣṭakāḥ; the visarga becomes s before t-. "
                           "Other editions read agnicity-eṣṭakāḥ, 'the bricks "
                           "of the fire-piling'")],
    "tām": [S("tad", "that, her", F, 2, EKA, stem=PRON)],
    "śarīran": [S("śarīra", "body", N, 1, EKA, stem="a-stem")],

    # ---- mantra 15 --------------------------------------------------------
    "vedāham": [T("vid", "I know", "2 (adādi)", "liṭ", 1, EKA,
                  note="the perfect veda with present sense"),
                S("asmad", "I", None, 1, EKA, stem=PRON)],
    "etam": [S("etad", "this", M, 2, EKA, stem=PRON)],
    "puruṣaṁ": [S("puruṣa", "the Puruṣa, the cosmic Person", M, 2, EKA,
                  stem="a-stem")],
    "mahāntam": [S("mahat", "great", M, 2, EKA, stem="t-stem")],
    "ādityavarṇan": [S("ādityavarṇa", "sun-coloured, of the hue of the sun",
                       M, 2, EKA, stem="a-stem")],
    "tamasaḥ": [S("tamas", "than the darkness, beyond the darkness", N, 5,
                  EKA, stem="s-stem")],
    "parastāt": [A("parastāt", "beyond, on the far side of",
                   note="governs the ablative")],
    "yasya": [S("yad", "whose, of which", M, 6, EKA, stem=PRON)],
    "yonim": [S("yoni", "source, womb, origin", F, 2, EKA, stem="i-stem")],
    "paripaśyanti": [U("pari", "round, on every side"),
                     T("dṛś", "they behold", "1 (bhvādi)", "laṭ", 3, BAHU,
                       note="the present stem paśya-")],

    # ---- mantra 16 --------------------------------------------------------
    "yasyaitan": [S("yad", "whose", M, 6, EKA, stem=PRON),
                  S("etad", "this", M, 2, EKA, stem=PRON,
                    note="yasya + etam; the neuter accusative would be etat")],
    "punanti": [T("pū", "they purify", "9 (kryādi)", "laṭ", 3, BAHU)],
    "kavayo": [S("kavi", "seers, poets", M, 1, BAHU, stem="i-stem",
                 note="kavayaḥ; aḥ becomes o before a voiced sound")],
    "brahmāṇam": [S("brahman", "Brahmā — the absolute in personal form",
                    M, 2, EKA, stem="n-stem",
                    note="the strong accusative brahmāṇam belongs to the "
                         "masculine brahmán; the neuter bráhman would give "
                         "brahma, as at mantras 18, 31 and 33")],
    "etan": [S("etad", "this", M, 2, EKA, stem=PRON)],
    "tvā": [S("yuṣmad", "you", None, 2, EKA, stem=PRON)],
    "vṛṇutam": [T("vṛ", "choose, you two", "5 (svādi)", "loṭ", 2, DVI,
                  note="the class-5 imperative second dual; the Vedic vṛṇu- "
                       "stem serves both √vṛ 5 'cover' and √vṛ 9 'choose'. "
                       "The pāda is uncertain: other editions read vṛṇuta "
                       "indum (imperative second plural) or vṛṇutaṁ indum")],
    "indum": [S("indu", "the moon, the soma-drop", M, 2, EKA, stem="u-stem")],
    "sthāvarañ": [S("sthāvara", "the standing, the immovable", N, 1, EKA,
                    stem="a-stem")],
    "jaṅgaman": [S("jaṅgama", "the moving, the animate", N, 1, EKA,
                   stem="a-stem")],
    "dyaur": [S("div", "heaven", F, 1, EKA, stem="v-stem",
                note="dyauḥ; the visarga becomes r before a vowel")],
    "ākāśan": [S("ākāśa", "space, the ether", N, 1, EKA, stem="a-stem")],

    # ---- mantras 17-18 ----------------------------------------------------
    "parāt": [S("para", "than the high, than what is beyond", N, 5, EKA,
                stem="a-stem")],
    "paratarañ": [S("paratara", "higher, further", N, 1, EKA,
                    stem="a-stem (comparative)")],
    "parataram": [S("paratara", "higher, further", N, 1, EKA,
                    stem="a-stem (comparative)")],
    "caiva": [_CA(), A("eva", "just, indeed")],
    "parāc": [S("para", "than what is beyond", N, 5, EKA, stem="a-stem",
                note="parāt; t becomes c before c-")],
    "param": [S("para", "the highest, what is beyond", N, 1, EKA,
                stem="a-stem")],
    "parato": [A("paratas", "further, beyond")],
    "brahma": [S("brahman", "Brahman, the absolute", N, 1, EKA,
                 stem="n-stem")],
    "hariḥ": [S("hari", "Hari, Viṣṇu", M, 1, EKA, stem="i-stem")],
    "'dhīśan": [S("adhīśa", "the supreme lord", M, 2, EKA, stem="a-stem",
                  note="adhīśam; the initial a is elided after -o and written "
                       "with the avagraha")],

    # ---- mantra 19 --------------------------------------------------------
    "yā": [S("yad", "she who", F, 1, EKA, stem=PRON)],
    "vedādiṣu": [S("vedādi", "at the beginnings of the Vedas", M, 7, BAHU,
                   stem="i-stem")],
    "gāyatrī": [S("gāyatrī", "the Gāyatrī", F, 1, EKA, stem="ī-stem")],
    "sarvavyāpī": [S("sarvavyāpin", "all-pervading", M, 1, EKA,
                     stem="in-stem",
                     note="the masculine form stands with the feminine "
                          "gāyatrī; the concord is loose")],
    "maheśvarī": [S("maheśvarī", "the great sovereign", F, 1, EKA,
                    stem="ī-stem")],
    "ṛgyajus": [S("ṛgyajus", "the Ṛk and the Yajus", N, 1, EKA, stem="s-stem",
                  note="a dvandva; the visarga becomes s before s-")],
    "sāmātharvaiś": [S("sāmātharva", "with the Sāman and the Atharvan", M, 3,
                       BAHU, stem="a-stem",
                       note="sāma + atharvaiḥ; the ending -aiḥ is the a-stem "
                            "instrumental plural, from the secondary stem "
                            "atharva (the -an stem would give atharvabhiḥ). "
                            "The visarga becomes ś before c-")],

    # ---- mantra 20 --------------------------------------------------------
    "yo": [_YA_NOM()],
    "vai": [A("vai", "indeed, verily")],
    "devaṁ": [S("deva", "the god", M, 2, EKA, stem="a-stem")],
    "mahādevam": [S("mahādeva", "the Great God", M, 2, EKA, stem="a-stem")],
    "prayataḥ": [S("prayata", "self-restrained, prepared", M, 1, EKA,
                   stem="a-stem",
                   note="past passive participle of pra-√yam")],
        "śuciḥ": [S("śuci", "pure, bright", M, 1, EKA, stem="i-stem")],
    "yas": [S("yad", "who", M, 1, EKA, stem=PRON,
              note="yaḥ; the visarga becomes s before s-")],
    "sarve": [S("sarva", "all", M, 1, BAHU, stem=PRON)],
    
    "sarvan": [S("sarva", "all, everything", N, 1, EKA, stem=PRON,
                 note="sarvam; m takes the homorganic n before t-")],
    "praṇataś": [S("praṇata", "bowed down, humbled in reverence", M, 1, EKA,
                   stem="a-stem",
                   note="past passive participle of pra-√nam; the visarga "
                        "becomes ś before ś-")],
    "sarvavedaiś": [S("sarvaveda", "with all the Vedas", M, 3, BAHU,
                      stem="a-stem",
                      note="sarvavedaiḥ; the visarga becomes ś before c-")],
    "modanti": [T("mud", "they rejoice", "1 (bhvādi)", "laṭ", 3, BAHU,
                  note="parasmaipada; the classical form is the ātmanepada "
                       "modante, which three of the printed editions read")],

    # ---- mantra 21 --------------------------------------------------------
    "praṇavoṅkāram": [S("praṇava", "the praṇava", M, 2, EKA, stem="a-stem"),
                      S("oṅkāra", "the syllable Oṁ", M, 2, EKA,
                        stem="a-stem")],
    "praṇavam": [S("praṇava", "the praṇava", M, 2, EKA, stem="a-stem")],
    "puruṣottamam": [S("puruṣottama", "the highest Puruṣa", M, 2, EKA,
                       stem="a-stem")],
    "oṅkāram": [S("oṅkāra", "the syllable Oṁ", M, 2, EKA, stem="a-stem")],
    "praṇavātmānan": [S("praṇavātman", "whose very self is the praṇava", M, 2,
                        EKA, stem="n-stem (bahuvrīhi)")],

    # ---- mantra 22 --------------------------------------------------------
    "'sau": [S("adas", "that one yonder", M, 1, EKA, stem=PRON,
               note="asau; the initial a is elided after -o")],
    "sarveṣu": [S("sarva", "in all", M, 7, BAHU, stem=PRON)],
    "vedeṣu": [S("veda", "in the Vedas", M, 7, BAHU, stem="a-stem")],
    "paṭhyate": [T("paṭh", "is recited", "1 (bhvādi)", "laṭ", 3, EKA,
                   note="passive")],
    "hyayam": [A("hi", "for, indeed"),
               S("idam", "this", M, 1, EKA, stem=PRON)],
    "īśvaraḥ": [S("īśvara", "the Lord", M, 1, EKA, stem="a-stem")],
    "akāyo": [S("akāya", "bodiless", M, 1, EKA, stem="a-stem",
                note="akāyaḥ; aḥ becomes o before a voiced sound")],
    "nirguṇo": [S("nirguṇa", "without qualities", M, 1, EKA, stem="a-stem",
                  note="nirguṇaḥ; aḥ becomes o before a voiced sound")],
    "hyātmā": [A("hi", "for, indeed"),
               S("ātman", "the Self", M, 1, EKA, stem="n-stem")],

    # ---- mantra 23 --------------------------------------------------------
    "gobhir": [S("go", "with cattle", M, 3, BAHU, stem="o-stem",
                 note="gobhiḥ; the visarga becomes r before j-")],
    "juṣṭan": [S("juṣṭa", "attended, favoured, enjoyed", M, 2, EKA,
                 stem="a-stem",
                 note="past passive participle of √juṣ, agreeing with "
                      "puṣkarākṣam at the end of the mantra")],
    "dhanena": [S("dhana", "with wealth", N, 3, EKA, stem="a-stem")],
    "hyāyuṣā": [A("hi", "for, indeed"),
                S("āyus", "with long life", N, 3, EKA, stem="s-stem")],
    "balena": [S("bala", "with strength", N, 3, EKA, stem="a-stem")],
    "prajayā": [S("prajā", "with offspring", F, 3, EKA, stem="ā-stem")],
    "paśubhiḥ": [S("paśu", "with livestock", M, 3, BAHU, stem="u-stem")],
    "puṣkarākṣan": [S("puṣkarākṣa", "lotus-eyed", M, 2, EKA,
                      stem="a-stem (bahuvrīhi)")],

    # ---- mantra 24 (the tryambaka mantra) ---------------------------------
    "tryambakaṁ": [S("tryambaka", "the three-eyed one — Rudra", M, 2, EKA,
                     stem="a-stem")],
    "yajāmahe": [T("yaj", "we worship, we sacrifice to", "1 (bhvādi)", "laṭ",
                   1, BAHU, note="ātmanepada")],
    "sugandhim": [S("sugandhi", "the fragrant one", M, 2, EKA, stem="i-stem")],
    "puṣṭivardhanam": [S("puṣṭivardhana", "the increaser of nourishment", M,
                         2, EKA, stem="a-stem")],
    "urvārukam": [S("urvāruka", "a cucumber, a gourd", N, 1, EKA,
                    stem="a-stem")],
    "bandhanān": [S("bandhana", "from the stalk, from the binding", N, 5, EKA,
                    stem="a-stem", note="bandhanāt; t becomes n before m-")],
    "mṛtyor": [S("mṛtyu", "from death", M, 5, EKA, stem="u-stem",
                 note="mṛtyoḥ; the visarga becomes r before m-")],
    "mukṣīya": [T("muc", "may I be freed", "6 (tudādi)", "āśīrliṅ", 1, EKA,
                  note="benedictive ātmanepada")],
    "mā": [A("mā", "let not",
             note="the prohibitive particle, with the injunctive")],
    "'mṛtāt": [S("amṛta", "from the deathless, from immortality", N, 5, EKA,
                 stem="a-stem",
                 note="amṛtāt; the initial a is elided after -ā")],

    # ---- mantras 25-26 ----------------------------------------------------
    "kailāsaśikhare": [S("kailāsaśikhara", "on the peak of Kailāsa", M, 7,
                         EKA, stem="a-stem")],
    "ramye": [S("ramya", "lovely, delightful", M, 7, EKA, stem="a-stem")],
    "śaṅkarasya": [S("śaṅkara", "of Śaṅkara — the maker of peace, Śiva", M, 6,
                     EKA, stem="a-stem")],
    "śivālaye": [S("śivālaya", "in the abode of Śiva", M, 7, EKA,
                   stem="a-stem")],
    "devatās": [S("devatā", "the deities", F, 1, BAHU, stem="ā-stem",
                  note="devatāḥ; the visarga becomes s before t-")],
    "tatra": [A("tatra", "there")],
        "kailāsaśikharāvāsā": [S("kailāsaśikharāvāsa",
                             "whose dwelling is the peak of Kailāsa", M, 1,
                             EKA, stem="a-stem (bahuvrīhi)",
                             note="the base edition's -āvāsā for -āvāsaḥ")],
    "himavad": [O("himavat", "the snow mountain, the Himālaya",
                  note="the first member of himavad-giri-saṁsthitam, "
                       "'established on the snow mountain', written across a "
                       "word break; t becomes d before a voiced sound")],
    "girisamsthitam": [S("girisaṁsthita", "established on the mountain", M, 2,
                         EKA, stem="a-stem")],
    "nīlakaṇṭhan": [S("nīlakaṇṭha", "the blue-throated one", M, 2, EKA,
                      stem="a-stem (bahuvrīhi)")],
    "triṇetrañ": [S("triṇetra", "the three-eyed one", M, 2, EKA,
                    stem="a-stem (bahuvrīhi)")],

    # ---- mantra 27 --------------------------------------------------------
    "viśvataś": [A("viśvatas", "on every side, from all sides",
                   note="the visarga becomes ś before c-")],
    "viśvataḥ": [A("viśvatas", "on every side, from all sides")],
    "viśvato": [A("viśvatas", "on every side, from all sides",
                  note="aḥ becomes o before a voiced sound")],
    "cakṣur": [S("cakṣus", "eye — eyed on every side", N, 1, EKA,
                 stem="s-stem",
                 note="with viśvataḥ a bahuvrīhi, viśvataś-cakṣus, like the "
                      "three that follow it; the visarga becomes r before "
                      "a vowel")],
    "mukho": [S("mukha", "faced — having faces", M, 1, EKA,
                stem="a-stem (bahuvrīhi)",
                note="mukhaḥ; aḥ becomes o before a voiced sound")],
    "hasta": [S("hasta", "handed — having hands", M, 1, EKA,
                stem="a-stem (bahuvrīhi)",
                note="hastaḥ; aḥ becomes a before a vowel")],
    "pāt": [S("pad", "footed — having feet", M, 1, EKA, stem="d-stem")],
    "sam": [U("sam", "together, wholly")],
    "bāhubhyāṁ": [S("bāhu", "with the two arms", M, 3, DVI, stem="u-stem")],
    "namati": [T("nam", "bends, bows, joins", "1 (bhvādi)", "laṭ", 3, EKA,
                 note="the Ṛgvedic parallel 10.81.3 reads dhamati, 'blows'")],
    "patatrair": [S("patatra", "with wings", N, 3, BAHU, stem="a-stem",
                    note="patatraiḥ; the visarga becomes r before d-")],
    "dyāvāpṛthivī": [S("dyāvāpṛthivī", "heaven and earth", F, 2, DVI,
                       stem="ī-stem (dvandva)")],
    "janayan": [S("janayat", "bringing forth, generating", M, 1, EKA,
                  stem="present participle of the causative of √jan")],
    "deva": [S("deva", "god", M, 1, EKA, stem="a-stem",
               note="devaḥ; aḥ becomes a before a vowel")],
    "ekas": [S("eka", "one, alone", M, 1, EKA, stem="a-stem (numeral)",
               note="ekaḥ; the visarga becomes s before t-")],

    # ---- mantra 28 --------------------------------------------------------
    "caturo": [S("catur", "four", M, 2, BAHU, stem="r-stem (numeral)",
                 note="caturaḥ; aḥ becomes o before a voiced sound")],
    "vedān": [S("veda", "the Vedas", M, 2, BAHU, stem="a-stem")],
    "adhīyīta": [U("adhi", "over, upon"),
                 T("i", "one should study, one should recite", "2 (adādi)",
                   "liṅ", 3, EKA, note="ātmanepada adhi-√i, 'to study'")],
    "sarvaśāstramayaṁ": [S("sarvaśāstramaya", "consisting of all the śāstras",
                           M, 2, EKA, stem="a-stem")],
    "viduḥ": [T("vid", "they know", "2 (adādi)", "liṭ", 3, BAHU,
                note="the perfect veda with present sense")],
    "itihāsa": [O("itihāsa", "the itihāsas — the epic narratives",
                  note="a bare stem, standing first in a loose compound with "
                       "purāṇānām")],
    "purāṇānān": [S("purāṇa", "of the purāṇas", N, 6, BAHU, stem="a-stem")],

    # ---- mantra 29 --------------------------------------------------------
    "no": [S("asmad", "us, our", None, 2, BAHU, stem=PRON,
             note="the enclitic naḥ; aḥ becomes o before a voiced sound")],
    "nas": [S("asmad", "us, our", None, 2, BAHU, stem=PRON,
              note="the enclitic naḥ; the visarga becomes s before t-")],
    "arbhakaṁ": [S("arbhaka", "the small one, the child", M, 2, EKA,
                   stem="a-stem")],
    "ukṣantam": [S("ukṣat", "the one growing up", M, 2, EKA,
                   stem="present participle of √ukṣ")],
    "ukṣitam": [S("ukṣita", "the one grown", M, 2, EKA, stem="a-stem",
                  note="past passive participle of √ukṣ")],
    "vadhīḥ": [T("vadh", "may you slay", "1 (bhvādi)", "luṅ", 2, EKA,
                 note="the injunctive with mā — a prohibition")],
    "'vadhīr": [T("vadh", "may you strike down", "1 (bhvādi)", "luṅ", 2, EKA,
                  note="avadhīḥ, the injunctive with mā; the initial a is "
                       "elided after -o and written with the avagraha, and "
                       "the visarga becomes r before h-")],
    "pitaraṁ": [S("pitṛ", "father", M, 2, EKA, stem="ṛ-stem")],
    "mota": [A("mā", "let not"), A("uta", "and, also")],
    "mātaram": [S("mātṛ", "mother", F, 2, EKA, stem="ṛ-stem")],
    "priyā": [S("priya", "dear, beloved", F, 2, BAHU, stem="a-stem",
                note="priyāḥ, agreeing with tanuvaḥ; the visarga is lost "
                     "before m-")],
    "tanuvo": [S("tanū", "bodies, selves", F, 2, BAHU, stem="ū-stem",
                 note="tanuvaḥ; aḥ becomes o before a voiced sound")],
    "rudra": [S("rudra", "O Rudra", M, 8, EKA, stem="a-stem")],
    "rīriṣas": [T("riṣ", "may you injure", "4 (divādi)", "luṅ", 2, EKA,
                  note="the reduplicated aorist injunctive with mā; the "
                       "visarga becomes s before t-")],
    "rīriṣaḥ": [T("riṣ", "may you injure", "4 (divādi)", "luṅ", 2, EKA,
                  note="the reduplicated aorist injunctive with mā")],

    # ---- mantra 30 --------------------------------------------------------
    "toke": [S("toka", "in offspring, in children", N, 7, EKA,
               stem="a-stem")],
    "tanaye": [S("tanaya", "in descendants", N, 7, EKA, stem="a-stem",
                 note="neuter in the Ṛgvedic formula toke tanaye, pairing "
                      "with the neuter toka; the masculine is also attested")],
    "āyuṣi": [S("āyus", "in the span of life", N, 7, EKA, stem="s-stem")],
    "goṣu": [S("go", "among the cattle", M, 7, BAHU, stem="o-stem")],
    "aśveṣu": [S("aśva", "among the horses", M, 7, BAHU, stem="a-stem")],
    "vīrān": [S("vīra", "the heroes, the men", M, 2, BAHU, stem="a-stem")],
    "bhāmito": [S("bhāmita", "angered, enraged", M, 1, EKA, stem="a-stem",
                  note="bhāmitaḥ; aḥ becomes o before a voiced sound")],
    "haviṣmanto": [S("haviṣmat", "bearing oblations", M, 1, BAHU,
                     stem="mat-stem",
                     note="haviṣmantaḥ; aḥ becomes o before a voiced sound")],
    "namasā": [S("namas", "with reverence, with homage", N, 3, EKA,
                 stem="s-stem")],
    "vidhema": [T("vidh", "may we worship, may we serve", "6 (tudādi)",
                  "liṅ", 1, BAHU)],

    # ---- mantra 31 --------------------------------------------------------
    "ṛtam": [S("ṛta", "the right, the cosmic order", N, 1, EKA,
               stem="a-stem")],
    "satyam": [S("satya", "the true, truth", N, 1, EKA, stem="a-stem")],
    "puruṣaṅ": [S("puruṣa", "the Puruṣa, the Person", M, 2, EKA,
                  stem="a-stem",
                  note="puruṣam; m takes the homorganic ṅ before k-")],
    "kṛṣṇapiṅgalam": [S("kṛṣṇapiṅgala", "dark and tawny", M, 2, EKA,
                        stem="a-stem")],
    "ūrdhvaretaṁ": [S("ūrdhvareta", "of upward-drawn seed — the chaste one",
                      M, 2, EKA, stem="a-stem (bahuvrīhi)",
                      note="the accusative ūrdhvaretam requires the a-stem "
                           "by-form; the -as stem would give ūrdhvaretasam. "
                           "Monier-Williams carries both")],
    "virūpākṣaṁ": [S("virūpākṣa", "of strange or unequal eyes", M,
                     2, EKA, stem="a-stem (bahuvrīhi)")],
    "viśvarūpāya": [S("viśvarūpa", "to him whose form is the universe", M, 4,
                      EKA, stem="a-stem (bahuvrīhi)")],
    "namo": [S("namas", "homage, reverence", N, 1, EKA, stem="s-stem",
               note="namaḥ; aḥ becomes o before a voiced sound")],
    "namas": [S("namas", "homage, reverence", N, 1, EKA, stem="s-stem",
                note="namaḥ; the visarga becomes s before t-")],
    "namaḥ": [S("namas", "homage, reverence", N, 1, EKA, stem="s-stem")],

    # ---- mantra 32 --------------------------------------------------------
    "kad": [S("kim", "what?", N, 2, EKA, stem=PRON,
              note="the Vedic neuter kat; t becomes d before r-")],
    "rudrāya": [S("rudra", "to Rudra", M, 4, EKA, stem="a-stem")],
    "pracetase": [S("pracetas", "to the wise, to the attentive one", M, 4,
                    EKA, stem="s-stem")],
    "mīḍhuṣṭamāya": [S("mīḍhuṣṭama", "to the most bountiful", M, 4, EKA,
                       stem="a-stem (superlative of mīḍhvas)")],
    "tavyase": [S("tavyas", "to the mightier, to the stronger", M, 4, EKA,
                  stem="s-stem (comparative)")],
    "vocema": [T("vac", "may we say", "2 (adādi)", "liṅ", 1, BAHU,
                 note="the aorist optative")],
    "śantamam": [S("śantama", "most healing, most beneficent", N, 2, EKA,
                   stem="a-stem (superlative of śam)")],
    "hṛde": [S("hṛd", "for the heart", N, 4, EKA, stem="d-stem")],
    "sarvo": [S("sarva", "all, everything", M, 1, EKA, stem=PRON,
                note="sarvaḥ; aḥ becomes o before a voiced sound")],
    "hyeṣa": [A("hi", "for, indeed"),
              S("etad", "this one", M, 1, EKA, stem=PRON)],
    "rudras": [S("rudra", "Rudra", M, 1, EKA, stem="a-stem",
                 note="rudraḥ; the visarga becomes s before t-")],
    "tasmai": [S("tad", "to that one", M, 4, EKA, stem=PRON)],

    # ---- mantra 33 --------------------------------------------------------
    "jajñānam": [S("jajñāna", "being born, having come into being", N, 1, EKA,
                   stem="perfect middle participle of √jan")],
    "prathamam": [S("prathama", "first, foremost", N, 1, EKA,
                    stem="a-stem (ordinal)")],
    "purastād": [A("purastāt", "in front, in the east",
                   note="purastāt; t becomes d before a voiced sound")],
    "vi": [U("vi", "apart, out, forth",
             note="in tmesis with āvaḥ at the end of the pāda — vi … āvaḥ, "
                  "'he disclosed'")],
    "sīmatas": [A("sīmatas", "from the boundary, from the limit",
                  note="the visarga becomes s before s-")],
    "suruco": [S("suruc", "from the shining one, from the bright", F, 5, EKA,
                 stem="c-stem",
                 note="surucaḥ; aḥ becomes o before a voiced sound")],
    "vena": [S("vena", "the seer, the longing one", M, 1, EKA,
               stem="a-stem")],
    "āvaḥ": [U("ā", "towards, open"),
             T("vṛ", "he uncovered, he disclosed", "5 (svādi)", "laṅ", 3, EKA,
               note="the imperfect; the Ṛgvedic āvar")],
    "sa": [S("tad", "he, that one", M, 1, EKA, stem=PRON)],
    "budhniyā": [S("budhniya", "of the depth, belonging to the ground", F, 1,
                   BAHU, stem="a-stem")],
    "upamā": [S("upama", "the highest, the topmost", F, 1, BAHU,
                stem="a-stem",
                note="upamāḥ, the feminine nominative plural of the adjective "
                     "upama; not the noun upamā, 'simile'")],
    "asya": [S("idam", "of this, its", M, 6, EKA, stem=PRON)],
    "viṣṭhās": [S("viṣṭhā", "the stations, the standing-places", F, 1, BAHU,
                  stem="ā-stem",
                  note="viṣṭhāḥ; the visarga becomes s before s-")],
    "sataś": [S("sat", "of what is, of the existent", N, 6, EKA,
                stem="t-stem",
                note="sataḥ; the visarga becomes ś before c-")],
    "asataś": [S("asat", "of what is not, of the non-existent", N, 6, EKA,
                 stem="t-stem",
                 note="asataḥ; the visarga becomes ś before c-")],
    "vivas": [U("vi", "apart, open"),
              T("vṛ", "he disclosed, he laid open", "5 (svādi)", "laṅ", 3,
                EKA, note="vivaḥ; the visarga becomes s before t-")],

    # ---- mantra 34 --------------------------------------------------------
    "yaḥ": [_YA_NOM()],
    "prāṇato": [S("prāṇat", "of what breathes", N, 6, EKA,
                  stem="present participle of pra-√an",
                  note="prāṇataḥ; aḥ becomes o before a voiced sound")],
    "nimiṣato": [S("nimiṣat", "of what blinks", N, 6, EKA,
                   stem="present participle of ni-√miṣ",
                   note="nimiṣataḥ; aḥ becomes o before a voiced sound")],
    "mahitvaika": [S("mahitva", "by greatness, by might", N, 3, EKA,
                     stem="a-stem"),
                   S("eka", "one, alone", M, 1, EKA,
                     stem="a-stem (numeral)")],
    "id": [A("id", "just, indeed (an emphasising particle)",
             note="Vedic it; t becomes d before r-")],
    "rājā": [S("rājan", "king", M, 1, EKA, stem="n-stem")],
    "ya": [S("yad", "who", M, 1, EKA, stem=PRON,
             note="yaḥ; aḥ becomes a before a vowel")],
    "īśe": [T("īś", "rules over, is master of", "2 (adādi)", "laṭ", 3, EKA,
              note="ātmanepada; governs the genitive")],
    "dvipadaś": [S("dvipad", "of the two-footed", N, 6, EKA, stem="d-stem",
                   note="dvipadaḥ; the visarga becomes ś before c-")],
    "catuṣpadaḥ": [S("catuṣpad", "of the four-footed", N, 6, EKA,
                     stem="d-stem")],
    "kasmai": [S("kim", "to which god? — or: to Ka, the Unknown", M, 4, EKA,
                 stem=PRON,
                 note="the refrain of the Hiraṇyagarbha sūkta; the tradition "
                      "also reads Ka as a name of Prajāpati")],
    "devāya": [S("deva", "to the god", M, 4, EKA, stem="a-stem")],
    "haviṣā": [S("havis", "with the oblation", N, 3, EKA, stem="s-stem")],

    # ---- mantra 35 --------------------------------------------------------
    "ātmadā": [S("ātmada", "giver of self, giver of life", M, 1, EKA,
                 stem="a-stem")],
    "baladā": [S("balada", "giver of strength", M, 1, EKA, stem="a-stem")],
    "viśva": [S("viśva", "all, everyone", M, 1, BAHU, stem=PRON,
                note="viśve; a Vedic final -e becomes -a before a vowel, and "
                     "the two vowels stay apart in hiatus")],
    "upāsate": [U("upa", "near, towards"),
                T("ās", "they revere, they wait upon", "2 (adādi)", "laṭ", 3,
                  BAHU, note="ātmanepada")],
    "praśiṣaṁ": [S("praśiṣ", "the command, the direction", F, 2, EKA,
                   stem="ṣ-stem")],
    "devāḥ": [S("deva", "the gods", M, 1, BAHU, stem="a-stem")],
    "chāyā": [S("chāyā", "shadow, reflection", F, 1, EKA, stem="ā-stem")],
    "'mṛtaṁ": [S("amṛta", "the deathless, immortality", N, 1, EKA,
                 stem="a-stem",
                 note="amṛtam; the initial a is elided after -ā")],
    "mṛtyuḥ": [S("mṛtyu", "death", M, 1, EKA, stem="u-stem")],

    # ---- mantra 36 (from the Śrī Sūktam) ----------------------------------
    "gandhadvārān": [S("gandhadvārā", "her whose doorway is fragrance", F, 2,
                       EKA, stem="ā-stem (bahuvrīhi)")],
    "durādharṣāṁ": [S("durādharṣā", "unassailable, hard to overcome", F, 2,
                      EKA, stem="ā-stem")],
    "nityapuṣṭāṅ": [S("nityapuṣṭā", "ever-nourished, ever-thriving", F, 2,
                      EKA, stem="ā-stem",
                      note="nityapuṣṭām; m takes the homorganic ṅ before k-")],
    "karīṣiṇīm": [S("karīṣiṇī", "abounding in dung-wealth — in the riches of "
                    "the herd", F, 2, EKA, stem="ī-stem")],
    "īśvarīm": [S("īśvarī", "sovereign, mistress", F, 2, EKA, stem="ī-stem",
                  note="the Taittirīya recites the anusvāra before s- as "
                       "the gum")],
    "sarvabhūtānān": [S("sarvabhūta", "of all beings", N, 6, BAHU,
                        stem="a-stem")],
    "ihopahvaye": [A("iha", "here"),
                   U("upa", "near, towards"),
                   T("hve", "I call, I invoke", "1 (bhvādi)", "laṭ", 1, EKA,
                     note="ātmanepada upa-√hve")],
    "śriyan": [S("śrī", "Śrī, prosperity", F, 2, EKA, stem="ī-stem")],

    # ---- mantra 37 --------------------------------------------------------
    "rudro": [S("rudra", "Rudra", M, 1, EKA, stem="a-stem",
                note="rudraḥ; aḥ becomes o before a voiced sound")],
    "agnau": [S("agni", "in the fire", M, 7, EKA, stem="i-stem")],
    "apsu": [S("ap", "in the waters", F, 7, BAHU, stem="p-stem")],
    "oṣadhīṣu": [S("oṣadhī", "in the plants, in the herbs", F, 7, BAHU,
                   stem="ī-stem")],
    "viśvā": [S("viśva", "all", N, 2, BAHU, stem=PRON)],
    "bhuvanā": [S("bhuvana", "the worlds", N, 2, BAHU, stem="a-stem",
                  note="bhuvanāni; the Vedic shortened plural")],
    "viveśa": [T("viś", "has entered", "6 (tudādi)", "liṭ", 3, EKA,
                 note="perfect; the other editions read āviveśa, with the "
                      "double avagraha")],

    # ---- mantras 38-39 ----------------------------------------------------
    "namakañ": [S("namaka", "the Namaka — the Śatarudrīya's 'namaḥ' litany",
                  N, 2, EKA, stem="a-stem",
                  note="namakam; m becomes ñ before c-")],
    "camakañ": [S("camaka", "the Camaka — the 'ca me' litany", N, 2, EKA,
                  stem="a-stem", note="camakam; m becomes ñ before c-")],
    "puruṣasūktañ": [S("puruṣasūkta", "the Puruṣa Sūkta", N, 2, EKA,
                       stem="a-stem", note="m becomes ñ before c-")],
    "mahādevañ": [S("mahādeva", "the Great God", M, 2, EKA, stem="a-stem",
                    note="mahādevam; m becomes ñ before c-")],
    "tattulyan": [S("tattulya", "equal to that, of the same measure", M, 2,
                    EKA, stem="a-stem")],
    "idam": [_IDAM_N()],
    "sadā": [A("sadā", "always, ever")],
    "dhyāyanti": [T("dhyai", "they meditate on", "1 (bhvādi)", "laṭ", 3,
                    BAHU)],
    "brāhmaṇāḥ": [S("brāhmaṇa", "the brāhmaṇas", M, 1, BAHU, stem="a-stem")],
    "paraṁ": [S("para", "highest, supreme", M, 2, EKA, stem="a-stem")],
    "mokṣaṅ": [S("mokṣa", "release, liberation", M, 2, EKA, stem="a-stem",
                 note="mokṣam; m takes the homorganic ṅ before g-")],
    "gamiṣyanti": [T("gam", "they will go", "1 (bhvādi)", "lṛṭ", 3, BAHU,
                     note="future")],

    # ---- the closing nyāsa ------------------------------------------------
    "oṁ": [A("oṁ", "the praṇava, the syllable of the absolute")],
    "bhagavate": [S("bhagavat", "to the Blessed One", M, 4, EKA,
                    stem="vat-stem")],
    "hṛdayāya": [S("hṛdaya", "to the heart", N, 4, EKA, stem="a-stem",
                   note="the limb on which this section of the Mahānyāsa is "
                        "placed")],
}


# Homographs — a surface that is a DIFFERENT WORD in a different mantra.
# `gen_shivasankalpa.build()` consults this before `WORDS`.
#
# THE KEY CARRIES THE SURFACE IT EXPECTS, and the generator asserts it. The
# first version of this table keyed on `(verse id, word index)` alone, and
# every one of its four indices was off by one or more: the `na` overrides
# landed on `ukṣantam`, `mā` and `āyuṣi`, and the `te` override landed on the
# refrain's `śivasaṅkalpam`, so mantra 30 told a reader that
# *śivasaṅkalpam* means "to you". Nothing caught it, because a wrong index is
# still a valid index. The expected surface is what makes it catchable.
OVERRIDES = {
    # `mā na ukṣantam uta mā na ukṣitam` — the enclitic naḥ of asmad ("our"),
    # not the negative particle the same surface carries in mantra 4.
    ("v-29", 8, "na"): [_NAS()],
    ("v-29", 12, "na"): [_NAS()],
    # `mā na āyuṣi` — the same enclitic.
    ("v-30", 5, "na"): [_NAS()],
    # `mā no mahāntam uta mā no arbhakam` — the pair is elder/child, not
    # "great"; the mantra's own translation says "our elder".
    ("v-29", 2, "mahāntam"): [
        S("mahat", "the grown one, the elder", M, 2, EKA, stem="t-stem",
          note="paired with arbhakam, the little one")],
    # `namasā vidhema te` — "we worship YOU": the dative of yuṣmad, where the
    # shared `te` is the nominative plural of tad it carries in mantras 14
    # and 39.
    ("v-30", 23, "te"): [
        S("yuṣmad", "to you", None, 4, EKA, stem=PRON,
          note="the enclitic te")],
    # `te agni citteṣṭakās tāṁ śarīram` — here the feminine tām agrees with
    # nothing, and the pāda is damaged. Everywhere else (mantra 37) it agrees
    # with śriyam and is perfectly ordinary.
    ("v-14", 11, "tām"): [
        S("tad", "that", F, 2, EKA, stem=PRON,
          note="the feminine does not agree with the neuter śarīram; the pāda "
               "is damaged in every witness")],
    # `mukṣīya mā 'mṛtāt` — the plain negative with an ablative, not the
    # prohibitive particle of mantras 29 and 30.
    ("v-24", 9, "mā"): [
        A("mā", "not",
          note="the plain negative before the ablative amṛtāt — 'from death, "
               "but not from the deathless'")],
    # `ya idaṁ śivasaṅkalpaṁ sadā dhyāyanti` and the closing nyāsa name THE
    # HYMN, in the accusative — not the bahuvrīhi "of auspicious resolve" that
    # the refrain repeats thirty-nine times.
    ("v-39", 1, "idam"): [
        S("idam", "this", N, 2, EKA, stem=PRON,
          note="the object of dhyāyanti, with śivasaṅkalpam")],
    ("v-39", 2, "śivasaṅkalpam"): [
        S("śivasaṅkalpa", "the Śiva Saṅkalpa — this hymn", M, 2, EKA,
          stem="a-stem", note="the object of dhyāyanti")],
    ("v-closing", 4, "śivasaṅkalpam"): [
        S("śivasaṅkalpa", "the Śiva Saṅkalpa — this hymn", M, 2, EKA,
          stem="a-stem", note="the text on which the nyāsa is placed")],
    # `puruṣasūktaṁ ca yad viduḥ` — the object of viduḥ. Neuter syncretism
    # hides the case in the form, so it has to be declared.
    ("v-38", 5, "yad"): [
        S("yad", "that which", N, 2, EKA, stem=PRON,
          note="the object of viduḥ")],
}
