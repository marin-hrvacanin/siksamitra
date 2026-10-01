/**
 * WHAT WAS TYPED AFTER A MARK, taken back out of it — and nothing else touched.
 */
import { describe, expect, it } from 'vitest';
import { mark } from '@siksamitra/format';
import { readParagraphs, mergeRuns } from '@siksamitra/interop';
import { paragraphsXml } from '../paragraph.js';
import { typedPlain, type Written } from '../typed-after.js';

const written = (text: string, marks: Parameters<typeof mark>[0][], caretWord: number): Written => {
  const tm = { text, marks: marks.map((m) => mark(m)) };
  const runs = mergeRuns(readParagraphs(paragraphsXml(tm)).flatMap((p) => p.runs));
  return { tm, runs, wordText: runs.map((r) => r.text).join(''), caretWord };
};

describe('typedPlain', () => {
  const boxed = written('agnim', [{ k: 'hold', from: 4, to: 5, v: 'short' }], 5);
  it('letters typed at the caret after a box go in plain, the box as it was', () => {
    const out = typedPlain(boxed, 'agnimx')!;
    expect(out.tm.text).toBe('agnimx');
    expect(out.tm.marks.filter((m) => m.k === 'hold').map((m) => [m.from, m.to])).toEqual([[4, 5]]);
    expect(out.caret).toBe(6);
  });
  it('several typed before the correction ran — all of them', () => {
    expect(typedPlain(boxed, 'agnim īḷe')!.tm.text).toBe('agnim īḷe');
    expect(typedPlain(boxed, 'agnim īḷe')!.caret).toBe(9);
  });
  it('after an accent: Word counts the accent, the model does not', () => {
    const accented = written('agni', [{ k: 'svara', from: 3, to: 4, v: 'svarita' }], 5);
    expect(accented.wordText).toBe('agni̍');
    const out = typedPlain(accented, 'agni̍m')!;
    expect(out.tm.text).toBe('agnim');
    expect(out.tm.marks.filter((m) => m.k === 'svara').map((m) => [m.from, m.to])).toEqual([[3, 4]]);
  });
  it('a change anywhere else is not typing on after the mark — left alone', () => {
    expect(typedPlain(boxed, 'xagnim')).toBeNull();
    expect(typedPlain(boxed, 'agni')).toBeNull();
    expect(typedPlain(boxed, 'agnam')).toBeNull();
    expect(typedPlain(boxed, 'agnim')).toBeNull();
  });
  it('nor is a new line', () => {
    expect(typedPlain(boxed, 'agnim\r')).toBeNull();
  });
});
