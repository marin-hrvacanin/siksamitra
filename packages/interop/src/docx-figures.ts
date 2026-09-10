/**
 * READING A PICTURE OUT OF SOMEBODY ELSE'S `.docx`.
 *
 * `word/drawing.ts` writes one; this reads one back, and the two are not the
 * same job. The writer only ever has to produce the one shape it chose. A
 * reader meets every shape Word has ever written: inline and anchored, wrapped
 * six ways, sized in EMU that bear no relation to the file's own pixels, and
 * pointing at bytes through a relationship id that lives in a different part.
 *
 * WHAT IS TAKEN, and nothing else:
 *
 *   the bytes      through `r:embed` -> `word/_rels/document.xml.rels` ->
 *                  `word/media/…`, and into a `data:` URI, because a document
 *                  here carries its own pictures (`format/figure.ts`).
 *   the alt text   `descr`, which is where Word's own "Alt Text" pane writes.
 *                  It IS the instruction for a picture of a mudra.
 *   how wide       the drawn `cx` as a fraction of the section's own text
 *                  column, so a picture half the width of his page is half the
 *                  width of ours rather than a number of points that means
 *                  something different on A5.
 *   the wrap       an anchor with a square/tight wrap becomes `start` or `end`
 *                  from the side it is aligned to; everything else is `block`.
 *
 * THE INTRINSIC SIZE IS READ FROM THE BYTES, not from `cx`/`cy`. Those are how
 * big Word DREW it, which is a decision somebody made with a mouse; the aspect
 * box a page reserves has to come from the picture itself, or a figure that
 * somebody squashed in Word reserves the wrong space here and the mantra under
 * it moves when the bytes load.
 */
import { toBase64 } from './base64.js';
import { imageDataUri, type ChantFigure } from '@siksamitra/format';
import { xmlText } from './xml.js';

/** One `<w:drawing>`, as the XML has it. */
export interface DocxDrawing {
  /** The relationship id in `<a:blip r:embed>`. */
  readonly relId: string;
  readonly alt: string;
  /** Drawn size in EMU. */
  readonly cx: number;
  readonly cy: number;
  /** Which side an anchored picture is aligned to. */
  readonly side?: 'start' | 'end';
  /**
   * What the TEXT does about it, as Word's own wrap element says.
   *
   * `wrapSquare`, `wrapTight` and `wrapThrough` all put text beside the
   * picture; `wrapTopAndBottom` gives it a band of its own. Read separately
   * from the side, because they are separate in Word and now separate here —
   * a picture aligned right with a top-and-bottom wrap used to come back as a
   * square wrap, and then flowed text beside a mantra it was never meant to.
   */
  readonly wrap?: 'square' | 'top-bottom';
}

const RE_DRAWING = /<w:drawing\b[\s\S]*?<\/w:drawing>/g;
const RE_EMBED = /<a:blip\b[^>]*r:embed="([^"]+)"/;
const RE_EXTENT = /<wp:extent\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/;
const RE_DESCR = /<wp:docPr\b[^>]*descr="([^"]*)"/;
const RE_WRAP = /<wp:wrap(Square|Tight|Through)\b/;
const RE_WRAP_BAND = /<wp:wrapTopAndBottom\b/;
const RE_ALIGN_H = /<wp:positionH\b[\s\S]*?<wp:align>(left|right|center|inside|outside)<\/wp:align>/;
const RE_OFFSET_H = /<wp:positionH\b[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/;

/**
 * Every picture in one paragraph's XML, in the order it draws.
 *
 * A drawing with no `r:embed` is a chart, a shape or a SmartArt diagram — a
 * `<w:drawing>` is the wrapper for all of them — and is skipped rather than
 * turned into a figure with no bytes.
 */
export function readDrawings(paragraphXml: string): DocxDrawing[] {
  const out: DocxDrawing[] = [];
  RE_DRAWING.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_DRAWING.exec(paragraphXml)) !== null) {
    const xml = m[0];
    const relId = RE_EMBED.exec(xml)?.[1];
    if (relId === undefined) continue;
    const extent = RE_EXTENT.exec(xml);
    const side = sideOf(xml);
    const wrap = wrapOf(xml);
    out.push({
      relId,
      alt: xmlText(RE_DESCR.exec(xml)?.[1] ?? ''),
      cx: Number(extent?.[1] ?? 0),
      cy: Number(extent?.[2] ?? 0),
      ...(side === undefined ? {} : { side }),
      ...(wrap === undefined ? {} : { wrap }),
    });
  }
  return out;
}

