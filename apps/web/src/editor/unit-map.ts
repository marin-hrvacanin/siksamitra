/**
 * Between the screen and the source: where a letter is, and where a caret goes.
 *
 * The editor is a PROJECTION of the source, not a rich-text tree. Nothing is
 * editable in the DOM; the marked text is drawn, and a click is translated
 * into a position in the source through the map `emit` produced. That is the
 * whole architectural difference from v1, whose document *was* the DOM and
 * which therefore had no answer to "is this holding correct?".
 *
 * Two translations, and they must be exact inverses or the caret drifts from
 * the text:
 *
 *   screen → source   a `data-u` element, plus which half of it was clicked
 *   source → screen   a rectangle to draw the caret in
 *
 * `data-u` is a unit index within the verse, written by the one renderer (see
 * `MarkRenderOptions.unitOffset`). `SrcMap.units[n]` is that unit's span in the
 * source line. Both come from `emit`, so neither can drift from what a unit is.
 */
import type { SrcMap } from '@siksamitra/engine';
import { offsetOf, type CaretAddress, type FlatSource } from '@siksamitra/edit';

export interface UnitHit {
  verseId: string;
  sectionId: string;
  /** Unit index within the verse. */
  unit: number;
  /** How many units the clicked element stands for — an akṣara stands for
   *  several, and you cannot click half a conjunct. */
  span: number;
  /** The click fell in the right-hand half: the caret goes after the letter. */
  after: boolean;
  /** The verse is transcribed: editable nowhere, selectable everywhere. */
  attested: boolean;
}

/** What was clicked, if it was a letter. */
export function hitAt(target: EventTarget | null, x: number): UnitHit | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>('[data-u]');
  const verse = (el ?? target).closest<HTMLElement>('[data-verse]');
  if (verse === null) return null;

  const verseId = verse.dataset['verse'] ?? '';
  const sectionId = verse.dataset['section'] ?? '';
  const attested = verse.dataset['attested'] === '1';
  if (el === null) {
    // Clicked a verse but not a letter — the gutter, or past the end of a
    // line. The caret goes to the start of the verse rather than nowhere.
    return { verseId, sectionId, unit: 0, span: 1, after: false, attested };
  }

  const box = el.getBoundingClientRect();
  return {
    verseId,
    sectionId,
    unit: Number(el.dataset['u'] ?? '0'),
    span: Number(el.dataset['un'] ?? '1'),
    after: x > box.left + box.width / 2,
    attested,
  };
}

/**
 * A unit index, as a caret address.
 *
 * `after` puts the caret at the END of the unit's span, which is what clicking
 * the right half of a letter means everywhere. For an akṣara standing for
 * several units it is the end of the LAST of them — the caret cannot land
 * inside a shaped conjunct, and offering to would be a lie about what a click
 * can express.
 */
export function addressOfUnit(
  verseId: string,
  srcMap: SrcMap,
  hit: Pick<UnitHit, 'unit' | 'span' | 'after'>,
): CaretAddress | null {
  const last = Math.max(hit.unit, hit.unit + hit.span - 1);
  const span = srcMap.units[hit.after ? last : hit.unit];
  if (span === undefined) return null;
  return { verseId, line: span.line, column: hit.after ? span.end : span.start };
}

/** A click, as a flat offset in the section — what a command needs. */
export function offsetOfHit(
  flat: FlatSource,
  srcMap: SrcMap | null,
  hit: UnitHit,
): number | null {
  if (srcMap === null) {
    // A transcribed verse has no source map because it has no source. The
    // caret still goes somewhere sensible: the start of the verse.
    const line = flat.lineStarts.find((l) => l.verseId === hit.verseId);
    return line?.at ?? null;
  }
  const at = addressOfUnit(hit.verseId, srcMap, hit);
  return at === null ? null : offsetOf(flat, at);
}

/**
 * Which unit a caret address sits at, and on which side.
 *
 * The inverse of `addressOfUnit`, and used to draw the caret. A column past
 * the last unit's span — the end of a line — reports the last unit with
 * `after: true`, because that is where the caret visibly belongs.
 */
export function unitOfAddress(
  srcMap: SrcMap,
  at: CaretAddress,
): { unit: number; after: boolean } | null {
  let last: { unit: number; after: boolean } | null = null;
  for (const [unit, span] of srcMap.units.entries()) {
    if (span.line !== at.line) continue;
    if (at.column <= span.start) return { unit, after: false };
    if (at.column < span.end) return { unit, after: false };
    last = { unit, after: true };
  }
  return last;
}

/** The rectangle to draw a caret in, relative to a scrolling container. */
export interface CaretBox {
  left: number;
  top: number;
  height: number;
}

export function caretBox(
  scroller: HTMLElement,
  verseId: string,
  place: { unit: number; after: boolean } | null,
): CaretBox | null {
  const verse = scroller.querySelector<HTMLElement>(`[data-verse="${cssEscape(verseId)}"]`);
  if (verse === null) return null;

  const el = place === null
    ? null
    : verse.querySelector<HTMLElement>(`[data-u="${place.unit}"]`);
  const anchor = el ?? verse.querySelector<HTMLElement>('.pada') ?? verse;
  const box = anchor.getBoundingClientRect();

  /*
   * Relative to the SCROLLED CONTENT, not the viewport: the caret is an
   * absolutely positioned child of the scroll container, so it must be placed
   * in the same coordinates the content is in — otherwise it sits still while
   * the text scrolls past it.
   */
  const base = scroller.getBoundingClientRect();
  return {
    left: box.left - base.left + scroller.scrollLeft + (place?.after === true ? box.width : 0),
    top: box.top - base.top + scroller.scrollTop,
    height: box.height,
  };
}

/**
 * Escape a value for a CSS attribute selector.
 *
 * `CSS.escape` is not available in every environment this runs in (jsdom in
 * the component tests, older WebViews), and a verse id containing a quote
 * would otherwise build a selector that throws.
 */
function cssEscape(value: string): string {
  const escape = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS?.escape;
  return escape === undefined ? value.replace(/["\\]/g, '\\$&') : escape(value);
}

/** Paint a selection over the letters inside it, without re-rendering them.
 *
 *  IMPERATIVE ON PURPOSE. Passing the selection into the document components
 *  would re-render every verse on every caret move; in a 700-verse text that is
 *  the difference between an editor and a slideshow. The DOM already knows
 *  where the letters are, so the highlight is a class toggle over the letters
 *  actually in range — bounded by the selection, not by the document. */
export function paintSelection(
  scroller: HTMLElement,
  ranges: readonly { verseId: string; from: number; to: number }[],
): void {
  for (const el of scroller.querySelectorAll<HTMLElement>('.is-selected')) {
    el.classList.remove('is-selected');
  }
  for (const range of ranges) {
    const verse = scroller.querySelector<HTMLElement>(
      `[data-verse="${cssEscape(range.verseId)}"]`,
    );
    if (verse === null) continue;
    for (const el of verse.querySelectorAll<HTMLElement>('[data-u]')) {
      const unit = Number(el.dataset['u'] ?? '-1');
      const span = Number(el.dataset['un'] ?? '1');
      if (unit + span - 1 >= range.from && unit <= range.to) el.classList.add('is-selected');
    }
  }
}
