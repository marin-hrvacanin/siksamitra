/**
 * WHAT ONE PAGE DRAWS, AND WHAT MAY BE SPLIT AT ALL.
 *
 * Two rules, both of which were once nowhere:
 *
 *   `pageContent`  the page map already says which lines of a block are on
 *                  which page (`lineRange`); the view chose its blocks by ID
 *                  and read none of it, so a split verse — whose id is on both
 *                  pages — was drawn WHOLE on both.
 *   `mayBreak`     whether a verse may split at all: only when it cannot fit
 *                  a page by itself. His ruling (2026-10-02): a page that
 *                  fills and breaks a verse is "precisely what I dislike".
 *   `breaksAfter`  where a page may end inside a verse too tall for one: his
 *                  Word's widow control within each of his paragraphs, and
 *                  its last line kept with its translation.
 */
import { describe, expect, it } from 'vitest';
import type { Page } from '@siksamitra/layout';
import { breaksAfter, mayBreak, pageContent } from '../page-slices.js';

const page = (blocks: Page['blocks']): Page => ({ index: 0, blocks, used: 0 });

describe('whether a verse may split at all', () => {
  it('not when it fits a page — it moves to the next one whole', () => {
    expect(mayBreak(300, 700)).toBe(false);
    expect(mayBreak(700, 700)).toBe(false);
  });
  it('only when it is taller than a page, where nothing else can hold it', () => {
    expect(mayBreak(700.5, 700)).toBe(true);
  });
});

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

describe('where a page may end inside a verse — his Word’s rule', () => {
  /* `breaksAfter(starts)`: for each line but the last, may a page end after it. */
  it('one paragraph of four lines: only in the middle — never one line alone at either end', () => {
    expect(breaksAfter([true, false, false, false])).toEqual([false, true, false]);
  });
  it('six lines, one paragraph — his sūryopaniṣat 7 broke four and two', () => {
    expect(breaksAfter([true, false, false, false, false, false])).toEqual([false, true, true, true, false]);
  });
  it('two half-verses of two: between them, and nowhere inside either (bhū sūktam 8)', () => {
    expect(breaksAfter([true, false, true, false])).toEqual([false, true, false]);
  });
  it('a refrain, a line a paragraph: after any line', () => {
    expect(breaksAfter([true, true, true])).toEqual([true, true]);
  });
  it('nine and one (sūryopaniṣat 5): inside the nine away from its ends, and between them', () => {
    const starts = [true, false, false, false, false, false, false, false, false, true];
    expect(breaksAfter(starts)).toEqual([false, true, true, true, true, true, true, false, true]);
  });
  it('two lines are never parted', () => {
    expect(breaksAfter([true, false])).toEqual([false]);
  });
});
