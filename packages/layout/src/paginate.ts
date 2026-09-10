/**
 * Pagination — a pure function from measured blocks to a page map.
 *
 * WHY THIS IS A FUNCTION AND NOT A STYLESHEET. The browser can paginate, but
 * only when printing: there is no way to ask it "where would the breaks fall"
 * and then draw that on screen. CSS Regions are dead and multi-column is a
 * different model. So a paged view built on CSS would be a SECOND opinion about
 * where pages break, and the export would be the first — which is precisely the
 * arrangement that lets a preview lie.
 *
 * The intention was one page map, computed here, used by BOTH the paged view
 * and the export — exact by construction rather than by coincidence.
 *
 * THAT IS NOT WHERE IT STANDS, and this header claimed otherwise for a long
 * time, including that "an integration test asserts the two agree". There is
 * no such test and there was no such sharing: `paginate` has one caller,
 * `apps/web/src/views/PagedView.tsx`. The PDF is the HTML export printed by
 * the host's browser, which paginates it itself from the `break-inside` rules
 * in `packages/render/src/export.css`; the `.docx` is paginated by Word from
 * `w:keepLines` and `w:keepNext`. Three mechanisms.
 *
 * What holds them together today is that all three are told the same thing
 * about the one case where they could visibly disagree — a verse is not split
 * — and the view is the one that had to be taught it. Sharing the map for real
 * is open work; `openspec/changes/bootstrap-v2/tasks.md` says so.
 *
 * Everything is in points, so the result does not depend on zoom (geometry.ts).
 */

import { contentBox, type PageGeometry } from './geometry.js';

/**
 * One atomic piece of content, already measured.
 *
 * Measurement happens in the renderer, because only the renderer knows how tall
 * a marked verse is — the holding boxes and the svara strokes sit outside the
 * line box. This module never measures; it only places.
 */
export interface LayoutBlock {
  readonly id: string;
  /** Height in points at zoom 1. */
  readonly height: number;
  /**
   * May this block be split across a page boundary?
   *
   * A verse of ten lines may split between lines; a four-line verse usually
   * should not, and a figure never can.
   */
  readonly breakable?: boolean;
  /** Line heights in points, for a breakable block. Must sum to `height`. */
  readonly lines?: readonly number[];
  /**
   * Keep this block on the same page as the one after it.
   *
   * A section heading alone at the foot of a page is the classic typographic
   * fault, and in a recitation text it is worse than ugly: the heading is the
   * instruction that tells you what you are about to chant.
   */
  readonly keepWithNext?: boolean;
  /** Force a page break before this block. */
  readonly breakBefore?: boolean;
  /** Minimum lines left behind / carried over, for a breakable block. */
  readonly orphans?: number;
  readonly widows?: number;
}

export interface PlacedBlock {
  readonly id: string;
  /** Offset from the top of the page's content box, in points. */
  readonly top: number;
  readonly height: number;
  /** Which slice of a split block this is: `[firstLine, lastLine]`. */
  readonly lineRange?: readonly [number, number];
  /** True when this block is continued from, or onto, another page. */
  readonly continuesFrom?: boolean;
  readonly continuesOnto?: boolean;
}

export interface Page {
  readonly index: number;
  readonly blocks: readonly PlacedBlock[];
  /** Points of the content box actually used. */
  readonly used: number;
}

export interface PageMap {
  readonly pages: readonly Page[];
  readonly geometry: PageGeometry;
  /** Content-box height, cached — every caller needs it. */
  readonly contentHeight: number;
}

const DEFAULT_ORPHANS = 2;
const DEFAULT_WIDOWS = 2;

/**
 * Place blocks onto pages.
 *
 * The algorithm is deliberately simple and greedy: fill a page until the next
 * block does not fit, then start another. Simple is the point — this runs on
 * every edit and its result must be predictable enough that an author learns
 * where their breaks are. A cleverer optimiser that moved earlier breaks to
 * improve a later page would make editing feel haunted.
 */
export function paginate(
  blocks: readonly LayoutBlock[],
  geometry: PageGeometry,
): PageMap {
  const { height: contentHeight } = contentBox(geometry);
  const pages: Page[] = [];

  let current: PlacedBlock[] = [];
  let used = 0;

  const flush = (): void => {
    pages.push({ index: pages.length, blocks: current, used });
    current = [];
    used = 0;
  };

  /** How much of the page a run of keep-together blocks needs. */
  const keepRunHeight = (from: number): number => {
    let total = 0;
    let i = from;
    while (i < blocks.length) {
      total += blocks[i]!.height;
      if (blocks[i]!.keepWithNext !== true) break;
      i += 1;
    }
    return total;
  };

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;

    if (block.breakBefore === true && current.length > 0) flush();

    const remaining = contentHeight - used;

    // A heading that must stay with what follows is measured together with it,
    // so it moves to the next page rather than being left behind alone.
    const needed = block.keepWithNext === true ? keepRunHeight(i) : block.height;

    if (needed <= remaining) {
      current.push({ id: block.id, top: used, height: block.height });
      used += block.height;
      continue;
    }

    // Does not fit. Split it if it may be split and enough of it fits.
    const lines = block.lines;
    if (block.breakable === true && lines !== undefined && lines.length > 0) {
      const orphans = block.orphans ?? DEFAULT_ORPHANS;
      const widows = block.widows ?? DEFAULT_WIDOWS;

      let fit = 0;
      let h = 0;
      while (fit < lines.length && h + lines[fit]! <= remaining) {
        h += lines[fit]!;
        fit += 1;
      }
      // Splitting is only allowed if both halves keep enough lines. Otherwise
      // move the whole block: one line stranded on a page is worse than a
      // slightly short page.
      const leavesEnough = fit >= orphans;
      const carriesEnough = lines.length - fit >= widows;
      if (fit > 0 && leavesEnough && carriesEnough) {
        current.push({
          id: block.id, top: used, height: h,
          lineRange: [0, fit - 1], continuesOnto: true,
        });
        used += h;
        flush();
        let rest = lines.slice(fit);
        let firstLine = fit;
        // The tail may itself be taller than a page (a very long verse).
        while (rest.length > 0) {
          let take = 0;
          let th = 0;
          while (take < rest.length && th + rest[take]! <= contentHeight) {
            th += rest[take]!;
            take += 1;
          }
          if (take === 0) take = 1; // a single line taller than the page: place it anyway
          const last = firstLine + take - 1;
          const more = take < rest.length;
          current.push({
            id: block.id, top: 0, height: th,
            lineRange: [firstLine, last],
            continuesFrom: true,
            ...(more ? { continuesOnto: true } : {}),
          });
          used = th;
          if (more) flush();
          rest = rest.slice(take);
          firstLine += take;
        }
        continue;
      }
    }

    // Unsplittable, or not worth splitting: move it to a fresh page.
    if (current.length > 0) flush();
    current.push({ id: block.id, top: 0, height: block.height });
    used = block.height;
  }

  if (current.length > 0 || pages.length === 0) flush();

  return { pages, geometry, contentHeight };
}

/** Which page a block starts on, or -1. */
export function pageOf(map: PageMap, blockId: string): number {
  for (const page of map.pages) {
    if (page.blocks.some((b) => b.id === blockId)) return page.index;
  }
  return -1;
}
