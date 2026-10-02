/**
 * WHAT "THE SAME LETTERS" MEANS — vignanam's bhū sūktam against his.
 *
 * A real request (2026-10-02) built the bhū sūktam from vignanam.org, which
 * writes each junction as it is said, where his page writes the words and
 * leaves how they are said to the rules. Every pair here is a line of that
 * source and the same line of his `bhū sūktam v1.1`: the first group must
 * compare equal, the second must not — a difference of reading is not a
 * difference of spelling, and the bot must never paper one over.
 */
import { describe, expect, it } from 'vitest';
import { letterChange, strictLetters } from '../letters.js';

const same = (source: string, his: string): void => { expect(strictLetters(his)).toBe(strictLetters(source)); };
const differ = (source: string, his: string): void => { expect(strictLetters(his)).not.toBe(strictLetters(source)); };

describe('one sound, two spellings — equal', () => {
  it('a nasal before a consonant is the anusvāra', () => {
    same('आ-ऽयङ्गौः पृश्नि॑रक्रमी॒-दस॑नन्मा॒तर॒-म्पुनः॑ ।', "ā'yaṁ gauḥ pṛśni̍ra-kramī̱da-sa̍nan mā̱tara̱ṁ puna̍ḥ ।");
    same('पि॒तर॑-ञ्च प्र॒यन्-थ्सुवः॑ ॥', 'pi̱tara̍ṁ ca pra̱yanth suva̍ḥ ॥ 2॥');
  });
  it('a sibilant a visarga became is the visarga', () => {
    same('ॐ शान्ति॒-श्शान्ति॒-श्शान्तिः॑ ॥', '॥ oṁ śānti̱ḥ śānti̱ḥ śānti̍ḥ ॥');
  });
  it('a svara set after the visarga is its vowel’s', () => {
    same('पुनः॑', 'puna̍ḥ');
  });
  it('a final n doubled for a vowel that is not on the line is one n', () => {
    same('आ॒दि॒त्या विश्वे॒ तद्दे॒वा वस॑वश्च स॒माभ॑रन्न् ॥', 'ā̱di̱tyā viśve̱ tad de̱vā vasa̍vaś ca sa̱mābha̍ran ॥ 6॥');
  });
  it('the y or v an anusvāra nasalises, spelt out, is not a letter', () => {
    same('श्लोकं॒-यँज॑मानाय', 'śloka̱ṁ yaja̍mānāya');
    same('म॒हीन्दे॒वीं-विँष्णु॑पत्नी', 'ma̱hīṁ de̱vīṁ viṣṇu̍patnī');
  });
  it('the gum written as gg is the anusvāra it stands for', () => {
    same('पुण्य॒ग्ग्॒ श्लोकं॒', 'puṇya̱ṁ̱ śloka̱ṁ');
  });
});

describe('a difference of reading — not equal', () => {
  it('a svara in another place', () => {
    differ('प्रती॒ची॑मेनाग्ं', 'pra̱tīcī̍me-nāṁ');
  });
  it('a visarga the source does not have', () => {
    differ('तन्नो॑ धरा प्रचो॒दया᳚त्', 'tanno̍ dharāḥ praco̱dayā̎t');
  });
  it('an anudātta the source does not have', () => {
    differ('तच्छ्रो॒णैति श्रव॑', 'tac chro̱ṇai-ti̱ śrava̍');
  });
  it('an m where nothing follows is not an anusvāra', () => {
    differ('tam', 'taṁ');
  });
  it('a nasal before a vowel is not one either', () => {
    differ('tam asi', 'taṁ asi');
  });
});

describe('his lines, where the source has fewer', () => {
  const ONE = ['म॒हीन्दे॒वीं-विँष्णु॑पत्नी मजू॒र्या-म्प्रती॒ची॑मेनाग्ं ह॒विषा॑ यजामः ॥'];
  it('one source line set as two of his is the same letters', () => {
    expect(letterChange(ONE, ['ma̱hīṁ de̱vīṁ viṣṇu̍patnīma-jū̱ryām ।', 'pratī̱cī̍me-nāṁ ha̱viṣā̍ yajāmaḥ ॥'])).toBeNull();
  });
  it('and a letter changed across them is still found, and said where', () => {
    expect(letterChange(ONE, ['ma̱hīṁ de̱vīṁ viṣṇu̍patnīma-jū̱ryām ।', 'pra̱tīcī̍me-nāṁ ha̱viṣā̍ yajāmaḥ ॥']))
      .toMatch(/its lines: spaced changes a letter at ".*pra̱tī/);
  });
});

describe('an opening oṁ', () => {
  const FIRST = ['ओम् ॥ ओ-म्भूमि॑र्भू॒म्ना द्यौर्व॑रि॒णा-ऽन्तरि॑क्ष-म्महि॒त्वा ।'];
  it('a source’s — alone, and joined to the first word — may be left out: his bhū sūktam begins with bhūmi', () => {
    expect(letterChange(FIRST, ["bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣaṁ mahi̱tvā ।"])).toBeNull();
  });
  it('or one of them kept, or both', () => {
    expect(letterChange(FIRST, ["o-m bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣaṁ mahi̱tvā ।"])).toBeNull();
    expect(letterChange(FIRST, ["om ॥ o-m bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣaṁ mahi̱tvā ।"])).toBeNull();
  });
  it('but never added', () => {
    expect(letterChange(['भूमि॑र्भू॒म्ना'], ['oṁ bhūmi̍r bhū̱mnā'])).toMatch(/spaced changes a letter/);
  });
  it('and only where the text begins', () => {
    expect(letterChange(FIRST, ["bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣaṁ mahi̱tvā ।"], false)).toMatch(/spaced changes a letter/);
  });
});
