/**
 * The exported page, PRINTED.
 *
 * THE PDF IS THE HTML EXPORT. Nothing here lays out a mantra, measures a glyph
 * or draws a holding box; it opens the self-contained file `page.mjs` produced
 * and asks the browser to print it. That is the only way the PDF someone sends
 * can be guaranteed to be the page they were looking at — a PDF writer of our
 * own would be a second renderer, and the first time a mark moved there would
 * be no way to say which of the two was right. `raster.mjs` is its sibling and
 * makes the same argument about pictures.
 *
 * THE SHEET COMES FROM `pageGeometry`, IN POINTS, and so do the `.docx`'s
 * `w:pgSz` and `w:pgMar`. One A4, one set of 25 mm margins, three consumers.
 * `@page { margin: 0 }` in `export.css`'s print block is what stops the browser
 * adding half an inch of its own on top of the sheet's.
 *
 * WHAT `printBackground` IS FOR: without it Chrome prints no paper colour and
 * no holding-box fill, so a Veda Union page comes out with its green boxes
 * missing and the manuscript style comes out white. It is not optional here.
 */
import { embedInPdf, embedded, PDF_FORMAT, PDF_VERSION } from '@siksamitra/interop';
import { DEFAULT_PAGE, pageGeometry } from '@siksamitra/layout';
import { exportStyle } from '@siksamitra/tokens/export-styles';
import { ENGINE, buildPage } from './page.mjs';

/** A point is 1/72 in; a millimetre is 1/25.4 in. */
const MM_PER_PT = 25.4 / 72;

/**
 * Print one exported page.
 *
 * The document is embedded AFTER the browser is done, into the bytes it
 * produced — see `packages/interop/src/pdf/embed.ts` for why that is an
 * append and not a rewrite.
 */
export async function toPdf(browser, built, options = {}) {
  const page = await browser.newPage();
  try {
    await page.setContent(built.html, { waitUntil: 'load' });
    /* The faces are `data:` URIs so there is no network to wait for, but
       decoding an 818 KB TrueType still happens after the first paint, and a
       print taken before it finishes is a print of the fallback face. */
    await page.evaluate(() => document.fonts.ready);
    const sheet = options.page ?? pageGeometry(DEFAULT_PAGE);
    const bytes = await page.pdf({
      printBackground: true,
      /*
       * IN MILLIMETRES. Given the same size in CSS pixels, Chrome wrote a
       * MediaBox of 595.92 x 841.92 pt where A4 is 595.28 x 841.89 — 0.64 pt
       * too wide, which the sheet's `margin-inline: auto` then split in two and
       * put 0.32 pt of it in front of every line. Millimetres are what A4 is
       * defined in and Chrome converts them exactly.
       */
      width: `${sheet.width * MM_PER_PT}mm`,
      height: `${sheet.height * MM_PER_PT}mm`,
      /*
       * THE TOP AND BOTTOM MARGINS ARE THE PAGE BOX'S; THE SIDES ARE THE
       * COLUMN'S. Not a compromise — each belongs where it repeats.
       *
       * A vertical margin has to repeat on every page, and the exported page is
       * ONE tall column whose padding is applied once to the whole flow: page
       * two began 12 pt from the top edge where Word began at 70.87. So the
       * page box takes those two.
       *
       * The SIDES cannot go there. `Translit` carries `w:right="-276"` — a
       * negative right indent that lets a long pāda run 13.8 pt into the margin
       * rather than wrap — and content wider than the page box makes Chrome
       * shrink the whole page to fit: measured, a 16 pt mantra printed at
       * 15.53 pt and a 24 pt leading at 23.30, the entire page scaled by
       * 2.94 %. Left inside the column's own padding, the overflow has
       * somewhere to go and nothing is scaled.
       */
      margin: {
        top: `${sheet.margins.top * MM_PER_PT}mm`,
        right: 0,
        bottom: `${sheet.margins.bottom * MM_PER_PT}mm`,
        left: 0,
      },
      preferCSSPageSize: false,
    });
    return new Uint8Array(bytes);
  } finally {
    await page.close();
  }
}

/**
 * A document and a style, out the other end as one `.pdf` with the document
 * inside it.
 *
 * `savedAt` is passed through so a gate can print the same document twice and
 * compare the bytes.
 */
export async function buildPdf(browser, doc, options = {}) {
  const style = exportStyle(options.style ?? 'veda-union');
  const built = await buildPage(doc, { ...options, style: style.id });
  const printed = await toPdf(browser, built, options);
  const { manifest, json } = await embedded(PDF_FORMAT, PDF_VERSION, {
    doc: built.doc,
    slug: options.slug ?? `${doc.id ?? 'document'}.pdf`,
    engine: options.engine ?? ENGINE,
    style: style.id,
    script: built.script,
    ...(options.assets === undefined ? {} : { assets: options.assets }),
    ...(options.select === undefined ? {} : { select: options.select }),
    ...(options.savedAt === undefined ? {} : { savedAt: options.savedAt }),
  });
  return {
    bytes: embedInPdf(printed, manifest, json, options.assets ?? {}),
    printed,
    built,
    style,
    manifest,
  };
}
