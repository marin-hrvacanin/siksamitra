/**
 * The ribbon's fit.
 *
 * Three fitting bugs shipped past a green gate because this arithmetic lived
 * inside a hook and could only be checked by resizing a browser and looking.
 * Every one of them is a case below — and the last test is the invariant that
 * makes all three impossible rather than merely fixed: over a sweep of widths
 * and group sets, THE FIT NEVER EXCEEDS THE SPACE.
 */
import { describe, expect, it } from 'vitest';
import { FOLDED_W, MORE_W, fitGroups, fitWidth } from '../fit-groups.js';

/** Five groups of plausible width, in priority order. */
const GROUPS = [
  { id: 'mode', priority: 0 },
  { id: 'holding', priority: 1 },
  { id: 'history', priority: 2 },
  { id: 'file', priority: 4 },
  { id: 'library', priority: 5 },
];
const WIDTHS = new Map([
  ['mode', 118], ['holding', 130], ['history', 129], ['file', 165], ['library', 159],
]);
const fit = (available: number, groups = GROUPS, widths = WIDTHS) =>
  fitGroups({ groups, widths, available });

describe('everything fits', () => {
  it('keeps every group inline when there is room', () => {
    const f = fit(1400);
    expect(f.visible).toHaveLength(5);
    expect(f.folded).toEqual([]);
    expect(f.overflow).toEqual([]);
  });

  it('shows everything before anything has been measured', () => {
    // A first paint with groups hidden and then appearing is a visible flash.
    const f = fitGroups({ groups: GROUPS, widths: new Map(), available: 300 });
    expect(f.visible).toHaveLength(5);
  });

  it('shows everything when the row has no width yet', () => {
    expect(fit(0).visible).toHaveLength(5);
  });
});

describe('one group over budget', () => {
  /*
   * 701px of groups. Four of them are 542, so a row of 642 holds those four
   * plus the 100px folded button and nothing more — which is the window where
   * a single group folds into a button of its own.
   */
  const f = fit(660);

  it('folds exactly one, into a button of its own', () => {
    expect(f.folded).toEqual(['library']);
    expect(f.overflow).toEqual([]);
    expect(f.visible).toEqual(['mode', 'holding', 'history', 'file']);
  });

  it("counts the folded button's own width", () => {
    /*
     * BUG 1. The fold used to be free: the survivors were fitted exactly and
     * then a 92px button was added for the one that had been dropped, 18px
     * past the edge. So 542 + 100 must fit in 660 — and a row of 641, one
     * pixel short of that, must NOT keep four.
     */
    expect(fitWidth({ groups: GROUPS, widths: WIDTHS, available: 660 }, f)).toBe(542 + FOLDED_W);
    expect(fitWidth({ groups: GROUPS, widths: WIDTHS, available: 660 }, f))
      .toBeLessThanOrEqual(660);
    expect(fit(641).visible).toHaveLength(3);
  });

  it('prefers the shared button when the folded one would not fit', () => {
    /*
     * At 620 the four survivors plus a folded button are 642 — so the fit
     * gives up a third group instead and uses the narrower shared button.
     * Measured in a browser at the same width: 3 inline, 2 behind More.
     */
    const tight = fit(620);
    expect(tight.visible).toEqual(['mode', 'holding', 'history']);
    expect(tight.folded).toEqual([]);
    expect(tight.overflow).toEqual(['file', 'library']);
  });
});

