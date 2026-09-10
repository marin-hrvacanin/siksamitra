/**
 * A PICTURE IN A `.docx` — the drawing, the bytes, and the wrap.
 *
 * WHY THIS WAS MISSING AND WHY THAT MATTERED. The Word export carries the
 * whole document in a custom XML part, so a picture always survived a round
 * trip through our own reader — and nothing showed in Word. A person inserts a
 * photograph of a mudrā, exports to Word to send to somebody, and the picture
 * is not in the file they send. The round trip being lossless made the loss
 * invisible to every gate we had.
 *
 * THE BYTES GO IN THE PACKAGE, as `word/media/imageN.png`. That is where a
 * `.docx` keeps a picture, and it is the one place Word will look. It is not a
 * contradiction of `format/figure.ts`, which says a picture belongs INSIDE the
 * document: a `.docx` is a container with somewhere to put bytes, our `.json`
 * is not. The bytes are the same bytes; only the envelope differs.
 *
 * INLINE OR ANCHORED, from the figure's own `flow`:
 *
 *   block, aside   `wp:inline` — a picture in the run of text, centred by the
 *                  paragraph. Word's "In line with text".
 *   start, end     `wp:anchor` with `wp:wrapSquare` — Word's "Square" wrap,
 *                  aligned to the left or right margin. The same two things
 *                  the page does with `float`.
 *
 * HOW WIDE, from `@siksamitra/tokens/figure`. A `.docx` stores a size in EMU
 * and has no percentage, so the five steps are resolved against the section's
 * own content column — the one `sectPr` writes — rather than against a number
 * typed in here. A picture is then the same fraction of the column in Word
 * that it is on the page.
 *
 * `pictureWidth` and not `figureWidth`: a caption set BESIDE the picture takes
 * a share of the figure and the picture gets the rest. And the drawing is
 * always the PICTURE'S own shape — see `extent`, which is where a fixed crop
 * used to stretch it.
 */
import { pictureWidth } from '@siksamitra/tokens/figure';
import {
  FIGURE_DEFAULTS, figureBytes, imageMediaType, isEmbeddedImage, type ChantFigure,
} from '@siksamitra/format';
import { fromBase64 } from '../base64.js';
import { xmlEscape } from '../xml.js';

/** English Metric Units in one inch — OOXML's unit for everything drawn. */
export const EMU_PER_INCH = 914400;
const EMU_PER_POINT = EMU_PER_INCH / 72;

const DML = 'http://schemas.openxmlformats.org/drawingml/2006';
const WP_NS = `${DML}/wordprocessingDrawing`;
const A_NS = `${DML}/main`;
const PIC_NS = `${DML}/picture`;

/** The extension a media part gets, from the picture's own media type. */
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** One picture, as it goes into the package. */
export interface WordMedia {
  /** The part name, e.g. `word/media/image1.png`. */
  readonly part: string;
  /** The relationship id `<a:blip r:embed>` names. */
  readonly relId: string;
  /** What the relationship's `Target` says, relative to `word/`. */
  readonly target: string;
  readonly extension: string;
  readonly bytes: Uint8Array;
}

/**
 * The pictures a document carries, numbered, with their bytes decoded.
 *
 * KEYED BY THE BYTES, not by the figure's id. Three figure items may carry the
 * same photograph — one drawing of the añjali mudrā used at five steps of the
 * pūjā manual — and a package that stored it five times would be five times
 * the size for nothing. Word does the same: one media part, five drawings
 * pointing at it.
 *
 * A picture the document does NOT carry — the pūjā manual names 22 that live
 * on the platform — has no bytes to write and is skipped here; `figureDrawing`
 * then draws nothing for it and the body writes its alt text instead, which is
 * what the page does too.
 *
 * The relationship ids start after the four `documentRels` already spends, and
 * the numbering is by the order figures appear so that two exports of one
 * document produce the same bytes.
 */
export function mediaFor(
  figures: readonly ChantFigure[], firstRelId: number,
): Map<string, WordMedia> {
  const out = new Map<string, WordMedia>();
  let n = 0;
  for (const fig of figures) {
    if (!isEmbeddedImage(fig.src)) continue;
    const type = imageMediaType(fig.src);
    const extension = type === null ? undefined : EXTENSIONS[type];
    if (extension === undefined) continue;
    if (out.has(fig.src)) continue;
    n += 1;
    const target = `media/image${n}.${extension}`;
    out.set(fig.src, {
      part: `word/${target}`,
      target,
      extension,
      relId: `rId${firstRelId + n - 1}`,
      bytes: fromBase64(fig.src.slice(fig.src.indexOf(',') + 1)),
    });
  }
  return out;
}

