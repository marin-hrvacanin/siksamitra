/**
 * OUR PARAGRAPH INDEX → WORD'S, past the paragraphs Word does not count.
 *
 * Measured on his Devī Māhātmyam: 21 hidden paragraphs, and Word counts 3 900
 * with hidden text hidden, 3 921 with it shown — our reader always 3 921.
 */
import { describe, expect, it } from 'vitest';
import { markIsHidden, nextToHidden, wordIndexOf, bodyShape, isEmptyParagraph } from '../paragraph-index.js';

describe('markIsHidden', () => {
  it('a paragraph whose mark is hidden', () => {
    expect(markIsHidden('<w:p><w:pPr><w:pStyle w:val="Translit"/><w:rPr><w:vanish/></w:rPr></w:pPr><w:r><w:t>oṁ</w:t></w:r></w:p>')).toBe(true);
  });
  it('not one whose TEXT is hidden and whose mark is not — Word counts that one', () => {
    expect(markIsHidden('<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr><w:r><w:rPr><w:vanish/></w:rPr><w:t>oṁ</w:t></w:r></w:p>')).toBe(false);
  });
  it('nor an ordinary one', () => {
    expect(markIsHidden('<w:p><w:pPr><w:rPr><w:i/></w:rPr></w:pPr></w:p>')).toBe(false);
  });
});

describe('wordIndexOf', () => {
  it('the same count: the same index', () => {
    const at = wordIndexOf({ total: 10, hidden: [3, 4] }, 10)!;
    expect([0, 3, 5, 9].map(at)).toEqual([0, 3, 5, 9]);
  });
  it('hidden text collapsed: every index past a hidden paragraph moves back', () => {
    const at = wordIndexOf({ total: 10, hidden: [3, 4] }, 8)!;
    expect([0, 2, 6, 9].map(at)).toEqual([0, 2, 4, 7]);
  });
  it('a hidden paragraph has no index of its own, and neither has the one it joins', () => {
    const at = wordIndexOf({ total: 10, hidden: [3, 4] }, 8)!;
    expect([3, 4, 5].map(at)).toEqual([null, null, null]);
    expect(nextToHidden(5, [3, 4])).toBe(true);
    expect(nextToHidden(6, [3, 4])).toBe(false);
  });
  it('any other count is the document changing under the read — nothing is written', () => {
    expect(wordIndexOf({ total: 10, hidden: [3, 4] }, 9)).toBeUndefined();
    expect(wordIndexOf({ total: 10, hidden: [] }, 11)).toBeUndefined();
  });
  it('his Devī Māhātmyam, as measured', () => {
    const hidden = Array.from({ length: 21 }, (_, k) => 2398 + k);
    expect(wordIndexOf({ total: 3921, hidden }, 3900)).toBeDefined();
    expect(wordIndexOf({ total: 3921, hidden }, 3921)).toBeDefined();
    expect(wordIndexOf({ total: 3921, hidden }, 3900)!(3000)).toBe(2979);
  });
});

describe('getOoxml’s own empty last paragraph, which Word does not count', () => {
  const ONE = ['<w:p><w:r><w:t>bhavyam</w:t></w:r></w:p>', '<w:p w14:paraId="0DB3A367"/>'];
  it('a one-line document reads as two, and Word’s one is accepted — measured in Word', () => {
    const shape = bodyShape(ONE);
    expect(shape).toEqual({ total: 2, hidden: [], emptyLast: true });
    expect(wordIndexOf(shape, 1)!(0)).toBe(0);
  });
  it('and a real empty last paragraph, which Word does count, still maps', () => {
    expect(wordIndexOf(bodyShape(ONE), 2)!(0)).toBe(0);
  });
  it('with hidden paragraphs too, hidden text hidden', () => {
    const raw = ['<w:p><w:pPr><w:rPr><w:vanish/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>', ...ONE];
    expect(wordIndexOf(bodyShape(raw), 1)!(2)).toBe(1);
  });
  it('a last paragraph with text is never taken for it: one short is still a changed document', () => {
    expect(wordIndexOf(bodyShape(['<w:p><w:r><w:t>a</w:t></w:r></w:p>', '<w:p><w:r><w:t>b</w:t></w:r></w:p>']), 1)).toBeUndefined();
  });
  it('an empty paragraph is one with no run — a paragraph mark alone still is', () => {
    expect(isEmptyParagraph('<w:p><w:pPr><w:pStyle w:val="Mantra"/></w:pPr></w:p>')).toBe(true);
    expect(isEmptyParagraph('<w:p><w:rPr/><w:r><w:t>a</w:t></w:r></w:p>')).toBe(false);
  });
});
