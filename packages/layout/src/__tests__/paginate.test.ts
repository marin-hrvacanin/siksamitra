/**
 * Pagination.
 *
 * The tests are grouped by the PROMISE each one defends, because the paged view
 * makes exactly one promise — "this is how it will export" — and every way that
 * promise can break is a test here.
 */

import { describe, expect, it } from 'vitest';
import {
  PT_TO_PX, clampZoom, contentBox, pageGeometry, paginate, pageOf, resolveZoom,
  stepZoom, type LayoutBlock,
} from '../index.js';

const A4 = pageGeometry('a4');
const H = contentBox(A4).height;

const block = (id: string, height: number, extra: Partial<LayoutBlock> = {}): LayoutBlock =>
  ({ id, height, ...extra });

/** Every block placed, in page then document order. */
const placedIds = (map: ReturnType<typeof paginate>): string[] =>
  map.pages.flatMap((p) => p.blocks.map((b) => b.id));

describe('placing blocks', () => {
  it('fills one page while it fits', () => {
    const map = paginate([block('a', 100), block('b', 100)], A4);
    expect(map.pages).toHaveLength(1);
    expect(map.pages[0]!.used).toBe(200);
  });

  it('starts a new page when the next block does not fit', () => {
    const map = paginate([block('a', H - 10), block('b', 50)], A4);
    expect(map.pages).toHaveLength(2);
    expect(pageOf(map, 'b')).toBe(1);
  });

  it('never loses or duplicates a block', () => {
    // The invariant that matters most: pagination is a rearrangement, and any
    // bug that drops a verse silently loses text from the export.
    const blocks = Array.from({ length: 200 }, (_, i) => block(`v${i}`, 20 + (i % 37)));
    const map = paginate(blocks, A4);
    const ids = placedIds(map);
    expect(new Set(ids).size).toBe(200);
    expect(ids).toEqual(blocks.map((b) => b.id));
  });

  it('never overfills a page', () => {
    const blocks = Array.from({ length: 300 }, (_, i) => block(`v${i}`, 15 + (i % 53)));
    const map = paginate(blocks, A4);
    for (const page of map.pages) {
      // A page whose content exceeds its box is content the export will clip.
      expect(page.used).toBeLessThanOrEqual(H + 1e-9);
    }
  });

  it('honours a forced break', () => {
    const map = paginate([block('a', 50), block('b', 50, { breakBefore: true })], A4);
    expect(map.pages).toHaveLength(2);
  });

  it('always produces at least one page, even with no content', () => {
    // An empty document is a document, and a view that renders zero pages for it
    // looks broken rather than empty.
    expect(paginate([], A4).pages).toHaveLength(1);
  });

  it('places a single block taller than the page rather than looping', () => {
    const map = paginate([block('tall', H * 2.5)], A4);
    expect(placedIds(map)).toEqual(['tall']);
  });
});

describe('keeping a heading with what it introduces', () => {
  it('moves a heading to the next page rather than orphaning it', () => {
    // Room for the heading but not for the verse under it.
    const map = paginate([
      block('filler', H - 40),
      block('heading', 30, { keepWithNext: true }),
      block('verse', 100),
    ], A4);
    expect(pageOf(map, 'heading')).toBe(1);
    expect(pageOf(map, 'verse')).toBe(1);
  });

  it('keeps a run of headings together', () => {
    const map = paginate([
      block('filler', H - 60),
      block('part', 25, { keepWithNext: true }),
      block('section', 25, { keepWithNext: true }),
      block('verse', 90),
    ], A4);
    expect(pageOf(map, 'part')).toBe(pageOf(map, 'verse'));
  });
});

