/**
 * A picture in a document: what it is allowed to be, and where its bytes are.
 *
 * The shape is `ChantFigure` in `chant-parts.ts` and this file adds nothing to
 * it. What is here is the part a reader and a writer must AGREE on — the four
 * vocabularies, the rule about `alt`, and the one question that decides
 * everything downstream: is this picture inside the document or outside it?
 *
 * WHERE THE BYTES LIVE, and why the answer is "inside".
 *
 * A `.docx` keeps its pictures inside the zip and names them from the XML, and
 * that is the right answer for a container that has somewhere to put bytes.
 * This program saves one `.json`, so the only container it has is the document
 * itself — and the corpus shows what the other choice costs: `puja-vidhi.json`
 * names 22 PNGs under `/figures/puja-vidhi/`, not one of which exists in this
 * repository, so every one of them draws as a hole and the document is not one
 * thing.
 *
 * A picture inserted here is therefore a `data:` URI in `src`. Three things
 * follow, and all three are the point:
 *
 *   - saving is saving. `canonicalJson` carries it, `docHash` covers it, and
 *     `.vuchant` and the `.html` export get it for nothing.
 *   - the lossless HTML export stays lossless BY CONSTRUCTION rather than by a
 *     new inlining pass — its gate counts URLs that are not `data:`, and a
 *     `data:` URI already is one.
 *   - the bytes are visible in the file size instead of hidden in a folder,
 *     which is why `figureBytes` exists and why the insert path reports it.
 *
 * `src` may still be a path or an http URL: the corpus and the platform both
 * use them, and a reader that refused would refuse the pūjā manual. Those are
 * resolved by the HOST (`RenderHost.resolveUrl`), never by the renderer, and a
 * host that cannot resolve one gets a placeholder carrying the alt text rather
 * than a broken image — see `packages/render/src/render/figure.tsx`.
 */
import type { ChantDoc, ChantItem } from './chant-structure.js';
import type { ChantFigure, ChantFigureFlow, ChantFigureSize } from './chant-parts.js';

/* ==========================================================================
   The vocabularies — the closed sets a figure's four axes may take
   ========================================================================== */

/** Width as a fraction of the column. Never a free length — see `figure.css`. */
export const FIGURE_SIZES: readonly ChantFigureSize[] = [
  'thumb', 'small', 'medium', 'large', 'full',
];

/**
 * How the step's text moves around the picture.
 *
 * Three of Word's seven, and the four that are missing are missing on purpose
 * — see `openspec/changes/document-images/design.md`. `aside` is kept because
 * the format already declares it and a document may carry it; it draws as
 * `block` until a margin rail exists, which is a degradation and not a lie.
 */
export const FIGURE_FLOWS: readonly ChantFigureFlow[] = ['block', 'start', 'end', 'aside'];

export const FIGURE_CAPTION_AT = ['below', 'above', 'beside', 'none'] as const;
export const FIGURE_CROPS = ['auto', 'square', 'portrait', 'wide'] as const;
export const FIGURE_FRAMES = ['none', 'thin', 'violet'] as const;

export type FigureCaptionAt = (typeof FIGURE_CAPTION_AT)[number];
export type FigureCrop = (typeof FIGURE_CROPS)[number];
export type FigureFrame = (typeof FIGURE_FRAMES)[number];

/** What a figure is when the document does not say. One place, so the reader,
 *  the editor and the exporter cannot each pick a different default. */
export const FIGURE_DEFAULTS = {
  size: 'medium',
  flow: 'block',
  captionAt: 'below',
  crop: 'auto',
  frame: 'none',
  rounded: true,
} as const;

/* ==========================================================================
   The bytes
   ========================================================================== */

/**
 * The image types a document may carry.
 *
 * SVG IS NOT ONE OF THEM, and that is a security decision rather than a
 * typographic one: an SVG is a script host, and an `<img>` of a `data:image/
 * svg+xml` inherits nothing but the same file opened in a tab does. A picture
 * that arrives inside a document someone was sent must not be able to run.
 */
export const FIGURE_MEDIA_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif',
] as const;

