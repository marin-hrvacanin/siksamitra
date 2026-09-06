# -*- coding: utf-8 -*-
"""Attach per-word grammar (words[]) to Bhāgya Sūktam (RV 7.41 / TB 2.8.9), in the
same shape as Durgā/Puruṣa. Grounded in Monier-Williams; each lemma carries a
verifiable MW reference link (ambuda.org). Sandhi-fused surfaces carry multiple
entries. Uncertain analyses are flagged in `note`. SAFE: asserts the per-verse
word count equals the surface count and ABORTS without writing on any mismatch.
"""
import json, re, pathlib
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

CHANT = pathlib.Path(r"D:/Projects/vedaunion/app/client/public/chants/bhagya-suktam.json")


def surfaces_of(v):
    out, cur = [], ""
    for t in v["tokens"]:
        if t["t"] == "syl":
            cur += t.get("iast", "")
        elif t["t"] in ("sp", "br", "bar", "danda", "pause"):
            if cur:
                out.append(cur); cur = ""
    if cur:
        out.append(cur)
    return out


def forms(iast):
    b = ''.join(c for c in iast if c not in "\u0331\u030d\u030e\u0951\u0952\u0310").replace("\u1e41", "\u1e43")
    return {"deva": transliterate(b, sanscript.IAST, sanscript.DEVANAGARI),
            "tel": transliterate(b, sanscript.IAST, sanscript.TELUGU),
            "tam": transliterate(b, sanscript.IAST, sanscript.TAMIL)}


def mw(lemma):
    slug = ''.join(c for c in lemma if c not in "\u0331\u030d\u030e")
    return "https://ambuda.org/tools/dictionaries/mw/" + slug


def N(lemma, meaning, gender, vibhakti, vacana, **x):
    e = {"lemma": lemma, "type": "subanta", "meaning": meaning, "gender": gender,
         "vibhakti": vibhakti, "vacana": vacana, "forms": forms(lemma), "ref": mw(lemma)}
    e.update(x); return e


def V(lemma, meaning, **x):
    e = {"lemma": lemma, "type": "tinanta", "meaning": meaning, "forms": forms(lemma), "ref": mw(lemma)}
    e.update(x); return e


def I(lemma, meaning, **x):  # indeclinable / particle / adverb / preverb
    e = {"lemma": lemma, "type": "avyaya", "meaning": meaning, "forms": forms(lemma), "ref": mw(lemma)}
    e.update(x); return e


om = I("oṁ", "the sacred syllable Oṁ (praṇava)")
pratar = I("prātar", "at dawn, early in the morning")
prep_pra = I("pra", "forth, forward (preverb)")
uta = I("uta", "and, also")
cid = I("cid", "even, indeed (emphatic particle)")
eva = I("eva", "just, indeed")
iva = I("iva", "like, as")
iha = I("iha", "here")
atha = I("atha", "then, thereupon")

