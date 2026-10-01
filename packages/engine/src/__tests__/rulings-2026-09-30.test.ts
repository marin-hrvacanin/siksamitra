/**
 * THE OWNER'S RULINGS OF 2026-09-30 — each a profile setting, with its default.
 *
 * Measured first against his six reference documents (`check:reference`),
 * then ruled on:
 *
 *   - `ṁ` before a nasal takes that nasal: "always the exact same form of the
 *     anunāsika". His files do it five times in six; the rules never did.
 *   - a geminate under ONE box over both letters is the newer convention
 *     (Devī Māhātmyam v6.62, Rudram v1.622); the older one, a box on one
 *     letter, stays the default and the newer can be switched on.
 *   - the `u` of `vy` is optional and OFF by default; the `g` of `jñ` always.
 *   - `ḥ` before `k` / `kh` is marked as a change — on by default, and off
 *     can be chosen.
 */
import { describe, expect, it } from 'vitest';
import { derive, resolveProfile } from '../index.js';

const units = (text: string, patch: Record<string, unknown> = {}) =>
  derive({ lines: [text] }, resolveProfile([{ preset: 'smarta', patch } as never]), { trace: false }).tokens
    .flatMap((t) => (t.t === 'syl' ? t.units : []));
const letters = (text: string, patch?: Record<string, unknown>) => units(text, patch).map((u) => u.c).join('');

describe('ṁ before a nasal', () => {
  it('takes the nasal: m before m, n before n, and is a change', () => {
    expect(letters('puraṁ mahā')).toBe('purammahā');
    expect(letters('śagmāṁ no')).toBe('śagmānno');
    expect(units('puraṁ mahā').find((u) => u.c === 'm' && u.change === true)).toBeDefined();
  });
  it('as it always took a stop\'s nasal — unchanged', () => {
    expect(letters('taṁ paśya')).toBe('tampaśya');
    expect(letters('taṁ gacchati')).toBe('taṅgacchati');
  });
  it('switched off, ṁ is kept before a nasal', () => {
    expect(letters('puraṁ mahā', { sandhi: { nasalBeforeNasal: false } })).toBe('puraṁmahā');
  });
  it('a bīja is never assimilated, nasal or not', () => {
    expect(letters('oṁ namaḥ')).toContain('oṁ');
  });
});

describe('ḥ before k / kh', () => {
  it('is marked as a change, and stays ḥ', () => {
    const h = units('devyaḥ krodha').find((u) => u.c === 'ḥ');
    expect(h?.change).toBe(true);
    expect(units('duḥkha').find((u) => u.c === 'ḥ')?.change).toBe(true);
  });
  it('switched off, it is plain', () => {
    expect(units('devyaḥ krodha', { sandhi: { visargaBeforeVelar: false } }).find((u) => u.c === 'ḥ')?.change).toBeUndefined();
  });
  it('and before anything else it does what it did — ś before c', () => {
    expect(letters('rāmaḥ carati')).toBe('rāmaścarati');
  });
});

describe('the reading aids', () => {
  const aid = (text: string, letter: string, patch?: Record<string, unknown>) => units(text, patch).find((u) => u.c === letter)?.sup;
  it('jñ takes its g, always', () => {
    expect(aid('yajña', 'j')).toBe('g');
  });
  it('vy takes no u by default', () => {
    expect(aid('bhavyam', 'v')).toBeUndefined();
  });
  it('and takes it when switched on', () => {
    expect(aid('bhavyam', 'v', { aids: { vy: true } })).toBe('u');
  });
});

describe('a geminate', () => {
  const boxed = (text: string, patch?: Record<string, unknown>) =>
    units(text, patch).filter((u) => u.hold !== undefined).map((u) => `${u.c}:${u.hg}`);
  it('one box on one letter by default — the older convention', () => {
    expect(boxed('uttamam')).toEqual(['t:1']);
    expect(boxed('gacchati')).toEqual(['c:1']);
  });
  it('switched to the whole geminate, one box over both letters', () => {
    expect(boxed('uttamam', { holdings: { geminate: 'whole' } })).toEqual(['t:1', 't:1']);
    expect(boxed('gacchati', { holdings: { geminate: 'whole' } })).toEqual(['c:1', 'ch:1']);
    expect(boxed('buddhi', { holdings: { geminate: 'whole' } })).toEqual(['d:1', 'dh:1']);
  });
  it('but not a cluster that is not a geminate', () => {
    expect(boxed('agni', { holdings: { geminate: 'whole' } })).toEqual(['g:1']);
  });
});

describe('the switches a person is offered', () => {
  it('are on and off as ruled, in every register', async () => {
    const { CONVENTIONS, PROFILES } = await import('../index.js');
    const want = { 'nasal-before-nasal': true, 'visarga-before-velar': true, 'vy-aid': false, 'geminate-box': false };
    for (const p of Object.values(PROFILES)) {
      for (const c of CONVENTIONS) expect([c.id, c.isOn(p)]).toEqual([c.id, want[c.id]]);
    }
  });
  it('each one\'s patch turns it on and off', async () => {
    const { CONVENTIONS, conventionsPatch } = await import('../index.js');
    for (const c of CONVENTIONS) {
      expect(c.isOn(resolveProfile([{ preset: 'taittiriya', patch: conventionsPatch({ [c.id]: true }) } as never]))).toBe(true);
      expect(c.isOn(resolveProfile([{ preset: 'taittiriya', patch: conventionsPatch({ [c.id]: false }) } as never]))).toBe(false);
    }
  });
  it('a switch not chosen leaves the register its own, and the others alone', async () => {
    const { conventionsPatch } = await import('../index.js');
    expect(conventionsPatch({})).toEqual({});
    expect(conventionsPatch({ 'vy-aid': true, 'nasal-before-nasal': false }))
      .toEqual({ aids: { vy: true }, sandhi: { nasalBeforeNasal: false } });
  });
  it('and every example is what the rules do', () => {
    expect(letters('puraṁ mahā')).toBe('purammahā');
    expect(units('bhavyam', { aids: { vy: true } }).find((u) => u.c === 'v')?.sup).toBe('u');
  });
});