/**
 * How big the picture is drawn, in whatever unit the column is given in.
 *
 * EXPORTED so a gate can ask for the number without generating a whole
 * `.docx`: `tools/export/gate-figures.mjs` compares it with the box the
 * browser actually drew, which is the only way to know the page and Word agree
 * about a picture.
 *
 * THE WIDTH IS CLAMPED HERE, and it has to be somewhere. `widthPct` is floored
 * at 5 and capped at 100 by the drag that produces it, and by `figureBlockers`
 * for a document being validated — but a `.json` is a file a person can edit,
 * and neither guard is on the EXPORT path. A `widthPct` of `-50` wrote
 * `cx="-2880000"` and a non-numeric one wrote `cx="NaN"`, both of which are a
 * `.docx` Word offers to repair rather than open: a whole document lost to one
 * bad number, and the only report of it is Word's own "the file appears to be
 * corrupted".
 *
 * A picture cannot be narrower than nothing or wider than the column it is in,
 * so those are the bounds, and `EMU_MIN` is one point — small enough to be a
 * mistake a person can see, large enough that Word draws something.
 */
export function pictureExtent(
  fig: ChantFigure, column: number, rem: number,
): { w: number; h: number; ratio: number } {
  /*
   * `pictureWidth` AND NOT `figureWidth`. A caption set BESIDE the picture
   * takes a share of the figure's width and the picture gets the rest, so the
   * figure's width is not the drawing's. Asking for the figure's drew a
   * picture about 47 % wider in Word than the page draws it, with the caption
   * underneath — one document, two pictures. The share is a token, read by
   * `figure.css` and by this, so neither can drift.
   */
  const asked = pictureWidth(fig, column, rem);
  const boxW = Number.isFinite(asked) ? Math.max(asked, 0) : Math.min(column, rem * 4);

  /*
   * THE PICTURE'S OWN SHAPE, ALWAYS — a fixed crop reserves a BOX and the page
   * fits the picture inside it (`object-fit: contain`), so the empty band is
   * around the picture rather than in it.
   *
   * THIS USED TO STRETCH. `cy` was `cx * cropRatio` and a `<a:stretch>` fill
   * fills whatever extent it is given, so a 400x300 rectangle with
   * `crop: square` came out of Word 1:1 — the same picture, a third again as
   * tall as it is, with every face in it wrong. On the page the identical
   * figure was letterboxed. A distorted picture is not a difference of layout;
   * it is the wrong picture.
   *
   * `auto` — where the crop IS the picture's ratio — comes out unchanged,
   * which is the overwhelming case.
   */
  const crop = fig.crop ?? FIGURE_DEFAULTS.crop;
  const intrinsic = fig.width !== undefined && fig.height !== undefined && fig.width > 0
    ? fig.height / fig.width
    : 3 / 4;
  const box = crop === 'square' ? 1
    : crop === 'portrait' ? 4 / 3
      : crop === 'wide' ? 9 / 16
        : intrinsic;
  /* Taller than its box: the height binds and the picture comes in narrower.
     Otherwise the width binds, which is what `auto` always does. */
  const w = intrinsic > box ? (boxW * box) / intrinsic : boxW;
  /* `ratio` is the PICTURE's, reported separately so a clamped width still has
     a shape to keep: `w` and `h` can both be nothing when a hand-edited
     `widthPct` is negative, and `h / w` is then no ratio at all. */
  return { w, h: w * intrinsic, ratio: intrinsic };
}

/**
 * The same, in EMU and clamped to something Word will open.
 *
 * THE WIDTH IS CLAMPED HERE, and it has to be somewhere. `widthPct` is floored
 * at 5 and capped at 100 by the drag that produces it, and by `figureBlockers`
 * for a document being validated — but a `.json` is a file a person can edit,
 * and neither guard is on the EXPORT path. A `widthPct` of `-50` wrote
 * `cx="-2880000"` and a non-numeric one wrote `cx="NaN"`, both of which are a
 * `.docx` Word offers to repair rather than open: a whole document lost to one
 * bad number, and the only report of it is Word's own "the file appears to be
 * corrupted".
 *
 * A picture cannot be narrower than nothing or wider than the column it is in,
 * so those are the bounds, and `EMU_MIN` is one point — small enough to be a
 * mistake a person can see, large enough that Word draws something.
 */
function extent(fig: ChantFigure, columnEmu: number): { cx: number; cy: number } {
  const EMU_MIN = EMU_PER_POINT;
  const { w, ratio } = pictureExtent(fig, columnEmu, EMU_PER_POINT * 12);
  const cx = Number.isFinite(w)
    ? Math.round(Math.min(Math.max(w, EMU_MIN), Math.max(columnEmu, EMU_MIN)))
    : Math.round(Math.min(columnEmu, EMU_PER_INCH));
  /* The height follows the width that was actually WRITTEN and the picture's
     own ratio, so a clamp cannot leave a stretched picture behind. */
  return { cx: Math.max(1, cx), cy: Math.max(1, Math.round(cx * ratio)) };
}