# ---- per verse: one list of ENTRY-LISTS, parallel to surfaces_of(v) ----------
W = {
    "v-1": [
        [om],
        [pratar, N("agni", "Agni, the fire-god", "m", 2, "eka")],
        [pratar, N("indra", "Indra", "m", 2, "eka")],
        [V("hve", "we invoke", purusha="prathama→uttama", vacana="bahu", lakara="laṭ (ātmanepada)", note="1st pl. mid. 'havāmahe'")],
        [pratar],
        [N("mitra", "Mitra", "m", 2, "dvi", note="Mitrā-Varuṇā dual compound")],
        [N("varuṇa", "Varuṇa", "m", 2, "dvi")],
        [pratar, N("aśvin", "the two Aśvins", "m", 2, "dvi")],
        [pratar],
        [N("bhaga", "Bhaga, the dispenser of fortune (an Āditya)", "m", 2, "eka")],
        [N("pūṣan", "Pūṣan, the nourisher", "m", 2, "eka")],
        [N("brahmaṇaspati", "Brahmaṇaspati, lord of prayer", "m", 2, "eka")],
        [I("prātar", "at dawn")],
        [N("soma", "Soma", "m", 2, "eka"), uta],
        [N("rudra", "Rudra", "m", 2, "eka")],
        [V("hve", "may we invoke", vacana="bahu", lakara="leṭ/āśīr (opt.)", note="1st pl. 'huvema'")],
    ],
    "v-2": [
        [pratar, V("ji", "the victorious one", note="'jitam' — conquering, ever-victorious (of Bhaga)")],
        [V("ji", "victorious", note="'jitam' epithet")],
        [N("bhaga", "Bhaga", "m", 2, "eka"), N("ugra", "fierce, mighty", "m", 2, "eka", type_note="adj")],
        [V("hve", "may we invoke", vacana="bahu", note="'huvema'")],
        [N("vayam", "we", "-", 1, "bahu", type="sarvanāma")],
        [N("putra", "son", "m", 2, "eka"), N("aditi", "of Aditi", "f", 6, "eka", note="'aditer' gen.")],
        [N("yad", "who (rel.)", "m", 1, "eka", type="sarvanāma", note="'yo'")],
        [N("vidhartṛ", "sustainer, disposer", "m", 1, "eka")],
        [N("ādhra", "the poor, the weak", "m", 1, "eka", note="'ādhraḥ'")],
        [cid],
        [N("yad", "whom (rel.)", "m", 2, "eka", type="sarvanāma", note="'yam'")],
        [V("man", "thinking (himself great), proud", note="'manyamānaḥ' pres. part. ātm.")],
        [N("tura", "the strong, the swift", "m", 1, "eka", note="'turaḥ'")],
        [cid],
        [N("rājan", "a king", "m", 1, "eka", note="'rājā'")],
        [cid],
        [N("yad", "whom (rel.)", "m", 2, "eka", type="sarvanāma", note="'yam'")],
        [N("bhaga", "Bhaga", "m", 2, "eka")],
        [V("bhakṣ", "'let me partake' — he says", note="'bhakṣi iti āha': bhakṣ (partake) + āha (says); Vedic idiom, analysis best-effort")],
    ],
    "v-3": [
        [N("bhaga", "O Bhaga", "m", 8, "eka")],
        [N("praṇetṛ", "O leader, guide", "m", 8, "eka", note="'praṇetar' voc.")],
        [N("bhaga", "O Bhaga", "m", 8, "eka")],
        [N("satyarādhas", "of true bounty, whose gifts are true", "m", 8, "eka", note="'satyarādhaḥ' voc.")],
        [N("bhaga", "Bhaga", "m", 2, "eka"), N("imā", "these", "-", 2, "bahu", type="sarvanāma", note="'bhага imāṁ' — best-effort split of 'bhagemān'")],
        [N("dhī", "thought, insight", "f", 2, "eka", note="'dhiyam'"), V("av", "favour, protect!", note="'ud-ava' imperative")],
        [V("dā", "giving", note="'dadat' pres. part.")],
        [N("asmad", "us", "-", 6, "bahu", type="sarvanāma", note="'naḥ'")],
        [N("bhaga", "O Bhaga", "m", 8, "eka")],
        [prep_pra],
        [N("asmad", "for us", "-", 4, "bahu", type="sarvanāma", note="'ṇo' = naḥ")],
        [V("jan", "generate, bring forth!", note="'janaya' caus. imperative")],
        [N("go", "with cows", "f", 3, "bahu", note="'gobhiḥ'"), N("aśva", "with horses", "m", 3, "bahu", note="'aśvaiḥ'")],
        [N("bhaga", "O Bhaga", "m", 8, "eka")],
        [prep_pra],
        [N("nṛ", "with men, with heroes", "m", 3, "bahu", note="'nṛbhiḥ'")],
        [N("nṛvant", "rich in men/heroes", "m", 1, "bahu", note="'nṛvantaḥ'")],
        [V("as", "may we be", note="'syāma' opt. 1st pl.")],
    ],
    "v-4": [
        [uta, I("idānīm", "now")],
        [N("bhagavant", "possessing fortune, blessed", "m", 1, "bahu", note="'bhagavantaḥ'")],
        [V("as", "may we be", note="'syāma' + uta ('syāmota'); best-effort split")],
        [uta],
        [N("prapitva", "the afternoon, the drawing-on (of day)", "n", 7, "eka", note="loc., best-effort")],
        [uta],
        [N("madhya", "in the middle", "n", 7, "eka", note="'madhye'")],
        [N("ahan", "of the days", "n", 6, "bahu", note="'ahnām'")],
        [N("ahan", "of days", "n", 6, "bahu", note="'anhām' — variant/duplicate of ahnām; flagged")],
        [uta, N("udita", "at the risen (sun), sunrise", "n", 7, "eka", note="'ud-itā' best-effort")],
        [N("maghavan", "the bounteous one (Indra)", "m", 2, "eka", note="'maghavantam'")],
        [N("sūrya", "of the sun", "m", 6, "eka", note="'sūryasya'")],
        [N("vayam", "we", "-", 1, "bahu", type="sarvanāma", note="'vayam'")],
        [N("deva", "of the gods", "m", 6, "bahu", note="'devānām'")],
        [N("sumati", "in the good grace/favour", "f", 7, "eka", note="'sumatau'")],
        [V("as", "may we be", note="'syāma' opt. 1st pl.")],
    ],
    "v-5": [
        [N("bhaga", "Bhaga", "m", 1, "eka")],
        [eva],
        [N("bhagavant", "the fortunate one", "m", 1, "eka", note="'bhagavān'")],
        [V("as", "let him be", note="'astu' imperative 3rd sg.")],
        [N("deva", "O gods", "m", 8, "bahu", note="'devāḥ'")],
        [N("tad", "by that", "-", 3, "eka", type="sarvanāma", note="'tena'")],
        [N("vayam", "we", "-", 1, "bahu", type="sarvanāma")],
        [N("bhagavant", "possessing fortune", "m", 1, "bahu", note="'bhagavantaḥ'")],
        [V("as", "may we be", note="'syāma' opt. 1st pl.")],
        [N("tad", "that (thee)", "-", 2, "eka", type="sarvanāma", note="'tam' (tan)")],
        [N("yuṣmad", "thee", "-", 2, "eka", type="sarvanāma", note="'tvā'")],
        [N("bhaga", "O Bhaga", "m", 8, "eka")],
        [N("sarva", "all, altogether", "m", 2, "eka", note="'sarvam'")],
        [I("id", "indeed, just (emphatic, here 'ij')")],
        [V("hu", "I invoke earnestly", note="'johavīmi' intensive (yaṅ-luk) 1st sg.")],
        [N("tad", "he", "-", 1, "eka", type="sarvanāma", note="'saḥ'")],
        [N("asmad", "for us", "-", 4, "bahu", type="sarvanāma", note="'no'")],
        [N("bhaga", "O Bhaga", "m", 8, "eka")],
        [I("puras", "before, in front")],
        [N("etṛ", "goer, leader (one who goes before)", "m", 1, "eka", note="'etā'")],
        [V("bhū", "be!", note="'bhava' imperative"), iha],
    ],
    "v-6": [
        [I("sam", "together, fully (preverb)"), N("adhvara", "for the sacrifice", "m", 4, "eka", note="'adhvarāya'"), N("uṣas", "the dawns", "f", 1, "bahu", note="'uṣasaḥ'")],
        [V("nam", "bow, bend low", note="'namanta' 3rd pl.")],
        [N("dadhikrāvan", "to Dadhikrāvan (the divine steed)", "m", 4, "eka", note="'dadhikrāve'"), iva],
        [N("śuci", "to the bright, pure", "adj", 4, "eka", note="'śucaye'")],
        [N("pada", "to the station, step", "n", 4, "eka", note="'padāya'")],
        [N("arvācīna", "turned hither, toward us", "n", 2, "eka", note="'arvācīnam'")],
        [N("vasu", "wealth, good", "n", 2, "eka")],
        [V("vid", "finding, procuring", note="'vidam' — best-effort")],
        [N("bhaga", "Bhaga", "m", 1, "eka", note="'bhagaḥ' (bhagan)")],
        [N("asmad", "for us", "-", 4, "bahu", type="sarvanāma", note="'no'")],
        [N("ratha", "a chariot", "m", 2, "eka", note="'ratham'"), iva, N("aśva", "as steeds", "m", 1, "dvi", note="'aśvā'")],
        [N("vājin", "the swift, prize-winning steeds", "m", 1, "bahu", note="'vājinaḥ'")],
        [V("vah", "let them bring hither", note="'ā-vahantu' imperative 3rd pl.")],
    ],
    "v-7": [
        [N("aśvāvatī", "rich in horses", "f", 1, "bahu", note="'aśvāvatīḥ'")],
        [N("gomatī", "rich in cattle", "f", 1, "bahu", note="'gomatīḥ'")],
        [N("asmad", "for us", "-", 4, "bahu", type="sarvanāma", note="'naḥ'")],
        [N("uṣas", "the dawns", "f", 1, "bahu", note="'uṣāsaḥ'")],
        [N("vīravatī", "rich in heroes", "f", 1, "bahu", note="'vīravatīḥ'")],
        [I("sadam", "always, ever"), V("vas", "let them dawn, shine forth", note="'ucchantu' imperative 3rd pl.")],
        [N("bhadra", "auspicious", "f", 1, "bahu", note="'bhadrāḥ'")],
        [N("ghṛta", "ghee", "n", 2, "eka", note="'ghṛtam'")],
        [V("duh", "yielding, milking out", note="'duhānāḥ' pres. part.")],
        [I("viśvatas", "on all sides, everywhere")],
        [N("prapīna", "swollen, streaming full", "f", 1, "bahu", note="'prapīnāḥ'")],
        [N("yuṣmad", "you (pl.)", "-", 1, "bahu", type="sarvanāma", note="'yūyam'")],
        [V("pā", "protect!", note="'pāta' imperative 2nd pl.")],
        [N("svasti", "with blessings, well-being", "f", 3, "bahu", note="'svastibhiḥ'")],
        [I("sadā", "always")],
        [N("asmad", "us", "-", 2, "bahu", type="sarvanāma", note="'naḥ'")],
    ],
    "v-8": [
        [N("yad", "who (rel.)", "m", 1, "eka", type="sarvanāma", note="'yo'")],
        [N("asmad", "me", "-", 2, "eka", type="sarvanāma", note="'mā'"), N("agni", "O Agni", "m", 8, "eka", note="'agne'")],
        [N("bhāgin", "having a share, fortunate", "m", 2, "eka", note="'bhāginam'")],
        [V("as", "being", note="'santam' pres. part."), atha, N("abhāga", "shareless, without a portion", "m", 2, "eka", note="'abhāgam'")],
        [V("kṛ", "wishes to make", note="'cikīrṣati' desiderative 3rd sg.")],
        [N("abhāga", "shareless", "m", 2, "eka", note="'abhāgam'"), N("agni", "O Agni", "m", 8, "eka", note="'agne'")],
        [N("tad", "him", "-", 2, "eka", type="sarvanāma", note="'tam'")],
        [V("kṛ", "make!", note="'kuru' imperative 2nd sg.")],
        [N("asmad", "me", "-", 2, "eka", type="sarvanāma", note="'mām'"), N("agni", "O Agni", "m", 8, "eka", note="'agne'")],
        [N("bhāgin", "a sharer, fortunate", "m", 2, "eka", note="'bhāginam'")],
        [V("kṛ", "make!", note="'kuru' imperative 2nd sg.")],
    ],
    "v-9": [
        [om],
        [N("śānti", "peace", "f", 1, "eka", note="'śāntiḥ'")],
        [N("śānti", "peace", "f", 1, "eka", note="'śāntiḥ'")],
        [N("śānti", "peace", "f", 1, "eka", note="'śāntiḥ'")],
    ],
}

doc = json.load(open(CHANT, encoding="utf-8"))
ok = True
for s in doc["sections"]:
    for v in s["verses"]:
        vid = v["id"]; surfs = surfaces_of(v)
        entries = W.get(vid)
        if entries is None:
            print(f"[skip] {vid}: no grammar authored"); ok = False; continue
        if len(entries) != len(surfs):
            print(f"[MISMATCH] {vid}: {len(surfs)} surfaces vs {len(entries)} authored")
            print("   surfaces:", surfs); ok = False; continue

if not ok:
    raise SystemExit("count mismatch — NOT writing (safe abort)")

for s in doc["sections"]:
    for v in s["verses"]:
        surfs = surfaces_of(v)
        v["words"] = [{"surface": surfs[i], "entries": W[v["id"]][i]} for i in range(len(surfs))]

json.dump(doc, open(CHANT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("attached words[] to all verses:", CHANT)
