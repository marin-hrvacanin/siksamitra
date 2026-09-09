/**
 * WHERE THE DRAWING CHANGES.
 *
 * `toRuns` decides how many elements a verse becomes, so its faults are the
 * ones that show as a box in two pieces or a mark on the wrong letter. The
 * properties asserted here are about the RESULT — the runs cover the text
 * exactly once, in order, with no gap and no overlap — rather than about the
 * steps, and they are checked over random markings as well as chosen ones.
 */
import { describe, expect, it } from 'vitest';
import { mark, normalise, type Mark } from '@siksamitra/format';
import { toLines, toRuns } from '../runs.js';

const TEXT = 'agnim īḷe purohitaṁ';

const hold = (from: number, to: number, v = 'long'): Mark =>
  mark({ k: 'hold', from, to, v });

/** The runs, put back together, must be the text — every time. */
const rebuilt = (text: string, marks: Mark[]): string =>
  toRuns(text, marks).map((r) => r.text).join('');

function rng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

describe('the runs are the text', () => {
  it('with no markings at all, the whole verse is one run', () => {
    const runs = toRuns(TEXT, []);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.text).toBe(TEXT);
  });

  it('they cover the text exactly once, in order, over random markings', () => {
    const random = rng(5);
    for (let n = 0; n < 300; n += 1) {
      const marks: Mark[] = [];
      for (let k = 0; k < 4; k += 1) {
        const a = Math.floor(random() * TEXT.length);
        const b = Math.floor(random() * TEXT.length);
        if (a === b) continue;
        marks.push(hold(Math.min(a, b), Math.max(a, b), random() < 0.5 ? 'long' : 'short'));
      }
      const list = normalise(marks.reduce<Mark[]>((acc, m) => {
        /* Overlapping holdings are not representable; apply them in turn so
           the input is a list the model would actually hold. */
        const cleared = acc.filter((x) => x.to <= m.from || x.from >= m.to);
        return [...cleared, m];
      }, []));
      const runs = toRuns(TEXT, list);
      expect(rebuilt(TEXT, list), `seed step ${n}`).toBe(TEXT);
      /* No gaps and no overlaps: each run starts where the last one ended. */
      let at = 0;
      for (const r of runs) {
        expect(r.from).toBe(at);
        expect(r.to).toBe(at + r.text.length);
        at = r.to;
      }
      expect(at).toBe(TEXT.length);
    }
  });
});

describe('a marking becomes ONE run', () => {
  it('a holding across a space is one run, not one per word', () => {
    /* The whole point: `purohitaṁ` and the space before it under one box. */
    const runs = toRuns(TEXT, [hold(9, 15)]);
    const held = runs.filter((r) => r.marks.hold === 'long');
    expect(held).toHaveLength(1);
    expect(held[0]!.text).toBe(TEXT.slice(9, 15));
    expect(held[0]!.text).toContain(' ');
  });

  it('two holdings of the same weight that touch are still one run', () => {
    /* `normalise` fuses them in the model; this checks the drawing agrees. */
    const marks = normalise([hold(2, 5), hold(5, 8)]);
    expect(marks.filter((m) => m.k === 'hold')).toHaveLength(1);
    expect(toRuns(TEXT, marks).filter((r) => r.marks.hold !== undefined)).toHaveLength(1);
  });

  it('two holdings of DIFFERENT weight that touch are two runs', () => {
    const marks = normalise([hold(2, 5, 'short'), hold(5, 8, 'long')]);
    const held = toRuns(TEXT, marks).filter((r) => r.marks.hold !== undefined);
    expect(held.map((r) => [r.text, r.marks.hold]))
      .toEqual([[TEXT.slice(2, 5), 'short'], [TEXT.slice(5, 8), 'long']]);
  });

  it('a svara over a holding splits the run where they disagree', () => {
    const marks = normalise([hold(2, 8), mark({ k: 'svara', from: 5, to: 10, v: 'anudatta' })]);
    const runs = toRuns(TEXT, marks);
    const both = runs.filter((r) => r.marks.hold !== undefined && r.marks.svara !== undefined);
    expect(both).toHaveLength(1);
    expect(both[0]!.text).toBe(TEXT.slice(5, 8));
  });
});

describe('what sits between the runs', () => {
  it('a pause is carried on the run that follows it', () => {
    const marks = normalise([mark({ k: 'pause', from: 6, to: 6, v: 'short' })]);
    const runs = toRuns(TEXT, marks);
    const carrying = runs.find((r) => r.before.length > 0);
    expect(carrying?.from).toBe(6);
    expect(carrying?.before[0]!.k).toBe('pause');
  });

  it('a pause past the last letter is carried on the last run', () => {
    const marks = normalise([mark({ k: 'pause', from: TEXT.length, to: TEXT.length, v: 'long' })]);
    const runs = toRuns(TEXT, marks);
    expect(runs[runs.length - 1]!.after.map((m) => m.k)).toEqual(['pause']);
  });

  it('a point marking always forces a boundary, so nothing is drawn inside a run', () => {
    const marks = normalise([mark({ k: 'sbhakti', from: 4, to: 4 })]);
    expect(toRuns(TEXT, marks).some((r) => r.from === 4)).toBe(true);
  });
});

describe('lines', () => {
  const TWO = 'agnim īḷe\npurohitaṁ';

  it('a run never straddles a line break', () => {
    for (const r of toRuns(TWO, [hold(4, 14)])) {
      expect(r.text === '\n' || !r.text.includes('\n')).toBe(true);
    }
  });

  it('the lines come back in order, without the break', () => {
    const lines = toLines(toRuns(TWO, []));
    expect(lines.map((l) => l.map((r) => r.text).join(''))).toEqual(['agnim īḷe', 'purohitaṁ']);
  });

  it('a holding that spans the break becomes one run per line', () => {
    /* 4..9 on the first line and 10..14 on the second; the break itself
       carries nothing, because it is a separator rather than a letter. */
    const runs = toRuns(TWO, [hold(4, 14)]);
    expect(runs.filter((r) => r.marks.hold !== undefined).map((r) => r.text))
      .toEqual(['m īḷe', 'puro']);
    expect(runs.find((r) => r.text === '\n')?.marks).toEqual({});
  });
});

describe('substitutions', () => {
  it('a run carries what its letters replaced', () => {
    const marks = normalise([mark({ k: 'was', from: 4, to: 5, v: 'ṁ' })]);
    const run = toRuns(TEXT, marks).find((r) => r.marks.was !== undefined);
    expect(run?.text).toBe(TEXT.slice(4, 5));
    expect(run?.marks.was).toBe('ṁ');
  });

  it('two substituted letters side by side stay two runs', () => {
    /* They are two substitutions — one `ḥ` each — and one run would say the
       pair of them replaced a single letter. */
    const marks = normalise([
      mark({ k: 'was', from: 2, to: 3, v: 'ḥ' }),
      mark({ k: 'was', from: 3, to: 4, v: 'ḥ' }),
    ]);
    expect(toRuns(TEXT, marks).filter((r) => r.marks.was !== undefined)).toHaveLength(2);
  });
});
