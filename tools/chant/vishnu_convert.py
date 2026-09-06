# -*- coding: utf-8 -*-
"""VedaVMS accented Taittirīya notation  ->  Veda Union source IAST.

A DEV helper, run once by hand: it does the mechanical part of transcribing the
primary witness (VedaVMS's accented Latin Taittirīya books) into the source form
`gen_vishnu.py` carries, so the ACCENTS — the part that must never be retyped —
travel as data instead of by eye.

VedaVMS already writes svara in Veda Union's own three code points
(docs/MARKING-RULES.md §1), with one fold: it uses U+0332 COMBINING LOW LINE for
anudātta where VU uses U+0331. Everything else here is letters.

What it converts
  U+0332 -> U+0331            anudātta (MARKING-RULES §1's normalisation table)
  (gm) (gg) -> ṁ              the gum, back to the UNDERLYING anusvāra: VU
                              derives the g/gg/gṁ reading aid from the rule
                              (MARKING-RULES §4), it is never authored
  m̐ before v/y -> dropped     same reason — the nasal is the preceding ṁ
  ṃ -> ṁ                      VU spells the anusvāra with the dot above
  ō ē -> o e                  the TB books mark e/o long; IAST does not
  ch -> c, Ch -> ch           VedaVMS writes the palatal as `ch`
  thsa -> tsa                 `ths` is VedaVMS's guard against reading `ts`
  :' -> '                     avagraha
  de-gemination               `pārtthivāni` -> `pārthivāni`, `maddhya` ->
                              `madhya`. This is the HOUSE convention, read off
                              the owner's own Taittirīya files, which print
                              `madhye` / `sādhyā` and not VedaVMS's geminates.

What it does NOT do — left to the hand, and to `--verify`
  * lineation (`br`), verse splits, verse numbers
  * vowel sandhi VU writes already applied (`aḥ` + voiced -> `o`)
  * VedaVMS's word-splitting (`ṇa stre` for `ṇas tre`, `pratad-viṣṇuḥ`)
"""
import re, sys, unicodedata

ANUDATTA, SVARITA, DIRGHA, CANDRA = "̱", "̍", "̎", "̐"
MARKS = {ANUDATTA, SVARITA, DIRGHA, CANDRA, "̲"}

# consonant + `h` pairs whose doubling VedaVMS writes and the house does not
# NARROW ON PURPOSE. A blanket `tth`->`th` ate the `tth` of `itthā`, which is a
# real geminate in a real word; a blanket `nn`->`n` ate the Taittirīya pāda-final
# `daśasyann` / `dhārayann`, which the primary witness and vignanam both print.
# Only the doublings VedaVMS itself introduces are undone.
_GEM = [("rtth", "rth"), ("ddhy", "dhy"), ("ddhv", "dhv")]


def convert(s):
    s = s.replace("̲", ANUDATTA)
    s = re.sub(r"\(g[gm]\)", "ṁ", s)          # the gum -> ṁ
    s = s.replace("m" + CANDRA, "")                # nasal already carried by ṁ
    s = s.replace("ṃ", "ṁ")              # ṃ -> ṁ
    # a BARE gum: VedaVMS parenthesises it as `(gm)` inside a word but writes it
    # plain before a pause — `tveṣagg hyasya`, `padagṁ sadā`. `gg`/`gṁ` after a
    # vowel is never two real letters in this corpus, so it is safe to fold, and
    # folding it is what keeps the letter streams 1:1 in `respace`.
    s = re.sub(r"(?<=[aāiīuūeoṛ])g[gṁ]", "ṁ", s)
    s = s.replace("ō", "o").replace("ē", "e")   # ō ē
    s = s.replace("Ch", "ch_TMP").replace("ch", "c").replace("ch_TMP", "ch")
    s = s.replace("ths", "ts")
    s = s.replace(":'", "'")
    for a, b in _GEM:
        s = s.replace(a, b)
    s = re.sub(r"[।॥]", "|", s)          # ।/॥ -> the source's pause mark
    s = re.sub(r"\s+", " ", s).strip()
    return s


def letters(s):
    """[(letter, marks)] — the accented string as a letter stream.

    Spaces, pause marks and VedaVMS's join hyphens are dropped: they are exactly
    what `respace` is for. Two-character IAST letters are kept whole so a mark
    can never be re-attached to the wrong half of `kh`/`ai`.
    """
    from gen_marks import TWO
    out, i = [], 0
    while i < len(s):
        ch = s[i]
        if ch in " |-":
            i += 1
            continue
        if ch in MARKS:                       # a stray mark before any letter
            if out:
                out[-1][1].append(ch)
            i += 1
            continue
        two = s[i:i + 2]
        if two in TWO:
            ch = two
        out.append([ch, []])
        i += len(ch)
        while i < len(s) and s[i] in MARKS:
            out[-1][1].append(s[i])
            i += 1
    return out


def respace(accented, target):
    """Carry the witness's ACCENTS onto MY word-split and underlying spelling.

    `target` is typed WITHOUT accents — the whole point, so that the one thing
    that must never be retyped by eye travels as data. It supplies:
      * the word boundaries (VedaVMS writes `ṇa stre` for `ṇas tre`, joins
        `viṣṇoḥpade`, hyphenates `pratad-viṣṇuḥ`),
      * the UNDERLYING spelling the pipeline wants — an un-assimilated `ḥ`
        where the witness prints the assimilated letter, `ṁ` before a consonant
        (docs/AUTHORING-CHANTS.md §5A-bis step 1).

    Returns (source_line, diffs). Every letter where the two disagree is
    reported; each one has to be a DECLARED decision (see `DIFFS` in
    gen_vishnu.py), never a silent edit of scripture.
    """
    from gen_marks import TWO
    src = letters(accented)
    out, diffs, k = [], [], 0
    i = 0
    while i < len(target):
        ch = target[i]
        if ch in " |/":          # `/` = my reader line break: passes through,
            out.append(ch)       # it must NOT consume a witness letter
            i += 1
            continue
        two = target[i:i + 2]
        if two in TWO:
            ch = two
        if k >= len(src):
            diffs.append((k, "-", ch))
            out.append(ch)
            i += len(ch)
            continue
        w, marks = src[k]
        if w != ch:
            diffs.append((k, w, ch))
        out.append(ch + "".join(marks))
        k += 1
        i += len(ch)
    if k < len(src):
        diffs.extend((j, src[j][0], "-") for j in range(k, len(src)))
    return "".join(out), diffs


def bare(s):
    """letters only — no accents, no punctuation, no spaces (for --verify)."""
    return re.sub(r"[^a-zà-ỿ]", "", "".join(
        c for c in s if c not in MARKS).lower())


def accents(s):
    """(nucleus index, svara) list — the accent skeleton, for --verify."""
    sys.path.insert(0, ".")
    from gen_vishnu import ACC_OF          # the one source of truth
    return ACC_OF(s)


if __name__ == "__main__":
    import json, os
    src = json.load(open(sys.argv[1], encoding="utf-8"))
    for k in sorted(src, key=lambda x: (len(x), x)):
        print(k, "::", convert(src[k]))
