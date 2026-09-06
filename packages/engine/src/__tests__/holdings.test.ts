/**
 * Where an automatic holding lands.
 *
 * OWNER'S RULING (2026-09-06): another practitioner marks holdings by grouping
 * the whole cluster — `d dh`, `tt`, `cch` — under one box. **This software does
 * not.** A person may build such a group by hand, and the format carries it
 * (`hg` over adjacent units), and documents imported from that practice keep
 * it. But when an author selects text and runs automatic holdings, the box goes
 * on ONE letter: the FIRST of the pair. The first `t` of `tt`, the first `c` of
 * `cch`.
 *
 * The behaviour was already correct when the ruling was given, and no test
 * covered it, which is the same as not having it — `applyHoldings` picks a
 * single host and a future change to `selectHoldingComponent` could widen that
 * silently. These are the cases the ruling named, plus the ones that decide
 * whether "first" means first-of-cluster or first-that-can-host.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, derive, resolveProfile } from '../index.js';

/** Every letter carrying a box, as `letter:len`, in order. */
function boxes(line: string): string[] {
  const profile = resolveProfile([{ preset: 'taittiriya' }]) ?? DEFAULT_PROFILE;
  const out: string[] = [];
  for (const t of derive({ lines: [line] }, profile).tokens) {
    if (t.t !== 'syl') continue;
    for (const u of t.units) if (u.hold !== undefined) out.push(`${u.c}:${u.hold}`);
  }
  return out;
}

/** The group id of every boxed letter, to prove a box is never widened. */
function groupSizes(line: string): number[] {
  const profile = resolveProfile([{ preset: 'taittiriya' }]) ?? DEFAULT_PROFILE;
  const counts = new Map<number, number>();
  for (const t of derive({ lines: [line] }, profile).tokens) {
    if (t.t !== 'syl') continue;
    for (const u of t.units) {
      if (u.hg === undefined) continue;
      counts.set(u.hg, (counts.get(u.hg) ?? 0) + 1);
    }
  }
  return [...counts.values()];
}

describe('automatic holdings land on the first letter of the cluster', () => {
  it('doubles the box onto the first `t` of `tt`', () => {
    expect(boxes('uttamam')).toEqual(['t:short']);
  });

  it('boxes the first `c` of `cch`, not the `ch`', () => {
    expect(boxes('gacchati')).toEqual(['c:short']);
    expect(boxes('ucchantu')).toEqual(['c:short', 't:short']);
  });

  it('boxes the first `d` of `ddh`', () => {
    expect(boxes('viddhi')).toEqual(['d:short']);
  });

  it('boxes the first member across a word join', () => {
    expect(boxes('tad dhi')).toEqual(['d:short']);
  });

  it('boxes one letter per cluster in a line with several', () => {
    expect(boxes('satyam uttaram')).toEqual(['t:short', 't:short']);
  });
});

describe('an automatic box is never widened across letters', () => {
  it.each([
    'uttamam', 'gacchati', 'ucchantu', 'viddhi', 'tad dhi', 'satyam uttaram',
  ])('%s produces only single-letter groups', (line) => {
    // The whole ruling in one assertion: every group covers exactly one letter.
    // A cluster-spanning box is a thing a PERSON may build; derivation may not.
    expect(groupSizes(line).every((n) => n === 1)).toBe(true);
  });
});

describe('the rules that decide which letter counts as first', () => {
  it('gives a single consonant no box at all', () => {
    // The rule most often broken by hand: a lone consonant between vowels is
    // never boxed, however long the vowel before it.
    expect(boxes('rāma')).toEqual([]);
    expect(boxes('deva')).toEqual([]);
  });

  it('leaves a line-initial cluster bare — and only that cluster', () => {
    // "we never box the initial clusters" — a cluster that OPENS the line stays
    // unboxed even though it is a perfectly good saṁyukta.
    expect(boxes('prajāpatiḥ')).toEqual([]);
    // But the exemption is for the OPENING cluster, not the word: `br` opens
    // the line and stays bare while `hm` further in is boxed normally.
    expect(boxes('brāhmaṇo')).toEqual(['h:long']);
  });

  it('takes its length from the vowel BEFORE the host', () => {
    // `hold: 'long'` names the preceding vowel, not a duration — the thing an
    // implementer reading the field name alone gets backwards.
    expect(boxes('āsthāya')).toEqual(['th:long']);
  });

  it('steps past a letter that cannot host, so "first" means first ABLE', () => {
    // The qualification to "the first of the two". For `tt`, `cch`, `ddh` the
    // first member hosts. But sibilants and nasals cannot carry a box, so a
    // cluster opening with one hands the box to the next letter that can:
    // `sth` hosts on `th`, not on `s`.
    expect(boxes('āsthāya')).toEqual(['th:long']);
    expect(boxes('asti')).toEqual(['t:short']);
  });
});
