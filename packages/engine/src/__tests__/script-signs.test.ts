/**
 * What a script writes that is not a letter, and what a style may not cut:
 * `script/signs.ts`. Every expectation is a constant written out by hand.
 */
import { describe, expect, it } from 'vitest';
import { toIast, transliterate, transliterateSyllable } from '../script/index.js';
import { CANDRA_SIGN, SCRIPT_DIGITS, digitsFrom, digitsIn, scriptClusters } from '../script/signs.js';

describe('a vowel after something that is not a consonant', () => {
  it('is written in full, never as a sign on the bracket', () => {
    const open = [{ c: '(' }, { c: 'i' }];
    expect(transliterateSyllable(open, 'deva')).toBe('(इ');
    expect(transliterateSyllable(open, 'tel')).toBe('(ఇ');
    expect(transliterateSyllable(open, 'tam')).toBe('(இ');
  });

  it('is still a sign when a consonant follows the bracket', () => {
    expect(transliterateSyllable([{ c: '(' }, { c: 't' }, { c: 'i' }], 'deva')).toBe('(ति');
    expect(transliterateSyllable([{ c: '(' }, { c: 't' }, { c: 'i' }], 'tam')).toBe('(தி');
  });

  it('reads back as the letters it was written from', () => {
    for (const script of ['deva', 'tel', 'tam'] as const) {
      expect(toIast(transliterate('(ityu', script), script).iast).toBe('(ityu');
    }
  });
});

describe('digits and the candrabindu, per script', () => {
  it('writes a verse number in the script it is in, and reads it back', () => {
    expect(digitsIn('14.2', 'deva')).toBe('१४.२');
    expect(digitsIn('14.2', 'tel')).toBe('౧౪.౨');
    expect(digitsIn('14.2', 'tam')).toBe('௧௪.௨');
    expect(digitsIn('14.2', 'iast')).toBe('14.2');
    for (const script of ['deva', 'tel', 'tam'] as const) {
      expect(digitsFrom(digitsIn('0123456789', script), script)).toBe('0123456789');
      expect([...SCRIPT_DIGITS[script]]).toHaveLength(10);
    }
  });

  it('has a candrabindu for every script, Tamil borrowing Grantha’s', () => {
    expect(CANDRA_SIGN).toEqual({ iast: '̐', deva: 'ँ', tel: 'ఀ', tam: '\u{11300}' });
  });
});

describe('the clusters a style may not cut', () => {
  it('keeps a conjunct whole', () => {
    expect(scriptClusters('क्षत्रिय', 'deva').map((c) => c.segment)).toEqual(['क्ष', 'त्रि', 'य']);
  });

  it('keeps Tamil’s qualifier and its ṛ approximation with their letters', () => {
    const t = transliterate('nṛbhir gho', 'tam', { lossless: true });
    expect(t).toBe('ந்ரு\'பி⁴ர் கோ⁴');
    expect(scriptClusters(t, 'tam')).toEqual([
      { segment: 'ந்', index: 0 }, { segment: 'ரு\'', index: 2 }, { segment: 'பி⁴', index: 5 },
      { segment: 'ர்', index: 8 }, { segment: ' ', index: 10 }, { segment: 'கோ⁴', index: 11 },
    ]);
  });

  it('keeps a space apart from a mark typed after it, which Unicode would join', () => {
    expect(scriptClusters('म् ̐', 'deva').map((c) => c.segment)).toEqual(['म्', ' ', '̐']);
    expect(scriptClusters(' ̐', 'tam').map((c) => [c.segment, c.index])).toEqual([[' ', 0], ['̐', 1]]);
  });

  it('never loses or reorders a character', () => {
    for (const w of ['saṁskṛtaṁ', 'kṛṣṇa', 'jñānaṁ', 'śrīḥ']) {
      for (const script of ['deva', 'tel', 'tam'] as const) {
        const text = transliterate(w, script, { lossless: true });
        expect(scriptClusters(text, script).map((c) => c.segment).join('')).toBe(text);
      }
    }
  });
});
