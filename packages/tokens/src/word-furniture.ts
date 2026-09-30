/**
 * THE FURNITURE OF HIS DOCUMENT — what is not a marking and not a role of the
 * type scale, but that his every file has: its `Title`, the spacing of an
 * ordinary line, and the running head over each page. Out of `word.ts` at the
 * module gate, which re-exports all of it.
 */
import { fromHalfPoints, fromTwips } from './word-units.js';

/**
 * HIS `Title` — the one style of his a document opens with that the role
 * table above has no row for (our `title` role is his `Heading1`). Measured in
 * the Lalitā Sahasranāma v9.3.1: Calibri Light (the theme's major face, which
 * Word renders as `Calibri-Light`), bold, 36 pt, centred, on an exact 40 pt
 * line with 12 pt after, and the mantra line's own hanging indent.
 */
export const WORD_TITLE = {
  style: 'Title',
  face: 'Calibri Light',
  bold: true,
  size: fromHalfPoints(72),
  leading: fromTwips(800),
  after: fromTwips(240),
  indent: fromTwips(284),
  hanging: fromTwips(284),
} as const;

/**
 * What every paragraph of his inherits from `docDefaults`: 8 pt after and
 * `w:line="259" w:lineRule="auto"` — Word's 1.08 — rather than single. His
 * `Normal` sets no spacing of its own, so this IS a Normal line's spacing.
 */
export const WORD_BODY_LINE = 259;

/** His `Header`'s two tab stops, in twips: the running title centred, the
 *  page number at the right edge of his text block. */
export const WORD_HEADER_TABS = { center: 4536, right: 9900 } as const;

/**
 * His running head's rule, and how far down the sheet the head sits. His is a
 * drawn line under the chant's name; a bottom border of half a point draws the
 * same line in every Word without a picture. `distance` is his `w:header`,
 * in twips from the top edge of the sheet.
 */
export const WORD_HEADER_RULE = { eighths: 4, space: 1, distance: 397 } as const;
