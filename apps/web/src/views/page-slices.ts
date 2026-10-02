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
 * Whether a verse may be split at all: only when it cannot fit a page by
 * itself. A verse that fits is kept whole and moves to the next page —
 * his ruling (2026-10-02): "Splitting only when the page is full is precisely
 * what I dislike... it should be visually nicer". So a page ends between verses, and the same is said to a printing
 * browser (`break-inside: avoid` on `.verse`, `export.css`) and to Word
 * (`KEEP_OF`: the verse's lines keep together and with what follows). Word's
 * own pagination, which fills a page and breaks a verse where it runs out, is
 * what his own files do and what he does not want here.
 */
export const mayBreak = (height: number, contentHeight: number): boolean =>
  height > contentHeight;

/**
 * Where a page may end inside a verse TOO TALL FOR ONE — his Word's answer,
 * and the same one `export.css` gives a printing browser.
 *
 * His `Translit` keeps with the next paragraph and NOT its lines together;
 * nothing of his turns widow control off. Measured in a real Word and on his
 * pages: a paragraph never leaves one line alone at a page's foot or carries
 * one alone to its head, so his sūryopaniṣat 7 (six lines) breaks four and
 * two; a verse's earlier half-verses do not keep, so his bhū sūktam breaks
 * verse 8 between its halves; and a verse's last line goes with its
 * translation, which the view measures as part of that line. This once kept
 * every verse whole, believing his style carries `keepLines`; it does not.
 *
 * `starts[i]`: does line `i` begin one of his paragraphs (`.pada--para`)?
 * The answer is, for each line but the last, whether a page may end after it.
 */
export function breaksAfter(starts: readonly boolean[]): boolean[] {
  const n = starts.length;
  const opens = (i: number): boolean => i === 0 || starts[i] === true;
  const closes = (i: number): boolean => i === n - 1 || opens(i + 1);
  const out: boolean[] = [];
  for (let j = 0; j < n - 1; j += 1) {
    /* Not after the first line of a paragraph of two or more, nor before its last. */
    out.push(!(opens(j) && !closes(j)) && !(!opens(j + 1) && closes(j + 1)));
  }
  return out;
}
