/**
 * How big a picture is, and the air around it.
 *
 * Its own file rather than more of `source.ts`, so that changing how pictures
 * sit on the page is one file — and because `source.ts` reached the 400-line
 * limit `check:modules` holds new code to, which is the signal to split rather
 * than to raise.
 *
 * A figure's width is a FRACTION of the column it stands in, never a length
 * somebody typed, because one document is drawn in three columns of different
 * widths: the A4 content box (453.5 pt), the web view's reading measure and
 * whatever a card is. A picture set at 340 px is a third of an A4 column and
 * two thirds of an A5 one.
 *
 * The five steps are the vocabulary `ChantFigure.size` already had, restated
 * from `chant.css` unchanged — 88px, clamp(120,25%,210), clamp(160,50%,340),
 * 75%, 100% — so adopting one shared component moved no picture in the pūjā
 * manual. 1rem = 16px.
 *
 * The floor and the ceiling on `small` and `medium` are why those two are
 * clamps rather than percentages: at the web view's 46rem measure a bare 25 %
 * is 184 px and readable, and on a phone's 20rem it is 80 px, which is a
 * thumbnail nobody asked for.
 *
 * ZOOM IS NOT IN ANY OF THESE, and this comment used to say the opposite —
 * "every one of these is multiplied by `--doc-zoom` where it is used". Three
 * of them were, in `figure.css`, and that was the trouble: the picture grew
 * with the zoom while the type could not, because the type's tokens are
 * declared on `:root` where `--doc-zoom` is always 1. Zoom is now the
 * browser's own `zoom` property, one declaration per sheet in `canvas.css`,
 * and it scales these along with everything else.
 */
export const FIGURE = {
  /* The corner grab handle on a selected picture: big enough to hit with a
     mouse and small enough not to cover the picture at thumbnail size. */
  "fig-handle": "0.5rem",
  "fig-thumb": "5.5rem",
  "fig-small": "25%",
  "fig-small-min": "7.5rem",
  "fig-small-max": "13.125rem",
  "fig-medium": "50%",
  "fig-medium-min": "10rem",
  "fig-medium-max": "21.25rem",
  "fig-large": "75%",
  "fig-full": "100%",
  /* The air around a floated picture: almost none above it, so its top lines
     up with the text it stands beside, and a full gutter on the text side. */
  "fig-float-lead": "0.2rem",
  "fig-float-gap": "1.1rem",
  "fig-float-after": "0.8rem",
  /* Between a picture and its caption. */
  "fig-cap-gap": "0.45rem",
  /* And beside it, when the caption is set alongside rather than under. */
  "fig-cap-beside-gap": "0.9rem",
  "fig-cap-beside-w": "40%",
  /* THE DROP RULE — the line that says where a dragged picture will land.
     Thicker than a hairline because it has to be findable while the pointer is
     moving, and it is chrome, so it never prints. */
  "fig-drop-rule": "0.1875rem",
  /* How far the pointer must travel before a press on a picture becomes a
     drag. Below this a click is a click: a person selecting a picture moves
     the mouse a pixel or two while the button is down, and a document that
     re-ordered itself on that would be a document nobody could click. */
  "fig-drag-slop": "4px",
  /* The picture being carried, left behind at half strength so the rule can be
     read against it. */
  "fig-drag-ghost": "0.4",
  /* The band at the top and bottom of the column that scrolls while a picture
     is held over it, and how fast. A drag to a step off the screen is the
     common case in a manual of 54 of them. */
  "fig-drag-edge": "48px",
  "fig-drag-speed": "14px",
} as const;

/* ==========================================================================
   The same widths, as a number — for the formats that cannot say "25 %"
   ========================================================================== */

/**
 * How wide this picture is, in the same units as the column it stands in.
 *
 * DERIVED FROM THE TOKENS ABOVE, never restated. A `.docx` stores a picture's
 * size in EMU and a PDF in points; neither has a percentage or a `clamp`, so
 * each of them needs a number — and a number typed into an exporter is a
 * second opinion about how wide `medium` is. Reading it out of the same table
 * `figure.css` uses means a change here moves the picture on the page and in
 * Word together, which is the whole reason the table exists.
 *
 * `widthPct` wins when the document has one: a picture whose corner somebody
 * dragged has a width of its own, and the five steps are only the starting
 * points.
 *
 * @param columnPx the column's width, in the unit you want the answer in.
 * @param remPx    what 1 rem is worth in that unit. 16 for CSS pixels.
 */
export function figureWidth(
  fig: { size?: string | undefined; widthPct?: number | undefined },
  columnPx: number,
  remPx = 16,
): number {
  if (fig.widthPct !== undefined) return (columnPx * fig.widthPct) / 100;
  const value = (token: string): number => {
    if (token.endsWith('%')) return (columnPx * parseFloat(token)) / 100;
    if (token.endsWith('rem')) return parseFloat(token) * remPx;
    return parseFloat(token);
  };
  const clamped = (base: string, lo: string, hi: string): number =>
    Math.max(value(lo), Math.min(value(base), value(hi)));
  switch (fig.size ?? 'medium') {
    case 'thumb': return value(FIGURE['fig-thumb']);
    case 'small': return clamped(FIGURE['fig-small'], FIGURE['fig-small-min'], FIGURE['fig-small-max']);
    case 'large': return value(FIGURE['fig-large']);
    case 'full': return value(FIGURE['fig-full']);
    default:
      return clamped(FIGURE['fig-medium'], FIGURE['fig-medium-min'], FIGURE['fig-medium-max']);
  }
}

/**
 * How wide the PICTURE is, which is not always how wide the figure is.
 *
 * A caption set BESIDE the picture takes a share of the figure's width, so the
 * picture gets the rest. `figure.css` splits it with flex; a `.docx` and a PDF
 * have to be told a number, and a number worked out in an exporter is a second
 * opinion about the same layout.
 *
 * MEASURED AS THE FAULT: the exporter asked `figureWidth`, which is the
 * FIGURE's width, so a picture with a caption beside it was drawn in Word at
 * the full step — about 47 % wider than the page draws it — with the caption
 * underneath. One document, two pictures.
 *
 * The share is `fig-cap-beside-w` and the space between them is
 * `fig-cap-beside-gap`, both from the table above, so moving either moves the
 * page and Word together.
 */
export function pictureWidth(
  fig: {
    size?: string | undefined;
    widthPct?: number | undefined;
    captionAt?: string | undefined;
    caption?: { en?: string | undefined } | undefined;
  },
  columnPx: number,
  remPx = 16,
): number {
  const whole = figureWidth(fig, columnPx, remPx);
  const text = fig.caption?.en ?? '';
  if (fig.captionAt !== 'beside' || text.trim() === '') return whole;
  const share = parseFloat(FIGURE['fig-cap-beside-w']) / 100;
  const gap = parseFloat(FIGURE['fig-cap-beside-gap']) * remPx;
  /* Never negative and never nothing: a thumbnail with a caption beside it is
     a small picture, not a missing one. */
  return Math.max(remPx, whole * (1 - share) - gap);
}

/** The share of a figure's width a caption beside it takes. */
export const CAPTION_BESIDE_SHARE = parseFloat(FIGURE['fig-cap-beside-w']) / 100;
