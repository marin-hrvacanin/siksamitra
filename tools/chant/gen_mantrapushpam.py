# -*- coding: utf-8 -*-
"""Mantra Puṣpam -> client/public/chants/mantra-pushpam.json (format v2).

NEVER hand-edit the JSON. Edit this file and re-run; output is byte-deterministic.

    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/gen_mantrapushpam.py

THE TEXT, AND ITS EXACT LOCUS
-----------------------------
Mantra Puṣpam is **Taittirīya Āraṇyaka 1.22**, i.e. the twenty-second anuvāka of
the first prapāṭhaka, which in the Aruṇapraśna numbering is sections **77-84**.
Kṛṣṇa Yajurveda, Taittirīya śākhā — the same recension as Puruṣa Sūktam and
Viṣṇu Sūktam, and the recension layer of MARKING-RULES §4 applies (the gum).

WITNESSES — two accented, independent, and in agreement
  1. **sanskritdocuments.org** `doc_veda/mantrapushpa.itx` / `.html` — accented
     Devanāgarī. Its own header states the locus: *taittirīyāraṇyakam
     aruṇapraśnaḥ 77-84, taittirīyāraṇyake prathamaprapāṭhakaḥ dvāviṁśo
     'nuvākaḥ*. This is where the citation on the page comes from.
  2. **vignanam.org** (Vaidika Vignanam) — the sūkta as recited, accented.

They agree letter for letter across all eight khaṇḍas and the Kubera portion.
The Devanāgarī of witness 1 was converted mechanically (`deva2vu.py`, the
MARKING-RULES §1 table: U+0951 -> U+030D, U+0952 -> U+0331, U+1CDA -> U+030E),
so the ACCENTS are data and were never retyped by eye.

SVARA IS ATTESTED, NEVER DERIVED (MARKING-RULES §3.1). This is Vedic saṁhitā /
āraṇyaka material: the positional convention may never be applied to it.

WHAT IS *NOT* IN THIS DOCUMENT, AND WHY
---------------------------------------
The longer South-Indian recitation appends a further set of passages after the
Kubera lines — `oṁ tad brahma … tat puror namaḥ` and `antaścarati bhūteṣu`
(both **Mahānārāyaṇa Upaniṣad anuvāka 68 = TA 10.68**), `īśānas sarvavidyānām`
(**MNU anuvāka 21 = TA 10.21**), the two Viṣṇu ṛcs (**TS 1.3.6.2**, already in
`vishnu-suktam.json`), `ṛtaṁ satyaṁ paraṁ brahma`, and the Nārāyaṇa Gāyatrī.

The last two could NOT be located in the accented Mahānārāyaṇa recension
checked (sanskritdocuments `mahAnArAyaNopaniShatsasvarA`), so their loci are
unverified. Rather than ship a guessed citation into a liturgical text, the
appendix is left out and the core TA 1.22 text stands complete. Adding it is a
content decision for the owner, not a silent one.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tokens import derive, line_tokens                            # noqa: E402
from gen_puja import apply_attested, strip_accents, surfaces_of   # noqa: E402
from gen_vishnu import apply_vedic_anusvara, rebuild_iast         # noqa: E402
from mantrapushpam_words import WORDS                             # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "..", "client", "public", "chants", "mantra-pushpam.json")
SLUG = "mantra-pushpam"

TA = "Taittirīya Āraṇyaka 1.22 · Aruṇapraśna 77–84"

SHANTI = [
    "oṁ bha̱draṁ karṇe̍bhiḥ śṛṇu̱yāma̍ devāḥ | bha̱draṁ pa̍śyemā̱kṣabhi̱ryaja̍trāḥ |",
    "sthi̱rairaṅgai̎stuṣṭu̱vāṁsa̍sta̱nūbhiḥ̍ | vyaśe̍ma de̱vahi̍taṁ̱ yadāyuḥ̍ |",
    "sva̱sti na̱ indro̍ vṛ̱ddhaśra̍vāḥ | sva̱sti naḥ̍ pū̱ṣā vi̱śvave̍dāḥ |",
    "sva̱sti na̱stārkṣyo̱ ari̍ṣṭanemiḥ | sva̱sti no̱ bṛha̱spati̍rdadhātu |",
]
KHANDAS = [
    ["yo̍'pāṁ puṣpaṁ̱ veda̍ | puṣpa̍vān pra̱jāvā̎n paśu̱mān bha̍vati |", "ca̱ndramā̱ vā a̱pāṁ puṣpam̎ | puṣpa̍vān pra̱jāvā̎n paśu̱mān bha̍vati |", "ya e̱vaṁ veda̍ | yo̍'pāmā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |"],
    ["a̱gnirvā a̱pāmā̱yata̍nam | ā̱yata̍navān bhavati |", "yo̎'gnerā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |", "āpo̱ vā a̱gnerā̱yata̍nam | ā̱yata̍navān bhavati |", "ya e̱vaṁ veda̍ | yo̍'pāmā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |"],
    ["vā̱yurvā a̱pāmā̱yata̍nam | ā̱yata̍navān bhavati |", "yo vā̱yorā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |", "āpo̱ vai vā̱yorā̱yata̍nam | ā̱yata̍navān bhavati |", "ya e̱vaṁ veda̍ | yo̍'pāmā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |"],
    ["a̱sau vai tapa̍nna̱pāmā̱yata̍nam | ā̱yata̍navān bhavati |", "yo̍'muṣya̱ tapa̍ta ā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |", "āpo̱ vā a̱muṣya̱ tapa̍ta ā̱yata̍nam | ā̱yata̍navān bhavati |", "ya e̱vaṁ veda̍ | yo̍'pāmā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |"],
    ["ca̱ndramā̱ vā a̱pāmā̱yata̍nam | ā̱yata̍navān bhavati |", "yaśca̱ndrama̍sa ā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |", "āpo̱ vai ca̱ndrama̍sa ā̱yata̍nam | ā̱yata̍navān bhavati |", "ya e̱vaṁ veda̍ | yo̍'pāmā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |"],
    ["nakṣa̍trāṇi̱ vā a̱pāmā̱yata̍nam | ā̱yata̍navān bhavati |", "yo nakṣa̍trāṇāmā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |", "āpo̱ vai nakṣa̍trāṇāmā̱yata̍nam | ā̱yata̍navān bhavati |", "ya e̱vaṁ veda̍ | yo̍'pāmā̱yata̍naṁ̱ veda ̍ | ā̱yata̍navān bhavati |"],
    ["pa̱rjanyo̱ vā a̱pāmā̱yata̍nam | ā̱yata̍navān bhavati |", "yaḥ pa̱rjanya̍syā̱''yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |", "āpo̱ vai pa̱rjanya̍syā̱''yata̍nam | ā̱yata̍navān bhavati |", "ya e̱vaṁ veda̍ | yo̍'pāmā̱yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |"],
    ["saṁ̱va̱tsa̱ro vā a̱pāmā̱yata̍nam | ā̱yata̍navān bhavati |", "yassaṁ̍vatsa̱rasyā̱''yata̍naṁ̱ veda̍ | ā̱yata̍navān bhavati |", "āpo̱ vai saṁ̍vatsa̱rasyā̱''yata̍nam | ā̱yata̍navān bhavati |", "ya e̱vaṁ veda̍ | yo̎'psu nāvaṁ̱ prati̍ṣṭhitāṁ̱ veda̍ | pratye̱va ti̍ṣṭhati |"],
]
KHANDA_SUBJECT = [
    "candramas — the moon is the flower of the waters",
    "agni — fire is the seat of the waters",
    "vāyu — wind is the seat of the waters",
    "asau tapan — yonder burning sun",
    "candramas — the moon",
    "nakṣatrāṇi — the lunar mansions",
    "parjanya — the rain-cloud",
    "saṁvatsara — the year, and the boat set firm in the waters",
]
KHANDA_TR = [
    "He who knows the flower of the waters becomes possessed of flowers, of offspring and of cattle. The moon is the flower of the waters. He who knows this becomes possessed of flowers, of offspring and of cattle. He who knows the seat of the waters becomes established in a seat.",
    "Fire is the seat of the waters. He who knows the seat of fire becomes established in a seat. The waters are the seat of fire. He who knows this becomes established in a seat; and he who knows the seat of the waters becomes established in a seat.",
    "Wind is the seat of the waters. He who knows the seat of the wind becomes established in a seat. The waters are the seat of the wind. He who knows this becomes established in a seat; and he who knows the seat of the waters becomes established in a seat.",
    "Yonder burning sun is the seat of the waters. He who knows the seat of yonder burning one becomes established in a seat. The waters are the seat of yonder burning one. He who knows this becomes established in a seat; and he who knows the seat of the waters becomes established in a seat.",
    "The moon is the seat of the waters. He who knows the seat of the moon becomes established in a seat. The waters are the seat of the moon. He who knows this becomes established in a seat; and he who knows the seat of the waters becomes established in a seat.",
    "The lunar mansions are the seat of the waters. He who knows the seat of the mansions becomes established in a seat. The waters are the seat of the mansions. He who knows this becomes established in a seat; and he who knows the seat of the waters becomes established in a seat.",
    "The rain-cloud is the seat of the waters. He who knows the seat of the rain-cloud becomes established in a seat. The waters are the seat of the rain-cloud. He who knows this becomes established in a seat; and he who knows the seat of the waters becomes established in a seat.",
    "The year is the seat of the waters. He who knows the seat of the year becomes established in a seat. The waters are the seat of the year. He who knows this becomes established in a seat. He who knows the boat set firm in the waters stands firm indeed.",
]
KUBERA = [
    "rā̱jā̱dhi̱rā̱jāya̍ prasahyasā̱hine̎ |",
    "namo̍ va̱yaṁ vai̎śrava̱ṇāya̍ kurmahe |",
    "sa me̱ kāmā̱nkāma̱kāmā̍ya̱ mahyam̎ |",
    "kā̱me̱śva̱ro vai̎śrava̱ṇo da̍dātu |",
    "ku̱be̱rāya̍ vaiśrava̱ṇāya̍ | ma̱hā̱rā̱jāya̱ namaḥ̍ |",
]
CLOSE = [
    "oṁ śāntiḥ̱ śāntiḥ̱ śāntiḥ̍ |",
]

APPENDIX = [
    ("v-tad-brahma", ["o̎ṁ tadbra̱hma | o̎ṁ tadvā̱yuḥ | o̎ṁ tadā̱tmā | o̎ṁ tatsa̱tyam |", "o̎ṁ tatsarva̎m | o̎ṁ tatpuro̱rnamaḥ |"],
     "Mahānārāyaṇa Upaniṣad, anuvāka 68 · Taittirīya Āraṇyaka 10.68",
     "Oṁ, that is brahman. Oṁ, that is the wind. Oṁ, that is the Self. Oṁ, that is the truth. Oṁ, that is all. Oṁ, salutation to that fullness."),
    ("v-antascarati", ["o̎ṁ antaścarati̍ bhūte̱ṣu gu̱hāyāṁ vi̍śvamū̱rtiṣu |", "tvaṁ yajñastvaṁ vaṣaṭkārastvamindrastvaṁ rudrastvaṁ viṣṇustvaṁ", "brahma tvaṁ̍ prajāpatiḥ | tvaṁ ta̍dāpa̱ āpo̱ jyotī̱ raso̱'mṛtaṁ̱", "brahma̱ bhūrbhuvaḥ̱ suva̱rom |"],
     "Mahānārāyaṇa Upaniṣad, anuvāka 68 · Taittirīya Āraṇyaka 10.68",
     "Oṁ. He moves within all beings, in the cave of the heart, in every form. You are the sacrifice, you are the vaṣaṭ-call, you are Indra, you are Rudra, you are Viṣṇu, you are brahman, you are Prajāpati. You are that — the waters, the waters, light, essence, the deathless, brahman, bhūr bhuvaḥ suvar, oṁ."),
    ("v-ishanah", ["īśānaḥ sarva̍vidyā̱nā̱mīśvaraḥ sarva̍bhūtā̱nāṁ̱", "brahmādhi̍pati̱rbrahma̱ṇo'dhi̍pati̱rbrahmā̍ śi̱vo me̍ astu sadāśi̱vom |"],
     "Mahānārāyaṇa Upaniṣad, anuvāka 21 · Taittirīya Āraṇyaka 10.21",
     "The ruler of all learning, the lord of all beings, the overlord of the sacred word, brahman — may that Śiva be gracious to me, the ever-auspicious one, oṁ."),
    ("v-rtam-satyam", ["ṛ̱taṁ sa̱tyaṁ pa̍raṁ bra̱hma̱ pu̱ruṣaṁ̍ kṛṣṇa̱piṅga̍lam |", "ū̱rdhvare̍taṁ vi̍rūpā̱kṣaṁ̱ vi̱śvarū̍pāya̱ vai namo̱ namaḥ̍ |"],
     "Mahānārāyaṇa Upaniṣad, anuvāka 23 · Taittirīya Āraṇyaka 10.23",
     "The cosmic order, the truth, the supreme brahman, the Puruṣa dark and tawny, the one of upward-turned seed, the one of many eyes — to him of universal form, salutation, salutation."),
]


def verse_tokens(lines, num=None):
    """Source lines -> reader tokens. MARKING-RULES §7 order: pauses, holdings, anusvāra, visarga (inside `line_tokens`), then the Taittirīya recension layer, then svara — which is transcribed, not derived."""
    toks = []
    for i, ln in enumerate(lines):
        if i:
            toks.append({"t": "br"})
        clean, acc = strip_accents(ln)
        lt = line_tokens(clean)
        if acc:
            apply_attested(lt, acc)
        toks.extend(lt)
    apply_vedic_anusvara(toks)
    rebuild_iast(toks)
    if num:
        toks.append({"t": "num", "s": num})
        toks.append({"t": "danda", "s": "॥"})
    return toks


def verse(vid, lines, n, source, tr):
    toks = verse_tokens(lines, n)
    surfaces = surfaces_of(toks)
    words, missing = [], []
    for s in surfaces:
        if s not in WORDS:
            missing.append(s)
            words.append({"surface": s, "entries": []})
        else:
            words.append({"surface": s, "entries": WORDS[s]})
    assert len(words) == len(surfaces), (vid, len(words), len(surfaces))
    return ({"id": vid, "n": n, "lineBreak": "source", "tokens": toks,
             "source": source, "translation": {"en": tr}, "words": words},
            missing)


def build():
    miss = []
    def add(bucket, *a):
        v, m = verse(*a)
        bucket.append(v); miss.extend(m)

    sh = []
    add(sh, "v-shanti", SHANTI, None,
        "śānti pāṭha · recited before the Aruṇapraśna",
        "May we hear what is auspicious with our ears, O gods; may we see what"
        "is auspicious with our eyes, O worshipful ones. May we, with limbs and"
        "bodies steady, praising you, obtain the full span of life allotted by"
        "the gods. May Indra of wide renown grant us well-being; may Pūṣan, who"
        "knows all, grant us well-being; may Tārkṣya of unhindered course grant"
        "us well-being; may Bṛhaspati grant us well-being.")

    kh = []
    for i, lines in enumerate(KHANDAS):
        add(kh, "v-%d" % (i + 1), lines, str(i + 1),
            "%s · %s" % (TA, KHANDA_SUBJECT[i]), KHANDA_TR[i])

    ku = []
    add(ku, "v-kubera", KUBERA, None, TA,
        "To the king of kings, the conqueror who prevails, we make our"
        "salutation — to Vaiśravaṇa. May he, Vaiśravaṇa the lord of desires,"
        "grant me my desires, to me who desires them. Salutation to Kubera"
        "Vaiśravaṇa, the great king.")
    add(ku, "v-shanti-close", CLOSE, None, "śānti pāṭha",
        "Oṁ. Peace, peace, peace.")

    ap = []
    for vid, lines, src, tr in APPENDIX:
        add(ap, vid, lines, None, src, tr)

    if miss:
        print("MISSING GRAMMAR (%d distinct):" % len(set(miss)))
        for s in sorted(set(miss)):
            print("%s" % s)
        raise SystemExit("every word needs a parse — AUTHORING-CHANTS §0.2")

    return {
        "format": "vedaunion.chant", "version": 2,
        "id": SLUG, "title": "mantra puṣpam",
        "subtitle": "The flower of the mantra — the waters, and the seat of the waters",
        "source": "kṛṣṇayajurveda ·" + TA,
        "primaryScript": "iast",
        "scripts": ["iast", "devanagari", "telugu", "tamil"],
        "titleForms": {
            "iast": "mantra puṣpam",
            "devanagari": derive("mantra")[0] + "" + derive("puṣpam")[0],
            "telugu": derive("mantra")[1] + "" + derive("puṣpam")[1],
            "tamil": derive("mantra")[2] + "" + derive("puṣpam")[2],
        },
        "lineBreak": "source",
        "sections": [
            {"id": "sec-shanti", "label": "Śānti pāṭha",
             "source": "recited before the Aruṇapraśna", "verses": sh},
            {"id": "sec-pushpam", "label": "Yo'pāṁ puṣpaṁ veda — the eight khaṇḍas",
             "source": TA, "verses": kh},
            {"id": "sec-kubera", "label": "Rājādhirāja — and the closing śānti",
             "source": TA, "verses": ku},
            # Said as a plain section with "(optional)" in its own head — no
            # include/exclude machinery. It is not part of TA 1.22, and the
            # head plus the source line say so; every verse carries its own
            # verified Mahānārāyaṇa locus.
            {"id": "sec-appendix",
             "label": "(Optional) Extended recitation — the Mahānārāyaṇa passages",
             "source": "Commonly appended in South Indian recitation, and not "
                       "part of Taittirīya Āraṇyaka 1.22 · Mahānārāyaṇa "
                       "Upaniṣad, Taittirīya Āraṇyaka 10.21, 10.23, 10.68",
             "verses": ap},
        ],
    }


def main():
    if "--surfaces" in sys.argv:
        seen = {}
        for lines in ([SHANTI] + list(KHANDAS) + [KUBERA, CLOSE]
                      + [a[1] for a in APPENDIX]):
            for s in surfaces_of(verse_tokens(lines)):
                seen[s] = seen.get(s, 0) + 1
        for s in sorted(seen):
            print("%-26s %d%s" % (s, seen[s], "" if s in WORDS else "<- NO GRAMMAR"))
        print("%d distinct surfaces" % len(seen))
        return
    doc = build()
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    nv = sum(len(s["verses"]) for s in doc["sections"])
    nw = sum(len(v["words"]) for s in doc["sections"] for v in s["verses"])
    longest = 0
    for s in doc["sections"]:
        for v in s["verses"]:
            cur = []
            for tk in v["tokens"]:
                if tk["t"] == "syl": cur.append(tk["iast"])
                elif tk["t"] == "sp": cur.append("")
                elif tk["t"] == "br":
                    longest = max(longest, len("".join(cur))); cur = []
            longest = max(longest, len("".join(cur)))
    print("sections %d · verses %d · words %d" % (len(doc["sections"]), nv, nw))
    print("longest rendered line: %d chars" % longest)
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()
