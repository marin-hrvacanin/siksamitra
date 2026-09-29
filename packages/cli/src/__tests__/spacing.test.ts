/**
 * A SPACE AFTER A DAṆḌA OR PAUSE IS PRESENTATION — and an original keeps its own.
 *
 * The owner's documents set `namaḥ | hariḥ` both with and without the space
 * (corpus: after a pause 266 with, 173 without), so the engine writes ONE
 * convention and a document that gains a source layer keeps the one it had.
 */
import { describe, expect, it } from 'vitest';
import type { ChantToken } from '@siksamitra/format';
import { diffVerse, isPresentationalSpace, keepSpacingOf } from '../verse-diff.js';

const syl = (iast: string): ChantToken => ({ t: 'syl', iast, deva: iast, units: [...iast].map((c) => ({ c })) });
const sp: ChantToken = { t: 'sp' };
const pause: ChantToken = { t: 'pause', len: 'short' };
const danda: ChantToken = { t: 'danda', s: '।' };
const num: ChantToken = { t: 'num', s: '3' };
const cells = (ts: readonly ChantToken[]) => ts.map((t) => (t.t === 'syl' ? t.iast : t.t === 'sp' ? '␣' : `<${t.t}>`)).join('');

describe('which space is presentation', () => {
  it('after a pause, before a word', () => {
    expect(isPresentationalSpace([syl('oṁ'), sp, pause, sp, syl('bhūr')], 3)).toBe(true);
  });
  it('after a mid-line daṇḍa, before a word', () => {
    expect(isPresentationalSpace([syl('naḥ'), sp, danda, sp, syl('ha')], 3)).toBe(true);
  });
  it('NOT before the mark — that one the engine always writes', () => {
    expect(isPresentationalSpace([syl('oṁ'), sp, pause], 1)).toBe(false);
  });
  it('NOT between a daṇḍa and a verse number: ॥3॥ and ॥ 3 ॥ are different documents', () => {
    expect(isPresentationalSpace([danda, sp, num, danda], 1)).toBe(false);
  });
  it('NOT an ordinary space between words — the control', () => {
    expect(isPresentationalSpace([syl('na'), sp, syl('ma')], 1)).toBe(false);
  });
  it('out of range is simply false, never a throw', () => {
    expect(isPresentationalSpace([], 0)).toBe(false);
    expect(isPresentationalSpace([pause], 5)).toBe(false);
  });
});

describe('the comparison', () => {
  const file = [syl('oṁ'), sp, pause, sp, syl('bhūr'), sp, danda];
  const engine = [syl('oṁ'), sp, pause, syl('bhūr'), sp, danda];
  it('treats the two spacings as the same verse', () => {
    expect(diffVerse(file, engine, { tamil: false }).kind).toBe('same');
  });
  it('but a MISSING pause is still a difference — the control', () => {
    expect(diffVerse(file, [syl('oṁ'), sp, syl('bhūr'), sp, danda], { tamil: false }).kind).toBe('text');
  });
  it('and a space inside ॥ 3 ॥ is still a difference', () => {
    expect(diffVerse([danda, num, danda], [danda, sp, num, sp, danda], { tamil: false }).kind).toBe('text');
  });
});

describe('keeping the original spacing', () => {
  it('adds the space the original had after a pause', () => {
    const out = keepSpacingOf([syl('oṁ'), sp, pause, syl('bhūr')], [syl('oṁ'), sp, pause, sp, syl('bhūr')]);
    expect(cells(out)).toBe('oṁ␣<pause>␣bhūr');
  });
  it('drops the space the original did not have', () => {
    const out = keepSpacingOf([syl('naḥ'), sp, danda, sp, syl('ha')], [syl('naḥ'), sp, danda, syl('ha')]);
    expect(cells(out)).toBe('naḥ␣<danda>ha');
  });
  it('pairs every mark in order, when a line has several', () => {
    const original = [syl('a'), sp, pause, sp, syl('b'), sp, pause, syl('c'), sp, danda, sp, syl('d')];
    const derived = [syl('a'), sp, pause, syl('b'), sp, pause, sp, syl('c'), sp, danda, syl('d')];
    expect(cells(keepSpacingOf(derived, original))).toBe(cells(original));
  });
  it('is the identity when the two already agree — the control', () => {
    const same = [syl('a'), sp, pause, sp, syl('b')];
    expect(cells(keepSpacingOf(same, same))).toBe(cells(same));
  });
  it('touches nothing that is not presentational: a final daṇḍa, a verse number', () => {
    const t = [syl('a'), sp, danda, num, danda];
    expect(cells(keepSpacingOf(t, t))).toBe(cells(t));
  });
  it('an empty verse is an empty verse', () => {
    expect(keepSpacingOf([], [])).toEqual([]);
  });
});