/**
 * The largest picture a document will take, in bytes of the encoded file.
 *
 * From the page rather than from taste. The A4 text column is 453.5 pt = 6.30
 * in, so a picture printed across it at 300 ppi — the point past which a press
 * gains nothing — is 1 889 px wide. A photograph at 1 889 x 1 417 is about
 * 2 MB as a good JPEG and about 6 MB as a PNG; 8 MiB takes both and refuses a
 * raw camera dump, which is bytes nobody can ever see.
 *
 * Base64 adds a third, so 8 MiB of file is about 10.7 MiB of document. The
 * insert path says so rather than letting it be discovered later.
 */
export const FIGURE_MAX_BYTES = 8 * 1024 * 1024;

const DATA_URI = /^data:([a-z]+\/[a-z0-9.+-]+)(;[a-z0-9-]+=[^,;]*)*;base64,([A-Za-z0-9+/=]*)$/i;

/** Is this picture carried by the document itself? */
export const isEmbeddedImage = (src: string): boolean => DATA_URI.test(src);

/** The media type of an embedded picture, or `null` for one that is not. */
export function imageMediaType(src: string): string | null {
  const m = DATA_URI.exec(src);
  return m === null ? null : m[1]!.toLowerCase();
}

/**
 * How many bytes of picture this `src` is, decoded.
 *
 * Base64 is four characters per three bytes, less one byte per `=`. Computed
 * rather than decoded because the caller wants a number to show, and decoding
 * a 10 MB string to measure it is 10 MB of garbage per keystroke.
 */