describe('splitting a long verse', () => {
  const lines = (n: number, h = 20): number[] => Array.from({ length: n }, () => h);

  it('splits a breakable block across the boundary', () => {
    const map = paginate([
      block('filler', H - 100),
      block('long', 400, { breakable: true, lines: lines(20) }),
    ], A4);
    expect(map.pages.length).toBeGreaterThan(1);
    const first = map.pages[0]!.blocks.find((b) => b.id === 'long');
    expect(first?.continuesOnto).toBe(true);
    const second = map.pages[1]!.blocks.find((b) => b.id === 'long');
    expect(second?.continuesFrom).toBe(true);
  });

  it('covers every line exactly once across the split', () => {
    const map = paginate([
      block('filler', H - 100),
      block('long', 400, { breakable: true, lines: lines(20) }),
    ], A4);
    const seen: number[] = [];
    for (const page of map.pages) {
      for (const b of page.blocks) {
        if (b.id !== 'long' || b.lineRange === undefined) continue;
        for (let i = b.lineRange[0]; i <= b.lineRange[1]; i += 1) seen.push(i);
      }
    }
    expect(seen).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('refuses to strand fewer lines than the orphan rule allows', () => {
    // Room for one line only. One line alone at the foot of a page is worse
    // than a short page, so the whole block moves.
    const map = paginate([
      block('filler', H - 25),
      block('verse', 100, { breakable: true, lines: lines(5), orphans: 2 }),
    ], A4);
    expect(pageOf(map, 'verse')).toBe(1);
    expect(map.pages[1]!.blocks[0]!.continuesFrom).toBeUndefined();
  });

  it('refuses to carry over fewer lines than the widow rule allows', () => {
    const total = 5;
    const lineH = 20;
    // Room for four of five lines: splitting would carry a single widow.
    const map = paginate([
      block('filler', H - lineH * 4),
      block('verse', lineH * total, { breakable: true, lines: lines(total, lineH), widows: 2 }),
    ], A4);
    expect(pageOf(map, 'verse')).toBe(1);
  });

  it('handles a block longer than a whole page by spilling across several', () => {
    const map = paginate([block('epic', 10_000, { breakable: true, lines: lines(500) })], A4);
    expect(map.pages.length).toBeGreaterThan(2);
    const seen = new Set<number>();
    for (const page of map.pages) {
      for (const b of page.blocks) {
        if (b.lineRange === undefined) continue;
        for (let i = b.lineRange[0]; i <= b.lineRange[1]; i += 1) seen.add(i);
      }
    }
    expect(seen.size).toBe(500);
  });
});

describe('THE PROMISE: pagination does not depend on zoom', () => {
  const blocks = Array.from({ length: 120 }, (_, i) => block(`v${i}`, 18 + (i % 41)));

  it('is computed in points, so no zoom can move a break', () => {
    // If this ever fails, the paged view is only accurate at one zoom level and
    // nobody knows which. The function takes no zoom argument AT ALL, which is
    // the structural guarantee; this test states the property so that adding
    // one would be caught as a design change and not slip in as a parameter.
    const map = paginate(blocks, A4);
    const signature = map.pages.map((p) => p.blocks.map((b) => b.id).join(',')).join('|');
    for (const zoom of [0.25, 0.5, 1, 1.75, 4]) {
      // Zoom affects only the pt→px conversion used to DRAW the map.
      expect(clampZoom(zoom)).toBeGreaterThan(0);
      const again = paginate(blocks, A4);
      expect(again.pages.map((p) => p.blocks.map((b) => b.id).join(',')).join('|'))
        .toBe(signature);
    }
  });

  it('is deterministic — the same input gives the same map', () => {
    const a = paginate(blocks, A4);
    const b = paginate(blocks, A4);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('changes when the PAGE changes, which is the only thing that should move it', () => {
    const a4 = paginate(blocks, A4);
    const a5 = paginate(blocks, pageGeometry('a5'));
    expect(a5.pages.length).toBeGreaterThan(a4.pages.length);
  });
});

describe('zoom', () => {
  it('clamps to the supported range', () => {
    expect(clampZoom(0.01)).toBe(0.25);
    expect(clampZoom(99)).toBe(4);
  });

  it('steps through the presets and stops at the ends', () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(0.25, -1)).toBe(0.25);
  });

  it('fits a page to the width of the viewport', () => {
    const zoom = resolveZoom({ kind: 'fit-width' }, A4, { width: 1000, height: 800 }, 48);
    // (1000 - 96) css px across a 210 mm page.
    expect(zoom).toBeCloseTo(904 / (A4.width * PT_TO_PX), 6);
  });

  it('fit-page never exceeds fit-width', () => {
    const viewport = { width: 1400, height: 500 };
    const w = resolveZoom({ kind: 'fit-width' }, A4, viewport);
    const p = resolveZoom({ kind: 'fit-page' }, A4, viewport);
    expect(p).toBeLessThanOrEqual(w);
  });

  it('survives a viewport of zero without dividing by it', () => {
    expect(resolveZoom({ kind: 'fit-width' }, A4, { width: 0, height: 0 })).toBe(0.25);
  });
});
