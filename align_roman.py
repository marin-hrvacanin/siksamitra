"""
align_roman.py — IAST / Devanagari → shared phone-token alphabet.

The unified aligner (align_fuse.py) compares the KNOWN text against the
faster-whisper transcript. Whisper, run with language='sa'/'hi', emits
Devanagari; the editor's text side is IAST. To compare them we fold BOTH into
one small, lossy phone alphabet so that phonetic *similarity* — not exact
script identity — drives the match.

Phone alphabet (21 symbols):
    vowels:      a i u e o
    consonants:  k g c j t d n p b m y r l v s h

Folding rationale (deliberately lossy, robust to ASR noise):
  * vowel length is dropped            (ā→a, ī→i, ū→u …)        — tempo varies
  * retroflex → dental                 (ṭ→t, ḍ→d, ṇ→n)
  * aspirates → unaspirated base       (kh→k, gh→g, …, थ→t)
  * all sibilants → s                  (ś, ṣ, s → s)
  * anusvāra / candrabindu → m, visarga → h
  * vocalic ṛ/ḷ → r/l

The function works on IAST, Devanagari, or a mix. IAST diacritics collapse to
their Latin base automatically via Unicode NFD + combining-mark stripping;
Devanagari is handled explicitly with inherent-'a' / virāma / mātrā logic.
"""

from __future__ import annotations

import unicodedata
from typing import List

# Latin base letter → phone (after NFD strips IAST diacritics: ā→a, ṭ→t, ś→s …)
_LATIN_MAP = {
    'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u',
    'k': 'k', 'g': 'g', 'c': 'c', 'j': 'j',
    't': 't', 'd': 'd', 'n': 'n',
    'p': 'p', 'b': 'b', 'm': 'm',
    'y': 'y', 'r': 'r', 'l': 'l', 'v': 'v', 'w': 'v',
    's': 's', 'h': 'h',
    # rough folds for stray romanizations
    'f': 'p', 'z': 'j', 'x': 'k', 'q': 'k',
}

_STOPS = frozenset(['k', 'g', 'c', 'j', 't', 'd', 'p', 'b'])

# Devanagari consonants → phone (aspirates already folded to base)
_DEVA_CONS = {
    'क': 'k', 'ख': 'k', 'ग': 'g', 'घ': 'g', 'ङ': 'n',
    'च': 'c', 'छ': 'c', 'ज': 'j', 'झ': 'j', 'ञ': 'n',
    'ट': 't', 'ठ': 't', 'ड': 'd', 'ढ': 'd', 'ण': 'n',
    'त': 't', 'थ': 't', 'द': 'd', 'ध': 'd', 'न': 'n',
    'प': 'p', 'फ': 'p', 'ब': 'b', 'भ': 'b', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
    'श': 's', 'ष': 's', 'स': 's', 'ह': 'h',
    'क़': 'k', 'ख़': 'k', 'ग़': 'g', 'ज़': 'j', 'ड़': 'd', 'ढ़': 'd', 'फ़': 'p', 'य़': 'y',
}

# Devanagari independent vowels → phone(s)
_DEVA_VOWEL = {
    'अ': ['a'], 'आ': ['a'], 'इ': ['i'], 'ई': ['i'], 'उ': ['u'], 'ऊ': ['u'],
    'ऋ': ['r'], 'ॠ': ['r'], 'ऌ': ['l'], 'ॡ': ['l'],
    'ए': ['e'], 'ऐ': ['a', 'i'], 'ओ': ['o'], 'औ': ['a', 'u'],
    'ऍ': ['e'], 'ऑ': ['o'], 'ॲ': ['a'],
    'ॐ': ['o', 'm'],
}