export function figureBytes(src: string): number {
  const m = DATA_URI.exec(src);
  if (m === null) return 0;
  const b64 = m[3]!;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

/** Build the `src` of an embedded picture. The one place the URI is spelled. */
export const imageDataUri = (mediaType: string, base64: string): string =>
  `data:${mediaType};base64,${base64}`;

/* ==========================================================================
   Validation
   ========================================================================== */

/**
 * What is wrong with this figure, as sentences. Empty means nothing is.
 *
 * ALT IS WANTED AND NOT DEMANDED, and the difference decides where the
 * requirement can live. These documents are liturgical manuals: a picture of a
 * mudrā is the only form that instruction takes, so one with no alternative
 * text is a step a blind reciter cannot perform. That is worth reporting on
 * every picture that lacks it.
 *
 * It is NOT worth stopping the insertion for. The owner's words: "photo name
 * shouldn't be obligatory and neither description — by default it should only
 * insert the picture and then in the picture tab you can set these." A dialog
 * between choosing a file and seeing it on the page is a dialog people learn
 * to dismiss, and a description written to get past a dialog is not a
 * description. So `figureFaults` reports it, `sm validate` prints it, and
 * `insertFigure` no longer refuses on it.
 *
 * A caption is not a substitute — a caption is shown to everybody and says
 * what the picture is FOR, while alt says what is IN it — which is why
 * repeating one as the other is reported.
 */
/**
 * The narrowest and widest a dragged picture may be, as a percentage.
 *
 * Below the floor a picture is a speck nobody meant to make and cannot grab
 * again; above the ceiling it is wider than the column it stands in.
 */
export const FIGURE_MIN_PCT = 5;
export const FIGURE_MAX_PCT = 100;

export function figureFaults(fig: ChantFigure, where = 'a figure'): string[] {
  return [...figureBlockers(fig, where), ...figureNudges(fig, where)];
}

/**
 * What a person has not written YET. Reported, never refused.
 *
 * One function rather than a filter on the prose of `figureFaults`: matching
 * a sentence to decide whether it blocks is a test that passes until somebody
 * rewords the sentence, and it did — rewording "has no alternative text" to
 * name the control instead made the insertion start refusing again.
 */
export function figureNudges(fig: ChantFigure, where = 'a figure'): string[] {
  const out: string[] = [];
  if (typeof fig.alt !== 'string' || fig.alt.trim() === '') {
    out.push(`${where}: has no description yet — add one on the Picture tab, `
      + 'so somebody who cannot see it can still follow the step');
  } else if (fig.caption?.en !== undefined && fig.caption.en.trim() === fig.alt.trim()) {
    out.push(`${where}: repeats its caption as its description, so a screen `
      + 'reader hears the same sentence twice and learns nothing about the picture');
  }
  return out;
}

/** What makes a figure unusable. These refuse the operation. */
export function figureBlockers(fig: ChantFigure, where = 'a figure'): string[] {
  const out: string[] = [];
  const say = (s: string): number => out.push(`${where}: ${s}`);

  if (typeof fig.id !== 'string' || fig.id === '') say('has no id');
  if (typeof fig.src !== 'string' || fig.src === '') say('has no picture');
  else if (isEmbeddedImage(fig.src)) {
    const type = imageMediaType(fig.src)!;
    if (!(FIGURE_MEDIA_TYPES as readonly string[]).includes(type)) {
      say(`carries a ${type}, which a document may not hold `
        + `(${FIGURE_MEDIA_TYPES.join(', ')})`);
    }
    const bytes = figureBytes(fig.src);
    if (bytes > FIGURE_MAX_BYTES) {
      say(`is ${(bytes / 1048576).toFixed(1)} MB, over the `
        + `${FIGURE_MAX_BYTES / 1048576} MB a document will carry`);
    }
  } else if (fig.src.startsWith('data:')) {
    say('has a data: src that is not base64 image data');
  }

  const inSet = <T extends string>(v: T | undefined, set: readonly T[], name: string): void => {
    if (v !== undefined && !set.includes(v)) say(`has ${name} "${v}" (${set.join(', ')})`);
  };
  if (fig.widthPct !== undefined
    && (!Number.isFinite(fig.widthPct) || fig.widthPct < FIGURE_MIN_PCT
      || fig.widthPct > FIGURE_MAX_PCT)) {
    say(`is ${String(fig.widthPct)}% wide, outside `
      + `${FIGURE_MIN_PCT}–${FIGURE_MAX_PCT}%`);
  }
  inSet(fig.size, FIGURE_SIZES, 'size');
  inSet(fig.flow, FIGURE_FLOWS, 'flow');
  inSet(fig.captionAt, FIGURE_CAPTION_AT, 'caption position');
  inSet(fig.crop, FIGURE_CROPS, 'crop');
  inSet(fig.frame, FIGURE_FRAMES, 'frame');

  for (const side of ['width', 'height'] as const) {
    const n = fig[side];
    if (n !== undefined && (!Number.isFinite(n) || n <= 0)) {
      say(`has ${side} ${String(n)}`);
    }
  }
  /*
   * `crop: auto` reserves the aspect box from `width`/`height`, so without them
   * it reserves nothing and a picture landing mid-step pushes the mantra being
   * read down the screen. The format's own comment says as much; nothing
   * checked it.
   */
  if ((fig.crop ?? FIGURE_DEFAULTS.crop) === 'auto'
    && (fig.width === undefined || fig.height === undefined)) {
    say('is cropped "auto" without a width and height, so nothing reserves its '
      + 'space and the text under it moves when it loads');
  }
  return out;
}

/* ==========================================================================
   Finding them
   ========================================================================== */

/** A figure, and the item that put it there. */
export interface FigureAt {
  readonly figure: ChantFigure;
  readonly sectionId: string;
  /** Index in the section's `items`, or `-1` for one carried by a verse. */
  readonly at: number;
  /** Set when the item pointed into `ChantDoc.figures` instead of inlining. */
  readonly ref?: string;
}

/**
 * Every figure a document draws, in reading order.
 *
 * Three places can hold one — a section item inline, a section item by `ref`
 * into the shared library, and a verse's own `figures` — and every consumer
 * that wants "the pictures in this document" needs all three. Written once
 * because the exporter, the validator and the gate all ask, and three walks
 * would be three chances to miss the library.
 */
export function figuresOf(doc: ChantDoc): FigureAt[] {
  const library = new Map<string, ChantFigure>();
  for (const f of doc.figures ?? []) library.set(f.id, f);

  const out: FigureAt[] = [];
  for (const section of doc.sections) {
    const items: readonly ChantItem[] = section.items ?? [];
    items.forEach((item, at) => {
      if (item.t === 'figure') {
        const figure = item.figure ?? (item.ref === undefined
          ? undefined
          : library.get(item.ref));
        if (figure !== undefined) {
          out.push({
            figure, sectionId: section.id, at,
            ...(item.ref === undefined ? {} : { ref: item.ref }),
          });
        }
        return;
      }
      if (item.t !== 'verse') return;
      for (const figure of item.figures ?? []) {
        out.push({ figure, sectionId: section.id, at: -1 });
      }
    });
  }
  return out;
}

/** What every figure in a document is wrong about. The gate's whole job. */
export function documentFigureFaults(doc: ChantDoc): string[] {
  return figuresOf(doc).flatMap(
    (f) => figureFaults(f.figure, `${f.sectionId}/${f.figure.id}`),
  );
}
