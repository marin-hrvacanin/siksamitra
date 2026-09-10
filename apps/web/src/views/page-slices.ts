/**
 * What one page of the page map draws.
 *
 * A projection, not a decision: `paginate` has already said which blocks are
 * on a page and — for a block a break runs THROUGH — which of its lines. This
 * turns that into the two things the renderer takes, the set of ids and the
 * ranges by id.
 *
 * ITS OWN MODULE BECAUSE IT WAS ITS OWN BUG. The view chose its blocks by id
 * and nothing read `lineRange`, so a split verse — whose id is on both pages —
 * was drawn WHOLE on both: once hanging past the foot of one page and once
 * again from the top of the next. Written inline in a component, the rule had
 * nowhere to be tested except through a browser.
 */
import type { Page } from '@siksamitra/layout';

export interface PageContent {
  /** The blocks this page draws, for `DocumentBlocks`'s `only`. */
  readonly ids: ReadonlySet<string>;
  /**
   * For a block this page draws only PART of, which lines — `[first, last]`
   * inclusive, in the block's own numbering. Absent when nothing is split,
   * which is the usual case and lets the renderer skip the lookup entirely.
   */
  readonly slices?: ReadonlyMap<string, readonly [number, number]>;
}

/** The ids and the line ranges of one page. */
export function pageContent(page: Page): PageContent {
  const ids = new Set<string>();
  const slices = new Map<string, readonly [number, number]>();
  for (const b of page.blocks) {
    ids.add(b.id);
    if (b.lineRange !== undefined) slices.set(b.id, b.lineRange);
  }
  return { ids, ...(slices.size === 0 ? {} : { slices }) };
}

/**
 * Whether a block may be split between its lines.
 *
 * THE ANSWER IS HIS OWN STYLE'S. `Translit` carries `w:keepLines`, so Word
 * moves a verse whole rather than splitting it, and the print block in
 * `export.css` says the same to the browser with `break-inside: avoid` on
 * `.verse`. The paged view promises to show "exactly how it will export" and
 * was the only one of the three that split a verse at all: on Śrī Rudram at A4
 * it broke 22 verses that the `.docx` and the printed page both keep whole.
 * Two files of one document, disagreeing about what is on the page — which is
 * the fault `styles.ts` records having already paid for once.
 *
 * So a verse is kept whole, EXCEPT when it cannot fit a page by itself: no
 * amount of keeping helps a block taller than the paper, and Word and Chrome
 * both split one too. That is the whole of the rule, and it is the reason the
 * splitting machinery in `paginate` stays — it is for the verse that has no
 * other option, not for tidying a page's foot.
 */
export const mayBreak = (height: number, contentHeight: number): boolean =>
  height > contentHeight;
