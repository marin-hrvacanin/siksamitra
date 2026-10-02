/**
 * THE KAMPA, AS HIS ŚIKṢĀ WRITES IT — "śikṣā — the science of pronunciation"
 * v5: "There are 2 kinds of kampas or undulations: hrasva kampa or ucca nīca
 * kampa, 1̱̍ · dīrgha kampa or nīca ucca nīca kampa, 3̱̍".
 *
 * A Ṛgveda source wrote one in the manyu sūktam (`abravo३॒॑ऽस्माक॑म्`) and it came
 * out `3̱` — read mark by mark, its stroke above lost.
 */
import { describe, expect, it } from 'vitest';
import { KAMPA_CHAR, SVARA_TEXT, isKampa, kampaOf } from '../rules/svara.js';
import { witnessLine } from '../rules/witness.js';

const B = String.fromCodePoint(0x0331);
const A = String.fromCodePoint(0x030d);
const DB = String.fromCodePoint(0x0952);
const DA = String.fromCodePoint(0x0951);

describe('the kampa', () => {
  it('1̱̍ is the hrasva kampa and 3̱̍ the dīrgha: a digit, the line below and the stroke above', () => {
    expect(KAMPA_CHAR.get('kampa')).toBe(`1${B}${A}`);
    expect(KAMPA_CHAR.get('dirgha-kampa')).toBe(`3${B}${A}`);
  });

  it('is read as a source writes it — a Latin or Devanāgarī digit, its marks in either order or script', () => {
    for (const s of [`3${B}${A}`, `3${A}${B}`, `३${DB}${DA}`, `३${B}${A}`]) expect(kampaOf(s), s).toBe('dirgha-kampa');
    expect(kampaOf(`1${B}${A}`)).toBe('kampa');
    expect(kampaOf(`१${DB}${DA}`)).toBe('kampa');
  });

  it('and nothing else is one: a verse number, the marks alone, a digit with one mark, another digit', () => {
    for (const s of ['3', '॥ 3॥', `${B}${A}`, `3${B}`, `2${B}${A}`]) expect(kampaOf(s), s).toBeUndefined();
  });

  it('is written back after its vowel as its digit and marks', () => {
    expect(witnessLine([{ c: 'v' }, { c: 'o', svara: 'dirgha-kampa' }, { c: 's' }])).toBe(`vo3${B}${A}s`);
  });

  it('is a kampa — the other svaras are marks', () => {
    expect(isKampa('kampa') && isKampa('dirgha-kampa')).toBe(true);
    expect(isKampa('svarita') || isKampa(undefined)).toBe(false);
    expect(SVARA_TEXT.get('svarita')).toBe(A);
  });
});
