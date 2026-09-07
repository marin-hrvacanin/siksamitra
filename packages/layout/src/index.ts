/**
 * `@siksamitra/layout` — where things go on a page, and how big.
 *
 * Pure and measurement-free: it places blocks whose heights someone else
 * measured, and converts between points and pixels. It imports no React, no
 * DOM, no document format — which is what lets the paged view and the PDF
 * exporter share one page map instead of each having an opinion.
 */

export {
  MM_TO_PT, PT_TO_PX, PAGE_SIZES, DEFAULT_PAGE, contentBox, pageGeometry, pt,
} from './geometry.js';
export type { Margins, PageGeometry } from './geometry.js';

export { paginate, pageOf } from './paginate.js';
export type { LayoutBlock, Page, PageMap, PlacedBlock } from './paginate.js';

export {
  ZOOM_MAX, ZOOM_MIN, ZOOM_STEPS, clampZoom, flowColumnWidthPx, px,
  resolveZoom, stepZoom, zoomLabel,
} from './zoom.js';
export type { Viewport, ZoomMode } from './zoom.js';

export { anchorAt, reanchor, scrollTopFor } from './anchor.js';
export type { BlockOffset, ScrollAnchor } from './anchor.js';

export {
  DEFAULT_VIEW, VIEW_CYCLE, VIEW_MODES, nextView, themeFor, viewMode,
} from './view.js';
export type { ViewKind, ViewMode } from './view.js';
