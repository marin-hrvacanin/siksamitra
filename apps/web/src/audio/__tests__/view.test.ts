/**
 * Which seconds of a take are on screen.
 *
 * The rules being checked are the ones a person notices when they are broken:
 * the window never shows time the recording does not have, zooming in on a
 * boundary keeps that boundary on screen, and the view does NOT move while the
 * playhead is comfortably inside it — a waveform that scrolls under the cursor
 * cannot be aimed at.
 *
 * A 40 minute take is used throughout because that is Śrī Rudram, the longest
 * thing in the corpus and the only one where any of this matters.
 */
import { describe, expect, it } from 'vitest';
import { MIN_SPAN, follow, fractionOf, secondsAt, viewAround } from '../view.js';

const RUDRAM = 40 * 60;

describe('a window around a moment', () => {
  it('centres on the moment and is as wide as it was asked for', () => {
    expect(viewAround(RUDRAM, 60, 600)).toEqual({ from: 570, to: 630 });
  });

  it('stops at the start of the recording rather than showing time before it', () => {
    expect(viewAround(RUDRAM, 60, 10)).toEqual({ from: 0, to: 60 });
  });

  it('stops at the end rather than showing time after it', () => {
    expect(viewAround(RUDRAM, 60, RUDRAM)).toEqual({ from: RUDRAM - 60, to: RUDRAM });
  });

  it('will not zoom in past the point where there is nothing more to see', () => {
    const view = viewAround(RUDRAM, 0.001, 600);
    expect(view.to - view.from).toBe(MIN_SPAN);
  });

  it('shows a short take whole rather than a window inside it', () => {
    expect(viewAround(90, 600, 45)).toEqual({ from: 0, to: 90 });
  });
});

describe('following the playhead', () => {
  const view = { from: 100, to: 160 };

  it('leaves the window alone while the playhead is inside it', () => {
    expect(follow(view, RUDRAM, 100)).toBe(view);
    expect(follow(view, RUDRAM, 130)).toBe(view);
    /* 154 is the last second before the tenth-of-a-span margin at the edge. */
    expect(follow(view, RUDRAM, 154)).toBe(view);
  });

  it('pages forward before the playhead reaches the edge, not after', () => {
    const next = follow(view, RUDRAM, 155);
    expect(next.from).toBe(149);
    expect(next.to - next.from).toBe(60);
    expect(next.from).toBeLessThan(155);
  });

  it('centres on the playhead when somebody has seeked backwards', () => {
    expect(follow(view, RUDRAM, 20)).toEqual({ from: 0, to: 60 });
  });

  it('puts a forward seek near the left edge, so what is coming is on screen', () => {
    expect(follow(view, RUDRAM, 600)).toEqual({ from: 594, to: 654 });
  });

  it('never runs off the end of the recording', () => {
    const next = follow({ from: RUDRAM - 60, to: RUDRAM }, RUDRAM, RUDRAM - 1);
    expect(next.to).toBeLessThanOrEqual(RUDRAM);
  });
});

describe('seconds and the fraction across the strip', () => {
  const view = { from: 100, to: 160 };

  it('agrees with itself in both directions', () => {
    expect(fractionOf(view, 130)).toBe(0.5);
    expect(secondsAt(view, 0.5)).toBe(130);
    expect(secondsAt(view, fractionOf(view, 143.25))).toBeCloseTo(143.25, 6);
  });

  it('says where a moment outside the window is, rather than clamping it', () => {
    /* The playhead is drawn from this, and a playhead pinned to the edge of a
       window it has left says the recording has stopped when it has not. */
    expect(fractionOf(view, 190)).toBe(1.5);
    expect(fractionOf(view, 70)).toBe(-0.5);
  });

  it('has an answer for a window of no width', () => {
    expect(fractionOf({ from: 5, to: 5 }, 5)).toBe(0);
  });
});