/**
 * Which side a floated picture sits on, or `undefined` for one that does not
 * float.
 *
 * ONLY A WRAPPED ANCHOR COUNTS. `wp:anchor` also covers "behind text" and "in
 * front of text", which are not wraps at all and have no equivalent here — a
 * picture the text runs OVER is read as an ordinary block rather than
 * pretended to be a float.
 *
 * An anchor positioned by an offset rather than by an alignment is read by the
 * sign of the offset: Word writes a right-hand float as a large positive
 * offset from the margin, and a left-hand one as zero or near it. Half the
 * column is the dividing line, which is the only reading that does not need
 * the page width.
 */
/**
 * What the text does about an anchored picture.
 *
 * `undefined` for an inline drawing, which has no wrap: it sits in the text
 * line, and `top-bottom` is what that becomes on our page.
 */
function wrapOf(xml: string): 'square' | 'top-bottom' | undefined {
  if (!xml.includes('<wp:anchor')) return undefined;
  if (RE_WRAP.test(xml)) return 'square';
  if (RE_WRAP_BAND.test(xml)) return 'top-bottom';
  return undefined;
}

function sideOf(xml: string): 'start' | 'end' | undefined {
  /*
   * An anchor with a REAL WRAP — which now includes top-and-bottom, because a
   * picture in a band of its own is still aligned left or right within it, and
   * reading the side only for square wraps sent every one of them back to the
   * centre.
   *
   * `wrapNone` is still no side, and that is not a detail: it means the text
   * runs OVER the picture — a watermark. There is no such thing on our page,
   * so it becomes an ordinary centred block rather than a lie about the
   * layout, and a test holds that line.
   */
  if (!xml.includes('<wp:anchor')) return undefined;
  if (!RE_WRAP.test(xml) && !RE_WRAP_BAND.test(xml)) return undefined;
  const align = RE_ALIGN_H.exec(xml)?.[1];
  if (align === 'right' || align === 'outside') return 'end';
  if (align === 'left' || align === 'inside') return 'start';
  if (align === 'center') return undefined;
  const offset = Number(RE_OFFSET_H.exec(xml)?.[1] ?? 0);
  const cx = Number(RE_EXTENT.exec(xml)?.[1] ?? 0);
  return offset > cx / 2 ? 'end' : 'start';
}

/* ==========================================================================
   The bytes
   ========================================================================== */

/** 914400 EMU to the inch, 96 pixels to the inch — so 9525 EMU to the pixel. */
const EMU_PER_PX = 9525;

const RE_REL = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;

/** `rId7` -> `media/image3.png`, from `word/_rels/document.xml.rels`. */
export function relationshipTargets(relsXml: string): Map<string, string> {
  const out = new Map<string, string>();
  RE_REL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_REL.exec(relsXml)) !== null) out.set(m[1]!, m[2]!);
  return out;
}

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

/** The media type a part's name implies, or `null` for one a document may not
 *  carry — `.emf` and `.wmf` are the two Word writes most often, and neither
 *  is an image any browser can draw. */
export function mediaTypeOf(part: string): string | null {
  const ext = part.slice(part.lastIndexOf('.') + 1).toLowerCase();
  return MEDIA_TYPES[ext] ?? null;
}

