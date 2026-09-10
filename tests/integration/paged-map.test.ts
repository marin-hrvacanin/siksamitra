/**
 * THE PAGE MAP AND WHAT THE VIEW MAKES OF IT, TOGETHER.
 *
 * `paginate` is unit-tested on its own and `pageContent` is unit-tested on its
 * own, and both passed for the whole period a split verse was drawn twice: the
 * map said `lineRange` and the view never asked. What was missing is the tier
 * that puts the two halves together and asks the only question that matters —
 * do the pages, taken together, hold the document exactly once?
 *
 * NO BROWSER HERE, deliberately. The browser gate
 * (`tools/interaction-pages.mjs`) drives the real thing and is the only place
 * that can see a real rectangle, but it can only test the documents that exist:
 * once a verse is kept whole unless it cannot fit a page, nothing in the corpus
 * splits at all, and the splitting machinery would go untested. This tier
 * constructs the verse that has no other option — one taller than the paper —
 * which is exactly the case the machinery is for.
 *
 * The heights are given rather than measured, because measurement is
 * `useMeasure`'s subject and it has its own tests. What is under test here is
 * the placement and the projection.
 */
import { describe, expect, it } from 'vitest';
import { contentBox, pageGeometry, paginate, type LayoutBlock } from '@siksamitra/layout';
import { mayBreak, pageContent } from '../../apps/web/src/views/page-slices.js';

const A4 = pageGeometry('a4');
const COLUMN = contentBox(A4).height;

/** A verse of `n` lines, each `lead` points tall. */
const verse = (id: string, n: number, lead = 38): LayoutBlock => ({
  id,
  height: n * lead,
  lines: Array.from({ length: n }, () => lead),
});

/**
 * The blocks as the VIEW hands them to `paginate` — its `keepWithNext` and
 * `mayBreak` decisions included, because those are what make the map the map.
 */
const asTheViewDoes = (blocks: readonly LayoutBlock[]): LayoutBlock[] => blocks.map((b) => ({
  id: b.id,
  height: b.height,
  keepWithNext: b.id.startsWith('h:'),
  ...(b.id.startsWith('h:') || b.lines === undefined || !mayBreak(b.height, COLUMN)
    ? {}
    : { breakable: true, lines: b.lines }),
}));

/**
 * Every line of every block, in the order the pages draw them.
 *
 * This is the composition the fault lived in: the ids come from the map, the
 * ranges come from `pageContent`, and a block with no range is drawn whole —
 * which is the branch that put a split verse on two pages in full.
 */
function drawn(
  blocks: readonly LayoutBlock[],
): Map<string, { lines: number[]; pages: number[] }> {
  const map = paginate(asTheViewDoes(blocks), A4);
  const lineCount = new Map(blocks.map((b) => [b.id, b.lines?.length ?? 1]));
  const out = new Map<string, { lines: number[]; pages: number[] }>();
  for (const p of map.pages) {
    const { ids, slices } = pageContent(p);
    for (const id of ids) {
      const range = slices?.get(id);
      const n = lineCount.get(id)!;
      const from = range?.[0] ?? 0;
      const to = range?.[1] ?? n - 1;
      const entry = out.get(id) ?? { lines: [], pages: [] };
      for (let i = from; i <= to; i += 1) entry.lines.push(i);
      entry.pages.push(p.index);
      out.set(id, entry);
    }
  }
  return out;
}

