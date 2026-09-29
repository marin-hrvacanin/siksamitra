/**
 * WHAT A REPLACED LETTER WAS TYPED AS — one answer for the inverter, the
 * importer and the styles. Every form the corpus's 971 substitutions take.
 */
import { describe, expect, it } from 'vitest';
import { typedAs } from '../index.js';

describe('typedAs', () => {
  for (const c of ['m', 'ñ', 'n', 'ṁ', 'm̐', 'ṅ', 'ṇ', 'gṁ', 'ggṁ']) {
    it(`${c} was an anusvāra`, () => expect(typedAs(c)).toBe('ṁ'));
  }
  for (const c of ['ś', 's', 'ṣ', 'ḥ', 'r', ':']) {
    it(`${c} was a visarga`, () => expect(typedAs(c)).toBe('ḥ'));
  }
  it('the two sets never meet — no letter is both', () => {
    for (const c of ['m', 'n', 's', 'r', 'ḥ', 'ṁ']) expect(['ṁ', 'ḥ']).toContain(typedAs(c));
  });
  for (const c of ['a', 'k', 'y', 'l', 'v', '', 'x', 'ā']) {
    it(`${JSON.stringify(c)} is neither — nothing is guessed`, () => expect(typedAs(c)).toBeUndefined());
  }
  it('a precomposed and a decomposed m̐ are the same letter', () => {
    expect(typedAs('m̐'.normalize('NFD'))).toBe('ṁ');
  });
});
