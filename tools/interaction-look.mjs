#!/usr/bin/env node
/**
 * WHAT THE AGENT IS SHOWN WHEN IT LOOKS — in the app, and in the bot.
 *
 * `look` lets the model see a page of what it made, once, before it hands it
 * over. Two hosts answer it: the bot, through the headless Chromium that
 * prints its PDFs (`apps/bot/src/exporters.ts`), and the app's Ask pane,
 * through the window's own canvas (`lookAtPage` in `export-doc.ts`, the PNG
 * export's path). Neither can be seen by a unit test — a canvas, an SVG image,
 * fonts — so this drives both, in a real browser, over a real document.
 *
 * WHAT IT COMPARES AGAINST, and it is not the code under test:
 *
 *   the PAPER, in millimetres — ISO 216's A4 and A5, converted at the CSS
 *            inch (96 px to 25.4 mm), never through `pageGeometry`;
 *   the PNG's own header — its signature and its IHDR, read here byte by
 *            byte, as the PNG specification lays them out;
 *   the INK in its pixels — a page of a mantra has dark letters on it, a
 *            blank or failed picture has none, and two different pages do not
 *            have the same ink;
 *   EACH OTHER — the two hosts must show the same page: their rows of ink are
 *            compared, so a host whose picture drifted from the other's fails.
 *
 * Needs the DEV server (the app's module is imported by its source path) and
 * a Chromium: `npm run dev`, then `CHROME=<path> npm run check:look`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { openApp } from './_ui.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = join(ROOT, 'out/look');
mkdirSync(OUT, { recursive: true });

let passed = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  ok    ${name}${detail === '' ? '' : `  — ${detail}`}`); return; }
  failures.push(name);
  console.log(`  FAIL  ${name}  ${detail}`);
};

/* ── the PNG, read as its specification lays it out ─────────────────────── */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function header(png) {
  const signed = SIGNATURE.every((b, i) => png[i] === b);
  const be = (at) => ((png[at] << 24) | (png[at + 1] << 16) | (png[at + 2] << 8) | png[at + 3]) >>> 0;
  /* After the signature: length (4), "IHDR" (4), width (4), height (4). */
  const ihdr = String.fromCharCode(...png.slice(12, 16));
  return { signed: signed && ihdr === 'IHDR', width: be(16), height: be(20) };
}

/* ── the paper, from ISO 216, never from the program ────────────────────── */
const MM = { a4: [210, 297], a5: [148, 210] };
const cssPx = (mm) => (mm / 25.4) * 96;
const SCALE = 1.4;

const DOC = process.env.LOOK_DOC ?? 'sri-rudram';

const browser = await puppeteer.launch({ executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.setViewport({ width: 1400, height: 950, deviceScaleFactor: 1 });
await openApp(page);

/* The app's own modules, by their source paths, as the dev server serves them. */
const fs = (p) => `/@fs/${join(ROOT, p).replace(/\\/g, '/')}`;
const shots = await page.evaluate(async (o) => {
  const [{ lookAtPage }, { readChantFile }, { openChantDoc }] = await Promise.all([
    import(o.app), import(o.format), import(o.engine),
  ]);
  const read = readChantFile(await (await fetch(`/chants/${o.doc}.json`)).text());
  if (!read.ok) throw new Error(read.error);
  const doc = openChantDoc(read.doc);
  /* Ink, from the pixels: how dark each row is, and how much is dark at all. */
  const inkOf = async (png) => {
    const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const g = c.getContext('2d');
    g.drawImage(bitmap, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    const rows = new Array(c.height).fill(0);
    let dark = 0;
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        const i = (y * c.width + x) * 4;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (data[i + 3] > 128 && lum < 110) { rows[y] += 1; dark += 1; }
      }
    }
    return { rows, dark };
  };
  const take = async (paper, n) => {
    const s = await lookAtPage(doc, { page: paper }, n);
    const ink = await inkOf(s.png);
    return { paper, asked: n, page: s.page, pages: s.pages, png: [...s.png], rows: ink.rows, dark: ink.dark };
  };
  return [await take('a4', 1), await take('a4', 2), await take('a4', 9999), await take('a5', 1)];
}, { app: '/src/shell/export-doc.ts', format: fs('packages/format/src/index.ts'), engine: fs('packages/engine/src/index.ts'), doc: DOC });

console.log(`\n── what the app's look shows (${DOC})\n`);
for (const s of shots) writeFileSync(join(OUT, `app-${s.paper}-${s.asked}.png`), Uint8Array.from(s.png));
const [first, second, last, small] = shots;
for (const s of shots) {
  const h = header(s.png);
  check(`${s.paper} page ${s.asked}: a PNG`, h.signed, `${h.width}x${h.height}`);
}
const a4 = header(first.png);
const [w4, h4] = MM.a4.map((mm) => cssPx(mm) * SCALE);
check('A4 page 1 is as wide as A4 paper', Math.abs(a4.width - w4) <= 2, `${a4.width} px against ${w4.toFixed(1)}`);
check('…and as tall', Math.abs(a4.height - h4) <= 3, `${a4.height} px against ${h4.toFixed(1)}`);
const a5 = header(small.png);
const [w5] = MM.a5.map((mm) => cssPx(mm) * SCALE);
check('A5 is as wide as A5 paper — the person’s paper, not A4', Math.abs(a5.width - w5) <= 2, `${a5.width} px against ${w5.toFixed(1)}`);
check('a long document is many pages', first.pages >= 10, `${first.pages} pages of A4`);
check('page 2 is page 2', second.page === 2 && second.pages === first.pages);
check('a page past the end is the last page', last.page === first.pages, `asked 9999, shown ${last.page} of ${last.pages}`);
check('…and no taller than a page', header(last.png).height <= a4.height);
const share = (s) => s.dark / (header(s.png).width * header(s.png).height);
check('page 1 has letters on it', share(first) > 0.004, `${(share(first) * 100).toFixed(2)}% dark`);
check('page 2 has letters on it', share(second) > 0.004, `${(share(second) * 100).toFixed(2)}% dark`);
check('and they are not the same letters', JSON.stringify(first.rows) !== JSON.stringify(second.rows));

/* ── the bot's look, over the same document, the same page ─────────────── */
console.log('\n── the bot shows the same page\n');
const { nodeExporters } = await import('../apps/bot/src/exporters.ts');
const { readChantFile } = await import('../packages/format/src/index.ts');
const { openChantDoc } = await import('../packages/engine/src/index.ts');
const { readFileSync } = await import('node:fs');
const read = readChantFile(readFileSync(join(ROOT, `corpus/chants/${DOC}.json`), 'utf8'));
const exporters = nodeExporters();
const bot = await exporters.look(openChantDoc(read.doc), 1);
await exporters.close();
writeFileSync(join(OUT, 'bot-a4-1.png'), bot.png);
const b = header(bot.png);
check('the bot’s page 1: a PNG', b.signed, `${b.width}x${b.height}`);
check('…as wide as A4 paper', Math.abs(b.width - w4) <= 2, `${b.width} px against ${w4.toFixed(1)}`);

const botInk = await page.evaluate(async (png) => {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(png)], { type: 'image/png' }));
  const c = document.createElement('canvas');
  c.width = bitmap.width; c.height = bitmap.height;
  const g = c.getContext('2d');
  g.drawImage(bitmap, 0, 0);
  const { data } = g.getImageData(0, 0, c.width, c.height);
  const rows = new Array(c.height).fill(0);
  for (let y = 0; y < c.height; y += 1) {
    for (let x = 0; x < c.width; x += 1) {
      const i = (y * c.width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (data[i + 3] > 128 && lum < 110) rows[y] += 1;
    }
  }
  return rows;
}, [...bot.png]);