/**
 * The picture's own width and height, read out of its bytes.
 *
 * Three formats by hand rather than a decoder: PNG puts them in the IHDR at a
 * fixed offset, GIF in the header, and JPEG in whichever SOF marker comes
 * first. That is every format Word embeds a photograph as. Anything else falls
 * back to the DRAWN aspect, which is a guess and is marked as one by the
 * caller reserving space from it.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const be16 = (at: number): number => (bytes[at]! << 8) | bytes[at + 1]!;
  const be32 = (at: number): number =>
    ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;

  /* PNG: the 8-byte signature, then an IHDR whose first two fields are the
     dimensions. */
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: be32(16), height: be32(20) };
  }
  /* GIF: little-endian, in the logical screen descriptor. */
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) {
    return { width: bytes[6]! | (bytes[7]! << 8), height: bytes[8]! | (bytes[9]! << 8) };
  }
  /* JPEG: walk the markers to the first start-of-frame. */
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) { at += 1; continue; }
      const marker = bytes[at + 1]!;
      /* C0-CF are start-of-frame, except C4 (Huffman), C8 and CC. */
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8
        && marker !== 0xcc) {
        return { height: be16(at + 5), width: be16(at + 7) };
      }
      at += 2 + be16(at + 2);
    }
  }
  return null;
}

/* ==========================================================================
   And the figure it becomes
   ========================================================================== */

/** The section's text column, in EMU, out of the `<w:sectPr>` of the body. */
export function columnEmuOf(documentXml: string): number {
  const size = /<w:pgSz\b[^>]*w:w="(\d+)"/.exec(documentXml);
  const margins = /<w:pgMar\b[^>]*>/.exec(documentXml)?.[0] ?? '';
  const twip = (re: RegExp, fallback: number): number =>
    Number(re.exec(margins)?.[1] ?? fallback);
  /* Twips — a twentieth of a point — throughout `w:pgSz` and `w:pgMar`. A4 at
     his 25 mm margins if the file says nothing, which is what `sectPr` writes. */
  const width = Number(size?.[1] ?? 11906);
  const left = twip(/w:left="(\d+)"/, 1418);
  const right = twip(/w:right="(\d+)"/, 1418);
  return Math.round(((width - left - right) / 20 / 72) * 914400);
}

/**
 * One drawing as a figure this format can hold.
 *
 * `null` when the bytes are missing or are of a kind a document may not carry
 * — an `.emf` line drawing, which is what Word turns a pasted Visio shape
 * into. The caller reports it rather than writing a figure with no picture in
 * it, which `figureBlockers` would refuse anyway.
 */
export function figureFromDrawing(
  drawing: DocxDrawing,
  part: string,
  bytes: Uint8Array,
  id: string,
  columnEmu: number,
): ChantFigure | null {
  const type = mediaTypeOf(part);
  if (type === null) return null;
  const size = imageSize(bytes);
  /* The DRAWN aspect, only when the bytes did not say. `cx`/`cy` are how big
     somebody made it with a mouse and are the wrong thing to reserve space
     from when the real proportions are available. */
  const measured = size ?? (drawing.cx > 0 && drawing.cy > 0
    ? {
      width: Math.round(drawing.cx / EMU_PER_PX),
      height: Math.round(drawing.cy / EMU_PER_PX),
    }
    : null);
  if (measured === null) return null;

  const pct = columnEmu > 0 && drawing.cx > 0
    ? Math.max(5, Math.min(100, Math.round((drawing.cx / columnEmu) * 100)))
    : undefined;
  return {
    id,
    src: imageDataUri(type, toBase64(bytes)),
    alt: drawing.alt,
    width: measured.width,
    height: measured.height,
    ...(pct === undefined ? {} : { widthPct: pct }),
    flow: drawing.side ?? 'block',
    wrap: drawing.wrap ?? 'top-bottom',
    size: 'medium',
    captionAt: 'below',
    crop: 'auto',
    frame: 'none',
    rounded: true,
  };
}
