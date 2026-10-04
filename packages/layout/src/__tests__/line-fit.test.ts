/**
 * A LINE THAT FITS ITS COLUMN — the arithmetic of `fitLine`.
 *
 * Measured here with one unit a letter, so every expectation can be counted
 * by eye; the real widths (Arial's, his) are held in
 * `tests/integration/line-fit.test.ts` against his own lines.
 */
import { describe, expect, it } from 'vitest';
import { advanceWidth, fitLine, fitLineAt, piecesOf } from '../line-fit.js';

const letters = { widthOf: (t: string): number => [...t].length, limit: 20 };

describe('the pieces a line breaks between', () => {
  it('are its words, each with the signs after it', () => {
    expect(piecesOf('agne naya ॥ 1॥')).toEqual(['agne', 'naya ॥ 1॥']);
    expect(piecesOf('oṁ | śāntiḥ')).toEqual(['oṁ |', 'śāntiḥ']);
  });
  it('and a no-break space holds two words as one piece', () => {
    expect(piecesOf('a b c')).toEqual(['a b', 'c']);
  });
});

describe('a line too wide for its column', () => {
  it('a line that fits is left as it is — no need to fill it', () => {
    expect(fitLine('aaaa bbbb cccc', letters)).toEqual(['aaaa bbbb cccc']);
  });

  it('is divided EVENLY, not filled: two halves, not a full line and a stub', () => {
    // 29 letters: filling would give 19 + 9; even is 14 + 14.
    const out = fitLine('aaaa bbbb cccc dddd eeee ffff', letters);
    expect(out).toEqual(['aaaa bbbb cccc', 'dddd eeee ffff']);
  });

  it('ends a line at a half-verse when that is about as even', () => {
    // 13 + 17 at the daṇḍa, against 16 + 14 without one: the daṇḍa wins.
    const out = fitLine('aaa bbbbbbbb। cc dddd eeee ffff', letters);
    expect(out).toEqual(['aaa bbbbbbbb।', 'cc dddd eeee ffff']);
  });

  it('never carries a verse’s number, or a daṇḍa, to the start of a line', () => {
    for (const l of fitLine('aaaa bbbb cccc dddd eeee ff ॥ 12॥', letters)) {
      expect(l).not.toMatch(/^[।॥0-9]/u);
    }
  });

  it('takes as many lines as it needs, all within the limit', () => {
    const line = Array.from({ length: 12 }, (_, i) => String.fromCharCode(97 + i).repeat(5)).join(' ');
    const out = fitLine(line, letters);
    expect(out.length).toBe(4);
    for (const l of out) expect([...l].length).toBeLessThanOrEqual(20);
    expect(out.join(' ')).toBe(line);
  });

  it('a word wider than the column is a line of its own, never cut', () => {
    const out = fitLine('aa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb cc', letters);
    expect(out).toContain('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(out.join(' ')).toBe('aa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb cc');
  });
});

describe('his brackets, round an optional verse', () => {
  it('an opening bracket goes with the word after it, a closing one with the sign before it', () => {
    expect(piecesOf('( ā no divo ॥ )')).toEqual(['( ā', 'no', 'divo ॥ )']);
  });
  it('so a line is never left ending in "(" nor begun with ")"', () => {
    for (const l of fitLine('( aaaa bbbb cccc dddd eeee ffff ॥ )', letters)) {
      expect(l).not.toMatch(/\($/u);
      expect(l).not.toMatch(/^\)/u);
    }
  });
});

describe('a name’s raised number, measured', () => {
  /* His Lalitā numbers its names `śrī mā̍tā¹ śrī̍ mahā̱rājñī²`: drawn at about
     two thirds of the line's size, it must not be measured as a whole letter,
     or a line of names is divided that his page sets whole. */
  const advance = new Map([['a', 0.5], ['1', 0.5], ['2', 0.5]]);
  it('at its digit’s width times the raised share', () => {
    const width = advanceWidth(advance, 1, 10, 0.668);
    expect(width('a¹')).toBeCloseTo(5 + 5 * 0.668);
    expect(width('a²')).toBeCloseTo(width('a¹'));
  });
  it('and a host that does not say measures it as its digit', () => {
    expect(advanceWidth(advance, 1, 10)('a¹')).toBeCloseTo(10);
  });
});

describe('a line divided only where it may be', () => {
  /* A limit of 20 letters; the words a b c (cut after 3) d e f. */
  it('is divided at the cuts it is given, and nowhere else', () => {
    expect(fitLineAt('aaaa bbbb cccc dddd eeee ffff', [3], letters)).toEqual(['aaaa bbbb cccc', 'dddd eeee ffff']);
    /* A unit still too wide for the line is divided as fitLine divides it. */
    expect(fitLineAt('aaaa bbbb cccc dddd eeee ffff', [1], letters)).toEqual(['aaaa', ...fitLine('bbbb cccc dddd eeee ffff', letters)]);
  });
  it('is left whole when it fits, and divided as fitLine divides it when no cut is usable', () => {
    expect(fitLineAt('aaaa bbbb', [1], letters)).toEqual(['aaaa bbbb']);
    expect(fitLineAt('aaaa bbbb cccc dddd eeee ffff', [], letters)).toEqual(fitLine('aaaa bbbb cccc dddd eeee ffff', letters));
  });
});
