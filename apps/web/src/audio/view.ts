/**
 * WHICH SECONDS OF THE TAKE ARE ON SCREEN.
 *
 * A boundary cannot be fixed in a view of the whole recording. Śrī Rudram runs
 * about 40 minutes; in a strip 900 px wide that is 2.7 seconds per pixel, so
 * the smallest drag anyone can make moves a pāda boundary by more than a whole
 * pāda. The mapping's precision is a hundredth of a second and the picture has
 * to be able to show it, which is what this file is for.
 *
 * Kept separate from the canvas because it is arithmetic and the canvas is not:
 * every rule about where the window may sit — it never leaves the recording, it
 * never gets shorter than the shortest useful span, it follows the playhead
 * only when the playhead has actually left — is testable here and would need a
 * browser to test there.
 */

export interface View {
  readonly from: number;
  readonly to: number;
}

/**
 * The shortest window worth drawing.
 *
 * Two seconds across a strip of about 900 px is 2 ms per pixel, which is a
 * fifth of the hundredth-of-a-second grid the mapping is written on. There is
 * nothing further in to see.
 */
export const MIN_SPAN = 2;

/** How far each press of zoom moves. Halving is the step every audio editor
 *  uses, and it takes a 40 minute take to two seconds in eleven presses. */
export const ZOOM_STEP = 2;

/** A window of `span` seconds around `centre`, kept inside the recording. */
export function viewAround(duration: number, span: number, centre: number): View {
  const wide = Math.min(Math.max(span, MIN_SPAN), Math.max(duration, MIN_SPAN));
  const from = Math.min(Math.max(centre - wide / 2, 0), Math.max(0, duration - wide));
  return { from, to: from + wide };
}

/**
 * Keep the playhead on screen while it moves — and only then.
 *
 * The window is left alone until the playhead is within a tenth of the span of
 * an edge, and then it jumps a whole window rather than scrolling under the
 * cursor. Scrolling continuously means the waveform is always moving and
 * nothing can be aimed at; the edge margin means the jump happens before the
 * playhead disappears rather than after.
 */
export function follow(view: View, duration: number, at: number): View {
  const span = view.to - view.from;
  const margin = span / 10;
  if (at >= view.from && at <= view.to - margin) return view;
  /* Behind the window means somebody seeked backwards, so centre on it.
     Running off the end means playback, so page forward and leave the playhead
     near the left edge with a window of lookahead in front of it. */
  if (at < view.from) return viewAround(duration, span, at);
  const from = Math.min(Math.max(at - margin, 0), Math.max(0, duration - span));
  return { from, to: from + span };
}

/** Seconds → the fraction across the window, for a canvas or a stylesheet. */
export const fractionOf = (view: View, t: number): number =>
  (view.to === view.from ? 0 : (t - view.from) / (view.to - view.from));

/** The fraction back into seconds — what a pointer at an x is pointing at. */
export const secondsAt = (view: View, fraction: number): number =>
  view.from + fraction * (view.to - view.from);
