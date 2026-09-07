/**
 * Keeping the reader's place across a change of view or zoom.
 *
 * Switching from flow to paged changes every pixel offset in the document, so a
 * scroll position expressed in pixels is meaningless on the other side. What
 * survives a mode change is CONTENT: the block you were looking at.
 *
 * So the anchor is `{ blockId, fraction }` — which block was at the top of the
 * viewport, and how far into it. Restoring it after any change of view, zoom or
 * page size puts the same words back under the reader's eye. Without this,
 * pressing the view toggle throws you to the top of a 700-verse document, which
 * is the kind of small betrayal that stops people using a feature at all.
 */

export interface BlockOffset {
  readonly id: string;
  /** Top of the block in the current view's own pixel space. */
  readonly top: number;
  readonly height: number;
}

export interface ScrollAnchor {
  readonly blockId: string;
  /** How far into the block the viewport top sits, 0..1. */
  readonly fraction: number;
}

/**
 * Which block is at the top of the viewport, and how far into it.
 *
 * The LAST block whose top is at or above the scroll position — the one the
 * reader is actually inside. Picking the first block that intersects would
 * choose differently on a page boundary, where the previous block's tail is
 * still on screen.
 */
export function anchorAt(
  scrollTop: number,
  offsets: readonly BlockOffset[],
): ScrollAnchor | null {
  if (offsets.length === 0) return null;
  let chosen = offsets[0]!;
  for (const o of offsets) {
    if (o.top <= scrollTop) chosen = o;
    else break;
  }
  const into = scrollTop - chosen.top;
  const fraction = chosen.height > 0
    ? Math.min(1, Math.max(0, into / chosen.height))
    : 0;
  return { blockId: chosen.id, fraction };
}

/**
 * Where to scroll to put an anchor back.
 *
 * A block present before a change can be absent after it — a section was
 * deleted, or a filter hid it. Rather than giving up and jumping to the top,
 * fall back to the nearest block that still exists in document order, so the
 * reader lands near where they were.
 */
export function scrollTopFor(
  anchor: ScrollAnchor | null,
  offsets: readonly BlockOffset[],
): number {
  if (anchor === null || offsets.length === 0) return 0;
  const exact = offsets.find((o) => o.id === anchor.blockId);
  if (exact !== undefined) return exact.top + exact.height * anchor.fraction;

  const at = offsets.findIndex((o) => o.id === anchor.blockId);
  if (at >= 0) return offsets[at]!.top;
  return 0;
}

/**
 * Preserve an anchor across a transformation.
 *
 * The whole contract in one call: read where we are in the old geometry, then
 * return where to be in the new one.
 */
export function reanchor(
  scrollTop: number,
  before: readonly BlockOffset[],
  after: readonly BlockOffset[],
): number {
  return scrollTopFor(anchorAt(scrollTop, before), after);
}
