/**
 * A PICTURE'S WIDTH, and which of the two ways of saying it wins.
 *
 * A figure can carry a `size` — one of five names — or a `widthPct` a person
 * dragged. Three places decide a width from those: this function (which the
 * Word exporter measures with), the `fig--<size>` classes in `figure.css`, and
 * the inline `style.width` the renderer writes. They MUST agree on the
 * precedence, and the cost of them not agreeing was the whole Size control
 * going dead after one drag — the class changed, the inline width did not, and
 * `figureWidth` sided with the inline width. See `useFigures.ts` `setSize`.
 *
 * So the precedence is asserted here, at the one place that can be tested
 * without a browser, and the browser gate `tools/interaction-figure.mjs`
 * measures that the screen obeys the same rule.
 *
 * THE EXPECTATIONS ARE ARITHMETIC DONE BY HAND from the table in `figure.ts`,
 * not values read back out of it.
 */
import { describe, expect, it } from 'vitest';
import { FIGURE, figureWidth } from '../figure.js';

/** An A4 text column at 25 mm margins, in CSS pixels — the corpus's own. */
const COLUMN = 605;

describe('which width wins', () => {
  it('a dragged per cent beats every one of the five sizes', () => {
    for (const size of ['thumb', 'small', 'medium', 'large', 'full']) {
      expect(figureWidth({ size, widthPct: 57 }, COLUMN), size)
        .toBeCloseTo((COLUMN * 57) / 100, 6);
    }
  });

  it('and with no per cent, the size decides', () => {
    const bySize = ['thumb', 'small', 'medium', 'large', 'full']
      .map((size) => figureWidth({ size }, COLUMN));
    /* Strictly increasing: the five are a scale, and a scale with a step that
       goes backwards is a list a person cannot reason about. */
    for (let i = 1; i < bySize.length; i += 1) {
      expect(bySize[i], `${bySize[i - 1]} → ${bySize[i]}`).toBeGreaterThan(bySize[i - 1] as number);
    }
  });

  it('a per cent of zero is still a per cent, not a missing one', () => {
    /*
     * `widthPct: 0` is not reachable through the UI — the drag floors at 5 —
     * but `undefined` and `0` must not be confused, because the whole fix for
     * the dead Size control is that patching the field to `undefined` REMOVES
     * it. A falsy check here would have made clearing it look like setting it
     * to nothing.
     */
    expect(figureWidth({ size: 'full', widthPct: 0 }, COLUMN)).toBe(0);
    expect(figureWidth({ size: 'full' }, COLUMN)).toBeGreaterThan(0);
  });

  it('an absent size is medium, and says so in the table', () => {
    expect(figureWidth({}, COLUMN)).toBe(figureWidth({ size: 'medium' }, COLUMN));
  });

  it('an unknown size falls back rather than returning nothing', () => {
    /* A document written by a newer version, or by hand. NaN here would
       become a zero-width picture in the .docx and no error anywhere. */
    const width = figureWidth({ size: 'enormous' }, COLUMN);
    expect(Number.isFinite(width)).toBe(true);
    expect(width).toBeGreaterThan(0);
  });
});

describe('the size table', () => {
  it('full is the whole column', () => {
    expect(FIGURE['fig-full']).toBe('100%');
    expect(figureWidth({ size: 'full' }, COLUMN)).toBe(COLUMN);
  });

  it('a per cent scales with the column and a rem does not', () => {
    /* The two units the table mixes. A thumb is an absolute size — a thumbnail
       is a thumbnail on any paper — and full is a fraction of whatever column
       it is in. Getting these the same way round is what keeps a picture the
       size it looks in the editor when it reaches A5. */
    expect(figureWidth({ size: 'full' }, 1000)).toBe(1000);
    expect(figureWidth({ size: 'thumb' }, 1000))
      .toBe(figureWidth({ size: 'thumb' }, COLUMN));
  });

  it('every width in the table is a length, and there are five of them', () => {
    /* The table also carries a ghost's opacity and the float's gutters, which
       are not lengths in the same sense — so the WIDTHS are named, and the
       count is asserted: a sixth size added without a thought for how it
       exports fails here rather than reaching a `.docx`. */
    const widths = ['fig-thumb', 'fig-small', 'fig-small-min', 'fig-small-max',
      'fig-medium', 'fig-medium-min', 'fig-medium-max', 'fig-large', 'fig-full'];
    for (const name of widths) {
      const value = FIGURE[name as keyof typeof FIGURE];
      expect(value, `${name} is missing from the table`).toBeDefined();
      expect(String(value), name).toMatch(/^[\d.]+(%|rem|px)$/);
    }
    const sizes = Object.keys(FIGURE)
      .filter((k) => /^fig-(thumb|small|medium|large|full)$/.test(k));
    expect(sizes.sort()).toEqual(
      ['fig-full', 'fig-large', 'fig-medium', 'fig-small', 'fig-thumb'],
    );
  });
});
