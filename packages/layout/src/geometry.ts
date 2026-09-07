/**
 * Page geometry, in points.
 *
 * Points, not pixels, and that choice carries the whole design. A page is a
 * PHYSICAL thing — A4 is 210 mm wide whatever the screen — so every length here
 * is device-independent and zoom is applied only when the page is finally drawn.
 *
 * The consequence is the property the paged view depends on: **pagination is
 * invariant under zoom.** Where a page breaks is decided in points, so zooming
 * from 70 % to 250 % cannot move a break. If it could, the "exactly how it will
 * export" promise would be false at every zoom but one, and nobody would know
 * which one.
 */

/** 1 pt = 1/72 in. The CSS reference pixel is 1/96 in. */
export const PT_TO_PX = 96 / 72;
export const MM_TO_PT = 72 / 25.4;

export const pt = (mm: number): number => mm * MM_TO_PT;

export interface Margins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PageGeometry {
  readonly id: string;
  readonly label: string;
  /** Trim size in points. */
  readonly width: number;
  readonly height: number;
  readonly margins: Margins;
}

/** The usable column: trim minus margins. Pagination measures against this. */
export function contentBox(page: PageGeometry): { width: number; height: number } {
  return {
    width: page.width - page.margins.left - page.margins.right,
    height: page.height - page.margins.top - page.margins.bottom,
  };
}

const MARGINS_25MM: Margins = {
  top: pt(25), right: pt(25), bottom: pt(25), left: pt(25),
};

/**
 * The page sizes an export can target.
 *
 * A4 first because it is what the owner's own documents use. Margins default to
 * 25 mm, which is what the Word template measures — a page preview with
 * different margins from the export is a preview of a different document.
 */
export const PAGE_SIZES: Readonly<Record<string, PageGeometry>> = {
  a4: {
    id: 'a4', label: 'A4', width: pt(210), height: pt(297), margins: MARGINS_25MM,
  },
  letter: {
    id: 'letter', label: 'Letter', width: 612, height: 792, margins: MARGINS_25MM,
  },
  a5: {
    id: 'a5', label: 'A5', width: pt(148), height: pt(210),
    margins: { top: pt(15), right: pt(15), bottom: pt(15), left: pt(15) },
  },
};

export const DEFAULT_PAGE = 'a4';

export function pageGeometry(id: string): PageGeometry {
  const found = PAGE_SIZES[id];
  if (found === undefined) {
    throw new Error(`unknown page size "${id}" — one of ${Object.keys(PAGE_SIZES).join(', ')}`);
  }
  return found;
}
