/**
 * A VEDIC TEXT IN DEVANĀGARĪ, READ AS ITS IAST IS WRITTEN.
 *
 * vignanam.org's bhū sūktam (2026-10-02) writes three things the way
 * Devanāgarī typesetting does and his IAST does not: a svara at the end of the
 * akṣara, after the visarga or the anusvāra (`नमः॑`, `श्लोकं॒`); the visarga
 * before p as the upadhmānīya sign (`क्रु॒द्धᳶ`); and the gum with a svara of
 * its own (`त्रि॒ꣳ॒शद्`). Each expectation is his IAST, written out by hand.
 */
import { describe, expect, it } from 'vitest';
import { normalize, spelling, toIast } from '../index.js';

const read = (deva: string): string => normalize(toIast(deva, 'deva').iast).text.normalize('NFC');

describe('a svara set after the visarga or the anusvāra', () => {
  it('is its vowel’s', () => {
    expect(read('पुनः॑')).toBe('puna̍ḥ');
    expect(read('नमः॑ शि॒वाय॑')).toBe('nama̍ḥ śi̱vāya̍');
    expect(read('श्लोकं॒')).toBe('śloka̱ṁ');
    expect(read('शान्तिः॑ ॥')).toContain('śānti̍ḥ');
  });
  it('but the gum keeps a svara of its own', () => {
    expect(read('त्रि॒ꣳ॒शद्धाम॒')).toBe('tri̱ṁ̱śaddhāma̱');
  });
  it('and a visarga with no svara after it is untouched', () => {
    expect(read('पुनः')).toBe('punaḥ');
  });
});

describe('the y, v or l an anusvāra nasalises, spelt out', () => {
  it('is the anusvāra alone, as his texts write it', () => {
    expect(read('म॒हीन्दे॒वीं-विँष्णु॑पत्नी')).toBe('ma̱hīnde̱vīṁ-viṣṇu̍patnī');
    expect(read('श्लोकं॒-यँज॑मानाय')).toBe('śloka̱ṁ-yaja̍mānāya');
    expect(read('ल॒क्ष्मीं-लँ॒क्ष्मीः')).toContain('ṁ-la̱');
  });
  it('but a candrabindu after anything else is the letter it is', () => {
    expect(read('सँ')).toBe('saṁ');
  });
});

describe('the visarga spelt as it is said', () => {
  it('the upadhmānīya before p, and the jihvāmūlīya before k, are the visarga', () => {
    expect(read('क्रु॒द्धᳶ प॑रो॒वप॑')).toBe('kru̱ddhaḥ pa̍ro̱vapa̍');
    expect(read('यᳵ कः')).toBe('yaḥ kaḥ');
  });
  it('and copied into IAST as they stand, they are folded the same way', () => {
    expect(normalize('kru̱ddhaᳶ pa̍ro̱vapa̍').text).toBe('kru̱ddhaḥ pa̍ro̱vapa̍');
    expect(normalize('kru̱ddhaᳶ pa̍ro̱vapa̍').changes.map((c) => c.rule)).toContain('visarga.vedic-sign');
  });
});

describe('an IAST line from a source, spelt as his texts spell', () => {
  it('long e and o, the anudātta sign, the Vedic visarga and the written gum are his', () => {
    expect(spelling('dē̠vī hi̍raṇyaga̠rbhiṇī̍ dē̠vī pra̍sō̠darī̎')).toBe('de̱vī hi̍raṇyaga̱rbhiṇī̍ de̱vī pra̍so̱darī̎');
    expect(spelling("ā'yaṅ gauᳶ pṛśni̍r")).toBe("ā'yaṅ gauḥ pṛśni̍r");
    expect(spelling('pra̱tīcī̍menāgm̐ ha̱viṣā̍')).toBe('pra̱tīcī̍menāṁ ha̱viṣā̍');
    expect(spelling('ॐ śānti̍ḥ')).toBe('oṁ śānti̍ḥ');
  });
  it('and nothing that is only a page’s punctuation or casing', () => {
    expect(spelling('1.5.3 — a+b (=x) _y. Om')).toBe('1.5.3 — a+b (=x) _y. Om');
  });
});
