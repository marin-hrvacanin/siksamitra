/**
 * Photograph the built guide — `node tools/guide/shot.mjs <out-dir>` — so a
 * person can LOOK at it: the top, the rules and the scripts, light and dark.
 */
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { browserPath } from '../_browser.mjs';

const out = process.argv[2] ?? '.';
const page = pathToFileURL(resolve(import.meta.dirname, '../../out/guide/index.html')).href;
const browser = await puppeteer.launch({ executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await browser.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(page, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const shots = [['top', null], ['rules', '#rules'], ['svaras', '#svaras'], ['scripts', '#scripts']];
for (const [name, sel] of shots) {
  if (sel !== null) await p.evaluate((s) => document.querySelector(s)?.scrollIntoView(), sel);
  await p.screenshot({ path: join(out, `guide-${name}.png`) });
}
await p.evaluate(() => { document.documentElement.dataset.mode = 'dark'; window.scrollTo(0, 0); });
await p.screenshot({ path: join(out, 'guide-dark.png') });
console.log('height', await p.evaluate(() => document.body.scrollHeight));
await browser.close();