/** The `<a:graphic>` half, which is identical inline and anchored. */
function graphic(fig: ChantFigure, media: WordMedia, id: number, cx: number, cy: number): string {
  const name = xmlEscape(`Picture ${id}`);
  const alt = xmlEscape(fig.alt);
  return `<a:graphic xmlns:a="${A_NS}">`
    + `<a:graphicData uri="${PIC_NS}">`
    + `<pic:pic xmlns:pic="${PIC_NS}">`
    + `<pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${alt}"/>`
    + '<pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>'
    + `<pic:blipFill><a:blip r:embed="${media.relId}"/>`
    + '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
    + '</pic:pic></a:graphicData></a:graphic>';
}

/**
 * One picture as a `<w:drawing>`, or `null` when the document has no bytes.
 *
 * `id` must be unique across the document: Word treats a repeated `docPr` id
 * as one object in two places and the second one loses its alternative text.
 */
export function figureDrawing(
  fig: ChantFigure,
  media: WordMedia | undefined,
  id: number,
  columnEmu: number,
): string | null {
  if (media === undefined) return null;
  const { cx, cy } = extent(fig, columnEmu);
  const alt = xmlEscape(fig.alt);
  const docPr = `<wp:docPr id="${id}" name="${xmlEscape(`Picture ${id}`)}" descr="${alt}"/>`
    + '<wp:cNvGraphicFramePr>'
    + `<a:graphicFrameLocks xmlns:a="${A_NS}" noChangeAspect="1"/></wp:cNvGraphicFramePr>`;
  const size = `<wp:extent cx="${cx}" cy="${cy}"/>`
    + '<wp:effectExtent l="0" t="0" r="0" b="0"/>';
  const flow = fig.flow ?? FIGURE_DEFAULTS.flow;
  const wrap = fig.wrap ?? FIGURE_DEFAULTS.wrap;

  /*
   * INLINE only when the picture is CENTRED AND top-and-bottom — Word's own
   * default, where the drawing sits in the text line and nothing flows beside
   * it. A picture that names a side has to be anchored, because `wp:inline`
   * has nowhere to put one.
   */
  if (wrap === 'top-bottom' && flow !== 'start' && flow !== 'end') {
    return `<w:drawing xmlns:wp="${WP_NS}">`
      + '<wp:inline distT="0" distB="0" distL="0" distR="0">'
      + size + docPr + graphic(fig, media, id, cx, cy)
      + '</wp:inline></w:drawing>';
  }

  /*
   * ANCHORED. The wrap is the PICTURE'S, exactly as it is on the page:
   *
   *   square       `wp:wrapSquare` — the text runs beside it.
   *   top-bottom   `wp:wrapTopAndBottom` — it gets a band of its own, and is
   *                aligned to its side within that band. This is the case that
   *                used to be unrepresentable: every picture with a side was
   *                written as a square wrap, so a document whose text was
   *                never meant to flow beside a mantra arrived in Word with it
   *                flowing anyway.
   *
   * The gutter is on the TEXT side only — the same asymmetry `figure.css`
   * gives a float, where the margin is a full gutter towards the text and
   * nothing towards the margin. Top-and-bottom has no text beside it, so it
   * takes no side gutter at all.
   */
  const gutter = Math.round(EMU_PER_INCH / 8);
  const beside = wrap === 'square';
  const align = flow === 'end' ? 'right' : flow === 'start' ? 'left' : 'center';
  return `<w:drawing xmlns:wp="${WP_NS}">`
    + `<wp:anchor distT="0" distB="0" distL="${beside && flow === 'end' ? gutter : 0}" `
    + `distR="${beside && flow === 'start' ? gutter : 0}" simplePos="0" relativeHeight="2" `
    + 'behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">'
    + '<wp:simplePos x="0" y="0"/>'
    + `<wp:positionH relativeFrom="margin"><wp:align>${align}</wp:align></wp:positionH>`
    + '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
    + size
    + (beside ? '<wp:wrapSquare wrapText="bothSides"/>' : '<wp:wrapTopAndBottom/>')
    + docPr + graphic(fig, media, id, cx, cy)
    + '</wp:anchor></w:drawing>';
}

/** What a picture the document does not carry says instead. Its alt text, as
 *  the page draws it — not nothing, and not a broken frame. */
export const figurePlaceholderText = (fig: ChantFigure): string =>
  (fig.alt.trim() === '' ? '[picture]' : `[${fig.alt.trim()}]`);

/** The decoded size of every picture written, for the export's own report. */
export const mediaBytes = (figures: readonly ChantFigure[]): number =>
  figures.reduce((n, f) => n + figureBytes(f.src), 0);