describe('a document of ordinary verses', () => {
  /* 30 four-line verses at 38 pt a line: 152 pt each, four to a 700 pt page. */
  const blocks = Array.from({ length: 30 }, (_, i) => verse(`v:s:${i}`, 4));

  it('holds every verse exactly once, whole', () => {
    const d = drawn(blocks);
    expect(d.size).toBe(30);
    for (const [id, { lines, pages }] of d) {
      expect(lines, id).toEqual([0, 1, 2, 3]);
      expect(pages, id).toHaveLength(1);
    }
  });

  it('and splits none of them, because they fit', () => {
    /*
     * HIS OWN STYLE'S RULE. `keepLines` on `Translit`, `break-inside: avoid`
     * in the print sheet, and until this was taught to the view it split 22 of
     * Śrī Rudram's verses at A4 that both exports keep whole.
     */
    const map = paginate(asTheViewDoes(blocks), A4);
    const split = map.pages.flatMap((p) => p.blocks).filter((b) => b.lineRange !== undefined);
    expect(split).toEqual([]);
  });

  it('and no page is fuller than the column — the arithmetic, not the ink', () => {
    const map = paginate(asTheViewDoes(blocks), A4);
    for (const p of map.pages) {
      expect(p.used, `page ${p.index}`).toBeLessThanOrEqual(COLUMN);
    }
  });
});

describe('a verse taller than the paper', () => {
  /* 30 lines at 38 pt is 1140 pt against a 700 pt column: it cannot be kept
     whole by any rule, so it is the one case the splitting is for. */
  const blocks = [verse('v:s:0', 4), verse('v:s:1', 30), verse('v:s:2', 4)];

  it('is spread over pages, and every line is drawn exactly once', () => {
    const d = drawn(blocks);
    const long = d.get('v:s:1')!;
    expect(long.pages.length).toBeGreaterThan(1);
    expect(long.lines).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(new Set(long.lines).size).toBe(30);
  });

  it('and its neighbours are untouched', () => {
    /* A control on the splitting: a bug that gave every block a range would
       satisfy the check above. */
    const d = drawn(blocks);
    expect(d.get('v:s:0')!.lines).toEqual([0, 1, 2, 3]);
    expect(d.get('v:s:2')!.lines).toEqual([0, 1, 2, 3]);
    expect(d.get('v:s:0')!.pages).toHaveLength(1);
  });

  it('its slices are contiguous and in order', () => {
    /* Two pages that both drew lines 0–14 would still produce 30 lines in the
       gathered list if a third drew 15–29 twice. Order and contiguity say it
       properly. */
    const map = paginate(asTheViewDoes(blocks), A4);
    const ranges = map.pages
      .flatMap((p) => p.blocks)
      .filter((b) => b.id === 'v:s:1')
      .map((b) => b.lineRange ?? [0, 29]);
    expect(ranges.length).toBeGreaterThan(1);
    expect(ranges[0]![0]).toBe(0);
    expect(ranges[ranges.length - 1]![1]).toBe(29);
    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i]![0], `slice ${i}`).toBe(ranges[i - 1]![1] + 1);
    }
  });

  it('and a verse two pages long really does take two, not one over-full one', () => {
    const map = paginate(asTheViewDoes(blocks), A4);
    for (const p of map.pages) {
      /* A page holding one slice of an over-tall block may be as full as the
         column but no fuller. */
      expect(p.used, `page ${p.index}`).toBeLessThanOrEqual(COLUMN + 0.001);
    }
  });
});

describe('a heading is never left alone, and never split', () => {
  it('a heading at the foot of a page moves with what it introduces', () => {
    /*
     * Sized so the heading would land last on page one: five four-line verses
     * fill 760 of 700 pt, so four fit and the fifth moves; put the heading
     * fifth and it must move WITH the verse after it.
     */
    const blocks = [
      verse('v:s:0', 4), verse('v:s:1', 4), verse('v:s:2', 4), verse('v:s:3', 4),
      { id: 'h:s2', height: 30 }, verse('v:s2:0', 4),
    ];
    const map = paginate(asTheViewDoes(blocks), A4);
    const pageOf = (id: string): number =>
      map.pages.findIndex((p) => p.blocks.some((b) => b.id === id));
    expect(pageOf('h:s2')).toBe(pageOf('v:s2:0'));
  });

  it('and a heading is never given a line range', () => {
    const blocks = [{ id: 'h:s', height: 30, lines: [15, 15] }, verse('v:s:0', 4)];
    const map = paginate(asTheViewDoes(blocks), A4);
    expect(map.pages.flatMap((p) => p.blocks).every((b) => b.lineRange === undefined)).toBe(true);
  });
});
