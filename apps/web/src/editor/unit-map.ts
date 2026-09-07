/**
 * A UNIT, AND WHERE IT IS IN THE SOURCE.
 *
 * The page is a PROJECTION of the source: `ṁ` may be drawn `gṁ`, a holding is
 * a box around a syllable, and an akṣara can stand for three units at once. So
 * a position on screen is not a position in the file, and this is the pair of
 * functions that convert between them — exact inverses, or the caret drifts a
 * letter at a time.
 *
 *   `addressOfUnit`   a unit, and which side of it, as a line and a column
 *   `unitOfAddress`   the same, backwards
 *
 * `data-u` is the unit index within the verse, written by the one renderer
 * (see `MarkRenderOptions.unitOffset`); `SrcMap.units[n]` is that unit's span
 * in the source line. Both come from `emit`, so neither can drift from what a
 * unit is.
 *
 * WHAT USED TO BE HERE AND IS NOT. A hit test from an x-coordinate, a caret
 * rectangle to draw, and a selection painter that added a class to every
 * selected letter. The page is `contenteditable` now, so the browser does all
 * three — see `dom-selection.ts`, which turns the browser's own position into
 * a unit and hands it to the functions below.
 */
import type { SrcMap } from '@siksamitra/engine';
import type { CaretAddress } from '@siksamitra/edit';

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
  let previous: { unit: number; after: boolean } | null = null;
  for (const [unit, span] of srcMap.units.entries()) {
    if (span.line !== at.line) continue;
    // Inside this letter: the caret goes before it.
    if (at.column >= span.start && at.column < span.end) return { unit, after: false };
    /*
     * BEFORE this letter but after the previous one — the caret is in a gap: a
     * space, a daṇḍa, a pause, none of which contributes a unit. It belongs
     * AFTER the letter it follows, not before the letter it precedes. Drawn
     * the other way, the caret sat past the space and did not appear to move
     * when you crossed one, so you could not tell what Backspace would take.
     */
    if (at.column < span.start) {
      return previous ?? { unit, after: false };
    }
    previous = { unit, after: true };
  }
  return previous;
}
