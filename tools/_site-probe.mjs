import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const b = await puppeteer.launch({ executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 1000 });
const url = pathToFileURL(resolve('site/index.html')).href;
const bad = [];
p.on('requestfailed', (r) => bad.push(`${r.failure()?.errorText} ${r.url().split('/').pop()}`));
await p.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 1500));
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 1500));
const imgs = await p.evaluate(() => [...document.images].map((i) => ({
  src: i.currentSrc.split('/').pop(),
  natural: `${i.naturalWidth}x${i.naturalHeight}`,
  drawn: `${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)}`,
  complete: i.complete,
})));
console.log('failed requests:', bad.length ? bad.join(', ') : 'none');
for (const i of imgs) console.log(' ', JSON.stringify(i));
const fonts = await p.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.status}`));
console.log('fonts:', fonts.join(', ') || 'none');
await p.screenshot({ path: 'artifacts/site-full.png', fullPage: true });
await b.close();
