/**
 * Keeping the reader's place.
 *
 * The bug this prevents is small and infuriating: press the view toggle in a
 * 700-verse document and land at the top. It makes the feature unusable without
 * ever looking broken.
 */

import { describe, expect, it } from 'vitest';
import { anchorAt, reanchor, scrollTopFor, type BlockOffset } from '../index.js';

/** Uniform blocks, so the arithmetic is obvious. */
const offsets = (heights: readonly number[]): BlockOffset[] => {
  let top = 0;
  return heights.map((height, i) => {
    const o = { id: `b${i}`, top, height };
    top += height;
    return o;
  });
};

const FLOW = offsets([100, 100, 100, 100, 100]);
/** The same content in the paged view: taller, because of page furniture. */
const PAGED = offsets([160, 160, 160, 160, 160]);

describe('reading the anchor', () => {
  it('names the block the viewport top is inside', () => {
    expect(anchorAt(0, FLOW)).toEqual({ blockId: 'b0', fraction: 0 });
    expect(anchorAt(250, FLOW)).toEqual({ blockId: 'b2', fraction: 0.5 });
  });

  it('chooses the block being read, not the one still trailing on screen', () => {
    // At 200 the previous block has just left; b2 is what the reader is in.
    expect(anchorAt(200, FLOW)?.blockId).toBe('b2');
  });

  it('handles a scroll past the end without inventing a block', () => {
    expect(anchorAt(99_999, FLOW)?.blockId).toBe('b4');
  });

  it('has no anchor in an empty document', () => {
    expect(anchorAt(0, [])).toBeNull();
  });

  it('does not divide by a zero-height block', () => {
    const withEmpty = [{ id: 'a', top: 0, height: 0 }, { id: 'b', top: 0, height: 50 }];
    expect(anchorAt(0, withEmpty)?.fraction).toBe(0);
  });
});

describe('restoring the anchor', () => {
  it('puts the same words back under the eye across a geometry change', () => {
    // Half-way into b2 in flow must be half-way into b2 in paged, even though
    // every pixel offset differs.
    const anchor = anchorAt(250, FLOW);
    expect(scrollTopFor(anchor, PAGED)).toBe(160 * 2 + 80);
  });

  it('round-trips exactly when the geometry has not changed', () => {
    for (const at of [0, 1, 99, 250, 449]) {
      expect(scrollTopFor(anchorAt(at, FLOW), FLOW)).toBeCloseTo(at, 6);
    }
  });

  it('falls back to the top when the anchored block is gone', () => {
    // The section was deleted while the view was switching. Landing at the top
    // is not ideal, but it is defined — and better than a NaN scroll offset,
    // which silently leaves the container unscrollable.
    const gone = { blockId: 'deleted', fraction: 0.5 };
    expect(scrollTopFor(gone, PAGED)).toBe(0);
  });

  it('returns 0 rather than NaN for an empty target', () => {
    expect(scrollTopFor({ blockId: 'b1', fraction: 0.5 }, [])).toBe(0);
  });
});

describe('reanchor: the whole contract in one call', () => {
  it('maps a flow position to the equivalent paged position', () => {
    expect(reanchor(250, FLOW, PAGED)).toBe(400);
  });

  it('is stable under a round trip through the other view', () => {
    // Switch to pages and back: the reader must end up where they started, or
    // toggling twice walks them down the document.
    const there = reanchor(250, FLOW, PAGED);
    const back = reanchor(there, PAGED, FLOW);
    expect(back).toBeCloseTo(250, 6);
  });

  it('is stable across repeated toggling', () => {
    let at = 137;
    for (let i = 0; i < 10; i += 1) {
      at = reanchor(at, FLOW, PAGED);
      at = reanchor(at, PAGED, FLOW);
    }
    expect(at).toBeCloseTo(137, 6);
  });
});
