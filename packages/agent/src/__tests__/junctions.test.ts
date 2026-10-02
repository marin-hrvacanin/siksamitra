/**
 * HIS JUNCTIONS — the words apart, as the model gives them, and his line.
 *
 * Every right-hand side is a line of his `bhū sūktam v1.1`, as his page has
 * it; the left is the same line as a model gives it: words apart, the letters
 * as the source joins them. Every hyphen in his corpus — 312 of 312 — has a
 * vowel before it and a consonant after; the rule is written from that.
 */
import { describe, expect, it } from 'vitest';
import { hisJunctions } from '../junctions.js';
import { withSourceDandas } from '../letters.js';

const his = (words: string, line: string): void => { expect(hisJunctions(words)).toBe(line.normalize('NFC')); };

describe('a last consonant that takes the next word’s vowel', () => {
  it('is joined, with his hyphen after that vowel — its svara with it', () => {
    his("u̱pasthe̍ te devy adite̱'gnim a̍nnā̱dam a̱nnādyā̱yā''da̍dhe ॥", "u̱pasthe̍ te devya-dite̱'gnima̍-nnā̱dama̱-nnādyā̱yā''da̍dhe ॥");
    his('puna̍r ū̱rjā ni va̍rtasva̱ puna̍r agna i̱ṣā\'\'yu̍ṣā ।', "puna̍rū̱-rjā ni va̍rtasva̱ puna̍ra-gna i̱ṣā''yu̍ṣā ।");
    his('yatte̍ ma̱nyu pa̍roptasya pṛthi̱vīm anu̍ dadhva̱se ।', 'yatte̍ ma̱nyu pa̍roptasya pṛthi̱vīma-nu̍ dadhva̱se ।');
    his('ma̱hīṁ de̱vīṁ viṣṇu̍patnīm ajū̱ryām ।', 'ma̱hīṁ de̱vīṁ viṣṇu̍patnīma-jū̱ryām ।');
  });
  it('again and again along a line', () => {
    his("ā'yaṅ gauḥ pṛśni̍r akramī̱d asa̍nan mā̱tara̱m puna̍ḥ ।", "ā'yaṁ gauḥ pṛśni̍ra-kramī̱da-sa̍nan mā̱tara̱ṁ puna̍ḥ ।");
    his('mano̱ jyoti̍r juṣatā̱m ājya̱ṁ vicchi̍nnaṁ ya̱jñaṁ sam i̱maṁ da̍dhātu ।', 'mano̱ jyoti̍r juṣatā̱mā-jya̱ṁ vicchi̍nnaṁ ya̱jñaṁ sami̱-maṁ da̍dhātu ।');
  });
  it('a word that is its vowel alone joins on to the word after it', () => {
    his('sa̱pta yonī̱r ā pṛ̍ṇasvā ghṛ̱tena̍ ॥', 'sa̱pta yonī̱rā-pṛ̍ṇasvā ghṛ̱tena̍ ॥');
  });
});

describe('the words as he types them', () => {
  it('a last m before a consonant is the anusvāra; before a daṇḍa it stays', () => {
    his("bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।", "bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣaṁ mahi̱tvā ।");
    expect(hisJunctions('ajū̱ryām ।')).toBe('ajū̱ryām ।');
  });
  it('a ṅ or ñ before its own class is the anusvāra; an n is its own', () => {
    his('pi̱tara̍ñ ca pra̱yanth suva̍ḥ ॥', 'pi̱tara̍ṁ ca pra̱yanth suva̍ḥ ॥');
    expect(hisJunctions('asa̍nan mā̱taram')).toBe('asa̍nan mā̱taram');
  });
  it('a sibilant a visarga became, before the same sibilant, is the visarga', () => {
    his('vya̍khyan mahi̱ṣas suva̍ḥ ॥', 'vya̍khyan mahi̱ṣaḥ suva̍ḥ ॥');
    his('śānti̱ś śānti̱ś śānti̍ḥ ॥', 'śānti̱ḥ śānti̱ḥ śānti̍ḥ ॥');
  });
  it('a last n doubled for a vowel that is not there is one n — his “sa̱mābha̍ran ॥ 6॥”', () => {
    his('ā̱di̱tyā viśve̱ tad de̱vā vasa̍vaś ca sa̱mābha̍rann ॥', 'ā̱di̱tyā viśve̱ tad de̱vā vasa̍vaś ca sa̱mābha̍ran ॥');
    expect(hisJunctions('sa̱mābha̍rann')).toBe('sa̱mābha̍ran');
    /* Not inside a line, where the vowel it is doubled for follows. */
    expect(hisJunctions('sa̱mābha̍rann i̱ha')).toBe('sa̱mābha̍ranni̱-ha');
  });
  it('but ś before c stays — his “a̍ntaś ca̍rati”, “vasa̍vaś ca”', () => {
    expect(hisJunctions('a̍ntaś ca̍rati')).toBe('a̍ntaś ca̍rati');
  });
});

describe('what never joins', () => {
  it('an anusvāra or a visarga before a vowel — his “viva̍svā̱ṁ̱ adi̍ti̱r”', () => {
    expect(hisJunctions('viva̍svā̱ṁ̱ adi̍ti̱r deva̍jūti̱s')).toBe('viva̍svā̱ṁ̱ adi̍ti̱r deva̍jūti̱s');
    expect(hisJunctions('sa̱midha̍ḥ ā')).toBe('sa̱midha̍ḥ ā');
  });
  it('a vowel before a vowel — his “ādi̱tyā ājya̍ṁ”', () => {
    expect(hisJunctions('ādi̱tyā ājya̍ṁ')).toBe('ādi̱tyā ājya̍ṁ');
  });
  it('a word across a daṇḍa', () => {
    expect(hisJunctions('mahi̱tvām । ā')).toBe('mahi̱tvām । ā');
  });
});

describe('the source’s daṇḍas, where his lines end with them', () => {
  const SOURCE = ['ओम् ॥ ओ-म्भूमि॑र्भू॒म्ना द्यौर्व॑रि॒णा-ऽन्तरि॑क्ष-म्महि॒त्वा ।', 'उ॒पस्थे॑ ते देव्यदिते॒-ऽग्निम॑न्ना॒द-म॒न्नाद्या॒याद॑धे ॥'];
  it('a half-line the model left open is closed as the source closes it', () => {
    expect(withSourceDandas(SOURCE, ['bhūmi̍r bhū̱mnā', 'u̱pasthe̍ te'])).toEqual(['bhūmi̍r bhū̱mnā ।', 'u̱pasthe̍ te']);
  });
  it('the last line is the builder’s to close, with its number', () => {
    expect(withSourceDandas(SOURCE, ['a ।', 'b'])[1]).toBe('b');
  });
  it('and lines set otherwise than the source’s are left as given', () => {
    expect(withSourceDandas(SOURCE, ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});
