# -*- coding: utf-8 -*-
"""Attach per-word grammatical analysis (words[]) to every verse of the durga
chant, matching the purusha format. Surfaces + counts are taken from the actual
token stream (extract.json) so they always match ChantReader.chunkVerse."""
import json, os
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

JSON = r"D:\Projects\vedaunion\app\client\public\chants\durga-suktam.json"
EXTRACT = r"C:\Users\marin\AppData\Local\Temp\claude\D--Projects-vedaunion\e84b47d8-cfb9-41b6-b655-5f9b4fa03ab9\scratchpad\extract.json"

def _forms(head):
    if head == "oṁ":
        return {"deva": "ॐ", "tel": "ఓం", "tam": "ௐ"}
    return {"deva": transliterate(head, sanscript.IAST, sanscript.DEVANAGARI),
            "tel": transliterate(head, sanscript.IAST, sanscript.TELUGU),
            "tam": transliterate(head, sanscript.IAST, sanscript.TAMIL)}

def sub(lemma, meaning, gender=None, vib=None, vac=None, stem=None, note=None):
    g = {"lemma": lemma, "type": "subanta", "meaning": meaning}
    if gender: g["gender"] = gender
    if vib: g["vibhakti"] = vib
    if vac: g["vacana"] = vac
    if stem: g["stem"] = stem
    if note: g["note"] = note
    g["forms"] = _forms(lemma)
    return g

def tin(root, meaning, gana=None, lakara=None, pur=None, vac=None, note=None):
    g = {"lemma": root, "type": "tinanta", "meaning": meaning, "root": root}
    if gana: g["gana"] = gana
    if lakara: g["lakara"] = lakara
    if pur: g["purusha"] = pur
    if vac: g["vacana"] = vac
    if note: g["note"] = note
    g["forms"] = _forms(root)
    return g

def _ind(t, lemma, meaning, note=None):
    g = {"lemma": lemma, "type": t, "meaning": meaning}
    if note: g["note"] = note
    g["forms"] = _forms(lemma)
    return g
def avy(l, m, note=None): return _ind("avyaya", l, m, note)
def upa(l, m, note=None): return _ind("upasarga", l, m, note)
def oth(l, m, note=None): return _ind("other", l, m, note)

# reusable
def pr_pri(pur, note=None):  # parṣat/parṣi -> √pṛ
    return tin("pṛ", "may (he/thou) carry (us) safely across", gana="(s-aor.)",
               lakara="leṭ (subj.)", pur=pur, vac="eka",
               note=note or "s-aorist subjunctive of √pṛ 'to take across, rescue'")
ATI = lambda: avy("ati", "across, over, beyond")

