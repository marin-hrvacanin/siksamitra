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
import { WORD_DEVANAGARI } from '@siksamitra/tokens/word';

/*
 * `agnim īḻe`, the `g` held — written as his Devanāgarī is
 * (`WORD_DEVANAGARI`): अ | ͂ | ग्नि | म् | ␣␣ | ई | ळे — the holding his small
 * raised mark BEFORE the akṣara its letter is in, and the word gap two spaces.
 */
const tm = { text: 'agnim īḻe', marks: [mark({ k: 'hold', from: 1, to: 2, v: 'short' })] };

describe('a Devanāgarī line', () => {
  const runs = paragraphRuns(tm, 'deva')[0]!;
  const map = offsetMap(runs, 'deva');

  it('is written as his Devanāgarī is: the holding a raised mark before its akṣara, the gap two spaces', () => {
    expect(runs.map((r) => [r.rStyle, r.text])).toEqual([
      [null, 'अ'], [WORD_DEVANAGARI.hold.style, WORD_DEVANAGARI.hold.short], [null, 'ग्निम्  ईळे'],
    ]);
  });

  it('reads back as the very line', () => {
    const back = decodeRuns(runs, 'deva');
    expect(back.text).toBe(tm.text);
    expect(back.marks.filter((m) => m.k === 'hold').map((m) => [m.from, m.to, m.v])).toEqual([[1, 2, 'short']]);
  });

  it('maps every cluster boundary to the letter it begins', () => {
    expect(map.wordText).toBe('अ͂ग्निम्  ईळे');
    /* अ=0 ͂=1 ग्नि=2..6 म्=6..8 ␣␣=8..10 ई=10 ळे=11..13. The mark belongs to
       the akṣara after it; the second space of a gap is the same space. */
    expect([0, 1, 2, 6, 8, 9, 10, 11, 13].map((w) => toModel(map, w))).toEqual([0, 1, 1, 4, 5, 6, 6, 7, 9]);
  });

  it('maps an offset inside a conjunct to its end', () => {
    expect([3, 4, 5].map((w) => toModel(map, w))).toEqual([4, 4, 4]);
  });

  it('and back: a letter is found at its cluster', () => {
    expect([0, 1, 4, 5, 6, 7, 9].map((m) => toWord(map, m))).toEqual([0, 2, 6, 8, 10, 11, 13]);
  });

  it('and a letter INSIDE a conjunct at its end — never at the start of the line', () => {
    /* The `n` and `i` of ग्नि, and the `e` of ळे. */
    expect([2, 3, 8].map((m) => toWord(map, m))).toEqual([6, 6, 13]);
  });

  it('puts the caret back where it was, in Word characters of the script', () => {
    const xml = paragraphsXml(tm, 'deva');
    expect(wordOffsetIn(xml, 4, 'deva')).toBe(6);
    expect(wordOffsetIn(xml, 9, 'deva')).toBe(13);
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
