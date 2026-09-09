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
 * Every one of these is multiplied by `--doc-zoom` where it is used
 * (`figure.css`), because a picture that held its pixel size while the page
 * doubled would shrink against the text at every zoom but 100 %.
 */
export const FIGURE = {
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
} as const;
