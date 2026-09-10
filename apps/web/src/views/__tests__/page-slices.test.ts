/**
 * WHAT ONE PAGE DRAWS, AND WHAT MAY BE SPLIT AT ALL.
 *
 * Two rules, both of which were once nowhere:
 *
 *   `pageContent`  the page map already says which lines of a block are on
 *                  which page (`lineRange`); the view chose its blocks by ID
 *                  and read none of it, so a split verse — whose id is on both
 *                  pages — was drawn WHOLE on both.
 *   `mayBreak`     a verse is not split at all unless it cannot fit a page by
 *                  itself, because that is what his `Translit` style says
 *                  (`w:keepLines`) and what `export.css` says to a printing
 *                  browser (`break-inside: avoid`). The view was the only one
 *                  of the three that split a verse for tidiness.
 */
import { describe, expect, it } from 'vitest';
import type { Page } from '@siksamitra/layout';
import { mayBreak, pageContent } from '../page-slices.js';

const page = (blocks: Page['blocks']): Page => ({ index: 0, blocks, used: 0 });

describe('the blocks one page draws', () => {
  it('is every id the map put on it', () => {
    const { ids } = pageContent(page([
      { id: 'h:s', top: 0, height: 30 },
      { id: 'v:s:1', top: 30, height: 60 },
    ]));
    expect([...ids]).toEqual(['h:s', 'v:s:1']);
  });

  it('and no ranges at all when nothing is split', () => {
    /* Absent rather than empty, so the renderer skips the lookup for the
       overwhelmingly common page. */
    expect(pageContent(page([{ id: 'v:s:1', top: 0, height: 60 }])).slices).toBeUndefined();
  });

  it('a block the break runs through comes with its lines', () => {
    const { ids, slices } = pageContent(page([
      { id: 'v:s:1', top: 0, height: 60 },
      { id: 'v:s:2', top: 60, height: 40, lineRange: [0, 1], continuesOnto: true },
    ]));
    expect([...ids]).toEqual(['v:s:1', 'v:s:2']);
    expect(slices?.get('v:s:2')).toEqual([0, 1]);
    /* Only the split one. A whole block with a range would be drawn short. */
    expect(slices?.has('v:s:1')).toBe(false);
    expect(slices?.size).toBe(1);
  });

  it('and the page after it gets the OTHER lines, not the same ones', () => {
    /*
     * The two halves must not agree. This is the shape of the original fault:
     * both pages naming the same block and drawing the same thing.
     */
    const first = pageContent(page([
      { id: 'v:s:2', top: 0, height: 40, lineRange: [0, 1], continuesOnto: true },
    ]));
    const second = pageContent(page([
      { id: 'v:s:2', top: 0, height: 40, lineRange: [2, 3], continuesFrom: true },
    ]));
    expect(first.slices?.get('v:s:2')).toEqual([0, 1]);
    expect(second.slices?.get('v:s:2')).toEqual([2, 3]);
    expect(first.slices?.get('v:s:2')).not.toEqual(second.slices?.get('v:s:2'));
  });
});

describe('whether a block may be split', () => {
  it('a verse that fits a page is kept whole', () => {
    /* MEASURED as a divergence, not chosen as a taste: the view split 22 of
       Śrī Rudram's verses at A4 that both exports keep whole. */
    expect(mayBreak(200, 700)).toBe(false);
  });

  it('a verse exactly as tall as the column is kept whole', () => {
    /* It fits. Splitting it would produce a page with two lines on it and a
       page with the rest, for nothing. */
    expect(mayBreak(700, 700)).toBe(false);
  });

  it('and one taller than the page is split, because nothing else can be done', () => {
    /* Word splits a paragraph taller than the page despite `keepLines`, and so
       does Chrome despite `break-inside: avoid`. Refusing here would draw a
       verse off the bottom of the paper for ever. */
    expect(mayBreak(701, 700)).toBe(true);
    expect(mayBreak(2100, 700)).toBe(true);
  });
});