describe('several groups over budget', () => {
  it('puts them behind one shared button rather than several', () => {
    const f = fit(420);
    expect(f.folded).toEqual([]);
    expect(f.overflow.length).toBeGreaterThan(1);
    expect(fitWidth({ groups: GROUPS, widths: WIDTHS, available: 420 }, f))
      .toBeLessThanOrEqual(420);
  });

  it('reconsiders what it has already admitted', () => {
    /*
     * BUG 2. The old loop grew a total from the front and never went back, so
     * once the shared button was added the row was over budget with no way to
     * recover: at 384px it kept three groups (377px) plus a 68px button and
     * ran 59px past the edge. The cut only ever shrinks, so this cannot happen.
     */
    const f = fit(384);
    expect(f.visible).toEqual(['mode', 'holding']);
    expect(fitWidth({ groups: GROUPS, widths: WIDTHS, available: 384 }, f))
      .toBeLessThanOrEqual(384);
  });

  it('gives up its last group rather than overflowing', () => {
    const f = fit(140);
    expect(f.visible).toEqual([]);
    expect(f.overflow).toHaveLength(5);
    expect(fitWidth({ groups: GROUPS, widths: WIDTHS, available: 140 }, f)).toBe(MORE_W);
  });
});

describe('the order things happen in', () => {
  it('drops the lowest priority first, and keeps the highest longest', () => {
    // Mode is priority 0: it is the last thing to go, at every width.
    for (const w of [1400, 800, 620, 500, 420, 300, 200]) {
      const f = fit(w);
      if (f.visible.length > 0) expect(f.visible, `${w}px`).toContain('mode');
    }
  });

  it('lists what it hid in the ROW s order, not in priority order', () => {
    /*
     * `file` (priority 4) sits before `library` (5) in the ribbon, and a
     * popover that reordered them would not read like the ribbon it came from.
     */
    const groups = [
      { id: 'a', priority: 9 }, { id: 'b', priority: 1 }, { id: 'c', priority: 5 },
    ];
    const widths = new Map([['a', 200], ['b', 200], ['c', 200]]);
    const f = fitGroups({ groups, widths, available: 300 });
    expect(f.overflow).toEqual(['a', 'c']);
  });
});

describe('the reserve', () => {
  it('is space the groups may not use', () => {
    const room = 1400;
    expect(fitGroups({ groups: GROUPS, widths: WIDTHS, available: room }).visible)
      .toHaveLength(5);
    expect(fitGroups({
      groups: GROUPS, widths: WIDTHS, available: room, reserve: room - 300,
    }).visible.length).toBeLessThan(5);
  });
});

/**
 * THE INVARIANT, over a sweep — which is what makes the three bugs impossible
 * rather than fixed.
 *
 * For every width from 120 to 1500 and for four different group sets: the fit
 * occupies no more than the space available, and every group is in exactly one
 * of the three states.
 */
describe('the fit never exceeds the space', () => {
  const sets = [
    GROUPS,
    GROUPS.slice(0, 3),
    [{ id: 'only', priority: 0 }],
    [
      { id: 'w1', priority: 0 }, { id: 'w2', priority: 1 }, { id: 'w3', priority: 2 },
      { id: 'w4', priority: 3 }, { id: 'w5', priority: 4 }, { id: 'w6', priority: 5 },
    ],
  ];
  const widthsFor = (groups: typeof GROUPS): Map<string, number> =>
    new Map(groups.map((g, i) => [g.id, [118, 130, 129, 165, 159, 240][i % 6]!]));

  it('holds at every width, for every set', () => {
    let checked = 0;
    for (const groups of sets) {
      const widths = widthsFor(groups);
      for (let available = 120; available <= 1500; available += 7) {
        const input = { groups, widths, available };
        const f = fitGroups(input);
        expect(fitWidth(input, f), `${groups.length} groups in ${available}px`)
          .toBeLessThanOrEqual(available);
        expect(f.visible.length + f.folded.length + f.overflow.length)
          .toBe(groups.length);
        // Never both affordances at once: one folded button OR one shared.
        expect(f.folded.length === 0 || f.overflow.length === 0).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(700);
  });

  it('is monotone: a wider row never shows less', () => {
    let last = -1;
    for (let available = 120; available <= 1500; available += 13) {
      const shown = fit(available).visible.length;
      expect(shown, `${available}px`).toBeGreaterThanOrEqual(last === -1 ? 0 : last);
      last = shown;
    }
  });
});
