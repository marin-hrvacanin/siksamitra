/**
 * Zoom.
 *
 * One scalar, meaning the same thing in every view: how many CSS pixels a point
 * of document becomes, relative to 1 pt = 96/72 px.
 *
 * IMPLEMENTED AS A LENGTH MULTIPLIER, NOT `transform: scale()`. The transform is
 * the obvious approach and it is wrong here for three reasons, in order of how
 * much they hurt:
 *
 *   1. **The caret.** Hit-testing a scaled subtree means unscaling every
 *      coordinate by hand, and the editor's whole model is a map from a point
 *      on screen back to an offset in the source. One transform in the middle
 *      of that turns an exact map into an approximate one.
 *   2. **Text quality.** A scaled subtree is rasterised at its natural size and
 *      then resampled, so text at 250 % is blurry rather than bigger. For a
 *      surface whose entire purpose is reading diacritics, that is fatal.
 *   3. **Layout.** Scaled content still occupies its unscaled box, so scroll
 *      extents and sticky positions all need correcting.
 *
 * A multiplier avoids all three: lengths are computed larger, the browser lays
 * out and rasterises at the real size, and geometry stays honest.
 */

import { PT_TO_PX, contentBox, type PageGeometry } from './geometry.js';

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

/** The steps the keyboard and the status-bar control move through. */
export const ZOOM_STEPS: readonly number[] = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4,
];

export type ZoomMode =
  | { readonly kind: 'fixed'; readonly value: number }
  /** Recomputed on resize: the page fills the viewport's width. */
  | { readonly kind: 'fit-width' }
  /** Recomputed on resize: a whole page is visible. */
  | { readonly kind: 'fit-page' };

export const clampZoom = (z: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** The next step up or down from where we are. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const steps = direction === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
  const next = steps.find((s) => (direction === 1 ? s > current + 1e-6 : s < current - 1e-6));
  return clampZoom(next ?? current);
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * Resolve a zoom mode to a number for this viewport.
 *
 * `gutter` is the space around a page in the paged view — the grey margin that
 * makes a page look like a page. It is subtracted before fitting, or a
 * fit-width page would be clipped by exactly the gutter.
 */
export function resolveZoom(
  mode: ZoomMode,
  page: PageGeometry,
  viewport: Viewport,
  gutter = 48,
): number {
  if (mode.kind === 'fixed') return clampZoom(mode.value);
  const usableWidth = Math.max(1, viewport.width - gutter * 2);
  const byWidth = usableWidth / (page.width * PT_TO_PX);
  if (mode.kind === 'fit-width') return clampZoom(byWidth);
  const usableHeight = Math.max(1, viewport.height - gutter * 2);
  const byHeight = usableHeight / (page.height * PT_TO_PX);
  return clampZoom(Math.min(byWidth, byHeight));
}

/**
 * In FLOW view there is no page, so fit-width means the measure column.
 *
 * The column is the page's content box, not its trim: reading width should be
 * the same in flow and paged view, or switching modes reflows every line and
 * loses the reader's place for no reason.
 */
export function flowColumnWidthPx(page: PageGeometry, zoom: number): number {
  return contentBox(page).width * PT_TO_PX * zoom;
}

/** Points to CSS pixels at this zoom. The only conversion the views use. */
export const px = (points: number, zoom: number): number => points * PT_TO_PX * zoom;

/** For display: `1.25` → `125%`. */
export const zoomLabel = (z: number): string => `${Math.round(z * 100)}%`;
