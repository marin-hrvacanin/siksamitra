/**
 * THE INSERT MENUS' PICTURES — each character, drawn in the face the app's
 * palette draws it in.
 *
 * A menu item on Word's ribbon must have an icon, and the honest icon for
 * "type ṭh" is ṭh. So each one is drawn by a real browser, in
 * `--doc-verse-face` (Gentium Book Plus, then Noto Serif Devanagari for the
 * daṇḍas and the Vedic signs) — the same stack `.iast__ch` uses on the app's
 * keys, so the Word menu and the app's palette show the same letters.
 *
 * WHY A BROWSER AND NOT SHARP. A rasteriser takes one font file; this needs a
 * fallback stack, and combining marks shaped onto their carrier letter. That
 * is text layout, which a browser has and we should not write (rule 16).
 *
 * THE FONTS ARE INLINED AS DATA URIs. A page opened from `file://` has no
 * origin, and Chromium refuses its font loads without saying so — the
 * repository's font gate once "passed" that way against a family that was
 * merely installed on the machine. Here `document.fonts.check` must hold for
 * both faces or nothing is drawn.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './_browser.mjs';

const FONTS = join(import.meta.dirname, '..', 'assets', 'fonts');
/* Each face, and a sample of what it is here to draw. */
const FACES = [
  ['Gentium Book Plus', 'gentium-book-plus-full.ttf', 'truetype', 'āṭh'],
  ['Noto Serif Devanagari', 'noto-serif-devanagari-devanagari-400-normal.woff2', 'woff2', '।ꣳ'],
];

const css = FACES.map(([family, file, format]) => `@font-face { font-family: '${family}'; `
  + `src: url(data:font/${format};base64,${readFileSync(join(FONTS, file)).toString('base64')}) format('${format}'); }`).join('\n');

/**
 * Draw every character at every size, in one ink, on nothing.
 * @param {{ ch: string, file: string }[]} glyphs
 * @param {readonly number[]} sizes
 * @param {string} ink
 * @param {(file: string, size: number, png: Buffer) => void} write
 */
export async function drawGlyphs(glyphs, sizes, ink, write) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><style>${css}
      html, body { margin: 0; background: transparent; }
      #g { display: flex; align-items: center; justify-content: center; overflow: hidden;
           font-family: 'Gentium Book Plus', 'Noto Serif Devanagari', serif; color: ${ink};
           line-height: 1; white-space: nowrap; }
    </style><div id="g"></div>`);
    const ok = await page.evaluate(async (faces) => {
      for (const [f, sample] of faces) await document.fonts.load(`16px '${f}'`, sample);
      return faces.every(([f, sample]) => document.fonts.check(`16px '${f}'`, sample));
    }, FACES.map(([f, , , sample]) => [f, sample]));
    if (!ok) throw new Error('the palette faces did not load; refusing to draw the insert icons in a fallback');
    for (const { ch, file } of glyphs) {
      for (const size of sizes) {
        await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
        /* Two letters (kh, ṭh) need the width; one letter gets the height. */
        const em = [...ch.normalize('NFC')].filter((c) => !/\p{M}/u.test(c)).length > 1 ? 0.62 : 0.86;
        await page.evaluate((c, s, e) => {
          const g = document.getElementById('g');
          g.textContent = c;
          g.style.width = `${s}px`;
          g.style.height = `${s}px`;
          g.style.fontSize = `${Math.round(s * e)}px`;
        }, ch, size, em);
        await page.evaluate(() => document.fonts.ready);
        const el = await page.$('#g');
        write(file, size, Buffer.from(await el.screenshot({ omitBackground: true })));
      }
    }
  } finally {
    await browser.close();
  }
}
