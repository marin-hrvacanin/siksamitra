/**
 * The same page, as a picture.
 *
 * THE IMAGE EXPORT IS THE HTML EXPORT, PHOTOGRAPHED. Nothing here lays out a
 * mantra, measures a glyph or draws a holding box; it opens the self-contained
 * file `page.mjs` produced and takes a picture of one element in it. That is
 * the only way the PNG someone sends to a chat can be guaranteed to be the page
 * they were looking at — a drawing routine of its own would be a second
 * renderer, and the first time a mark moved there would be no way to say which
 * of the two was right.
 *
 * WHAT IS CLIPPED per frame, and how the vector form is wrapped, are in
 * `packages/interop/src/html/frame.ts`. The window rasterises too — through an
 * iframe rather than a headless browser — and the two have to be pictures of
 * the same thing. What is left here is the half only a command can do: driving
 * a browser. Finding one is `tools/_browser.mjs`, which every tool that opens
 * a browser shares.
 */
import { CLIP_SELECTOR, RASTER_ATTR, svgDocument } from '@siksamitra/interop';
import { browserPath, withBrowser } from '../_browser.mjs';

export { browserPath, withBrowser };

/**
 * Load an exported page and hold it open while `fn` measures it.
 *
 * `document.fonts.ready` is awaited before anything is measured or captured.
 * The faces are `data:` URIs so there is no network to wait for, but decoding
 * a 818 KB TrueType still happens after the first paint, and a screenshot
 * taken before it finishes is a screenshot of the fallback face.
 */
async function open(browser, html, scale) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate((attr) => {
    document.documentElement.setAttribute(attr, '');
  }, RASTER_ATTR);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/**
 * Pull the transparent frame in to the widest line that actually rendered.
 *
 * The frame lays out at the reading measure — see `export.css` for why it
 * cannot simply shrink-wrap — so a four-word verse would otherwise come out as
 * a 736 px PNG with 400 px of alpha to the right of the text. Measured over
 * TEXT RANGES rather than element boxes, because every block in the document
 * is as wide as its column by definition and would report the measure back.
 *
 * Narrowing to the widest rendered line re-wraps nothing: every other line
 * already fits inside it.
 */
async function fitBare(page) {
  await page.evaluate(() => {
    const frame = document.querySelector('.export--bare');
    if (frame === null) return;
    const left = frame.getBoundingClientRect().left;
    const walk = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
    let right = 0;
    for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) right = Math.max(right, rect.right);
    }
    if (right > left) frame.style.width = `${Math.ceil(right - left)}px`;
  });
}

/** The element a frame's picture is of, and its size in CSS pixels. */
async function target(page, frame) {
  const selector = CLIP_SELECTOR[frame];
  if (selector === undefined) throw new Error(`no clip element for frame "${frame}"`);
  const handle = await page.$(selector);
  if (handle === null) {
    throw new Error(`the exported page has no "${selector}" — the ${frame} frame did not render`);
  }
  const box = await handle.boundingBox();
  return { handle, box, selector };
}

/**
 * A PNG of one exported page.
 *
 * `omitBackground` only for `bare`: that frame is the one that promises an
 * alpha channel. Asking for it on a card would punch a transparent hole
 * wherever the ground is, which WhatsApp then flattens to black.
 */
export async function toPng(browser, html, { frame, scale = 2 }) {
  const page = await open(browser, html, scale);
  try {
    if (frame === 'bare') await fitBare(page);
    const { handle, box } = await target(page, frame);
    const png = await handle.screenshot({ omitBackground: frame === 'bare' });
    return { bytes: Buffer.from(png), width: box.width * scale, height: box.height * scale };
  } finally {
    await page.close();
  }
}

/**
 * An SVG of one exported page: the element, its stylesheet and its faces,
 * inside a `<foreignObject>`.
 *
 * The styles are taken from the page's own `<style>` elements rather than
 * rebuilt, so the SVG cannot disagree with the PNG about anything.
 */
export async function toSvg(browser, html, { frame, doc }) {
  const page = await open(browser, html, 1);
  try {
    if (frame === 'bare') await fitBare(page);
    const { box, selector } = await target(page, frame);
    /* The page reports its own parts; `svgDocument` — shared with the window,
       which asks its iframe the same three questions — assembles them. */
    const parts = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const root = document.documentElement;
      const sheets = [...document.querySelectorAll('style')].map((s) => s.textContent);
      return {
        body: new XMLSerializer().serializeToString(el),
        css: sheets.join('\n'),
        chrome: root.getAttribute('data-chrome'),
        mode: root.getAttribute('data-mode'),
      };
    }, selector);
    const svg = svgDocument({ ...parts, doc, width: box.width, height: box.height });
    return { text: svg, width: Math.ceil(box.width), height: Math.ceil(box.height) };
  } finally {
    await page.close();
  }
}
