# -*- coding: utf-8 -*-
"""
IAST fragment -> reader tokens, in ONE place.

Every marked text in Veda Union — a chant JSON, the saṅkalpa fragment tables,
the pañcāṅga coordinate phrases — ends up as the same token stream, described by
`shared/src/chant.ts`:

    {"t":"syl","units":[…],"iast":…,"deva":…,"tel":…,"tam":…}
    {"t":"sp"} {"t":"br"} {"t":"pause","len":…} {"t":"danda","s":…} {"t":"num","s":…}

`gen_marks.mark()` derives the MARKS (holdings + anusvāra + visarga, per
docs/MARKING-RULES.md); this module finishes the job that every caller used to
do for itself: derive the three non-Latin scripts with `indic_transliteration`,
finish the anusvāra-before-a-vowel rule, and turn `gen_marks`' internal `punct`
element into the reader's typed daṇḍa.

Marks are ALWAYS generated offline and are byte-deterministic. Nothing here
runs in the browser.

Needs the Śikṣāmitra venv python (for `indic_transliteration`):

    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/emit.py
"""
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

from gen_marks import mark

OM_FORMS = ("ॐ", "ఓం", "ௐ")          # ॐ  ఓం  ௐ
ANUSVARA = "ṁ"
PRANAVA = ("oṁ", "oṃ")
VOWEL_C = {"a", "ā", "i", "ī", "u", "ū", "e", "o",
           "ṛ", "ṝ", "ḷ", "ḹ", "ai", "au"}

# Every ṁ → m applied before a vowel, for the run report.
ANUSVARA_FIXES = []


def derive(iast):
    """IAST syllable -> (devanāgarī, telugu, tamil). Never hand-typed."""
    if iast in ("oṁ", "oṃ"):
        return OM_FORMS
    b = iast.replace("ṁ", "ṃ")                 # ṁ (dot above) -> ṃ
    return (transliterate(b, sanscript.IAST, sanscript.DEVANAGARI),
            transliterate(b, sanscript.IAST, sanscript.TELUGU),
            transliterate(b, sanscript.IAST, sanscript.TAMIL))


def _anusvara_before_vowel(marked):
    """Finish the anusvāra rule `gen_marks` leaves incomplete.

    `gen_marks.apply_anusvara` assimilates `ṁ` to the homorganic nasal only
    before a STOP, and keeps it before a sibilant / semivowel / nasal / pause —
    which is the śāstric rule. It has no case for a following VOWEL, where a
    word-final -m is simply `m` (देवम् आवाहयामि, never देवं आवाहयामि). Left
    alone, the three scripts disagree: Devanāgarī and Telugu print the anusvāra
    sign, Tamil resolves it to ம். The praṇava / bīja is never touched (matching
    `gen_marks.BIJA`), and a daṇḍa blocks the sandhi.
    """
    flat = []                      # (token index, unit) | (None, None) barrier
    for i, tk in enumerate(marked):
        if tk["t"] == "syl":
            for u in tk["units"]:
                flat.append((i, u))
        elif tk["t"] in ("punct", "pause"):
            flat.append((None, None))
    for k, (ti, u) in enumerate(flat):
        if u is None or u["c"] != ANUSVARA:
            continue
        if marked[ti]["iast"] in PRANAVA:
            continue
        nxt = flat[k + 1][1] if k + 1 < len(flat) else None
        if nxt is None or nxt["c"] not in VOWEL_C:
            continue
        u["c"] = "m"
        u["change"] = True
        ANUSVARA_FIXES.append(f"{marked[ti]['iast']} + {nxt['c']}-")


# The nasals an anusvāra can become (gen_marks.apply_anusvara), plus ṁ itself.
NASAL_CODA = {"ṁ", "ṅ", "ñ", "ṇ", "n", "m"}


