/**
 * HIS SPACING, KEPT — no-break spaces, tabs, double spaces, and the space
 * before a pause.
 *
 * Every case here is a shape out of his own files (`check:word:reference`
 * measures them there), written out by hand so this tier needs no file of his.
 */
import { describe, expect, it } from 'vitest';
import type { ChantToken, ChantVerse } from '../index.js';
import { carrySpacing, spaceToken, toTextAndMarks, toTokens } from '../index.js';
import { structuralText as structuralTextOf } from '../typed-letter.js';

const verse = (tokens: ChantToken[]): ChantVerse => ({ id: 'v', tokens });
const syl = (iast: string, extra: Record<string, unknown> = {}): ChantToken =>
  ({ t: 'syl', iast, deva: iast, units: [...iast].map((c) => ({ c, ...extra })) } as ChantToken);
const help = { spell: (s: string) => ({ deva: s } as never), split: (s: string) => [...s] };

describe('spaceToken — the one answer for a whitespace character', () => {
  it('an ordinary space, a no-break space and a tab are three different spaces', () => {
    expect(spaceToken(' ')).toEqual({ t: 'sp' });
    expect(spaceToken(' ')).toEqual({ t: 'sp', nb: true });
    expect(spaceToken('\t')).toEqual({ t: 'sp', tab: true });
  });
  it('anything else is not a space', () => {
    for (const ch of ['a', '\n', '|', '।', '']) expect(spaceToken(ch)).toBeNull();
  });
  it('and each comes back as the character it was', () => {
    for (const ch of [' ', ' ', '\t']) expect(structuralTextOf(spaceToken(ch)!)).toBe(ch);
  });
});

describe('tokens ⇄ text + markings keep the kind of space', () => {
  it('a no-break space survives both directions', () => {
    const tm = toTextAndMarks(verse([syl('tat'), { t: 'sp', nb: true }, syl('sa')]));
    expect(tm.text).toBe('tat sa');
    expect(toTokens(tm, help).filter((t) => t.t === 'sp')).toEqual([{ t: 'sp', nb: true }]);
  });
  it('a tab that indents a line survives both directions', () => {
    const tm = toTextAndMarks(verse([syl('rujā'), { t: 'br' }, { t: 'sp', tab: true }, syl('ca')]));
    expect(tm.text).toBe('rujā\n\tca');
    expect(toTokens(tm, help).filter((t) => t.t === 'sp')).toEqual([{ t: 'sp', tab: true }]);
  });
  it('two spaces stay two', () => {
    const tm = toTextAndMarks(verse([syl('aṁ'), { t: 'sp' }, { t: 'sp' }, syl('ai')]));
    expect(tm.text).toBe('aṁ  ai');
  });
});

describe('a box drawn over a space is one box', () => {
  it('two letters of the SAME numbered box keep one holding across the space', () => {
    /* His `vipa̱n na̍rā`: one box over `n n`. It came back as two. */
    const tm = toTextAndMarks(verse([
      syl('pan', {}), { t: 'sp', nb: true }, syl('na'),
    ].map((t, i) => (t.t !== 'syl' ? t : {
      ...t,
      units: t.units.map((u, k) => ((i === 0 && k === 2) || (i === 2 && k === 0) ? { ...u, hold: 'short', hg: 1 } : u)),
    })) as ChantToken[]));
    expect(tm.marks.filter((m) => m.k === 'hold')).toEqual([expect.objectContaining({ from: 2, to: 5, v: 'short' })]);
  });
  it('two boxes that merely touch across a space stay two — different numbers', () => {
    const tm = toTextAndMarks(verse([
      { t: 'syl', iast: 'n', deva: 'n', units: [{ c: 'n', hold: 'short', hg: 1 }] },
      { t: 'sp' },
      { t: 'syl', iast: 'n', deva: 'n', units: [{ c: 'n', hold: 'short', hg: 2 }] },
    ] as ChantToken[]));
    expect(tm.marks.filter((m) => m.k === 'hold')).toHaveLength(2);
  });
  it('and a box does not reach over a space into an unboxed letter', () => {
    const tm = toTextAndMarks(verse([
      { t: 'syl', iast: 'n', deva: 'n', units: [{ c: 'n', hold: 'short', hg: 1 }] },
      { t: 'sp' },
      syl('na'),
    ] as ChantToken[]));
    expect(tm.marks.filter((m) => m.k === 'hold')).toEqual([expect.objectContaining({ from: 0, to: 1 })]);
  });
});

describe('the space before a pause that ends a line is not trailing', () => {
  it('`…ṇya̱m |⏎` keeps its space, because the pause is drawn', () => {
    const tm = toTextAndMarks(verse([syl('ṇyam'), { t: 'sp' }, { t: 'pause', len: 'short' }, { t: 'br' }, syl('bha')]));
    expect(tm.text).toBe('ṇyam \nbha');
    expect(tm.marks.find((m) => m.k === 'pause')).toMatchObject({ from: 5, to: 5 });
  });
  it('while an ordinary trailing space still goes', () => {
    expect(toTextAndMarks(verse([syl('ṇyam'), { t: 'sp' }, { t: 'br' }, syl('bha')])).text).toBe('ṇyam\nbha');
  });
});

describe('carrySpacing — his spacing back after the rules normalised it', () => {
  it('the same text is the identity, offsets included', () => {
    const s = carrySpacing('agne naya', 'agne naya');
    expect(s.text).toBe('agne naya');
    expect([0, 4, 9].map(s.at)).toEqual([0, 4, 9]);
  });
  it('a no-break space the rules made ordinary is his again', () => {
    expect(carrySpacing('tat savitur', 'tat savitur').text).toBe('tat savitur');
  });
  it('a double space the rules collapsed is his again, and later offsets move', () => {
    const s = carrySpacing('aṁ  ai', 'aṁ ai');
    expect(s.text).toBe('aṁ  ai');
    expect(s.at(3)).toBe(4); // the `a` of `ai`
  });
  it('the indent the rules trimmed from a line goes back before its letter', () => {
    const s = carrySpacing('rujā\n\tca', 'rujā\nca');
    expect(s.text).toBe('rujā\n\tca');
    expect(s.at(5)).toBe(6); // the `c`, after the tab
  });
  it('a letter the rules changed is theirs — only whitespace is carried', () => {
    expect(carrySpacing('taṁ sa', 'tan sa').text).toBe('tan sa');
    expect(carrySpacing('taṁ sa', 'tan sa').text).toBe('tan sa');
  });
  it('spaces the rules ADD are kept, and not doubled', () => {
    /* Two spaces around a pause are the rules' own; counting his as well
       once gave three. */
    expect(carrySpacing('rya  ā', 'rya  ā').text).toBe('rya  ā');
    expect(carrySpacing('rya ā', 'rya  ā').text).toBe('rya  ā');
  });
});
