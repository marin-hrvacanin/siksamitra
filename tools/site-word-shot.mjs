#!/usr/bin/env node
/**
 * LOOK AT THE LANDING PAGE'S WORD SECTION, and at the two pages the store
 * requires, on the LIVE site.
 *
 *   CHROME=<path> node tools/site-word-shot.mjs
 *
 * Not a gate — a look. `tools/site-shots.mjs` takes the pictures the page
 * SHOWS; this photographs the page itself, at a phone width and at a desk
 * width, because the section it added is the one a person follows three
 * instructions from and a numbered list that has collapsed is unreadable
 * rather than ugly.
 */
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { SITE } from '../scripts/word-addin.mjs';

const OUT = 'artifacts/site-word';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
});

for (const [name, width] of [['desk', 1000], ['phone', 390]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  await page.goto(`${SITE}/#word`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 800));
  const box = await page.evaluate(() => {
    const section = document.getElementById('word');
    if (section === null) return null;
    section.scrollIntoView({ block: 'start' });
    const r = section.getBoundingClientRect();
    return { x: 0, y: Math.max(0, r.top), width: window.innerWidth, height: Math.min(r.height, 4000) };
  });
  if (box === null) throw new Error('the page has no #word section');
  await page.setViewport({ width, height: Math.ceil(box.height) + 40, deviceScaleFactor: 2 });
  await page.evaluate(() => { document.getElementById('word')?.scrollIntoView({ block: 'start' }); });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/word-${name}.png` });
  console.log(`  word-${name}.png  ${width} px, ${Math.round(box.height)} px tall`);
  await page.close();
}

for (const which of ['privacy', 'terms']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 760, height: 1200, deviceScaleFactor: 2 });
  await page.goto(`${SITE}/${which}.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${which}.png`, fullPage: true });
  console.log(`  ${which}.png`);
  await page.close();
}

await browser.close();
console.log(`\n  -> ${OUT}\n`);
