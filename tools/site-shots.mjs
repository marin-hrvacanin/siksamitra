#!/usr/bin/env node
/**
 * THE PICTURES ON THE LANDING PAGE, taken from the running program.
 *
 * Two complaints, both fair, both about the same thing: the page was showing
 * the program second-hand.
 *
 *   THE HERO'S MARKED LINE WAS HAND-WRITTEN CSS. `box-shadow: inset` for a
 *   holding box, a pseudo-element bar for an anudātta, an underline for a
 *   svarita — a second implementation of the one thing this program is for,
 *   and it looked like it: detached rectangles floating above and beside the
 *   letters. Rule 1 exists for exactly this. The line is now a crop of the
 *   real renderer.
 *
 *   THE SCREENSHOTS WERE UNREADABLE. A 2720x1720 window shown 466 px wide is
 *   a grey smudge: you cannot see a single mark, which is the only reason to
 *   put a screenshot of a marking editor on a page. So each one is taken at
 *   the size it will be SHOWN, with the device pixel ratio doing the sharpness
 *   rather than a downscale doing the blurring.
 *
 *   npm run dev
 *   CHROME=<path> node tools/site-shots.mjs
 */
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { APP_URL } from './_ui.mjs';

const OUT = 'site/shots';
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
});

/**
 * A page with the appearance already chosen.
 *
 * Written into storage BEFORE the app loads rather than clicked afterwards:
 * the picker is three clicks deep and a screenshot taken with a popover open
 * is a screenshot of a popover.
 */
async function open({ width, height, scale = 2, mode = 'light', doc: docTheme = 'veda-union' }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.evaluateOnNewDocument((look) => {
    try {
      localStorage.setItem('siksamitra.appearance', JSON.stringify(look));
      localStorage.removeItem('siksamitra.view');
    } catch { /* a private window: the defaults will do */ }
  }, { chrome: 'palladio', document: docTheme, mode, density: 'regular' });
  /* `chrome=native` draws the desktop title bar in a plain browser, so the
     picture is the program people install rather than a browser tab. */
  await page.goto(`${APP_URL}?chrome=native&os=windows`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-block-id]');
  await page.evaluate(() => document.fonts.ready);
  await wait(1200);
  return page;
}

const shot = async (page, name, clip) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip === undefined ? {} : { clip }) });
  console.log(`  ${name}.png`);
};

/* ── the window, light and dark ──────────────────────────────────────────── */
/*
 * 1120x700 CSS pixels at 2x. Shown about 1000 px wide on the page, that is a
 * ONE-TO-ONE picture: every letter is the size it is on screen, which is the
 * difference between a screenshot and a smudge.
 */
for (const mode of ['light', 'dark']) {
  const page = await open({ width: 1120, height: 700, mode });
  await shot(page, `window-${mode}`);
  await page.close();
}

/* ── a page, in the paged view ───────────────────────────────────────────── */
{
  const page = await open({ width: 1120, height: 900 });
  await page.evaluate(() => {
    document.querySelector('#rbn-tab-view')?.click();
  });
  await wait(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.rbb')].find((x) => x.textContent.trim() === 'Pages');
    b?.click();
  });
  await page.waitForSelector('.page');
  await wait(1800);
  /* The sheet itself, not the desk around it. */
  const box = await page.evaluate(() => {
    const sheet = [...document.querySelectorAll('.page')]
      .find((e) => e.closest('.paged__probe') === null);
    if (sheet === undefined) return null;
    sheet.scrollIntoView({ block: 'start' });
    const r = sheet.getBoundingClientRect();
    return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: r.width + 16, height: Math.min(r.height + 16, window.innerHeight - r.top) };
  });
  if (box === null) throw new Error('no page on screen to photograph');
  await shot(page, 'page', box);
  await page.close();
}

/* ── the marked line, which is the hero ──────────────────────────────────── */
{
  /*
   * A NARROW VIEWPORT AT 3x, cropped to four verses. The hero shows it about
   * 700 px wide, so at 3x the marks are drawn with three device pixels per CSS
   * pixel and a holding box is a box rather than a suggestion.
   *
   * Four verses because one line does not show what the marks are FOR: the eye
   * needs a second box to see that the first one is a box.
   */
  const page = await open({ width: 760, height: 600, scale: 3 });
  const box = await page.evaluate(() => {
    const verses = [...document.querySelectorAll('[data-verse]')]
      .filter((e) => e.closest('.paged__probe') === null);
    const marked = verses.find((v) => v.querySelector('.hold-long, .hold-short, [class*="sv-"]'))
      ?? verses[0];
    if (marked === undefined) return null;
    marked.scrollIntoView({ block: 'center' });
    /*
     * THE PĀDAS, not the whole verse. A verse carries its translation and
     * sits under a heading, and a crop of the verse's own box caught a
     * clipped "Durgā Sūktam" at the top and three lines of English at the
     * bottom — neither of which is what the picture is for.
     */
    const padas = [...marked.querySelectorAll('.pada')];
    if (padas.length === 0) return null;
    /*
     * THE UNION OF WHAT IS ACTUALLY DRAWN, measured rather than padded. A
     * svara is a stroke ABOVE the line box, so a pāda's own rectangle does
     * not contain it and guessing at the overhang caught the heading above
     * and the translation below — both of which were in the picture.
     */
    const boxes = padas.flatMap((p) => [p, ...p.querySelectorAll('*')])
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const left = Math.min(...boxes.map((r) => r.left));
    const right = Math.max(...boxes.map((r) => r.right));
    const top = Math.min(...boxes.map((r) => r.top));
    const bottom = Math.max(...boxes.map((r) => r.bottom));
    /* Air on three sides. NOT below: the next thing down is the verse's
       translation, and six pixels of it is six pixels of the wrong picture. */
    const air = 6;
    return {
      x: Math.max(0, left - air),
      y: Math.max(0, top - air),
      width: Math.min(right - left + air * 2, window.innerWidth - left + air),
      height: bottom - top + air + 1,
    };
  });
  if (box === null) throw new Error('no marked verse to photograph');
  await shot(page, 'marks', box);
  await page.close();
}

await browser.close();
console.log(`\n  -> ${OUT}\n`);
