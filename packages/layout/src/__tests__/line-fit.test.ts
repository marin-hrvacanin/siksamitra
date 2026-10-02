/**
 * A LINE THAT FITS ITS COLUMN — the arithmetic of `fitLine`.
 *
 * Measured here with one unit a letter, so every expectation can be counted
 * by eye; the real widths (Arial's, his) are held in
 * `tests/integration/line-fit.test.ts` against his own lines.
 */
import { describe, expect, it } from 'vitest';
import { fitLine, piecesOf } from '../line-fit.js';

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
