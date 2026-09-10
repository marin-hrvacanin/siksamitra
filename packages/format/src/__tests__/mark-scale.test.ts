/**
 * THE TWO OPERATIONS EVERY SAVE RUNS, AND HOW THEY SCALE.
 *
 * `normalise` and `markFaults` both grouped their markings by kind with
 * `byKind.set(m.k, [...(byKind.get(m.k) ?? []), m])` — a copy of the whole
 * group for every marking in it — and `markFaults` then found each marking's
 * place again with `marks.indexOf`. Three quadratics on two functions that run
 * on the save path.
 *
 * MEASURED BEFORE THE FIX: 2 000 markings 19 ms and 11 ms; 8 000 159 ms and
 * 127 ms; 20 000 2 559 ms and 2 501 ms. After: 5 ms and 18 ms at 20 000, and
 * 13 ms and 27 ms at 60 000.
 *
 * HOW REACHABLE IT WAS, honestly: the largest single verse in the corpus
 * carries 268 markings, and both are called per VERSE — so this was a landmine
 * rather than a stall somebody was feeling. A document carries 11 538 and the
 * corpus 28 572, so the landmine was one long pasted verse away.
 *
 * WHY THIS TEST IS A RATIO AND NOT A STOPWATCH. An absolute millisecond budget
 * on a shared machine is a flaky test, and a flaky test gets deleted. Doubling
 * the input twice should cost about four times as much, not sixteen — so the
 * assertion is on the SHAPE of the growth, with a ceiling loose enough that
 * only a return to quadratic can breach it.
 */
import { describe, expect, it } from 'vitest';
import { mark, markFaults, type Mark } from '../mark.js';
import { normalise } from '../mark-ops.js';

/** `n` non-touching holdings, so nothing fuses and every one is kept. */
const holdings = (n: number): Mark[] => Array.from({ length: n }, (_, i) =>
  mark({ k: 'hold', from: i * 3, to: i * 3 + 2, v: 'long' }));

const textFor = (n: number): string => 'a'.repeat(n * 3 + 4);

/** The best of three runs, so one unlucky garbage collection cannot fail it. */
function fastest(work: () => void): number {
  let best = Infinity;
  for (let i = 0; i < 3; i += 1) {
    const at = performance.now();
    work();
    best = Math.min(best, performance.now() - at);
  }
  return best;
}

describe('grouping markings by kind is linear', () => {
  /*
   * 4 000 and 16 000 — four times the input. Quadratic would be about
   * sixteen times the time; linear about four. The ceiling is TEN, which no
   * linear implementation approaches and no quadratic one can meet.
   */
  const SMALL = 4000;
  const LARGE = SMALL * 4;
  const CEILING = 10;

  it('normalise does not go quadratic', () => {
    const small = holdings(SMALL);
    const large = holdings(LARGE);
    const t1 = fastest(() => { normalise(small); });
    const t2 = fastest(() => { normalise(large); });
    /* A floor on the small reading, or a sub-millisecond measurement makes the
       ratio meaningless. */
    const ratio = t2 / Math.max(t1, 0.5);
    expect(ratio, `4x the markings cost ${ratio.toFixed(1)}x the time `
      + `(${t1.toFixed(1)}ms → ${t2.toFixed(1)}ms)`).toBeLessThan(CEILING);
  });

  it('markFaults does not go quadratic either', () => {
    const small = holdings(SMALL);
    const large = holdings(LARGE);
    const t1 = fastest(() => { markFaults(small, textFor(SMALL)); });
    const t2 = fastest(() => { markFaults(large, textFor(LARGE)); });
    const ratio = t2 / Math.max(t1, 0.5);
    expect(ratio, `4x the markings cost ${ratio.toFixed(1)}x the time `
      + `(${t1.toFixed(1)}ms → ${t2.toFixed(1)}ms)`).toBeLessThan(CEILING);
  });

  it('and a document-sized list is not a stall', () => {
    /*
     * 28 572 is the whole corpus's markings. Not a shape this is called with
     * today — both run per verse — but it is the number a paste could reach,
     * and before the fix it took over three seconds.
     */
    const all = holdings(28572);
    const at = performance.now();
    normalise(all);
    markFaults(all, textFor(28572));
    const took = performance.now() - at;
    expect(took, `the corpus's markings took ${took.toFixed(0)}ms`).toBeLessThan(1500);
  });
});

describe('and it still does what it did', () => {
  /*
   * THE CONTROL FOR THE WHOLE FILE. A faster function that returns something
   * else is not a fix, and every assertion above would pass on one.
   */
  it('fuses two holdings that meet and agree, and leaves the rest sorted', () => {
    const out = normalise([
      mark({ k: 'hold', from: 4, to: 6, v: 'long' }),
      mark({ k: 'hold', from: 2, to: 4, v: 'long' }),
      mark({ k: 'svara', from: 3, to: 4, v: 'anudatta' }),
    ]);
    expect(out.filter((m) => m.k === 'hold').map((m) => [m.from, m.to])).toEqual([[2, 6]]);
    expect(out.map((m) => m.k)).toEqual(['hold', 'svara']);
  });

  it('and reports a fault at the marking\'s own index in the list it was given', () => {
    /*
     * The index used to come from `marks.indexOf(here)` and now travels with
     * the marking. It has to be the position in the list the CALLER passed,
     * because that is what a caller drops by index — `retext` and
     * `writeSources` both do.
     */
    const marks = [
      mark({ k: 'svara', from: 0, to: 1, v: 'anudatta' }),
      mark({ k: 'hold', from: 0, to: 2, v: 'long' }),
      /* Overlaps the holding above: the fault belongs to THIS one, at index 2. */
      mark({ k: 'hold', from: 1, to: 3, v: 'long' }),
    ];
    const faults = markFaults(marks, 'abcd');
    const overlap = faults.find((f) => f.code === 'overlap');
    expect(overlap).toBeDefined();
    expect(overlap!.at, 'the fault is reported at the third marking').toBe(2);
  });
});
