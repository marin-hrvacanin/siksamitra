/**
 * Which script a Word line is written in — by its letters. The accents and
 * the daṇḍas are written in every script and are evidence of nothing
 * (`word/script-reader.ts`).
 */
import { describe, expect, it } from 'vitest';
import { scriptOfLine, wordScript } from '../word/script-reader.js';

describe('the script of a line', () => {
  it('is its letters’', () => {
    expect(scriptOfLine('agnim īḻe purohitam')).toBe('iast');
    expect(scriptOfLine('अग्निमीळे पुरोहितम्')).toBe('deva');
    expect(scriptOfLine('అగ్నిమీళే పురోహితమ్')).toBe('tel');
    expect(scriptOfLine('அக்³னிமீளே')).toBe('tam');
  });

  it('is not changed by the Vedic accents, which are Devanāgarī’s characters in every script', () => {
    expect(scriptOfLine('అ॒గ్నిమీ॑ళే')).toBe('tel');
    expect(scriptOfLine('அ॒க்³னி᳚')).toBe('tam');
  });

  it('is not changed by a daṇḍa', () => {
    expect(scriptOfLine('అగ్ని ॥ 1 ॥')).toBe('tel');
    expect(scriptOfLine('agnim ॥')).toBe('iast');
  });

  it('is the one most of its words are in, when two are mixed', () => {
    expect(scriptOfLine('अग्निम् అగ్ని అగ్ని')).toBe('tel');
  });

  it('is IAST when there are no letters at all', () => {
    expect(scriptOfLine('')).toBe('iast');
    expect(scriptOfLine('॥ ॥')).toBe('iast');
  });

  it('names only the four a line can be written in', () => {
    expect(['iast', 'deva', 'tel', 'tam', 'itrans', 'nonsense', undefined].map(wordScript))
      .toEqual(['iast', 'deva', 'tel', 'tam', 'iast', 'iast', 'iast']);
  });
});
