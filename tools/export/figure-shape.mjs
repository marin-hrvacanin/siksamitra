/**
 * DOES THE PAGE DRAW THE PICTURE WORD IS TOLD ABOUT?
 *
 * Split out of `gate-figures.mjs` at the 400-line module gate, which is the
 * signal to split rather than to raise. It is one check with a long reason,
 * and the reason is the whole value of it.
 */
import { buildPage } from './page.mjs';
import { withBrowser } from './raster.mjs';
import { ALT, FIXED, SRC, withPictures } from './_figure-fixtures.mjs';
import { pictureExtent } from '../../packages/interop/src/word/drawing.js';

/* ==========================================================================
   8 · the picture the PAGE draws is the picture WORD is told about
   ========================================================================== */
/*
 * TWO WAYS THEY DISAGREED, and both were invisible because the document
 * travels in the `.docx` inside a custom XML part: the round trip was lossless
 * while the thing Word DRAWS was wrong.
 *
 *   a caption BESIDE the picture takes a share of the figure's width on the
 *   page and the picture gets the rest. The exporter asked for the FIGURE's
 *   width, so Word drew the picture about 47 % wider, with the caption
 *   underneath.
 *
 *   a fixed CROP reserves a box on the page and the picture is fitted inside
 *   it. The exporter wrote the box as the drawing's extent, and a
 *   `<a:stretch>` fill fills whatever it is given — a 400x300 rectangle with
 *   `crop: square` came out of Word 1:1.
 *
 * HOW THIS IS ASSERTED WITHOUT REDOING THE EXPORTER'S ARITHMETIC. The browser
 * gives the BOX it drew — `.fig__box`, whose shape is the crop's and whose
 * width is the figure's share of the column. The exporter gives the DRAWING.
 * Between them the rule is `object-fit: contain`, which is two inequalities
 * and not a formula:
 *
 *   the drawing FITS the box            w <= boxW and h <= boxH
 *   and TOUCHES it                      w == boxW or h == boxH
 *   and is never distorted              h / w == the picture's own ratio
 *
 * A gate that recomputed `contain` here would be the code under test on both
 * sides of the comparison, which is the failure this repository has been
 * caught making before.
 */
export async function pageAgainstWord(fail) {
  await withBrowser(async (browser) => {
  const page = await browser.newPage();
  const cases = [
    { what: 'no caption', over: {} },
    { what: 'caption below', over: { captionAt: 'below', caption: { en: 'The test rectangle' } } },
    { what: 'caption beside', over: { captionAt: 'beside', caption: { en: 'The test rectangle' } } },
    { what: 'a square crop', over: { crop: 'square' } },
    { what: 'a portrait crop', over: { crop: 'portrait' } },
    { what: 'a wide crop', over: { crop: 'wide' } },
    { what: 'beside, square', over: { crop: 'square', captionAt: 'beside', caption: { en: 'The test rectangle' } } },
  ];
  for (const { what, over } of cases) {
    const figure = {
      id: 'fig-1', src: SRC, alt: ALT, width: 400, height: 300,
      size: 'full', flow: 'block', captionAt: 'none', crop: 'auto',
      frame: 'none', rounded: false, ...over,
    };
    const one = {
      ...withPictures(),
      sections: [{ id: 'sec-1', title: 'Dīpa', verses: [], items: [{ t: 'figure', figure }] }],
    };
    const made = await buildPage(one, { style: 'veda-union', savedAt: FIXED });
    await page.setContent(made.html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const seen = await page.evaluate(() => {
      const fig = document.querySelector('.fig');
      const box = fig.querySelector('.fig__box').getBoundingClientRect();
      const holder = fig.parentElement;
      const cs = getComputedStyle(holder);
      /* THE CONTENT WIDTH of the column the figure stands in — the sheet's own
         rectangle includes its 25 mm margins as padding, and measuring that
         made every expectation a third too wide. */
      return {
        column: holder.getBoundingClientRect().width
          - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        boxW: box.width,
        boxH: box.height,
      };
    });
    /* What the exporter writes, in the same units, from the same figure. */
    const { w, h, ratio } = pictureExtent(figure, seen.column, 16);
    const fits = w <= seen.boxW + 1 && h <= seen.boxH + 1;
    const touches = Math.abs(w - seen.boxW) < 1 || Math.abs(h - seen.boxH) < 1;
    const shape = Math.abs(ratio - figure.height / figure.width) < 0.001;
    if (!fits) {
      fail(`Word's picture does not fit the page's box for ${what}`,
        `${w.toFixed(1)}x${h.toFixed(1)} in a ${seen.boxW.toFixed(1)}x${seen.boxH.toFixed(1)} box`);
    }
    if (!touches) {
      fail(`Word's picture is smaller than the page's box for ${what}`,
        `${w.toFixed(1)}x${h.toFixed(1)} in a ${seen.boxW.toFixed(1)}x${seen.boxH.toFixed(1)} box`);
    }
    if (!shape) {
      fail(`Word's picture is distorted for ${what}`,
        `${ratio.toFixed(3)} against the picture's ${(figure.height / figure.width).toFixed(3)}`);
    }
    console.log(`  ${what.padEnd(20)} page box ${seen.boxW.toFixed(0).padStart(4)}x`
      + `${seen.boxH.toFixed(0).padStart(4)}  .docx ${w.toFixed(0).padStart(4)}x`
      + `${h.toFixed(0).padStart(4)}  shape ${ratio.toFixed(3)}`);
  }
    await page.close();
  });
}

