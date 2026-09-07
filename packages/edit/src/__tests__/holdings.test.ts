/**
 * The four holding invariants, as the owner stated them: never empty, never
 * nested, adjacent same-type boxes merged, and no run across a syllable
 * boundary.
 *
 * Each violation is built deliberately and checked to be REPORTED — a checker
 * that cannot fail is worth nothing.
 *
 * The other half of the evidence is the corpus, and it lives in
 * `tests/integration/corpus-holdings.test.ts`: a unit test may not read the
 * corpus (see tests/README.md), because a tier that reads eleven documents is
 * no longer fast enough to run on every save.
 */
import { describe, expect, it } from 'vitest';
import type { ChantSyllable, ChantToken, ChantUnit } from '@siksamitra/format';
import { assertHoldings, holdingProblems, normaliseHoldings } from '../holdings.js';

const syl = (units: ChantUnit[]): ChantSyllable =>
  ({ t: 'syl', units, iast: units.map((u) => u.c).join(''), deva: '' });

const codes = (tokens: ChantToken[]): string[] =>
  [...new Set(holdingProblems(tokens).map((p) => p.code))].sort();

describe('the checker reports each violation', () => {
  it('a group id with no holding is an empty group', () => {
    expect(codes([syl([{ c: 'k', hg: 3 }, { c: 'a' }])])).toEqual(['empty-group']);
  });

  it('two adjacent letters of the same length in different groups', () => {
    expect(codes([syl([
      { c: 'k', hold: 'short', hg: 1 },
      { c: 'a', hold: 'short', hg: 2 },
    ])])).toEqual(['unmerged-adjacent']);
  });

  it('a group id reused in a later syllable is NOT a problem', () => {
    /*
     * Measured against the corpus: 537 legitimate reuses. `hg` only has to
     * tell apart two boxes that touch, so an id repeated in a later syllable
     * is a label, not a span. Reading it as a span is what drew one box over
     * eighty letters — the reader was wrong, not the data.
     */
    expect(codes([
      syl([{ c: 'k', hold: 'short', hg: 1 }]),
      syl([{ c: 'a' }, { c: 'm' }]),
      syl([{ c: 't', hold: 'short', hg: 1 }]),
    ])).toEqual([]);
  });

  it('a group with a gap inside one syllable', () => {
    expect(codes([syl([
      { c: 'k', hold: 'short', hg: 1 },
      { c: 'a' },
      { c: 'm', hold: 'short', hg: 1 },
    ])])).toEqual(['split-group']);
  });

  it('a holding on an empty letter', () => {
    expect(codes([syl([{ c: '', hold: 'long' }])])).toContain('hold-without-letter');
  });

  it('says nothing about a legal document', () => {
    expect(holdingProblems([
      syl([{ c: 'k', hold: 'short', hg: 1 }, { c: 'a' }]),
      syl([{ c: 't', hold: 'long', hg: 2 }, { c: 'ā' }]),
    ])).toEqual([]);
  });

  it('different lengths side by side are two boxes, correctly', () => {
    expect(holdingProblems([syl([
      { c: 'a', hold: 'short', hg: 1 },
      { c: 'ā', hold: 'long', hg: 2 },
    ])])).toEqual([]);
  });
});

describe('the repair', () => {
  it('merges adjacent same-length letters into one box', () => {
    const { tokens, changed } = normaliseHoldings([syl([
      { c: 'k', hold: 'short', hg: 7 },
      { c: 'a', hold: 'short', hg: 9 },
    ])]);
    const units = (tokens[0] as ChantSyllable).units;
    // The run keeps the id its first letter already had, so exactly one
    // letter changes — see the minimal-change note on `normaliseHoldings`.
    expect(units[0]!.hg).toBe(7);
    expect(units[1]!.hg).toBe(7);
    expect(changed).toBe(1);
    expect(holdingProblems(tokens)).toEqual([]);
  });

  it('drops an orphan group id', () => {
    const { tokens } = normaliseHoldings([syl([{ c: 'k', hg: 3 }])]);
    expect((tokens[0] as ChantSyllable).units[0]).toEqual({ c: 'k' });
  });

  it('leaves a group id reused in another syllable alone', () => {
    // Changing it would rewrite a group id in all eleven shipped documents to
    // no purpose. See `normaliseHoldings`.
    const input = [
      syl([{ c: 'k', hold: 'short', hg: 1 }]),
      syl([{ c: 't', hold: 'short', hg: 1 }]),
    ];
    const { tokens, changed } = normaliseHoldings(input);
    expect(changed).toBe(0);
    expect(tokens).toEqual(input);
  });

  it('splits two runs of ONE syllable that share an id', () => {
    const { tokens } = normaliseHoldings([syl([
      { c: 'k', hold: 'short', hg: 1 },
      { c: 'a' },
      { c: 'm', hold: 'short', hg: 1 },
    ])]);
    const units = (tokens[0] as ChantSyllable).units;
    expect(units[0]!.hg).not.toBe(units[2]!.hg);
    expect(holdingProblems(tokens)).toEqual([]);
  });

  it('does not merge across a syllable boundary — the older rule', () => {
    // `ij jo` carries ONE box, on the first `j`. The newer convention would
    // group the geminate across the boundary; this program does not follow it,
    // so two marked letters in adjacent syllables stay two boxes.
    const { tokens } = normaliseHoldings([
      syl([{ c: 'i' }, { c: 'j', hold: 'short' }]),
      syl([{ c: 'j' }, { c: 'o' }]),
    ]);
    const first = (tokens[0] as ChantSyllable).units;
    expect(first[1]!.hg).toBeDefined();
    expect((tokens[1] as ChantSyllable).units[0]!.hg).toBeUndefined();
  });

  it('never adds or removes a holding — only regroups', () => {
    const input: ChantToken[] = [
      syl([{ c: 'k', hold: 'short', hg: 1 }, { c: 'a' }]),
      syl([{ c: 't', hold: 'long', hg: 1 }, { c: 'ā', hold: 'long', hg: 4 }]),
      { t: 'sp' },
      syl([{ c: 'm' }]),
    ];
    const { tokens } = normaliseHoldings(input);
    const holds = (ts: readonly ChantToken[]): (string | undefined)[] =>
      ts.flatMap((t) => (t.t === 'syl' ? t.units.map((u) => u.hold) : []));
    expect(holds(tokens)).toEqual(holds(input));
  });

  it('is idempotent', () => {
    const once = normaliseHoldings([syl([
      { c: 'k', hold: 'short', hg: 7 },
      { c: 'a', hold: 'short', hg: 9 },
    ])]).tokens;
    const twice = normaliseHoldings(once);
    expect(twice.changed).toBe(0);
    expect(twice.tokens).toEqual(once);
  });

  it('leaves non-syllable tokens exactly as they were', () => {
    const input: ChantToken[] = [
      { t: 'sp' }, { t: 'pause', len: 'short' }, { t: 'bar' },
      { t: 'danda', s: '।' }, { t: 'num', s: '1' }, { t: 'br' },
      { t: 'text', s: 'name', fill: true },
    ];
    expect(normaliseHoldings(input).tokens).toEqual(input);
  });

  it('assertHoldings throws with every problem, not just the first', () => {
    try {
      assertHoldings([syl([{ c: 'k', hg: 1 }, { c: 'a', hg: 2 }])], 'a test');
      expect.unreachable('should have thrown');
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain('a test');
      expect(message.split('\n')).toHaveLength(3);
    }
  });
});
