/**
 * Export styles — what a file leaving this program looks like.
 *
 * Every export takes a style, and a style is DATA. Adding one is one entry in
 * `EXPORT_STYLES` and nothing else changes: the HTML exporter and the
 * rasteriser both read this list, and neither of them knows any style by name.
 *
 * A STYLE CARRIES NO COLOUR, FACE OR SIZE. It NAMES a document theme, and
 * `document-themes.ts` supplies all of them. That is the only reason
 * `veda-union` can be identical to his own page rather than a lookalike: it is
 * the `word` theme, whose every value was read out of his `.docx` by `word.ts`
 * and is measured back against a rendered page by `tools/doc-fidelity.mjs`. A
 * style holding its own "16 pt" would be a second set of numbers to keep in
 * step with his file, and a second set does not stay in step — that is how the
 * page came to draw 19.44 pt on 37.9 pt while the tokens said 16 pt on 24 pt.
 *
 * What a style DOES carry is the FRAME: the shape of the thing the document is
 * printed on. A frame is geometry, not appearance, which is why it can live
 * here without duplicating a theme.
 */
import { documentTheme, type DocumentTheme } from './document-themes.js';

/**
 * The shape an exported document is set on.
 *
 *   `page`   an A4 sheet with his 25 mm margins, on a desk. What Flow view
 *            shows and what printing produces.
 *   `web`    no sheet at all: the reading measure on the paper's own ground,
 *            which is the third view mode and how vedaunion.org sets a chant.
 *   `card`   the text on a rounded ground with a band around it. Built to be
 *            sent in a chat — see `CARD` for why the numbers are what they are.
 *   `bare`   the text and nothing else, on no ground. A transparent PNG, or an
 *            HTML fragment for a page that brings its own paper.
 */
export type ExportFrame = 'page' | 'web' | 'card' | 'bare';

/** The card's geometry. Lengths, so the exporter hands them to CSS unchanged. */
export interface CardGeometry {
  /** The corner. "Slightly rounded" — see `CARD`. */
  readonly radius: string;
  /** Inside the card, around the text. */
  readonly pad: string;
  /** How wide the card may get. */
  readonly measure: string;
  /** The band of ground around the card, between it and the image's edge. */
  readonly matPad: string;
}

/**
 * The card, measured against where it is going.
 *
 * WhatsApp draws an image in a chat bubble about 320–480 CSS px wide on a phone
 * and only shows the whole thing when it is tapped, so the card has to be
 * legible at a third of its own size. That fixes all four numbers:
 *
 *   `measure` 34rem = 544 px. At the mantra size the reading themes set
 *             (1.15rem = 18.4 px) that is around 30 Devanāgarī akṣaras to a
 *             line, so a pāda of the Durgā Sūktam sets on one line rather than
 *             wrapping. Rasterised at scale 2 with the band it is a 1184 px
 *             image, inside WhatsApp's 1600 px long edge, so the service does
 *             not resample it before it compresses it.
 *   `pad`     2.5rem over 2.25rem. Less than this and the holding boxes, which
 *             are drawn OUTSIDE the line box, touch the card's edge.
 *   `matPad`  1.5rem. The band exists so the rounded corner and the card's
 *             shadow are inside the image; a card flush to the edge loses both.
 *   `radius`  22px. On a 544 px card that is 4 % of the width — reads as a
 *             rounded card at full size and is still visibly not a square at
 *             thumbnail size.
 *
 * One constant, so the two card styles cannot drift apart.
 */
export const CARD: CardGeometry = {
  radius: '22px',
  pad: '2.5rem 2.25rem',
  measure: '34rem',
  matPad: '1.5rem',
};

export interface ExportStyle {
  readonly id: string;
  /** What a menu calls it. */
  readonly name: string;
  readonly note: string;
  /** A `DOCUMENT_THEMES` id. Every colour, face and size comes from there. */
  readonly doc: string;
  /**
   * Which of the theme's two modes. A theme with no dark of its own — `word` —
   * gives the same page for both, which is deliberate: a printed page is not
   * dark, and a "dark Veda Union Word document" would be a different document.
   */
  readonly mode: 'light' | 'dark';
  readonly frame: ExportFrame;
  /** Present only on a `card` frame. */
  readonly card?: CardGeometry;
}

/**
 * The styles, in the order a menu should offer them.
 *
 * His own document first, because it is the answer to "make me this mantra"
 * and it is the default. The rest are pairings of a theme with a frame; a
 * pairing that is missing is a missing ENTRY, not missing code.
 */
export const EXPORT_STYLES: readonly ExportStyle[] = [
  {
    id: 'veda-union',
    name: 'Veda Union',
    note: 'His own Word document on an A4 sheet: Arial 16 pt on 24 pt exact '
        + 'leading, his holding green, his svara red, his 25 mm margins.',
    doc: 'word',
    mode: 'light',
    frame: 'page',
  },
  {
    id: 'veda-union-web',
    name: 'Veda Union / web',
    note: 'How vedaunion.org sets a chant — warm vellum, violet-black ink, '
        + 'Cormorant headings — with no sheet and no page margins.',
    doc: 'vu-web',
    mode: 'light',
    frame: 'web',
  },
  {
    id: 'card',
    name: 'Card',
    note: 'The mantra on a rounded vellum card with a band around it. Sized to '
        + 'stay legible in a chat bubble; see CARD.',
    doc: 'vu-web',
    mode: 'light',
    frame: 'card',
    card: CARD,
  },
  {
    id: 'card-dark',
    name: 'Card / dark',
    note: 'The same card on the platform’s own dark ground, for a phone in '
        + 'dark mode and a chat read at night.',
    doc: 'vu-web',
    mode: 'dark',
    frame: 'card',
    card: CARD,
  },
  {
    id: 'plain',
    name: 'Plain',
    note: 'White paper, black ink, Gentium, on an A4 sheet. What a printed '
        + 'page looks like.',
    doc: 'plain',
    mode: 'light',
    frame: 'page',
  },
  {
    id: 'manuscript',
    name: 'Manuscript',
    note: 'Ivory and umber, EB Garamond, on an A4 sheet. The most bookish of '
        + 'the pages.',
    doc: 'manuscript',
    mode: 'light',
    frame: 'page',
  },
  {
    id: 'high-contrast',
    name: 'High contrast',
    note: 'Maximum separation between ink, paper and every mark. For proofing '
        + 'and for poor light.',
    doc: 'high-contrast',
    mode: 'light',
    frame: 'page',
  },
  {
    id: 'transparent',
    name: 'Transparent',
    note: 'The text and its marks on no ground at all — a PNG with an alpha '
        + 'channel, or a fragment to drop into a page that has its own paper.',
    doc: 'plain',
    mode: 'light',
    frame: 'bare',
  },
];

export const DEFAULT_EXPORT_STYLE = 'veda-union';

export function exportStyle(id: string): ExportStyle {
  const found = EXPORT_STYLES.find((s) => s.id === id);
  if (found === undefined) {
    throw new Error(
      `unknown export style "${id}" — one of ${EXPORT_STYLES.map((s) => s.id).join(', ')}`,
    );
  }
  return found;
}

/**
 * The theme a style is painted in.
 *
 * Goes through `documentTheme`, which throws on a name it does not know, so a
 * typo in a style's `doc` fails the first time that style is exported instead
 * of quietly rendering some other theme's colours under his name.
 */
export function documentThemeOf(style: ExportStyle): DocumentTheme {
  return documentTheme(style.doc);
}