/* Lines of text, as runs of inked rows: the same page has the same lines. */
const lines = (rows) => {
  const out = [];
  let from = -1;
  rows.forEach((n, y) => {
    if (n > 0 && from < 0) from = y;
    if (n === 0 && from >= 0) { if (y - from >= 6) out.push([from, y]); from = -1; }
  });
  return out;
};
const appLines = lines(first.rows);
const botLines = lines(botInk);
console.log(`  app: ${appLines.length} lines, first at ${appLines[0]?.[0]}; bot: ${botLines.length} lines, first at ${botLines[0]?.[0]}`);
check('both hosts show about as many lines of text', Math.abs(appLines.length - botLines.length) <= Math.max(2, botLines.length * 0.15),
  `${appLines.length} against ${botLines.length}`);
/*
 * THE SAME PAGE: their rows of ink agree, once the first line is aligned.
 * Not the first line itself: the bot photographs the PRINT form, where the
 * sheet's margin is the printer's (`@page`) and so not on the screenshot; the
 * window photographs the sheet with its margin drawn — 80 px on Śrī Rudram.
 * And not line by line: the window's svara strokes are taller than print's
 * (the screen's mark tokens against his Word metrics), which joins rows of
 * ink the print keeps apart. The profile of ink down the page does not care:
 * measured, r = 0.90 at the margin's offset, 0.66 two pixels off, 0.29 ten
 * off — and a different page does not agree at all.
 */
const correlation = (a, b, s) => {
  const xs = []; const ys = [];
  for (let y = 0; y < b.length; y += 1) {
    if (y + s < 0 || y + s >= a.length) continue;
    xs.push(a[y + s]); ys.push(b[y]);
  }
  const mean = (v) => v.reduce((p, c) => p + c, 0) / v.length;
  const mx = mean(xs); const my = mean(ys);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < xs.length; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
};
const margin = (appLines[0]?.[0] ?? 0) - (botLines[0]?.[0] ?? 0);
let best = { s: 0, r: -1 };
for (let s = -200; s <= 200; s += 1) {
  const r = correlation(first.rows, botInk, s);
  if (r > best.r) best = { s, r };
}
check('both hosts show the same page: their rows of ink agree', best.r >= 0.85, `r = ${best.r.toFixed(3)}`);
check('…at the margin’s offset, and only there', Math.abs(best.s - margin) <= 3 && correlation(first.rows, botInk, best.s + 10) < 0.5,
  `best at ${best.s} px, the margin ${margin} px; ten off, r = ${correlation(first.rows, botInk, best.s + 10).toFixed(3)}`);
const other = correlation(second.rows, botInk, best.s);
check('and a different page does not agree', other < 0.5, `the app’s page 2 against the bot’s page 1: r = ${other.toFixed(3)}`);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

console.log(`\n${passed} passed, ${failures.length} failed — pictures in out/look/`);
if (failures.length > 0) { console.log(`LOOK GATE FAILS: ${failures.join('; ')}`); process.exit(1); }
console.log('LOOK GATE PASSES — the agent sees the page, in both hosts');