# Devanagari dependent vowel signs (mātrās) → phone(s)
_DEVA_MATRA = {
    'ा': ['a'], 'ि': ['i'], 'ी': ['i'], 'ु': ['u'], 'ू': ['u'],
    'ृ': ['r'], 'ॄ': ['r'], 'ॢ': ['l'], 'ॣ': ['l'],
    'े': ['e'], 'ै': ['a', 'i'], 'ो': ['o'], 'ौ': ['a', 'u'],
    'ॅ': ['e'], 'ॉ': ['o'],
}

_VIRAMA = '्'
_ANUSVARA = 'ं'
_CHANDRABINDU = 'ँ'
_VISARGA = 'ः'
_NUKTA = '़'
_AVAGRAHA = 'ऽ'


def _is_combining(ch: str) -> bool:
    return unicodedata.category(ch) == 'Mn'


def _is_devanagari(ch: str) -> bool:
    return 'ऀ' <= ch <= 'ॿ'


def to_phones(text: str) -> List[str]:
    """Fold IAST/Devanagari/mixed text into the shared phone-token list.

    Combining IAST diacritics are stripped via NFD. Devanagari is expanded
    with inherent-'a' handling. The result is a flat list of single-character
    phone tokens drawn from the 21-symbol alphabet above.
    """
    if not text:
        return []
    # NFD so IAST diacritics decompose; we then drop the combining marks.
    norm = unicodedata.normalize('NFD', str(text)).lower()

    out: List[str] = []
    cons_pending = False  # a Devanagari consonant awaiting its inherent 'a'

    def flush_inherent():
        nonlocal cons_pending
        if cons_pending:
            out.append('a')
            cons_pending = False

    for ch in norm:
        if _is_combining(ch):
            # IAST diacritic (already folded by NFD onto base) or a stray mark.
            # Devanagari vowel signs are NOT category Mn for the spacing ones,
            # but the dependent signs handled below are Mc/Mn — handle explicitly.
            if ch in _DEVA_MATRA:
                cons_pending = False
                out.extend(_DEVA_MATRA[ch])
            elif ch == _VIRAMA:
                cons_pending = False
            elif ch in (_ANUSVARA, _CHANDRABINDU):
                flush_inherent()
                out.append('m')
            elif ch == _VISARGA:
                flush_inherent()
                out.append('h')
            # else: drop (svara accents, nukta, etc.)
            continue

        if _is_devanagari(ch):
            if ch in _DEVA_CONS:
                flush_inherent()
                out.append(_DEVA_CONS[ch])
                cons_pending = True
            elif ch in _DEVA_VOWEL:
                flush_inherent()
                out.extend(_DEVA_VOWEL[ch])
            elif ch in _DEVA_MATRA:
                cons_pending = False
                out.extend(_DEVA_MATRA[ch])
            elif ch == _VIRAMA:
                cons_pending = False
            elif ch in (_ANUSVARA, _CHANDRABINDU):
                flush_inherent()
                out.append('m')
            elif ch == _VISARGA:
                flush_inherent()
                out.append('h')
            elif ch in (_NUKTA, _AVAGRAHA):
                continue
            else:
                # Devanagari digit / danda / unknown → treat as separator
                flush_inherent()
            continue

        # Latin / IAST base letter
        ph = _LATIN_MAP.get(ch)
        if ph is not None:
            flush_inherent()
            out.append(ph)
        else:
            # whitespace, punctuation, digits, danda → separator
            flush_inherent()

    flush_inherent()

    # Collapse aspirates produced by IAST digraphs (kh, gh, …, th, dh): an 'h'
    # immediately after a stop phone is the aspiration, not a separate /h/.
    # Devanagari never produces stop+h here, so this only normalizes the IAST
    # side to match the Devanagari side.
    collapsed: List[str] = []
    for ph in out:
        if ph == 'h' and collapsed and collapsed[-1] in _STOPS:
            continue
        collapsed.append(ph)
    return collapsed


def romanize(text: str) -> str:
    """Debug/test helper: the phone list joined into a string."""
    return ''.join(to_phones(text))
