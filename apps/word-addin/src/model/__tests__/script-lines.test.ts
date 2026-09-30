/**
 * A MANTRA LINE IN DEVANĀGARĪ, TELUGU OR TAMIL — where the caret is, and
 * where it goes back to.
 *
 * Word says how many characters into a line the selection starts; in a
 * Devanāgarī line those are Devanāgarī characters, and a conjunct is several
 * of them for several letters. The map follows each into the IAST text the
 * model holds — a letter is where its cluster begins, and an offset inside a
 * cluster is its end, since a letter of a conjunct cannot be marked apart from
 * it. The expectations are written out by hand from the clusters.
 */
import { describe, expect, it } from 'vitest';
import { mark } from '@siksamitra/format';
import { paragraphRuns, paragraphsXml, decodeRuns } from '../paragraph.js';
import { offsetMap, toModel, toWord } from '../offsets.js';
import { wordOffsetIn } from '../caret.js';

/* `agnim īḻe`, the `g` boxed: अ | ग्नि | म् | ␣ | ई | ळे */
const tm = { text: 'agnim īḻe', marks: [mark({ k: 'hold', from: 1, to: 2, v: 'short' })] };

describe('a Devanāgarī line', () => {
  const runs = paragraphRuns(tm, 'deva')[0]!;
  const map = offsetMap(runs, 'deva');

  it('is written cluster by cluster, the box round the cluster its letter is in', () => {
    expect(runs.map((r) => [r.rStyle, r.text])).toEqual([[null, 'अ'], ['Holding', 'ग्नि'], [null, 'म् ईळे']]);
  });

  it('reads back as the very line', () => {
    const back = decodeRuns(runs, 'deva');
    expect(back.text).toBe(tm.text);
    expect(back.marks.filter((m) => m.k === 'hold').map((m) => [m.from, m.to, m.v])).toEqual([[1, 2, 'short']]);
  });

  it('maps every cluster boundary to the letter it begins', () => {
    expect(map.wordText).toBe('अग्निम् ईळे');
    /* अ=0 ग्नि=1..5 म्=5..7 ␣=7 ई=8 ळे=9..11 */
    expect([0, 1, 5, 7, 8, 9, 11].map((w) => toModel(map, w))).toEqual([0, 1, 4, 5, 6, 7, 9]);
  });

  it('maps an offset inside a conjunct to its end', () => {
    expect([2, 3, 4].map((w) => toModel(map, w))).toEqual([4, 4, 4]);
  });

  it('and back: a letter is found at its cluster', () => {
    expect([0, 1, 4, 5, 9].map((m) => toWord(map, m))).toEqual([0, 1, 5, 7, 11]);
  });

  it('puts the caret back where it was, in Word characters of the script', () => {
    const xml = paragraphsXml(tm, 'deva');
    expect(wordOffsetIn(xml, 4, 'deva')).toBe(5);
    expect(wordOffsetIn(xml, 9, 'deva')).toBe(11);
  });
});

describe('the other scripts', () => {
  for (const script of ['tel', 'tam'] as const) {
    it(`a ${script} line reads back as the line, and its offsets never go backwards`, () => {
      const runs = paragraphRuns(tm, script)[0]!;
      const back = decodeRuns(runs, script);
      expect(back.text).toBe(tm.text);
      const map = offsetMap(runs, script);
      expect(map.model[0]).toBe(0);
      expect(map.model[map.model.length - 1]).toBe(tm.text.length);
      expect(map.model.every((m, i) => i === 0 || m >= map.model[i - 1]!)).toBe(true);
    });
  }
});