def _anusvara_to_coda(marked):
    """Move a word-internal anusvāra off the FOLLOWING syllable's onset.

    `gen_marks` syllabifies on vowel nuclei and gives every consonant between
    two nuclei to the following syllable — right for a saṁyukta onset (bra·hma),
    wrong for an anusvāra, which is always the CODA of the syllable before it:
    saṁ·va·tsa·re, not sa·ṁva·tsa·re.

    In IAST the difference is only where the syllable boundary falls, but in the
    Indic scripts it is the difference between स + ंव — a bare combining sign
    with no base, which browsers render as a dotted-circle placeholder ◌ं — and
    सं + व. A syllable is one shaped cluster in this reader, so the combining
    mark has to sit in the same one as its base.

    Never splits a holding box: a unit that carries a holding stays put.
    """
    for i in range(1, len(marked)):
        tk, prev = marked[i], marked[i - 1]
        if tk["t"] != "syl" or prev["t"] != "syl":
            continue
        u = tk["units"][0]
        if len(tk["units"]) < 2 or u.get("hold"):
            continue
        if u["c"] != "ṁ" and not (u.get("change") and u["c"] in NASAL_CODA):
            continue
        prev["units"].append(tk["units"].pop(0))


def line_tokens(text):
    """IAST -> reader tokens (syl / sp / pause / danda / br).

    Usually ONE source line, but ` // ` may be used to mark a line break INSIDE
    the fragment, and then a whole verse should be passed in one call. That is
    not a nicety — it is the only way to get the marks right across the break:

      * a line break does NOT end a saṁyukta. MARKING-RULES §2.3 measured the
        alternative and rejected it ("he boxes clusters that span a line break,
        so `br` is a plain word space"; 500/534 against 510/534), and
        `gen_marks._collect_samyukta` steps over `br` for exactly that reason.
      * a line break does NOT block the anusvāra either — `durga-suktam.json`
        v-2 assimilates `…haṁ` / break / `prapadye` to `m` with `change`.

    Calling this once PER LINE silently makes the break a hard barrier for
    both, which drops every cross-line box (`sevitāṁ` + `pārśve` loses its
    holding on the `p`, and keeps an anusvāra that is recited `m`).
    """
    marked = mark(text)
    _anusvara_before_vowel(marked)
    _anusvara_to_coda(marked)
    out = []
    for tk in marked:
        if tk["t"] == "syl":
            # rebuilt from the units, which the anusvāra passes may have edited
            iast = "".join(u["c"] for u in tk["units"])
            deva, tel, tam = derive(iast)
            out.append({"t": "syl", "units": tk["units"], "iast": iast,
                        "deva": deva, "tel": tel, "tam": tam})
        elif tk["t"] == "sp":
            out.append({"t": "sp"})
        elif tk["t"] == "pause":
            # the praṇava's short pause, inserted by `gen_marks.build()` before
            # holdings are derived (it is a hard saṁyukta barrier, MARKING-RULES
            # §2.1) — pass it through as the reader's own `pause` token.
            out.append({"t": "pause", "len": tk["len"]})
        elif tk["t"] == "br":
            # ` // ` in the fragment — `gen_marks` has already used it for the
            # never-box-a-line-initial-cluster rule and stepped over it when
            # collecting saṁyuktas; the reader wants it as a break token.
            # The space that separated ` // ` from the word before it is not a
            # space in the rendering — it would be a trailing blank at the end
            # of the line. The two generated chants (`puja-vidhi`,
            # `vishnu-suktam`, which append `br` themselves) carry none.
            if out and out[-1]["t"] == "sp":
                out.pop()
            out.append({"t": "br"})
        elif tk["t"] == "punct":
            # gen_marks emits {'t':'punct'}; the reader wants a typed daṇḍa.
            out.append({"t": "danda", "s": "॥" if len(tk["iast"]) >= 2 else "।"})
    return out


def compact(o):
    """Deterministic, compact JSON for a generated TS table."""
    import json
    return json.dumps(o, ensure_ascii=False, separators=(",", ":"))
