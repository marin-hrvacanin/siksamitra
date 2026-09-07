/**
 * Recovering an edit from its result. The properties, not examples:
 *
 *   1. applying the recovered replacement to `before` must give `after`,
 *   2. for identical inputs there is no replacement at all,
 *   3. the recovered range is never negative — the case naive prefix/suffix
 *      arithmetic gets wrong, on inputs as ordinary as "aa" → "aaa".
 */
import { describe, expect, it } from 'vitest';
import { alignArrays, contiguousDiff } from '../diff.js';

const applied = (before: string, after: string): string => {
  const change = contiguousDiff(before, after);
  if (change === null) return before;
  expect(change.to).toBeGreaterThanOrEqual(change.from);
  return before.slice(0, change.from) + change.insert + before.slice(change.to);
};

describe('contiguousDiff', () => {
  it('reports nothing for an unchanged string', () => {
    expect(contiguousDiff('agnim', 'agnim')).toBeNull();
  });

  it('finds a single insertion', () => {
    expect(contiguousDiff('agnim', 'agnima')).toEqual({ from: 5, to: 5, insert: 'a' });
  });

  it('finds a single deletion', () => {
    expect(contiguousDiff('agnim', 'agim')).toEqual({ from: 2, to: 3, insert: '' });
  });

  it('finds a replacement in the middle', () => {
    // `ī` is one character: the replaced span is [6, 7), not [6, 8).
    expect(contiguousDiff('agnim īḷe', 'agnim aḷe'))
      .toEqual({ from: 6, to: 7, insert: 'a' });
  });

  /*
   * The overlap case. `before = "aa"`, `after = "aaa"`: the common prefix is 2
   * and the common suffix is also 2, so unclamped arithmetic gives
   * `to = 2 - 2 = 0` with `from = 2` — a backwards range that silently
   * reverses the edit.
   */
  it('never returns a backwards range when prefix and suffix overlap', () => {
    for (const [a, b] of [
      ['aa', 'aaa'], ['aaa', 'aa'], ['', 'a'], ['a', ''],
      ['ṁṁ', 'ṁṁṁ'], ['abab', 'ababab'],
    ] as const) {
      const change = contiguousDiff(a, b);
      expect(change!.to).toBeGreaterThanOrEqual(change!.from);
      expect(applied(a, b)).toBe(b);
    }
  });

  it('round-trips a spread of real edits', () => {
    const cases: [string, string][] = [
      ['agnim īḷe purohitaṁ', 'agnim īḷe purohitam'],
      ['agnim īḷe purohitaṁ', 'agnim purohitaṁ'],
      ['agnim īḷe purohitaṁ', 'agnim īḷe yajñasya purohitaṁ'],
      ['agnim', ''],
      ['', 'hotāraṁ'],
      ['hotāraṁ ratnadhātamam', 'ratnadhātamam hotāraṁ'],
    ];
    for (const [a, b] of cases) expect(applied(a, b)).toBe(b);
  });
});

describe('alignArrays', () => {
  it('matches everything when nothing moved', () => {
    expect(alignArrays(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([0, 1, 2]);
  });

  it('matches across an insertion in the middle', () => {
    expect(alignArrays(['a', 'b'], ['a', 'x', 'b'])).toEqual([0, 2]);
  });

  it('matches across a deletion at the front', () => {
    // The point of matching from BOTH ends: deleting the first verse must not
    // slide every id up one.
    expect(alignArrays(['a', 'b', 'c'], ['b', 'c'])).toEqual([null, 0, 1]);
  });

  it('matches a changed line positionally when the count is unchanged', () => {
    // Typing into one line of a verse: the line differs, but no line was added
    // or removed, so its marks must still rebase rather than being dropped.
    expect(alignArrays(['a', 'bb', 'c'], ['a', 'bX', 'c'])).toEqual([0, 1, 2]);
  });

  it('refuses to guess when the count changed and nothing matches', () => {
    expect(alignArrays(['a', 'b'], ['x', 'y', 'z'])).toEqual([null, null]);
  });
});
