"""Tests for align_roman: IAST/Devanagari → shared phone alphabet (T011)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from align_roman import to_phones, romanize


def test_basic_iast_folds():
    assert romanize('a') == 'a'
    assert romanize('ā') == 'a'          # long vowel folds to short
    assert romanize('ī') == 'i'
    assert romanize('ū') == 'u'
    assert romanize('ṛ') == 'r'          # vocalic r → r
    assert romanize('ś') == 's'          # all sibilants → s
    assert romanize('ṣ') == 's'
    assert romanize('ṭ') == 't'          # retroflex → dental
    assert romanize('ḍ') == 'd'
    assert romanize('ṇ') == 'n'
    assert romanize('ṅ') == 'n'
    assert romanize('ñ') == 'n'
    assert romanize('ṁ') == 'm'          # anusvāra → m
    assert romanize('ḥ') == 'h'          # visarga → h


def test_aspirates_fold_to_base():
    assert romanize('kha') == 'ka'
    assert romanize('gha') == 'ga'
    assert romanize('dha') == 'da'
    assert romanize('bha') == 'ba'
    assert romanize('tha') == 'ta'


def test_iast_devanagari_parity():
    # The whole design rests on these folding to the SAME phone string.
    pairs = [
        ('agnimīḷe', 'अग्निमीळे'),
        ('somam', 'सोमम्'),
        ('bhadraṁ', 'भद्रं'),
        ('namaste', 'नमस्ते'),
        ('puruṣa', 'पुरुष'),
    ]
    for iast, deva in pairs:
        assert romanize(iast) == romanize(deva), (iast, romanize(iast), romanize(deva))


def test_devanagari_inherent_a():
    # नम = na + ma (inherent a on both consonants)
    assert romanize('नम') == 'nama'
    # नम् = na + m (virama suppresses final inherent a)
    assert romanize('नम्') == 'nam'


def test_empty_and_punctuation():
    assert to_phones('') == []
    assert to_phones('   ') == []
    assert to_phones('| ॥ 123') == []
