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
import { embedInPdf, embedded, pageTemplates, PDF_FORMAT, PDF_VERSION } from '@siksamitra/interop';
import { DEFAULT_PAGE, pageGeometry } from '@siksamitra/layout';
import { exportStyle } from '@siksamitra/tokens/export-styles';
import { ENGINE, buildPage } from './page.mjs';

/** How much finer than a CSS pixel the PDF is laid out: see `toPdf`. */
const PRINT_FINE = 3;

/** The page's own `@font-face` rules for these families — what a template, a
 *  document of its own with no fonts, is given to draw in. */
const faceRules = (html, families) => [...html.matchAll(/@font-face\s*\{[^}]*\}/g)]
  .map((m) => m[0])
  .filter((rule) => families.some((f) => rule.includes(`'${f}'`)))
  .join('\n');

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
    /*
     * PRINTED THREE TIMES AS LARGE, AT A THIRD. Chrome rounds a border to a
     * whole pixel and sets each line on one, and a printed pixel is 0.75 pt:
     * his quarter-point holding box (`Holding`, `w:sz="2"`) came out as thick
     * as his one-point `2Holding`, and every line stood up to 0.75 pt off
     * where Word sets it. Laid out at three times the size and printed at a
     * third, a pixel is a quarter of a point — his hairline exactly — and the
     * layout is the same layout, because everything in it scaled together.
     */
    await page.addStyleTag({ content: `html { zoom: ${PRINT_FINE}; }` });
    const sheet = options.page ?? pageGeometry(DEFAULT_PAGE);
    /* HIS RUNNING HEAD AND FOOTER, where the style carries them: drawn by the
       browser on every page, from his measured furniture (`pdf/furniture.ts`),
       in the faces the page already embeds. */
    const furniture = options.style?.runningHead === true
      ? pageTemplates(built.doc, sheet, options.style.footer, faceRules(built.html, ['Arimo', 'Siksamitra Danda', 'Noto Serif Devanagari']))
      : undefined;
    const bytes = await page.pdf({
      scale: 1 / PRINT_FINE,
      ...(furniture === undefined ? {} : {
        displayHeaderFooter: true, headerTemplate: furniture.header, footerTemplate: furniture.footer,
      }),
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
      /* Chrome takes the margins in the SCALED page's units, so a third of
         them is the margin on paper. */
      margin: {
        top: `${(sheet.margins.top * MM_PER_PT) / PRINT_FINE}mm`,
        right: 0,
        bottom: `${(sheet.margins.bottom * MM_PER_PT) / PRINT_FINE}mm`,
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
  const printed = await toPdf(browser, built, { ...options, style });
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