# ---- per-chunk entries (each element = list of Gram for that chunk, in order)
W = {
 "v-1": [
  [sub("jātavedas", "Jātavedas — Agni, the knower of all created beings", "m", 4, "eka", "consonant stem (-vedas)")],
  [tin("su", "let us press out (the soma)", gana="5 (svādi)", lakara="leṭ (Vedic subj.)", pur=1, vac="bahu",
       note="1st pl. subjunctive of √su 'to extract/press'")],
  [sub("soma", "soma — the pressed sacred juice", "m", 2, "eka", "a-stem"),
   sub("arāti", "of the hostile / envious one (the enemy)", "m", 6, "eka", "i-stem (pres. part. arātīyát-)",
       note="gen. sg. of the denominative participle arātīyát- 'behaving as an enemy'; the word runs over the line-break — its final syllables (-yataḥ) fall on the next word")],
  [sub("arāti", "…of the hostile one (continued)", "m", 6, "eka", "i-stem",
       note="final syllables -yataḥ of arātīyataḥ, carried over from the previous line")],
  [upa("ni", "down, into", note="preverb of dahāti ('burns down')"),
   tin("dah", "he burns down", gana="1 (bhvādi)", lakara="leṭ (Vedic subj.)", pur=3, vac="eka",
       note="ni-dahāti: '(Agni) burns down (the foe's wealth)'")],
  [sub("veda", "property, wealth, possessions", "m", 1, "eka", "a-stem (√vid 'to obtain')",
       note="logical object of dahāti — '(he) burns the wealth (of the enemy)'")],
  [sub("tad", "he — that one (Agni)", "m", 1, "eka", "pronominal (tad)")],
  [sub("asmad", "us (enclitic)", None, 2, "bahu", "pronominal (asmad)", note="enclitic accusative naḥ")],
  [pr_pri(3), ATI()],
  [sub("durga", "difficult places, perils, hardships", "n", 2, "bahu", "a-stem")],
  [sub("viśva", "all", "n", 2, "bahu", "a-stem (pronominal adj.)", note="agrees with durgāṇi")],
  [sub("nau", "by a boat", "f", 3, "eka", "diphthong stem (nau)"),
   avy("iva", "like, as")],
  [sub("sindhu", "the river / sea", "m", 2, "eka", "u-stem")],
  [sub("durita", "evils, difficulties, perils", "n", 2, "bahu", "a-stem (dur+√i)"),
   ATI(), sub("agni", "Agni — the fire-god", "m", 1, "eka", "i-stem")],
 ],
 "v-2": [
  [sub("tad", "her — that one", "f", 2, "eka", "pronominal (tad)"),
   sub("agnivarṇā", "fire-coloured (whose colour is fire)", "f", 2, "eka", "bahuvrīhi a-stem (agni-varṇa)",
       note="bahuvrīhi 'having the hue of fire'; the compound spans the line-break, its ending -varṇāṁ falls on the next word")],
  [sub("agnivarṇā", "…fire-coloured (continued, -varṇāṁ)", "f", 2, "eka", "bahuvrīhi a-stem",
       note="second member -varṇāṁ of agni-varṇāṁ, carried over from the previous line")],
  [sub("tapas", "by heat / austerity (glowing power)", "n", 3, "eka", "consonant stem (-as)")],
  [sub("jvalantī", "blazing, flaming", "f", 2, "eka", "pres. participle of √jval, fem. -ī",
       note="pres. act. participle of √jval 'to blaze', acc. sg. f.")],
  [sub("vairocanī", "resplendent, effulgent (the shining one)", "f", 2, "eka", "ī-stem (vṛddhi of virocana)")],
  [oth("karman", "action, ritual act", note="uninflected prior member of the compound karma-phala 'fruit of action'")],
  [sub("phala", "in the fruits (of action)", "n", 7, "bahu", "a-stem",
       note="loc. pl.; second member of karma-phaleṣu 'in the fruits of action'")],
  [sub("juṣṭā", "worshipped, gladly served; well-pleased", "f", 2, "eka", "past participle of √juṣ, fem. -ā",
       note="ppp of √juṣ, acc. sg. f.")],
  [sub("durgā", "Durgā — the goddess", "f", 2, "eka", "ā-stem")],
  [sub("devī", "goddess", "f", 2, "eka", "ī-stem")],
  [sub("śaraṇa", "refuge, shelter, protection", "n", 2, "eka", "a-stem"),
   sub("asmad", "I", None, 1, "eka", "pronominal (asmad)")],
  [tin("pad", "I take refuge, I surrender (to)", gana="4 (divādi, ātm.)", lakara="laṭ", pur=1, vac="eka",
       note="pra + √pad 'to resort to'; ātmanepada pra-padye")],
  [tin("tṝ", "thou carriest (us) safely across", gana="1 (bhvādi)", lakara="laṭ", pur=2, vac="eka",
       note="su- 'well' + tarasi (2nd sg. of √tṝ 'to cross over')")],
  [sub("taras", "for the crossing-over / for (swift) deliverance", "n", 4, "eka", "consonant stem (-as)",
       note="dat. sg. of taras 'energy, crossing'; 'tarase namaḥ' = homage for safe passage. (Some read tarase as a 2nd-person verb of √tṝ.)")],
  [sub("namas", "salutation, obeisance, homage", "n", 1, "eka", "consonant stem (-as)")],
 ],
 "v-3": [
  [sub("agni", "O Agni (fire-god)", "m", 8, "eka", "i-stem")],
  [sub("yuṣmad", "thou / you", None, 1, "eka", "pronominal (yuṣmad)")],
  [tin("pṛ", "carry (us) across! ferry (us) over!", gana="caus. (pāráya-)", lakara="loṭ", pur=2, vac="eka",
       note="imperative 2nd sg. of the causative pāráyati of √pṛ 'to take across' (Vedic lengthened pārayā)")],
  [sub("navya", "new, ever-fresh, ever-young", "m", 1, "eka", "ya-adjective (from nava)",
       note="here adverbially 'anew'; some derive it as a gerundive of √nu 'to praise'")],
  [sub("asmad", "us", None, 2, "bahu", "pronominal (asmad)", note="acc. pl. asmān (euphonic -th before sv-)")],
  [sub("svasti", "with blessings / well-being (safely)", "f", 3, "bahu", "i-stem"),
   ATI()],
  [sub("durga", "difficult places, perils", "n", 2, "bahu", "a-stem")],
  [sub("viśva", "all", "n", 2, "bahu", "a-stem", note="agrees with durgāṇi")],
  [sub("pur", "a stronghold, fortress, rampart", "f", 1, "eka", "consonant stem (pūr / pur)",
       note="pūḥ (nom. sg.) → pūś before ca-: 'be thou a fortress for us'")],
  [avy("ca", "and")],
  [sub("pṛthivī", "broad, wide, ample (also: the wide Earth)", "f", 1, "eka", "ī-fem. (pṛthu / pṛthivī)")],
  [sub("bahula", "abundant, wide, ample", "f", 1, "eka", "a-stem, fem. -ā")],
  [sub("asmad", "for us (enclitic)", None, 4, "bahu", "pronominal (asmad)",
       note="naḥ (encl. dat./gen. pl.), shortened to na before u-")],
  [sub("uru", "broad, wide (a broad refuge)", "f", 1, "eka", "u-stem, fem. urvī")],
  [tin("bhū", "be! become (thou)!", gana="1 (bhvādi)", lakara="loṭ", pur=2, vac="eka",
       note="imperative 2nd sg. (Vedic lengthened bhavā)")],
  [sub("toka", "for children / offspring", "n", 4, "eka", "a-stem")],
  [sub("tanaya", "for progeny / descendants", "m", 4, "eka", "a-stem",
       note="paired with toka: 'children and grandchildren'")],
  [avy("śam", "well-being, happiness, auspiciousness", note="indeclinable, paired with yoḥ"),
   avy("yoḥ", "and averting of evil / welfare", note="archaic (from noun yu); śaṁ-yoḥ = 'weal and welfare'")],
 ],
 "v-4": [
  [sub("viśva", "all (perils)", "n", 2, "bahu", "a-stem", note="viśvāni (durgāṇi) 'all the perils'")],
  [sub("asmad", "us / our", None, 2, "bahu", "pronominal (asmad)", note="enclitic naḥ (object of parṣi)")],
  [sub("durgahan", "O destroyer of difficulties (Agni)", "m", 8, "eka", "-han agentive compound (durga + √han)",
       note="voc. sg.; 'thou who slayest the perils'")],
  [sub("jātavedas", "O Jātavedas (Agni, knower of all beings)", "m", 8, "eka", "consonant stem (-vedas)")],
  [sub("sindhu", "the river / sea", "m", 2, "eka", "u-stem", note="sindhum")],
  [avy("na", "like, as", note="Vedic comparative particle na (= iva)")],
  [sub("nau", "by a boat", "f", 3, "eka", "diphthong stem (nau)")],
  [sub("durita", "evils, difficulties, perils", "n", 2, "bahu", "a-stem"), ATI()],
  [pr_pri(2, note="2nd sg. s-aorist subjunctive of √pṛ 'to take (us) across'")],
  [sub("agni", "O Agni", "m", 8, "eka", "i-stem")],
  [avy("atrivat", "like Atri (as for the sage Atri)", note="taddhita -vat 'like'; 'as thou didst for Atri'")],
  [sub("manas", "with (thy) mind / heartfelt attention", "n", 3, "eka", "consonant stem (-as)")],
  [sub("gṛṇāna", "being lauded (also: praising)", "m", 1, "eka", "pres. mid. participle of √gṝ",
       note="pres. mid. part. of √gṝ 'to invoke, praise'"),
   sub("asmad", "our / of us", None, 6, "bahu", "pronominal (asmad)")],
  [tin("bhū", "be! become (thou)!", gana="(root-aor.)", lakara="loṭ", pur=2, vac="eka",
       note="Vedic imperative bodhi 'be!'; some derive it from √budh 'be attentive'"),
   sub("avitṛ", "a protector, guardian, helper", "m", 1, "eka", "agent noun -tṛ (√av 'to protect')")],
  [sub("tanū", "of (our) bodies / selves / persons", "f", 6, "bahu", "ū-stem")],
 ],
 "v-5": [
  [oth("pṛtanā", "battle, army, host", note="uninflected prior member of pṛtanā-jit 'conquering in battles'")],
  [sub("pṛtanājit", "conquering (in) battles, victorious in fight", "m", 2, "eka", "root-noun compound (-jit, √ji)",
       note="pṛtanā-jítam, acc. sg. — epithet of Agni")],
  [sub("sahamāna", "enduring, overpowering, all-subduing", "m", 2, "eka", "pres. mid. participle of √sah",
       note="pres. mid. part. of √sah 'to prevail'"),
   sub("ugra", "fierce, mighty, formidable", "m", 2, "eka", "a-stem adjective"),
   sub("agni", "Agni, the fire", "m", 2, "eka", "i-stem")],
  [tin("hve", "may we invoke / call upon", gana="1 (bhvādi)", lakara="liṅ (opt.)", pur=1, vac="bahu",
       note="1st pl. optative of √hū/hve 'to call, invoke' (huvema)")],
  [sub("parama", "from the highest / most remote", "m", 5, "eka", "a-stem superlative",
       note="abl. sg., agrees with sadhasthāt")],
  [sub("sadhastha", "from (his) seat / abode / station", "n", 5, "eka", "a-stem", note="abl. sg. — 'from the highest abode'")],
  [sub("tad", "he (Agni)", "m", 1, "eka", "pronominal (tad)")],
  [sub("asmad", "us", None, 2, "bahu", "pronominal (asmad)", note="enclitic accusative naḥ")],
  [pr_pri(3), ATI()],
  [sub("durga", "perils, difficult passages", "n", 2, "bahu", "a-stem")],
  [sub("viśva", "all", "n", 2, "bahu", "a-stem")],
  [sub("kṣām", "from the earth / ground (?)", "f", 5, "eka", "root noun (kṣam- / kṣā 'earth')",
       note="obscure in this context; taken as abl. of kṣām 'earth'. Some reciters/editions read it together with devaḥ as an epithet of the resplendent Agni. Meaning uncertain.")],
  [sub("deva", "the god (the shining one — Agni)", "m", 1, "eka", "a-stem")],
  [avy("ati", "over, beyond", note="the recitation sets 'ati' off with a pause before 'duritā … agniḥ'")],
  [sub("durita", "evils, difficulties", "n", 2, "bahu", "a-stem"),
   sub("agni", "Agni", "m", 1, "eka", "i-stem",
       note="the linking -ty- is the tail of the preceding 'ati' (ati + agniḥ → aty agniḥ)")],
 ],
 "v-6": [
  [sub("pratna", "ancient, primeval, of old", "m", 1, "eka", "a-stem adjective"),
   avy("hi", "for, indeed", note="recited pratnoṣi = pratnaḥ hi (RV 8.11.10); some read pratno 'si 'thou art ancient'")],
  [avy("kam", "indeed (emphatic particle)", note="Vedic enclitic particle, often after hi"),
   sub("īḍya", "to be praised, praiseworthy", "m", 1, "eka", "gerundive of √īḍ ('to praise')")],
  [sub("adhvara", "in the sacrifices / rites", "m", 7, "bahu", "a-stem")],
  [avy("sanāt", "from of old, from ancient times, ever")],
  [avy("ca", "and")],
  [sub("hotṛ", "the invoker-priest (the Hotṛ — Agni)", "m", 1, "eka", "agent noun -tṛ (√hu)")],
  [sub("navya", "new, young, fresh", "m", 1, "eka", "ya-adjective (from nava)", note="'sanāt … navyaḥ' = both of old and anew")],
  [avy("ca", "and")],
  [tin("sad", "thou sittest / presidest (as Hotṛ)", gana="1 (bhvādi)", lakara="laṭ", pur=2, vac="eka",
       note="satsi, 2nd sg. of √sad 'to sit, take one's seat'")],
  [sub("sva", "thine own", "f", 2, "eka", "pronominal a-stem, fem. -ā", note="svāṁ (agrees with tanuvam)")],
  [avy("ca", "and"),
   sub("agni", "O Agni", "m", 8, "eka", "i-stem")],
  [sub("tanū", "body, self / person", "f", 2, "eka", "ū-stem", note="'thine own body'")],
  [tin("prī", "gladden, delight, satisfy (thy own body)", gana="9 (kryādi), redupl.", lakara="loṭ", pur=2, vac="eka",
       note="piprayasva, reduplicated imperative mid. 2nd sg. of √prī 'to please'"),
   sub("asmad", "for us / to us", None, 4, "bahu", "pronominal (asmad)", note="asmabhyam, dat. pl.")],
  [avy("ca", "and")],
  [sub("saubhaga", "good fortune, welfare, prosperity", "n", 2, "eka", "a-stem"),
   upa("ā", "hither, unto (with yajasva)", note="preverb of ā-yajasva 'procure by worship'")],
  [tin("yaj", "bestow by worship, procure (for us)", gana="1 (bhvādi), ātm.", lakara="loṭ", pur=2, vac="eka",
       note="ā + √yaj; ā-yajasva 'obtain for us by thy sacrifice'")],
 ],
 "v-7": [
  [sub("go", "with cows / cattle (also: rays, milk)", "m", 3, "bahu", "diphthong stem (go)")],
  [sub("juṣṭa", "relished, savoured, cherished", "m", 2, "eka", "past participle of √juṣ",
       note="ppp of √juṣ; juṣṭam"),
   sub("ayuj", "peerless, without a second / mate", "m", 6, "eka", "consonant stem (a-yuj, √yuj)",
       note="'having no equal' — epithet of Indra/Viṣṇu; case ambiguous (taken as gen.)")],
  [sub("niṣikta", "poured down, effused, infused / consecrated", "m", 2, "eka", "past participle of ni+√sic",
       note="ni-sikta, acc. sg.; niṣiktam")],
  [sub("yuṣmad", "thy / of thee", None, 6, "eka", "pronominal (yuṣmad)", note="tava, gen. sg."),
   sub("indra", "O Indra", "m", 8, "eka", "a-stem")],
  [sub("viṣṇu", "of Viṣṇu", "m", 6, "eka", "u-stem"),
   upa("anu", "along, after (with saṁcarema)"),
   tin("car", "may we move about / attend / attain", gana="1 (bhvādi)", lakara="liṅ (opt.)", pur=1, vac="bahu",
       note="sam + anu + √car; (anu-saṁ-)carema, 1st pl. optative")],
  [sub("nāka", "of heaven / the firmament", "m", 6, "eka", "a-stem")],
  [sub("pṛṣṭha", "the back / summit / height (of heaven)", "n", 2, "eka", "a-stem"),
   upa("abhi", "towards, up to")],
  [sub("saṁvasāna", "dwelling (in), abiding together", "m", 1, "eka", "pres. mid. participle of sam+√vas",
       note="pres. mid. part. of sam-√vas 'to dwell'; (alt. √vas 'to wear' → 'clothed in')")],
  [sub("vaiṣṇavī", "the Vaiṣṇavī (glory/power) relating to Viṣṇu", "f", 2, "eka", "ī-stem (vṛddhi of viṣṇu)",
       note="acc. sg. f., qualifying an implied fem. (e.g. tanum / śaktim)")],
  [sub("loka", "in the world / realm", "m", 7, "eka", "a-stem",
       note="loka(-e) iha; the ending is ambiguous (loc. sg. 'in the realm' vs. nom.)")],
  [avy("iha", "here, in this world")],
  [tin("mad", "let them rejoice / be gladdened", gana="caus. (mādáya-)", lakara="loṭ", pur=3, vac="bahu",
       note="mādayantām, 3rd pl. imperative mid. of the causative of √mad 'to rejoice'")],
 ],
 "v-8": [
  [sub("kātyāyana", "unto Kātyāyana (father of Kātyāyanī)", "m", 4, "eka", "a-stem",
       note="gāyatrī idiom: the deity is named in the dative — 'may we know Kātyāyanī, the sage Kātyāyana's daughter'")],
  [tin("vid", "may we know / we realize", gana="2 (adādi)", lakara="laṭ", pur=1, vac="bahu",
       note="vidmahe, 1st pl. — the fixed gāyatrī formula 'X-āya vidmahe'")],
  [sub("kanyākumārī", "O virgin maiden (Kanyākumārī)", "f", 8, "eka", "ī-stem compound (kanyā + kumārī)")],
  [tin("dhī", "may we meditate (upon her)", gana="(√dhī / dhyai)", lakara="liṅ (precative)", pur=1, vac="bahu",
       note="dhīmahi, 1st pl. — 'may we contemplate'")],
  [sub("tad", "that / therefore", "n", 1, "eka", "pronominal (tad)", note="tat"),
   sub("asmad", "us", None, 2, "bahu", "pronominal (asmad)", note="naḥ, enclitic")],
  [sub("durgi", "Durgi — the goddess Durgā", "f", 1, "eka", "i-stem", note="nom. sg., subject of pracodayāt")],
  [tin("cud", "may (she) impel / inspire / urge on", gana="caus. (pracodáya-)", lakara="liṅ (opt.)", pur=3, vac="eka",
       note="pra + √cud (caus.); pracodayāt, 3rd sg. — 'may Durgā impel (our minds)'")],
 ],
 "v-9": [
  [avy("oṁ", "Om — the sacred syllable (praṇava)")],
  [sub("śānti", "peace", "f", 1, "eka", "i-stem",
       note="threefold: for the three afflictions — ādhyātmika (self), ādhidaivika (fate), ādhibhautika (world)")],
  [sub("śānti", "peace", "f", 1, "eka", "i-stem")],
  [sub("śānti", "peace", "f", 1, "eka", "i-stem")],
 ],
}

# ---- attach, guaranteeing surface + count match the token stream
ext = json.load(open(EXTRACT, encoding="utf-8"))
doc = json.load(open(JSON, encoding="utf-8"))

for vid, chunks in W.items():
    surfaces = ext[vid]["surfaces"]
    assert len(chunks) == len(surfaces), f"{vid}: {len(chunks)} entry-lists vs {len(surfaces)} chunks"
    words = [{"surface": surfaces[i], "entries": chunks[i]} for i in range(len(surfaces))]
    # write back into the doc
    found = False
    for sec in doc["sections"]:
        for v in sec["verses"]:
            if v["id"] == vid:
                v["words"] = words
                found = True
    assert found, f"{vid} not found in doc"

# sanity: every verse has words
for sec in doc["sections"]:
    for v in sec["verses"]:
        assert "words" in v and v["words"], f"{v['id']} missing words"

json.dump(doc, open(JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK — words attached to all 9 verses")
for sec in doc["sections"]:
    for v in sec["verses"]:
        print(f"  {v['id']}: {len(v['words'])} words, "
              f"{sum(len(w['entries']) for w in v['words'])} entries")
