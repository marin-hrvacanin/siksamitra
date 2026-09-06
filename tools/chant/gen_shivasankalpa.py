# -*- coding: utf-8 -*-
"""Śiva Saṅkalpa Sūktam -> client/public/chants/shiva-sankalpa-suktam.json (v2).

NEVER hand-edit the JSON. Edit this file and re-run; the output is
byte-deterministic (run it twice and `cmp`).

    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/gen_shivasankalpa.py
    "D:/Projects/siksamitra/.venv/Scripts/python.exe" tools/chant/pack_chants.py

WHICH ŚIVA SAṄKALPA THIS IS — the long one, 39 mantras
------------------------------------------------------
Four texts travel under this name and they must not be confused:

  * **Vājasaneyi Saṁhitā 34.1–6** — SIX mantras, Śukla Yajurveda, a genuine
    accented saṁhitā, also printed as adhyāya 1 of the Śukla-Yajurvedīya
    Rudrāṣṭādhyāyī. This is the only part of the sūkta with saṁhitā authority
    for its accents. **It is not in the Taittirīya Saṁhitā at all** — even the
    Vedic core reaches our tradition through a Śukla/Khila channel.
  * **Ṛgveda Khila 4.11** — THIRTEEN mantras (Scheftelowitz; GRETIL), the
    oldest full form, of which the Vājasaneyi six are a re-ordered selection.
  * **Śivasaṅkalpopaniṣad** — a minor Śaiva Upaniṣad: the compilation below,
    transmitted as an Upaniṣad rather than as a nyāsa. Vaidika Vignanam prints
    THIRTY-SEVEN mantras closing `iti śivasaṅkalpopaniṣat samāptā`. Its
    numbering is cited on every verse.
  * the **THIRTY-NINE** mantras recited as the thirteenth section of the
    **Mahānyāsa**, before the Śrī Rudram — the Khila sūkta re-ordered, extended
    with Śaiva ślokas and with Rudra mantras from the Taittirīya Saṁhitā and
    the Mahānārāyaṇa Upaniṣad. **That is the text here**, because that is the
    rite it belongs to and the recitation this document ships with.

Each `Verse.source` therefore names up to four coordinates: the Vedic locus,
the Ṛgveda Khila number, the Śivasaṅkalpopaniṣad number and the place in the
Mahānyāsa's own section. Where a mantra has no Vedic locus the source says so
outright rather than leaving it blank.

Every mantra ends `tan me manaḥ śivasaṅkalpam astu` — "may this mind of mine be
of auspicious resolve".

RECENSION — KṚṢṆA YAJURVEDA (Taittirīya)
----------------------------------------
The Mahānyāsa is a Taittirīya rite, and MARKING-RULES §4 branches on the
recension. The evidence is the *gum* itself: every accented witness prints
`yajū(gṁ)ṣi`, `triśata(gṁ)`, `yasmi(gg)ś cittaṁ`, `ṛta(gṁ) satyaṁ`,
`īśvarī(gṁ)`, `tā(gṁ) śarīraṁ`, `ida(gṁ) śivasaṅkalpa(gṁ)` — forms a Ṛgvedic
recitation never produces. So `gen_vishnu.apply_vedic_anusvara` (AUTHORING-CHANTS
§5H) runs here too, and the g-forms are DERIVED, never authored.

THE SIX WITNESSES, AND WHAT EACH SETTLED
----------------------------------------
1. **StotraNidhi / mahanyasam.com**, "Mahānyāsam 13 · śivasaṅkalpāḥ" — **the base
   edition**. The only complete, fully accented witness for all 39, and it writes
   svara in Veda Union's own three code points (U+030D / U+030E / U+0331), so the
   accents travel as DATA (§5I) and are never retyped by eye.
2. **`MahAnyAsam_Sanskrit_TVR`** (archive.org) — accented Devanāgarī, 37 mantras.
3. **`02-mahanyasam-Rudra-kramam`** (vedantastudents.com) — accented Devanāgarī,
   printed edition, 38 mantras.
4. **`Rudram-Mahanyasam-Eng-v1`** (archive.org / bharatiweb) — unaccented
   romanisation, 39 mantras, the same shape as (1).
5. **Vaidika Vignanam**, "Śiva Saṅkalpa Upaniṣad" — unaccented, 37 mantras; the
   source of the Upaniṣad numbering cited on each verse.
6. **Śukla-Yajurvedīya Sasvara Rudrāṣṭādhyāyī** adhyāya 1 (sanskritdocuments.org)
   — accented, the six Vājasaneyi mantras only; plus **Ṛgveda Khila 4.11**
   (GRETIL, Scheftelowitz) and the accented **Mahānārāyaṇa Upaniṣad**
   (sanskritdocuments.org) for the loci.

…and the owner's OWN marked corpus, which outranks all of them where it overlaps
(AUTHORING-CHANTS §0.5): `sri-rudram.json` carries mantras 24, 29, 30 and 36, and
`mantra-pushpam.json` carries 31. All five were compared letter by letter: the
holdings are identical, and the svara is identical but for each verse's final
syllable, which becomes anudātta here because the refrain follows.

HOW THE EDITIONS WERE ARBITRATED — the recitation, measured twice
-----------------------------------------------------------------
The base edition is followed. A departure from it is made ONLY when the reading
is corroborated AND the change moves no accent — that is, when it substitutes or
drops letters without changing the SYLLABLE COUNT, because the accents are the
base edition's and are indexed by vowel nucleus. Anything that would add or
remove a nucleus stays with the base edition and is recorded here instead.

The corroboration of last resort is the **Challakere Brothers' recitation**,
measured in two independent ways:

  * **letters** — `align_shivasankalpa.py` force-aligns the whole track mantra by
    mantra, and each disputed reading is decided by re-aligning BOTH candidates
    against that mantra's own window and comparing mean confidence
    (AUTHORING-CHANTS §5J). The scores below are those A/B tests.
  * **accents** — `svara_check.py` aligns every SYLLABLE and tracks F0, because
    svara *is* pitch. Over 1 672 syllables the stored anudātta is measured low
    86% of the time and high only 2.9%, and the stored udātta is measured on the
    reciting tone 86% of the time: the transcription is confirmed as a whole,
    and the residual is where to look for a single wrong mark.

Every departure is a `subst` on `w`, so it is visible in the verse table and
cannot silently move an accent. THE TWO ORDER CHANGES ARE DIFFERENT: the verse
table below is written in RECITED order, so the entry numbered 17 already holds
the base edition's mantra 18 (and 36 holds its 37). The sixth field of `V()`
records which base-edition mantra each `w` line came from, and `build()` asserts
it — a mis-paired `w` would otherwise pass the `respace` check silently, because
that check only compares a `w` against its own `t`.

ADOPTED against the base edition
  17 <-> 18   the `brahma … hariḥ … adhīśam` mantra comes FIRST. **The printed
              evidence runs 4–1 the other way** (StotraNidhi, TVR,
              vedantastudents and Vignanam all put `…caiva…jñeyaṁ` first;
              bharatiweb prints the `brahma` verse at both 17 and 18, a
              duplication). Only the recitation supports the swap — and it does
              so clearly: on mantra 17's own window `brahma…` scores .815 against
              .679 for `caiva…`. The gaps cannot help here (the two mantras share
              most of their syllables), so this rests on the A/B alone.
  36 <-> 37   `yo rudro agnau` before `gandhadvārāṁ` — .786 vs .437, the widest
              margin in the document, with Vignanam and bharatiweb against
              StotraNidhi and TVR. The base edition's order also left a 3.1 s
              hole in the alignment, which is what first exposed it.
  v-2   no `prāṇinaḥ` — .775 vs .714, and the greedy transcript of that window
        has no trace of it. bharatiweb agrees; four editions print it.
  v-3   `kṛṇvanti`, not `śṛṇvanti` — .814 vs .805, and VS 34.2, RVKh 4.11.2,
        Rudrāṣṭādhyāyī 1.2, TVR and Vignanam all read `kṛ-`. StotraNidhi's
        `śṛ-` is a Telugu-script శృ/కృ slip.
  v-11  `te śrotre`, not `ye śrotre` — .715 vs .706, with four printed editions
        against the base edition alone.
  v-17, v-18  the THIRD `parāt` takes the dīrgha-svarita, like the two before
        it. StotraNidhi marks the first two `parā̎t` and the third `parā̱t` in
        both mantras; `svara_check.py` measures all three alike (+0.2 / +0.4 /
        +0.2 semitones) against neighbouring anudāttas at −1.9 to −2.8, and the
        owner heard it before the measurement did. A scan of every word that
        occurs twice in one mantra found this to be **the only inconsistently
        accented word in the document** — the other fifteen apparent
        inconsistencies are genuine Vedic accentuation, each confirmed by pitch.
  v-20  `praṇataḥ` for `praṇavaḥ` and `sarvavedaiḥ` for `sarvavedāḥ` — .770 vs
        .758; the transcript reads `praddatas`, which is `praṇataḥ` and not the
        `prannaba` that `praṇava` decodes to two mantras later.
  v-29  `mā no vadhīḥ`, not `mā no 'vadhīḥ` — .803 vs .797, and the owner's own
        `sri-rudram.json` (TS 4.5.10.2) reads it so.
  v-30  `bhāmito 'vadhīḥ`, WITH the avagraha — `sri-rudram.json` again
        (TS 4.5.10.3), with bharatiweb. The alignment cannot arbitrate this one
        (`-o 'va-` and `-o va-` are acoustically identical), and the same
        authority had already decided the adjacent v-29; applying it in one
        mantra and not the next was the inconsistency.
  v-36  `bhuvanā viveśa` — the owner's `sri-rudram.json`. The other witnesses
        write the double avagraha (`bhuvanā''viveśa`); the recited syllables are
        the same six either way, so `sn_fold` simply drops the marker.

CONFIRMED by the recitation — the base edition's reading stands
  v-8   `sarvaṁ`, not `daivaṁ` — .694 vs .675, and the transcript reads
        `sarbam`. VS 34.1, RVKh 4.11.4, the Rudrāṣṭādhyāyī, TVR, Vignanam and
        the vedantastudents edition all read `daivam`, and StotraNidhi's own
        word-split gloss reads `daivaṁ` against its own text — but the reciter
        says `sarvaṁ`. **The English on v-8 must render `sarvaṁ`.**
  v-13  the numeral litany stops at `nyarbudaṁ ca` — .690 vs .492. TVR, the
        vedantastudents edition, bharatiweb and Vignanam all continue
        `… samudraś ca madhyaṁ cāntaś ca parārdhaś ca` (the agnicayana series
        of VS 17.2 / TS 4.4.11); the reciter does not.
  v-25  `modanti`, not the classical `modante` — .799 vs .787, though three
        printed editions read `modante`.

RECORDED, NOT ADOPTED — each would move an accent, or the base edition holds
  v-5   `yad acaraṁ` (base, + bharatiweb; audio .672 vs .667, a tie). VS 34.6,
        RVKh 4.11.6, the Rudrāṣṭādhyāyī, TVR, Vignanam **and the vedantastudents
        edition** read `yad ajiraṁ`, "swift" — so the printed majority is
        against the base edition here. It is kept only because the Vājasaneyi
        accents that word DIFFERENTLY (anudātta on `ji`, not on `raṁ`), so
        adopting the word without an accented *Taittirīya* witness for it would
        put a mark on the wrong syllable. If such a witness turns up, adopt it.
  v-6   `pratiṣṭhitā` (base, + Rudrāṣṭādhyāyī, + Vignanam; audio .719 vs .723, a
        tie). TVR and bharatiweb read `pratiṣṭhā` — one syllable fewer.
  v-8   `tat suptasya` (base, + bharatiweb). VS 34.1, TVR, Vignanam and the
        vedantastudents edition read `tad u suptasya` — one syllable more.
  v-9   `tad evāgniḥ tad vāyuḥ tat sūryaḥ tad u candramāḥ` (base, + bharatiweb,
        audio .740 vs .733) — MNU anuvāka 1.7, which is where the line comes
        from. **TVR**, the vedantastudents edition and Vignanam read
        `tad evāgnis tamaso jyotir ekaṁ`.
  v-14  `te agni citteṣṭakāḥ tāṁ śarīraṁ` (base, + vedantastudents, audio .772
        vs .763). The pāda is damaged in every witness — TVR
        `agnicityeṣṭakās taṁ`, Vignanam `te 'gnicityeṣṭakās taṁ`,
        RVKh 4.11.8 `te yajña citta iṣṭakāt tam`; TVR and vedantastudents print
        short `taṁ`, which is what would agree with neuter `śarīraṁ`. The
        uncertainty is stated in the word grammar rather than resolved here.
  v-22  `hyayam` (base, + bharatiweb; the transcript has the `m`). TVR and
        Vignanam read `hy aja īśvaraḥ`.
  v-7   `suvīryaṁ` and `yat paraṁ` — TVR and vedantastudents read `suvīraṁ`, and
        both, with RVKh 4.11.7b, add a final `ca`. One nucleus, so not adopted.
  v-12  `acintyaṁ` — TVR and vedantastudents read `acintayaṁ`, which over-fills
        the pāda; the shipped reading scans.
  v-16  `yasyaitaṁ` — TVR and vedantastudents read `yasyedaṁ`.
  v-24 / v-25  the vedantastudents edition recites 25 before 24.
  v-26, v-38  present in the base edition and in bharatiweb; ABSENT from TVR,
        Vignanam and (v-26) vedantastudents. They have no Upaniṣad number.
  the closing hṛdaya nyāsa is printed by the base edition and by TVR but is NOT
  on the recording, which ends with mantra 39. It ships with no audio.

WHERE THE MAHĀNYĀSA DIFFERS FROM THE ACCENTED SAṀHITĀ — recorded, never merged
------------------------------------------------------------------------------
The six Vājasaneyi mantras and the seven from the Mahānārāyaṇa Upaniṣad have
independent ACCENTED witnesses, and on about eleven syllables those witnesses
accent differently from the base edition. **None of these is a transcription
error** — the shipped accents are StotraNidhi's, faithfully, verified letter by
letter. They are a real difference between the saṁhitā and the Mahānyāsa's own
recitation of it, and merging the two would produce a text nobody recites.
Recorded so the fork is visible:

  vs the Rudrāṣṭādhyāyī (= VS 34)   v-1 `tāyáte`; v-3 `kṛṇvánti`, `yakṣám
      antáḥ`; v-5 `manuṣyā́n` (anudātta, not dīrgha-svarita), `nenīyáte
      'bhī́śubhir`; v-8 `suptásya` (anudātta, not svarita). v-4 and v-6 agree
      mark for mark.
  vs the Mahānārāyaṇa Upaniṣad      v-27 `bāhubhyāṁ`, `patatrair`; v-33 `suruco`;
      v-34 `īśe`; v-35 `devāḥ`; v-9 `candramāḥ` — in each case the base edition
      carries one mark the Upaniṣad does not. v-31, v-32 and v-37 agree mark for
      mark, and v-31 also agrees with `mantra-pushpam.json`.

STILL OPEN — reported, not papered over
---------------------------------------
`girisaṁsthitam` (v-26) takes a derived gum, `giri(gg)saṁsthitam`, because
MARKING-RULES §4 has no exception for it. **Every printed witness writes a plain
anusvāra there**, and the owner's own `sri-rudram.json` leaves the parallel
`saṁhitā` bare twice (and `-īnaṁ sa-` once) among its forty gum sites. That
looks like a real exception — the prefix `sam-` keeping its anusvāra before a
sibilant — but three counter-examples against forty is not enough to encode a
morphological rule into an engine that has no morphology, so it is left derived
and flagged here.

SVARA — transcribed, never placed by convention
-----------------------------------------------
All 39 carry svara in the base edition, including the ślokas, which the printed
Mahānyāsa books mark like the Vedic mantras around them. The accents are
therefore a TRANSCRIPTION of a marked source (MARKING-RULES §3.1's first
register), not the positional convention of §3.2 — that convention is never
applied here, and would be forbidden on the genuinely Vedic mantras anyway.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tokens import derive, line_tokens                              # noqa: E402
from gen_puja import VOWEL_C, strip_accents, surfaces_of            # noqa: E402
from gen_vishnu import apply_vedic_anusvara, rebuild_iast           # noqa: E402
from vishnu_convert import respace                                  # noqa: E402
from shivasankalpa_words import WORDS, OVERRIDES                    # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "..", "client", "public", "chants",
                   "shiva-sankalpa-suktam.json")

SLUG = "shiva-sankalpa-suktam"
TITLE = "śiva saṅkalpa sūktam"
SUBTITLE = "May this mind of mine be of auspicious resolve"
DOC_SOURCE = ("kṛṣṇayajurveda · Mahānyāsa 13 · Ṛgveda Khila 4.11 · "
              "Vājasaneyi Saṁhitā 34.1–6 · Taittirīya Saṁhitā 4.5, 5.5 · "
              "Taittirīya Āraṇyaka 3.13, 10")

#: The refrain, appended to every mantra. Written once so it cannot drift.
REFRAIN = "tan me manaḥ śivasaṅkalpam astu"

# ---------------------------------------------------------------------------
# The declared letter-level differences between the base edition's accented
# line (`w`) and the word-split, underlying-form line this document recites
# (`t`). `respace` reports every one of them; each must fall in a class below,
# and the totals are asserted in `build()`.
#
#   ḥ    an underlying VISARGA restored, so the marking engine re-derives the
#        sandhi itself instead of the base edition's pre-formed letter
#        (AUTHORING-CHANTS §5A-bis step 1). By far the commonest class.
#   ADOPT   the four readings adopted against the base edition, listed in the
#           module docstring.
# ---------------------------------------------------------------------------
VISARGA_RESTORED = {("s", "ḥ"), ("ś", "ḥ"), ("r", "ḥ")}


def V(vid, n, src, w, t, tr, subst=(), wn=None):
    """One mantra.

    `w`      the BASE EDITION's line, accents inline in VU's three code points,
             folded out of StotraNidhi's notation: its `:` visargas written
             `ḥ`, its `ths` written `ts`, and every *gum* (`g̍ṁ` / `gg`) folded
             back to the UNDERLYING anusvāra `ṁ`, because the g-form is DERIVED
             here (AUTHORING-CHANTS §5H) and must never be authored.
    `t`      the source lines this document recites — word-split, underlying
             spelling, typed WITHOUT accents so the accents can only ever
             arrive from `w` (§5I). Vowel sandhi the engine does not model is
             written already applied (`ca` + `antarikṣam` -> `cāntarikṣam`).
    `subst`  the declared departures from the base edition, applied to `w`
             before the accents are carried across. Each is justified in the
             module docstring, and each preserves the vowel-nucleus count, so
             no accent moves.
    `src`    the exact locus, shown under the verse in the reader.
    `tr`     a researched, neutral English rendering written for this document.
    """
    return {"id": vid, "n": n, "source": src, "w": w, "t": list(t), "tr": tr,
            "subst": list(subst), "wn": str(wn) if wn else n}


VERSES = [
    V("v-1", "1",
      "Ṛgveda Khila 4.11.1 · Vājasaneyi Saṁhitā 34.4 · Śivasaṅkalpopaniṣad 1 · Mahānyāsa 13.1",
      w="yene̱daṁ bhū̱taṁ bhuva̍naṁ bhavi̱ṣyat pari̍gṛhītama̱mṛte̍na̱ sarva̎m | yena̍ ya̱jñastā̍yate sa̱ptaho̍tā̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yenedaṁ bhūtaṁ bhuvanaṁ bhaviṣyat",
         "parigṛhītam amṛtena sarvam |",
         "yena yajñaḥ tāyate saptahotā",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="By which all this — what has been, what is, what is to come — is wholly encompassed by the deathless; by which the sacrifice with its seven priests is extended: may this mind of mine be of auspicious resolve."),

    V("v-2", "2",
      "Ṛgveda Khila 4.11.10 · not in Vājasaneyi Saṁhitā 34 · Śivasaṅkalpopaniṣad 2 · Mahānyāsa 13.2",
      w="yena̱ karmā̍ṇi pra̱cara̍nti̱ dhīrā̱ yato̍ vā̱cā mana̍sā̱ cāru̱yanti̍ | yatsammi̍ta̱ṁ mana̍ḥ sa̱ñcara̍nti̱ prā̱ṇina̱stanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yena karmāṇi pracaranti dhīrā",
         "yato vācā manasā cāru yanti |",
         "yat sammitaṁ manaḥ sañcaranti",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="By which the steadfast set their works in motion, and out of which they move rightly in speech and in thought; that commensurate mind through which they range: may this mind of mine be of auspicious resolve.",
      subst=[("̱ prā̱ṇina̱stanme", "̱ tanme")]),

    V("v-3", "3",
      "Ṛgveda Khila 4.11.2 · Vājasaneyi Saṁhitā 34.2 · Śivasaṅkalpopaniṣad 3 · Mahānyāsa 13.3",
      w="yena̱ karmā̎ṇya̱paso̍ manī̱ṣiṇo̍ ya̱jñe śṛ̍ṇvanti vi̱dathe̍ṣu̱ dhīrā̎ḥ | yada̍pū̱rvaṁ yakṣa̱manta̍ḥ pra̱jānā̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yena karmāṇy apaso manīṣiṇo",
         "yajñe kṛṇvanti vidatheṣu dhīrāḥ |",
         "yad apūrvaṁ yakṣam antaḥ prajānāṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="By which the skilled and thoughtful do their work at the sacrifice, the steadfast at the ritual assemblies; that unprecedented power that is within living beings: may this mind of mine be of auspicious resolve.",
      subst=[("ya̱jñe śṛ̍ṇvanti", "ya̱jñe kṛ̍ṇvanti")]),

    V("v-4", "4",
      "Ṛgveda Khila 4.11.3 · Vājasaneyi Saṁhitā 34.3 · Śivasaṅkalpopaniṣad 4 · Mahānyāsa 13.4",
      w="yatpra̱jñāna̍mu̱ta ceto̱ dhṛti̍śca̱ yajjyoti̍ra̱ntara̱mṛta̍ṁ pra̱jāsu̍ | yasmā̱nna ṛ̱te kiṁ ca̱ na karma̍ kri̱yate̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yat prajñānam uta ceto dhṛtiḥ ca",
         "yaj jyotiḥ antar amṛtaṁ prajāsu |",
         "yasmān na ṛte kiṁcana karma kriyate",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="That which is understanding, and awareness, and steadfastness; that deathless light within all creatures, without which no act whatever is done: may this mind of mine be of auspicious resolve."),

    V("v-5", "5",
      "Ṛgveda Khila 4.11.6 · Vājasaneyi Saṁhitā 34.6 · Śivasaṅkalpopaniṣad 5 · Mahānyāsa 13.5",
      w="su̱ṣā̱ra̱thiraśvā̍niva̱ yanma̍nu̱ṣyā̎nnenī̱yate̍'bhī̱śubhi̍rvā̱jina̍ iva | hṛ̱tpra̱ti̱ṣṭhaṁ yadaca̍ra̱ṁ javi̍ṣṭha̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["suṣārathiḥ aśvān iva yan manuṣyān",
         "nenīyate 'bhīśubhiḥ vājina iva |",
         "hṛtpratiṣṭhaṁ yad acaraṁ javiṣṭhaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="That which leads men on as a good charioteer leads horses, like swift steeds by the reins; that which is seated in the heart, unmoving and swiftest of all: may this mind of mine be of auspicious resolve."),

    V("v-6", "6",
      "Ṛgveda Khila 4.11.5 · Vājasaneyi Saṁhitā 34.5 · Śivasaṅkalpopaniṣad 6 · Mahānyāsa 13.6",
      w="yasmi̱nnṛca̱ḥ sāma̱ yajū̍ṁṣi̱ yasmi̱n prati̍ṣṭhitā rathanā̱bhāvi̍vā̱rāḥ | yasmiṁ̍ści̱ttaṁ sarva̱mota̍ṁ pra̱jānā̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yasminn ṛcaḥ sāma yajūṁṣi",
         "yasmin pratiṣṭhitā rathanābhāv ivārāḥ |",
         "yasmiṁś cittaṁ sarvam otaṁ prajānāṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="In which the ṛcs, the sāman and the yajus verses stand established, as the spokes stand in the hub of a wheel; in which the whole thought of living beings is woven: may this mind of mine be of auspicious resolve."),

    V("v-7", "7",
      "Ṛgveda Khila 4.11.7 · not in Vājasaneyi Saṁhitā 34 · Śivasaṅkalpopaniṣad 7 · Mahānyāsa 13.7",
      w="yadatra̍ ṣa̱ṣṭhaṁ tri̱śata̍ṁ su̱vīrya̍ṁ ya̱jñasya̍ gu̱hyaṁ nava̍nāva̱ māyya̎m | daśa̍ pañca tri̱̱ṁśata̱ṁ yatpa̍ra̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yad atra ṣaṣṭhaṁ triśataṁ suvīryaṁ",
         "yajñasya guhyaṁ navanāva māyyam |",
         "daśa pañca triṁśataṁ yat paraṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="That which here is the sixth of the three hundred, rich in vigour; the secret of the sacrifice, the ever-new mystery; the ten, the five, the thirty, and what is beyond them: may this mind of mine be of auspicious resolve."),

    V("v-8", "8",
      "Ṛgveda Khila 4.11.4 · Vājasaneyi Saṁhitā 34.1 · Śivasaṅkalpopaniṣad 8 · Mahānyāsa 13.8",
      w="yajjāgra̍to dū̱ramu̱daiti̱ sarva̱ṁ tatsu̱ptasya̍ tathai̱vaiti̍ | dū̱ra̱ṁ ga̱maṁ jyoti̍ṣā̱ṁ jyoti̱reka̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yaj jāgrato dūram udaiti sarvaṁ",
         "tat suptasya tathaivaiti |",
         "dūraṁgamaṁ jyotiṣāṁ jyotiḥ ekaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="All that goes far from one who is awake, and goes just so from one who sleeps; the far-travelling one light of lights: may this mind of mine be of auspicious resolve."),

    V("v-9", "9",
      "Ṛgveda Khila 4.11.13 · Śivasaṅkalpopaniṣad 10 · Mahānyāsa 13.9 · second half: Taittirīya Āraṇyaka 10.1.7 · Mahānārāyaṇa Upaniṣad anuvāka 1",
      w="yene̱daṁ viśva̱ṁ jaga̍to ba̱bhūva̍ ye de̱vāpi̍ maha̱to jā̱tave̍dāḥ | tade̱vāgnistadvā̱yustatsūrya̱stadu̍ca̱ndramā̱stanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yenedaṁ viśvaṁ jagato babhūva",
         "ye devāpi mahato jātavedāḥ |",
         "tad evāgniḥ tad vāyuḥ tat sūryaḥ tad u candramāḥ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="By which this whole world came to be, and the gods too, and the great Knower-of-beings: that indeed is Agni, that is Vāyu, that is the Sun, and that is the Moon: may this mind of mine be of auspicious resolve."),

    V("v-10", "10",
      "Ṛgveda Khila 4.11.12 · not in Vājasaneyi Saṁhitā 34 · Śivasaṅkalpopaniṣad 9 · Mahānyāsa 13.10",
      w="yena̱ dyauḥ pṛ̍thi̱vī cā̱ntari̍kṣaṁ ca̱ ye parva̍tāḥ pra̱diśo̱ diśa̍śca | yene̱daṁ jaga̱dvyāpta̍ṁ pra̱jānā̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yena dyauḥ pṛthivī cāntarikṣaṁ ca",
         "ye parvatāḥ pradiśo diśaḥ ca |",
         "yenedaṁ jagad vyāptaṁ prajānāṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="By which heaven is, and earth, and the mid-region; and the mountains, the intermediate quarters and the quarters; by which this world of living beings is pervaded: may this mind of mine be of auspicious resolve."),

    V("v-11", "11",
      "Ṛgveda Khila 4.11.11 · not in Vājasaneyi Saṁhitā 34 · Śivasaṅkalpopaniṣad 11 · Mahānyāsa 13.11",
      w="ye ma̍no̱ hṛda̍ya̱ṁ ye ca̍ de̱vā ye di̱vyā āpo̱ ye sū̎ryara̱śmiḥ | ye śrotre̱ cakṣu̍ṣī sa̱ñcara̍nta̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["ye mano hṛdayaṁ ye ca devā",
         "ye divyā āpo ye sūryaraśmiḥ |",
         "te śrotre cakṣuṣī sañcarantaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Those that are mind and heart, and the gods, and the divine waters, and the ray of the sun; those move within the two ears and the two eyes: may this mind of mine be of auspicious resolve.",
      subst=[("ye śrotre̱", "te śrotre̱")]),

    V("v-12", "12",
      "Śivasaṅkalpopaniṣad 12 · Mahānyāsa 13.12 · a śloka of the compilation, with no Vedic locus",
      w="aci̍ntya̱ṁ cāpra̍meya̱ṁ ca̱ vya̱ktā̱vyakta̍para̱ṁ ca ya̍t | sūkṣmā̎tsūkṣmata̍raṁ jñe̱ya̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["acintyaṁ cāprameyaṁ ca",
         "vyaktāvyaktaparaṁ ca yat |",
         "sūkṣmāt sūkṣmataraṁ jñeyaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="That which is unthinkable and immeasurable, and beyond both the manifest and the unmanifest; to be known as subtler than the subtle: may this mind of mine be of auspicious resolve."),

    V("v-13", "13",
      "Śivasaṅkalpopaniṣad 13 · Mahānyāsa 13.13 · the agnicayana numeral litany; cf. Vājasaneyi Saṁhitā 17.2 · Taittirīya Saṁhitā 4.4.11",
      w="ekā̍ ca da̱śa śa̱taṁ ca̍ sa̱hasra̍ṁ cā̱yuta̍ṁ ca ni̱yuta̍ṁ ca pra̱yuta̱ṁ cārbu̍daṁ ca̱ nya̍rbudaṁ ca̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["ekā ca daśa śataṁ ca sahasraṁ cāyutaṁ ca",
         "niyutaṁ ca prayutaṁ cārbudaṁ ca nyarbudaṁ ca",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="One, and ten, and a hundred, and a thousand, and ten thousand, and a hundred thousand, and a million, and ten million, and a hundred million: may this mind of mine be of auspicious resolve."),

    V("v-14", "14",
      "Ṛgveda Khila 4.11.8 · not in Vājasaneyi Saṁhitā 34 · Śivasaṅkalpopaniṣad 14 · Mahānyāsa 13.14",
      w="ye pa̍ñca pa̱ñcāda̱śa śa̱ta̍ṁ sa̱hasra̍ma̱yuta̱ṁ nya̍rbudaṁ ca | te a̍gni ci̱tteṣṭa̍kā̱stāṁ śarī̍ra̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["ye pañca pañcādaśa śataṁ",
         "sahasram ayutaṁ nyarbudaṁ ca |",
         "te agni citteṣṭakāḥ tāṁ śarīraṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="The five, the fifteen, the hundred, the thousand, the ten thousand and the hundred million — these are the bricks of the piled fire-altar, and that is its body: may this mind of mine be of auspicious resolve."),

    V("v-15", "15",
      "Ṛgveda Khila 4.11.9 · Śivasaṅkalpopaniṣad 15 · Mahānyāsa 13.15 · first half: Taittirīya Āraṇyaka 3.13 · uttaranārāyaṇa 2",
      w="vedā̱hame̱taṁ puru̍ṣaṁ ma̱hānta̍mādi̱tyava̍rṇa̱ṁ tama̍sa̱ḥ para̍stāt | yasya̱ yoni̱ṁ pari̱paśya̍nti̱ dhīrā̱stanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["vedāham etaṁ puruṣaṁ mahāntam",
         "ādityavarṇaṁ tamasaḥ parastāt |",
         "yasya yoniṁ paripaśyanti dhīrāḥ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="I know this great Puruṣa, sun-coloured, beyond the darkness — whose origin the steadfast behold on every side: may this mind of mine be of auspicious resolve."),

    V("v-16", "16",
      "Śivasaṅkalpopaniṣad 16 · Mahānyāsa 13.16 · a śloka of the compilation, with no Vedic locus",
      w="yasyai̱taṁ dhīrā̎ḥ pu̱nanti̍ ka̱vayo̎ bra̱hmāṇa̍me̱taṁ tvā̍ vṛṇuta̱mindu̎m | sthā̱va̱raṁ jaṅga̍ma̱ṁ dyaurā̍kā̱śaṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yasyaitaṁ dhīrāḥ punanti kavayo",
         "brahmāṇam etaṁ tvā vṛṇutam indum |",
         "sthāvaraṁ jaṅgamaṁ dyauḥ ākāśaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Whose being the steadfast seers make pure — you, this Brahman, this moon, whom they choose; the standing and the moving, heaven and space: may this mind of mine be of auspicious resolve."),

    V("v-17", "17",
      "Śivasaṅkalpopaniṣad 18 · Mahānyāsa 13.17 · a śloka of the compilation, with no Vedic locus",
      w="parā̎tpa̱rata̍raṁ bra̱hma̱ ta̱tparā̎tpara̱to hari̍ḥ | yatparā̱tpara̍to'dhī̱śa̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["parāt parataraṁ brahma",
         "tat parāt parato hariḥ |",
         "yat parāt parato 'dhīśaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Higher than the high is Brahman; beyond that beyond is Hari; and further than the furthest is the sovereign Lord: may this mind of mine be of auspicious resolve.",
      wn=18,
      subst=[("yatparā̱t", "yatparā̎t")]),

    V("v-18", "18",
      "Śivasaṅkalpopaniṣad 17 · Mahānyāsa 13.18 · a śloka of the compilation, with no Vedic locus",
      w="parā̎tpa̱rata̍raṁ cai̱va̱ ta̱tparā̎ccaiva̱ yatpa̍ram | yatparā̱tpara̍to jñe̱ya̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["parāt parataraṁ caiva",
         "tat parāc caiva yat param |",
         "yat parāt parato jñeyaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="That which is higher than the high, and beyond even that beyond; that which is to be known as further than the furthest: may this mind of mine be of auspicious resolve.",
      wn=17,
      subst=[("yatparā̱t", "yatparā̎t")]),

    V("v-19", "19",
      "Śivasaṅkalpopaniṣad 19 · Mahānyāsa 13.19 · a śloka of the compilation, with no Vedic locus",
      w="yā vedādiṣu̍ gāya̱trī sa̱rvavyā̍pī mahe̱śva̍rī | ṛgya̍ju̱ḥ sāmā̍tharvai̱śca̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yā vedādiṣu gāyatrī",
         "sarvavyāpī maheśvarī |",
         "ṛgyajuḥ sāmātharvaiḥ ca",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="She who at the beginning of the Vedas is the Gāyatrī, all-pervading, the great sovereign — with the Ṛk, the Yajus, the Sāman and the Atharvan: may this mind of mine be of auspicious resolve."),

    V("v-20", "20",
      "Śivasaṅkalpopaniṣad 20 · Mahānyāsa 13.20 · a śloka of the compilation, with no Vedic locus",
      w="yo vai̍ de̱vaṁ ma̍hāde̱va̱ṁ pra̱yata̍ḥ praṇa̱vaḥ śuci̍ḥ | yaḥ sarve̍ sarva̍vedā̱śca tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yo vai devaṁ mahādevaṁ",
         "prayataḥ praṇataḥ śuciḥ |",
         "yaḥ sarve sarvavedaiḥ ca",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="He who is the god, the Great God — self-restrained, bowed in reverence, pure; he who is all, and is with all the Vedas: may this mind of mine be of auspicious resolve.",
      subst=[("praṇa̱vaḥ", "praṇa̱taḥ"), ("sarva̍vedā̱śca", "sarva̍vedai̱śca")]),

    V("v-21", "21",
      "Śivasaṅkalpopaniṣad 21 · Mahānyāsa 13.21 · a śloka of the compilation, with no Vedic locus",
      w="praya̍ta̱ḥ praṇa̍voṅkā̱ra̱ṁ pra̱ṇava̍ṁ puru̱ṣotta̍mam | oṅkāra̱ṁ praṇa̍vātmā̱na̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["prayataḥ praṇavoṅkāraṁ",
         "praṇavaṁ puruṣottamam |",
         "oṅkāraṁ praṇavātmānaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="The self-restrained one — the praṇava, the syllable Oṁ; the praṇava, the highest Puruṣa; the Oṁ-kāra whose very self is the praṇava: may this mind of mine be of auspicious resolve."),

    V("v-22", "22",
      "Śivasaṅkalpopaniṣad 22 · Mahānyāsa 13.22 · a śloka of the compilation, with no Vedic locus",
      w="yo'sau̍ sa̱rveṣu̍ vede̱ṣu̱ paṭhyate̎ hyaya̱mīśva̍raḥ | a̱kā̱yo nirgu̍ṇo hyā̱tmā̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yo 'sau sarveṣu vedeṣu",
         "paṭhyate hyayam īśvaraḥ |",
         "akāyo nirguṇo hyātmā",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="He who is recited in all the Vedas — this Lord, bodiless, without attributes, the Self: may this mind of mine be of auspicious resolve."),

    V("v-23", "23",
      "Śivasaṅkalpopaniṣad 23 · Mahānyāsa 13.23 · a śloka of the compilation, with no Vedic locus",
      w="gobhi̱rjuṣṭa̱ṁ dhane̍na̱ hyāyu̍ṣā ca̱ bale̍na ca | pra̱jayā̍ pa̱śubhi̍ḥ puṣkarā̱kṣaṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["gobhiḥ juṣṭaṁ dhanena",
         "hyāyuṣā ca balena ca |",
         "prajayā paśubhiḥ puṣkarākṣaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Him who is attended with cattle, with wealth, with long life and with strength, with offspring and with livestock — the lotus-eyed one: may this mind of mine be of auspicious resolve."),

    V("v-24", "24",
      "Taittirīya Saṁhitā 1.8.6.i · Ṛgveda 7.59.12 · Taittirīya Āraṇyaka 10.56 · Śivasaṅkalpopaniṣad 24 · Mahānyāsa 13.24",
      w="trya̍mbakaṁ yajāmahe suga̱ndhiṁ pu̍ṣṭi̱vardha̍nam | u̱rvā̱ru̱kami̍va̱ bandha̍nānmṛ̱tyormu̍kṣīya̱ mā'mṛtā̱ttanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["tryambakaṁ yajāmahe sugandhiṁ puṣṭivardhanam |",
         "urvārukam iva bandhanān mṛtyoḥ mukṣīya mā 'mṛtāt",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="We worship the three-eyed one, the fragrant, the increaser of nourishment. As a cucumber is freed from its stalk, may I be freed from death — not from the deathless: may this mind of mine be of auspicious resolve."),

    V("v-25", "25",
      "Śivasaṅkalpopaniṣad 25 · Mahānyāsa 13.25 · a śloka of the compilation, with no Vedic locus",
      w="kailā̍sa̱śikha̍re ra̱mye̱ śa̱ṅkara̍sya śi̱vāla̍ye | de̱vatā̎statra̍ moda̱nti̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["kailāsaśikhare ramye śaṅkarasya śivālaye |",
         "devatāḥ tatra modanti",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="On the lovely peak of Kailāsa, in the Śiva-abode of Śaṅkara, the gods rejoice there: may this mind of mine be of auspicious resolve."),

    V("v-26", "26",
      "Mahānyāsa 13.26 · a śloka of the compilation, with no Vedic locus; absent from the Śivasaṅkalpopaniṣad recension",
      w="kailā̍sa̱śikha̍rāvā̱sā hi̱mava̍dgiri̱saṁsthi̍tam | nī̱la̱ka̱ṇṭhaṁ tri̍ṇetra̱ṁ ca̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["kailāsaśikharāvāsā himavad girisaṁsthitam |",
         "nīlakaṇṭhaṁ triṇetraṁ ca",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Him whose dwelling is the peak of Kailāsa, established on the snow mountain; the blue-throated, the three-eyed: may this mind of mine be of auspicious resolve."),

    V("v-27", "27",
      "Taittirīya Āraṇyaka 10.1.13 · Mahānārāyaṇa Upaniṣad anuvāka 1 · Ṛgveda 10.81.3 · Vājasaneyi Saṁhitā 17.19 · Śivasaṅkalpopaniṣad 26 · Mahānyāsa 13.27",
      w="vi̱śvata̍ścakṣuru̱ta vi̱śvato̍ mukho vi̱śvato̍ hasta u̱ta vi̱śvata̍spāt | saṁ bā̱hubhyā̱ṁ nama̍ti̱ sampata̍trai̱rdyāvā̍pṛthi̱vī ja̱naya̍nde̱va eka̱stanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["viśvataḥ cakṣuḥ uta viśvato mukho",
         "viśvato hasta uta viśvataḥ pāt |",
         "saṁ bāhubhyāṁ namati sam patatraiḥ",
         "dyāvāpṛthivī janayan deva ekaḥ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Eyed on every side, faced on every side, handed on every side, footed on every side, he bends together with his arms, together with his wings, bringing forth heaven and earth — the one god: may this mind of mine be of auspicious resolve."),

    V("v-28", "28",
      "Śivasaṅkalpopaniṣad 27 · Mahānyāsa 13.28 · a śloka of the compilation, with no Vedic locus",
      w="ca̱turo̍ ve̱dāna̍dhīyī̱ta̱ sa̱rvaśā̎strama̱yaṁ vidu̍ḥ | iti̍hā̱sa pu̍rāṇā̱nā̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["caturo vedān adhīyīta",
         "sarvaśāstramayaṁ viduḥ |",
         "itihāsa purāṇānāṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="One should study the four Vedas; they know that it consists of all the śāstras — of the itihāsas and the purāṇas: may this mind of mine be of auspicious resolve."),

    V("v-29", "29",
      "Taittirīya Saṁhitā 4.5.10.2 · Ṛgveda 1.114.7 · Śrī Rudram, namakam 10.5 · Śivasaṅkalpopaniṣad 28 · Mahānyāsa 13.29",
      w="mā no̍ ma̱hānta̍mu̱ta mā no̍ arbha̱kaṁ mā na̱ ukṣa̍ntamu̱ta mā na̍ ukṣi̱tam | māno̍'vadhīḥ pi̱tara̱ṁ motamā̱tara̍ṁ pri̱yāmāna̍sta̱nuvo̍ rudra rīriṣa̱stanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["mā no mahāntam uta mā no arbhakaṁ",
         "mā na ukṣantam uta mā na ukṣitam |",
         "mā no vadhīḥ pitaraṁ mota mātaraṁ",
         "priyā mā naḥ tanuvo rudra rīriṣaḥ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Do not harm our elder, nor our little one; nor the one growing up, nor the one grown. Do not slay our father, nor our mother; do not injure our own dear bodies, O Rudra: may this mind of mine be of auspicious resolve.",
      subst=[("māno̍'vadhīḥ", "māno̍vadhīḥ")]),

    V("v-30", "30",
      "Taittirīya Saṁhitā 4.5.10.3 · Ṛgveda 1.114.8 · Śrī Rudram, namakam 10.6 · Śivasaṅkalpopaniṣad 29 · Mahānyāsa 13.30",
      w="māna̍sto̱ke tana̍ye̱ mā na̱ āyu̍ṣi̱ mā no̱ goṣu̱ mā no̱ aśve̍ṣu rīriṣaḥ | vī̱rānmāno̍ rudra bhāmi̱to va̍dhīrha̱viṣma̍nto̱ nama̍sā vidhemate̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["mā naḥ toke tanaye mā na āyuṣi",
         "mā no goṣu mā no aśveṣu rīriṣaḥ |",
         "vīrān mā no rudra bhāmito 'vadhīḥ",
         "haviṣmanto namasā vidhema te",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Do not harm us in our children and descendants, nor in our lifespan, nor in our cattle, nor in our horses. Do not strike down our heroes in anger, O Rudra — bearing oblations, with reverence we worship you: may this mind of mine be of auspicious resolve.",
      subst=[("bhāmi̱to va̍dhīr", "bhāmi̱to 'va̍dhīr")]),

    V("v-31", "31",
      "Taittirīya Āraṇyaka 10.23 · Mahānārāyaṇa Upaniṣad anuvāka 23 · Śivasaṅkalpopaniṣad 30 · Mahānyāsa 13.31",
      w="ṛ̱taṁ sa̱tyaṁ pa̍raṁ bra̱hma̱ pu̱ruṣa̍ṁ kṛṣṇa̱piṅga̍lam | ū̱rdhvare̍taṁ vi̍rūpā̱kṣa̱ṁ vi̱śvarū̍pāya̱ vai namo̱ nama̱stanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["ṛtaṁ satyaṁ paraṁ brahma puruṣaṁ kṛṣṇapiṅgalam |",
         "ūrdhvaretaṁ virūpākṣaṁ viśvarūpāya vai namo namaḥ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="The right, the true, the highest Brahman, the Puruṣa dark and tawny, of upward-drawn seed, of unequal eyes — to him whose form is the universe, homage, homage: may this mind of mine be of auspicious resolve."),

    V("v-32", "32",
      "Taittirīya Āraṇyaka 10.25 · Mahānārāyaṇa Upaniṣad anuvāka 25 · first half: Ṛgveda 1.43.1 · Śivasaṅkalpopaniṣad 31 · Mahānyāsa 13.32",
      w="kadru̱drāya̱ prace̍tase mī̱ḍhuṣṭa̍māya̱ tavya̍se | vo̱cema̱ śanta̍maṁ hṛ̱de | sarvo̱ hye̍ṣa ru̱drastasmai̍ ru̱drāya̱ namo̍ astu̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["kad rudrāya pracetase mīḍhuṣṭamāya tavyase |",
         "vocema śantamaṁ hṛde |",
         "sarvo hyeṣa rudraḥ tasmai rudrāya namo astu",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="What may we say to Rudra the wise, the most bountiful, the mighty — what is most healing to the heart? For all this is Rudra; to that Rudra be homage: may this mind of mine be of auspicious resolve."),

    V("v-33", "33",
      "Taittirīya Āraṇyaka 10.1.45 · Mahānārāyaṇa Upaniṣad anuvāka 1 · Vājasaneyi Saṁhitā 13.3 · Taittirīya Saṁhitā 4.2.8.2 · Śivasaṅkalpopaniṣad 32 · Mahānyāsa 13.33",
      w="brahma̍jajñā̱naṁ pra̍tha̱maṁ pu̱rastā̱dvisī̍ma̱taḥ su̱ruco̍ ve̱na ā̍vaḥ | sa bu̱dhniyā̍ upa̱mā a̍sya vi̱ṣṭhāḥ sa̱taśca̱ yoni̱masa̍taśca̱ viva̱stanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["brahma jajñānaṁ prathamaṁ purastād",
         "vi sīmataḥ suruco vena āvaḥ |",
         "sa budhniyā upamā asya viṣṭhāḥ",
         "sataḥ ca yonim asataḥ ca vivaḥ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Brahman, born first in the east, the seer uncovered from the shining boundary; he uncovered its deepest and its highest stations, the womb of what is and of what is not: may this mind of mine be of auspicious resolve."),

    V("v-34", "34",
      "Taittirīya Āraṇyaka 10.1 · Mahānārāyaṇa Upaniṣad hiraṇyagarbha sūkta 2 · Ṛgveda 10.121.3 · Vājasaneyi Saṁhitā 25.11 · Śivasaṅkalpopaniṣad 33 · Mahānyāsa 13.34",
      w="yaḥ prā̍ṇa̱to ni̍miṣa̱to ma̍hi̱tvaika̱ idrājā̱ jaga̍to ba̱bhūva̍ | ya īśe̍ a̱sya dvi̱pada̱ścatu̍ṣpada̱ḥ kasmai̍ de̱vāya̍ ha̱viṣā̍ vidhema̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yaḥ prāṇato nimiṣato mahitvaika id rājā",
         "jagato babhūva |",
         "ya īśe asya dvipadaḥ catuṣpadaḥ",
         "kasmai devāya haviṣā vidhema",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="He who by his greatness became the one king of the breathing and blinking world, who rules over this that is two-footed and four-footed — to which god shall we offer oblation? May this mind of mine be of auspicious resolve."),

    V("v-35", "35",
      "Taittirīya Āraṇyaka 10.1 · Mahānārāyaṇa Upaniṣad hiraṇyagarbha sūkta 3 · Ṛgveda 10.121.2 · Vājasaneyi Saṁhitā 25.13 · Śivasaṅkalpopaniṣad 34 · Mahānyāsa 13.35",
      w="ya ā̎tma̱dā ba̍la̱dā yasya̱ viśva̍ u̱pāsa̍te pra̱śiṣa̱ṁ yasya̍ de̱vāḥ | yasya̍ chā̱yā'mṛta̱ṁ yasya̍ mṛ̱tyuḥ kasmai̍ de̱vāya̍ ha̱viṣā̍ vidhema̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["ya ātmadā baladā yasya viśva upāsate",
         "praśiṣaṁ yasya devāḥ |",
         "yasya chāyā 'mṛtaṁ yasya mṛtyuḥ",
         "kasmai devāya haviṣā vidhema",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="He who gives the self and gives strength, whom all revere, whose command the gods obey; whose shadow is the deathless, whose shadow is death — to which god shall we offer oblation? May this mind of mine be of auspicious resolve."),

    V("v-36", "36",
      "Taittirīya Saṁhitā 5.5.9.3 · Śrī Rudram, upasaṁhāra · Śivasaṅkalpopaniṣad 35 · Mahānyāsa 13.36",
      w="yo ru̱dro a̱gnau yo a̱psu ya oṣa̍dhīṣu̱ yo ru̱dro viśvā̱ bhuva̍nāvi̱veśa̱ tasmai̍ ru̱drāya̱ namo̍ astu̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["yo rudro agnau yo apsu ya oṣadhīṣu",
         "yo rudro viśvā bhuvanā viveśa",
         "tasmai rudrāya namo astu",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="The Rudra who is in the fire, who is in the waters, who is in the plants; the Rudra who has entered all the worlds — to that Rudra be homage: may this mind of mine be of auspicious resolve.",
      wn=37),

    V("v-37", "37",
      "Taittirīya Āraṇyaka 10.1.47 · Mahānārāyaṇa Upaniṣad anuvāka 1 · Śrī Sūktam · Ṛgveda Khila 2.6.9 · Śivasaṅkalpopaniṣad 36 · Mahānyāsa 13.37",
      w="ga̱ndha̱dvā̱rāṁ du̍rādha̱rṣā̱ṁ ni̱tyapu̍ṣṭāṁ karī̱ṣiṇī̎m | ī̱śvarī̍ṁ sarva̍bhūtā̱nā̱ṁ tāmi̱hopa̍hvaye̱ śriya̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["gandhadvārāṁ durādharṣāṁ nityapuṣṭāṁ karīṣiṇīm |",
         "īśvarīṁ sarvabhūtānāṁ tām ihopahvaye śriyaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Her whose doorway is fragrance, unassailable, ever-nourishing, abounding in wealth — sovereign of all beings: her, Śrī, I call here: may this mind of mine be of auspicious resolve.",
      wn=36),

    V("v-38", "38",
      "Mahānyāsa 13.38 · the phalaśruti of the section; absent from the Śivasaṅkalpopaniṣad recension",
      w="namakaṁ cama̍kaṁ cai̱va̱ pu̱ruṣasū̎ktaṁ ca̱ yadvi̍duḥ | ma̱hā̱de̱vaṁ ca̍ tattu̱lya̱ṁ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["namakaṁ camakaṁ caiva",
         "puruṣasūktaṁ ca yad viduḥ |",
         "mahādevaṁ ca tattulyaṁ",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="The Namaka and the Camaka, and the Puruṣa Sūkta — what they know of these, and the Great God who is their equal: may this mind of mine be of auspicious resolve."),

    V("v-39", "39",
      "Śivasaṅkalpopaniṣad 37 · Mahānyāsa 13.39 · the phalaśruti of the section",
      w="ya idaṁ śiva̍saṅka̱lpa̱ṁ sa̱dā dhyā̍yanti̱ brāhma̍ṇāḥ | te para̍ṁ mokṣaṁ ga̍miṣya̱nti̱ tanme̱ mana̍ḥ śi̱vasa̍ṅka̱lpama̍stu",
      t=["ya idaṁ śivasaṅkalpaṁ sadā dhyāyanti brāhmaṇāḥ |",
         "te paraṁ mokṣaṁ gamiṣyanti",
         "tan me manaḥ śivasaṅkalpam astu"],
      tr="Those brāhmaṇas who ever meditate on this Śiva Saṅkalpa will go to the highest release: may this mind of mine be of auspicious resolve."),

    V("v-closing", None,
      "Mahānyāsa 13 · śivasaṅkalpāḥ · the closing hṛdaya nyāsa of the section",
      w="oṁ namo bhagavate̍ rudrā̱ya | śivasaṅkalpaṁ hṛdayāya namaḥ",
      t=["oṁ namo bhagavate rudrāya |",
         "śivasaṅkalpaṁ hṛdayāya namaḥ"],
      tr="Oṁ. Homage to the Lord Rudra. The Śiva-saṅkalpa — to the heart, homage."),
]




# --------------------------------------------------------------------------
# The recitation — the Challakere Brothers' Mahānyāsa track, cut by
# `align_shivasankalpa.py` at MMS forced-alignment boundaries snapped to the
# local energy dip. The cuts are gapless and cover the whole 694.4 s: mantra N
# ends exactly where N+1 begins, so there is no drift and no silence to sit
# through. `v-closing` has no clip — the track ends with mantra 39.
#
# Re-derive with:
#   align_shivasankalpa.py --audio <mp3> --cut   (writes _align_work/byverse.json)
# --------------------------------------------------------------------------
RECORDING = {
    "v-1": {"file": "v-1.mp3", "duration": 17.38},
    "v-2": {"file": "v-2.mp3", "duration": 16.5},
    "v-3": {"file": "v-3.mp3", "duration": 19.06},
    "v-4": {"file": "v-4.mp3", "duration": 17.25},
    "v-5": {"file": "v-5.mp3", "duration": 17.7},
    "v-6": {"file": "v-6.mp3", "duration": 19.18},
    "v-7": {"file": "v-7.mp3", "duration": 17.99},
    "v-8": {"file": "v-8.mp3", "duration": 16.9},
    "v-9": {"file": "v-9.mp3", "duration": 20.32},
    "v-10": {"file": "v-10.mp3", "duration": 18.38},
    "v-11": {"file": "v-11.mp3", "duration": 18.23},
    "v-12": {"file": "v-12.mp3", "duration": 16.56},
    "v-13": {"file": "v-13.mp3", "duration": 15.97},
    "v-14": {"file": "v-14.mp3", "duration": 17.54},
    "v-15": {"file": "v-15.mp3", "duration": 18.41},
    "v-16": {"file": "v-16.mp3", "duration": 20.03},
    "v-17": {"file": "v-17.mp3", "duration": 16.17},
    "v-18": {"file": "v-18.mp3", "duration": 16.42},
    "v-19": {"file": "v-19.mp3", "duration": 15.35},
    "v-20": {"file": "v-20.mp3", "duration": 14.54},
    "v-21": {"file": "v-21.mp3", "duration": 14.56},
    "v-22": {"file": "v-22.mp3", "duration": 16.19},
    "v-23": {"file": "v-23.mp3", "duration": 14.78},
    "v-24": {"file": "v-24.mp3", "duration": 17.3},
    "v-25": {"file": "v-25.mp3", "duration": 14.65},
    "v-26": {"file": "v-26.mp3", "duration": 13.71},
    "v-27": {"file": "v-27.mp3", "duration": 22.21},
    "v-28": {"file": "v-28.mp3", "duration": 15.2},
    "v-29": {"file": "v-29.mp3", "duration": 22.43},
    "v-30": {"file": "v-30.mp3", "duration": 23.09},
    "v-31": {"file": "v-31.mp3", "duration": 18.47},
    "v-32": {"file": "v-32.mp3", "duration": 21.54},
    "v-33": {"file": "v-33.mp3", "duration": 21.34},
    "v-34": {"file": "v-34.mp3", "duration": 20.24},
    "v-35": {"file": "v-35.mp3", "duration": 21.65},
    "v-36": {"file": "v-36.mp3", "duration": 16.97},
    "v-37": {"file": "v-37.mp3", "duration": 19.93},
    "v-38": {"file": "v-38.mp3", "duration": 14.42},
    "v-39": {"file": "v-39.mp3", "duration": 15.84},
}

# --------------------------------------------------------------------------
# sections — the recitation's own movements. Every verse ALSO carries its own
# `source`, because the loci differ mantra by mantra and a section source could
# only run them together in prose.
# --------------------------------------------------------------------------
#: The two pairs the RECITATION orders the other way round from the base
#: edition (see the module docstring). The verse table is written in recited
#: order, so entry 17 carries the base edition's mantra 18 and 36 carries its
#: 37. `build()` asserts that these — and only these — have a `w` line from a
#: different mantra, because `respace` compares a `w` only against its own `t`
#: and would let a mis-paired one through in silence.
SWAPPED = {("17", "18"), ("18", "17"), ("36", "37"), ("37", "36")}

SECTIONS = [
    ("sec-1", "I · The Vedic sūkta — mantras 1–15",
     "Ṛgveda Khila 4.11 · Vājasaneyi Saṁhitā 34.1–6 · with two ślokas of the "
     "Mahānyāsa compilation",
     ["v-%d" % i for i in range(1, 16)]),
    ("sec-2", "II · Beyond the beyond — mantras 16–28",
     "Mahānyāsa 13 · Śaiva ślokas, with Taittirīya Saṁhitā 1.8.6 and "
     "Taittirīya Āraṇyaka 10.1",
     ["v-%d" % i for i in range(16, 29)]),
    ("sec-3", "III · The Rudra mantras — mantras 29–37",
     "Taittirīya Saṁhitā 4.5.10, 5.5.9 · Taittirīya Āraṇyaka 10 · "
     "Mahānārāyaṇa Upaniṣad",
     ["v-%d" % i for i in range(29, 38)]),
    ("sec-4", "IV · Phalaśruti and the nyāsa — mantras 38–39",
     "Mahānyāsa 13 · the fruit of the recitation, and the closing hṛdaya nyāsa",
     ["v-38", "v-39", "v-closing"]),
]


def accented_lines(v):
    """The base edition's accents carried onto THIS document's word split.

    `respace` walks the two letter streams together and reports every letter
    where they disagree; the assertion below is what keeps the transcription
    honest — a difference outside the declared classes is a transcription
    error, and this is how it is seen (AUTHORING-CHANTS §5I).
    """
    w = v["w"]
    for before, after in v["subst"]:
        assert before in w, (v["id"], "subst no longer matches: %r" % before)
        w = w.replace(before, after)
    joined, diffs = respace(w, " // ".join(v["t"]))
    bad = [d for d in diffs if (d[1], d[2]) not in VISARGA_RESTORED]
    assert not bad, (v["id"], "undeclared letter differences: %r" % (bad,))
    return joined.split(" // "), len(diffs)


def verse_tokens(v):
    """Source lines -> reader tokens, with the accents re-attached.

    THE WHOLE VERSE IS ONE FRAGMENT, with ` // ` for each line break: a line
    break is neither a saṁyukta barrier nor an anusvāra barrier
    (MARKING-RULES §2.3), so marking line by line silently drops every
    cross-line mark. Order of operations is §7 — pauses, holdings, anusvāra,
    visarga, svarabhakti (all inside `line_tokens`), THEN the recension layer,
    and svara last: it is a data field and never moves a box.
    """
    lines, ndiff = accented_lines(v)
    cleans, accs = [], []
    for ln in lines:
        clean, acc = strip_accents(ln)
        cleans.append(clean)
        accs.append(acc)
    toks = line_tokens(" // ".join(cleans))
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
                raise SystemExit("%s: no vowel to accent in %r"
                                 % (v["id"], tk["iast"]))
        nucleus += 1
    for i, (acc, n) in enumerate(zip(accs, used)):
        assert len(acc) == n, (
            "%s line %d: %d accents recorded but %d attached — the syllable "
            "count moved" % (v["id"], i + 1, len(acc), n))
    apply_vedic_anusvara(toks)
    rebuild_iast(toks)
    if v["n"]:
        toks.append({"t": "num", "s": v["n"]})
        toks.append({"t": "danda", "s": "॥"})
    return toks, ndiff


def build():
    by_id = {v["id"]: v for v in VERSES}
    assert len(by_id) == len(VERSES), "duplicate verse id"
    # 39 numbered mantras + the closing nyāsa line. The count is what
    # distinguishes this text from the six-mantra and thirteen-mantra sūktas
    # that share its name, so it is asserted rather than assumed.
    numbered = [v for v in VERSES if v["n"]]
    assert len(numbered) == 39, len(numbered)
    assert [v["n"] for v in numbered] == [str(i) for i in range(1, 40)]
    moved = {(v["n"], v["wn"]) for v in numbered if v["wn"] != v["n"]}
    assert moved == SWAPPED, (
        "the witness lines that come from a different base-edition mantra are "
        "%s, but the declared swaps are %s" % (sorted(moved), sorted(SWAPPED)))

    missing, sections, total_diffs = [], [], 0
    used_overrides = set()
    for sid, label, ssrc, vids in SECTIONS:
        verses = []
        for vid in vids:
            v = by_id[vid]
            toks, ndiff = verse_tokens(v)
            total_diffs += ndiff
            surfaces = surfaces_of(toks)
            words = []
            for i, s in enumerate(surfaces):
                # A homograph is resolved per (verse, word index) first. The
                # key carries the surface it expects and `used` records which
                # keys fired, so neither a wrong index nor a stale one can
                # ship — see the header of `shivasankalpa_words.OVERRIDES`.
                entries = OVERRIDES.get((vid, i, s)) or WORDS.get(s)
                if (vid, i, s) in OVERRIDES:
                    used_overrides.add((vid, i, s))
                if entries is None:
                    missing.append((vid, s))
                    entries = []
                words.append({"surface": s, "entries": entries})
            # the invariant the whole format rests on (AUTHORING-CHANTS §7)
            assert len(words) == len(surfaces), (vid, len(words), len(surfaces))
            verses.append({
                "id": vid, "n": v["n"], "lineBreak": "source",
                "tokens": toks, "source": v["source"],
                "translation": {"en": v["tr"]}, "words": words,
            })
        sections.append({"id": sid, "label": label, "source": ssrc,
                         "verses": verses})
    assert sum(len(s["verses"]) for s in sections) == len(VERSES), \
        "a verse is in VERSES but in no section"
    stale = set(OVERRIDES) - used_overrides
    assert not stale, (
        "OVERRIDES keys that matched no word — a wrong verse id, a wrong word "
        "index, or a surface that has since changed: %s" % sorted(stale))
    if missing:
        print("MISSING GRAMMAR (%d):" % len(missing))
        seen = set()
        for vid, s in missing:
            if s in seen:
                continue
            seen.add(s)
            print("    %-24s %s" % (s, vid))
        raise SystemExit("every word needs a parse — AUTHORING-CHANTS §0.2")
    print("letter differences from the base edition: %d "
          "(all underlying visargas restored)" % total_diffs)
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
        "audioBase": "/tests/%s/audio/" % SLUG,
        "recording": {"byVerse": RECORDING},
        "sections": sections,
    }


def report(doc):
    nv = sum(len(s["verses"]) for s in doc["sections"])
    nw = sum(len(v["words"]) for s in doc["sections"] for v in s["verses"])
    holds = svaras = gum = pauses = sbh = 0
    longest, longest_line = 0, ""
    for s in doc["sections"]:
        for v in s["verses"]:
            line = []
            for tk in v["tokens"]:
                if tk["t"] == "syl":
                    line.append(tk["iast"])
                elif tk["t"] == "sp":
                    line.append(" ")
                elif tk["t"] == "pause":
                    pauses += 1
                    line.append(" | ")
                elif tk["t"] == "br":
                    if len("".join(line)) > longest:
                        longest, longest_line = len("".join(line)), "".join(line)
                    line = []
                if tk["t"] == "syl":
                    for u in tk["units"]:
                        holds += 1 if u.get("hold") else 0
                        svaras += 1 if u.get("svara") else 0
                        gum += 1 if u.get("candra") else 0
                        sbh += 1 if u.get("sbhakti") else 0
            if len("".join(line)) > longest:
                longest, longest_line = len("".join(line)), "".join(line)
    print("sections %d · verses %d · words %d" % (len(doc["sections"]), nv, nw))
    print("holdings %d · svara %d · gum %d · pauses %d · svarabhakti %d"
          % (holds, svaras, gum, pauses, sbh))
    print("longest rendered line: %d chars (keep under ~60) — %s"
          % (longest, longest_line.strip()))


def main():
    if "--surfaces" in sys.argv:
        # the way to re-derive the glossary keys after editing the text
        seen = {}
        for v in VERSES:
            for s in surfaces_of(verse_tokens(v)[0]):
                seen[s] = seen.get(s, 0) + 1
        for s in sorted(seen):
            print("%-26s %d%s" % (s, seen[s],
                                  "" if s in WORDS else "   <- NO GRAMMAR"))
        print("%d distinct surfaces" % len(seen))
        return
    if "--lines" in sys.argv:
        # every rendered line, for the no-wrap check and for the aligner
        for v in VERSES:
            for ln in accented_lines(v)[0]:
                print("%-10s %s" % (v["id"], ln))
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
