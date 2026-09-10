/**
 * WHAT A BLOCK COSTS A PAGE.
 *
 * `paginate` places blocks whose heights this module measured, and it trusts
 * two things about them: that a block's height is all the room it takes, and
 * that a breakable block's `lines` SUM to that height. Both were false.
 *
 *   the gaps      a block's height was its border box, which excludes every
 *                 margin. A verse is separated from the next by
 *                 `--doc-verse-gap` and a heading by more, and the page map
 *                 was told about none of it — so it filled a page with the sum
 *                 of the boxes and the browser drew the boxes AND the gaps.
 *                 MEASURED in the running program on Śrī Rudram: 40 to 101 px
 *                 unaccounted per page, and 16 of 58 A4 pages drawn past the
 *                 foot of their text column.
 *   the tail      a verse's `lines` were the pādas' own heights, which leave
 *                 out the gaps between them and everything the verse carries
 *                 UNDERNEATH — translation, instructions, source. A split
 *                 verse's second half was therefore believed shorter than it
 *                 is.
 *
 * NO LAYOUT ENGINE HERE, and that is deliberate: this tier tests the
 * ARITHMETIC over rectangles, with the rectangles given. The rectangles a real
 * browser produces are the browser gate's subject
 * (`tools/interaction-pages.mjs`), which measures the drawn page against the
 * page's own margins. Two tiers, two different things, neither standing in for
 * the other.
 */
import { describe, expect, it } from 'vitest';
import { measureBlocks } from '../useMeasure.js';

/** Points per pixel — the conversion `measureBlocks` applies. */
const PT = 72 / 96;

interface Box { readonly top: number; readonly bottom: number }

const rect = (b: Box): DOMRect =>
  ({ top: b.top, bottom: b.bottom, height: b.bottom - b.top } as DOMRect);

/** An element with a rectangle, and optionally lines inside it. */
const el = (id: string, box: Box, lines: readonly Box[] = []): unknown => ({
  dataset: { blockId: id },
  getBoundingClientRect: () => rect(box),
  querySelectorAll: () => lines.map((l) => ({ getBoundingClientRect: () => rect(l) })),
});

/** A root whose `querySelectorAll` returns those elements, in order. */
const measure = (els: readonly unknown[]): ReturnType<typeof measureBlocks> =>
  measureBlocks({ querySelectorAll: () => els } as unknown as HTMLElement);

describe('a block’s height is its advance, not its box', () => {
  it('the space to the next block belongs to the block above it', () => {
    /* 100 px of verse, 30 px of gap, then the next verse. The page has to
       reserve 130. */
    const [a, b] = measure([
      el('v:s:1', { top: 0, bottom: 100 }),
      el('v:s:2', { top: 130, bottom: 200 }),
    ]);
    expect(a!.height).toBeCloseTo(130 * PT, 6);
    /* And the box alone — the old answer — is NOT what comes back. Without
       this the test would pass on the code it was written against. */
    expect(a!.height).not.toBeCloseTo(100 * PT, 6);
    expect(b!.height).toBeCloseTo(70 * PT, 6);
  });

  it('the last block of the document keeps its own height', () => {
    /* There is nothing after it to advance to, and inventing a gap there would
       make the final page one gap shorter than it is. */
    const [only] = measure([el('v:s:1', { top: 0, bottom: 100 })]);
    expect(only!.height).toBeCloseTo(100 * PT, 6);
  });

  it('and the advances add up to the whole column', () => {
    /*
     * THE PROPERTY THAT MATTERS. The page map fills a page by summing heights,
     * so the sum of every block's height must be the distance from the first
     * block's top to the last one's bottom — otherwise a full page is not a
     * full page. Three blocks with two different gaps, so an implementation
     * that assumed one uniform gap would fail here.
     */
    const blocks = measure([
      el('a', { top: 0, bottom: 40 }),
      el('b', { top: 58, bottom: 118 }),
      el('c', { top: 150, bottom: 190 }),
    ]);
    const total = blocks.reduce((n, m) => n + m.height, 0);
    expect(total).toBeCloseTo(190 * PT, 6);
  });

  it('a block the next one overlaps is never negative', () => {
    /* A float can put the next block's top ABOVE this one's bottom. A negative
       advance would let a page hold more than it can. */
    const [a] = measure([
      el('a', { top: 0, bottom: 100 }),
      el('b', { top: 60, bottom: 160 }),
    ]);
    expect(a!.height).toBeCloseTo(100 * PT, 6);
  });
});

describe('a breakable block’s lines', () => {
  it('sum to the block’s height, gaps and translation included', () => {
    /*
     * `LayoutBlock.lines` says so in as many words, and `paginate` relies on
     * it: it takes the lines that fit, then treats the REST as the tail's
     * height. Lines that sum to less than the block make the tail look
     * shorter than it is, and the page it lands on overflows by the
     * difference — which in the running program was exactly the translation.
     *
     * Four pādas 20 px each with 4 px between them, a 30 px translation under
     * them, and 16 px of gap before the next verse.
     */
    const [m] = measure([
      el('v:s:1', { top: 0, bottom: 126 }, [
        { top: 0, bottom: 20 }, { top: 24, bottom: 44 },
        { top: 48, bottom: 68 }, { top: 72, bottom: 92 },
      ]),
      el('v:s:2', { top: 142, bottom: 200 }),
    ]);
    expect(m!.lines).toBeDefined();
    expect(m!.lines).toHaveLength(4);
    const sum = m!.lines!.reduce((n, h) => n + h, 0);
    expect(sum).toBeCloseTo(m!.height, 6);
    /* The trailing matter and the gap are in the LAST line, because that is
       the slice they are drawn with: the fourth pāda's top (72) to where the
       block's share of the column ends (142) is 70 px — its own 20 px of type
       plus the 30 px translation and the 16 px gap. */
    expect(m!.lines![3]).toBeCloseTo(70 * PT, 6);
    /* And an inner line is the distance to the next one, not its own box. */
    expect(m!.lines![0]).toBeCloseTo(24 * PT, 6);
  });

  it('are absent when there is only one, so the block cannot be split', () => {
    /* One line is nothing to split between, and `paginate` reads absent as
       unbreakable — the safe default. */
    const [m] = measure([
      el('v:s:1', { top: 0, bottom: 40 }, [{ top: 0, bottom: 20 }]),
      el('v:s:2', { top: 60, bottom: 100 }),
    ]);
    expect(m!.lines).toBeUndefined();
    expect(m!.height).toBeCloseTo(60 * PT, 6);
  });

  it('and a block with no lines at all reports none — a heading', () => {
    const [m] = measure([
      el('h:s', { top: 0, bottom: 30 }),
      el('v:s:1', { top: 44, bottom: 100 }),
    ]);
    expect(m!.lines).toBeUndefined();
  });
});

describe('and a block with no id is not measured', () => {
  it('an element carrying the attribute empty is skipped, not named ""', () => {
    /* `querySelectorAll('[data-block-id]')` matches an EMPTY attribute too,
       and a block called "" in the page map is a block no page can find. */
    const measured = measure([
      { dataset: {}, getBoundingClientRect: () => rect({ top: 0, bottom: 10 }), querySelectorAll: () => [] },
      el('v:s:1', { top: 20, bottom: 60 }),
    ]);
    expect(measured.map((m) => m.id)).toEqual(['v:s:1']);
  });
});
