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
export const WORD_HEADER_RULE = { eighths: 4, space: 1, distance: 397, size: fromHalfPoints(24) } as const;

/**
 * HIS RULE, AS IT PRINTS — not a border: a Word shape under the head, the
 * flowchart "decision" diamond 5 467 350 × 45 085 EMU (430.5 × 3.55 pt),
 * centred on the sheet, filled with Word's light-horizontal hatch. Printed,
 * the hatch leaves one dark hairline, thickest in the middle and tapering to
 * both ends: traced at 720 dpi on his bhū sūktam, about 0.9 pt at its centre,
 * which is 39.4 pt from the top edge of the sheet.
 */
export const WORD_HEADER_SHAPE = { width: 430.5, ink: 0.9, inkTop: 39.4, opacity: 0.9, color: '000000' } as const;

/** The ink of his head and footer: `Header` and `Footer` set none, so Word's automatic black. */
export const WORD_FURNITURE_INK = '000000';

/** His `Footer`: Arial 11 pt, `w:footer` 283 twips above the foot of the sheet. */
export const WORD_FOOTER = { distance: 283, size: fromHalfPoints(22) } as const;

/** His `Hyperlink` character style: Word's hyperlink blue, underlined. */
export const WORD_HYPERLINK = { color: '0563C1' } as const;

/**
 * HIS DAṆḌA, as our own face draws it. His are Mangal's, which is Microsoft's
 * and not on every machine; `Siksamitra Danda` (`tools/fonts/danda.py`) is
 * Mangal's two bars, drawn from their measured dimensions — 0.4170 and 0.6123
 * em wide, a bar 0.0860 em thick from 0.0522 below the line to 0.6782 above.
 * At the line's own size and on its baseline, nothing to fit: it was once
 * Noto Serif Devanagari's daṇḍa, scaled and spaced to his width, and still a
 * lighter, shorter bar than his.
 */
export const WORD_DANDA_FACE = 'Siksamitra Danda';

/**
 * HIS TITLE PAGE, as his sādhanā opens: the title, centred, at 48 pt, its
 * paragraph spaced 6 240 twips (312 pt) down the sheet — `w:spacing
 * w:before="6240"`, measured in v9.1.13.
 */
export const WORD_COVER = { before: 6240, size: 48 } as const;
