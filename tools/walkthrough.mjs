#!/usr/bin/env node
/**
 * A walk through the application, with screenshots.
 *
 * Not a test — `tools/interaction.mjs` asserts. This DRIVES the program the way
 * a person would and photographs each step, so the result can be LOOKED at:
 * hierarchy, marks, the caret, a selection, the three views, the document
 * themes, and the window at four widths.
 *
 * It exists because a green assertion says a class name was present, and says
 * nothing about whether the page looks like a page. Both are needed.
 *
 *   npm run dev
 *   CHROME=<path> node tools/walkthrough.mjs [--out shots]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { mark, openTab, setMode, setView } from './_ui.mjs';

const exe = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.URL ?? 'http://localhost:5273/';
const out = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'shots';
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'shell',
  args: ['--no-sandbox', '--force-device-scale-factor=2'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const notes = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Photograph, and record what was on screen in words. */
async function shot(name, what) {
  const file = join(out, `${name}.png`);
  await page.screenshot({ path: file });
  const seen = await page.evaluate(() => ({
    verses: document.querySelectorAll('.verse').length,
    headings: [...document.querySelectorAll('.section__title')].map((h) => h.textContent),
    syllables: document.querySelectorAll('.syl').length,
    holdShort: document.querySelectorAll('.hold-short').length,
    holdLong: document.querySelectorAll('.hold-long').length,
    svaras: document.querySelectorAll('[class*="sv-"]').length,
    /* The browser owns the caret and the selection now — there is no `.caret`
       element and no `.is-selected` class to count. Both are read from the
       browser, which is where they live. */
    caret: document.activeElement?.closest?.('.doc[contenteditable="true"]') != null,
    selected: (document.getSelection()?.toString() ?? '').length,
    doc: document.querySelector('.canvas')?.getAttribute('data-doc'),
    chrome: document.querySelector('.app')?.getAttribute('data-chrome'),
    tab: document.querySelector('.rbn__tab.is-on')?.textContent,
    nav: document.querySelectorAll('.nav__row').length,
    mode: document.querySelector('.app')?.getAttribute('data-mode'),
    status: document.querySelector('.status')?.textContent?.replace(/\s+/g, ' ').slice(0, 120),
    pages: document.querySelectorAll('.page').length,
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    /* How far the page hangs off the LEFT of the canvas. A scroller only
       scrolls towards its end, so anything above zero here is content nobody
       can reach — which is what centring a too-wide page with
       `justify-content` produced. */
    lostLeft: (() => {
      const c = document.querySelector('.canvas');
      const s = c?.querySelector('.flow__column, .page');
      if (c == null || s == null) return 0;
      return Math.max(0, Math.round(c.getBoundingClientRect().left - s.getBoundingClientRect().left));
    })(),
  }));
  notes.push({ name, what, seen });
  console.log(`  ${name.padEnd(26)} ${what}`);
  console.log(`     ${JSON.stringify(seen)}`);
  return seen;
}

await page.setViewport({ width: 1500, height: 950, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-block-id]', { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
await wait(400);

/* ── 1. the document, read-only ─────────────────────────────────────────── */
await shot('01-flow-read', 'flow view, read-only, default appearance');

/* ── 2. the File view, and opening from it ─────────────────────── */
/* Documents are opened from the backstage now — the ribbon's `<select>` is
   gone. Driving it here is also how we see that the title bar survives it. */
const openFrom = async (title) => {
  await page.evaluate(() => document.querySelector('.rbn__file')?.click());
  await page.waitForSelector('.bs', { timeout: 10000 });
  await wait(300);
  const clicked = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('.bs__item')]
      .find((x) => x.querySelector('.bs__item-name')?.textContent?.trim() === t);
    if (b === undefined) return false;
    b.click();
    return true;
  }, title);
  if (!clicked) throw new Error(`no document named ${title} in the File view`);
  await wait(400);
};

await page.evaluate(() => document.querySelector('.rbn__file')?.click());
await page.waitForSelector('.bs', { timeout: 10000 });
await wait(350);
await shot('02-file', 'the File view — the title bar is still there and still works');
await page.keyboard.press('Escape');
await wait(300);

/* ── 3. hierarchy: a document with parts, sections and translations ─────── */
await openTab(page, 'home');
await openFrom('Puruṣa Sūktam');
await page.waitForFunction(() => document.querySelectorAll('.verse').length > 20, { timeout: 20000 });
await wait(500);
await shot('02-hierarchy', 'Puruṣa Sūktam — section headings and verse numbers');

await openFrom('Durgā Sūktam');
await page.waitForFunction(() => document.querySelectorAll('.verse').length > 5, { timeout: 20000 });
await wait(400);

/* ── 3. the document themes, including the Veda Union Word one ──────────── */
for (const doc of ['plain', 'warm', 'manuscript', 'screen', 'high-contrast', 'word']) {
  await page.evaluate((id) => {
    document.querySelector('.canvas')?.setAttribute('data-doc', id);
  }, doc);
  await wait(250);
  await shot(`03-doc-${doc}`, `document theme: ${doc}`);
}

/* ── 4. the VU Word theme, measured against the .docx ───────────────────── */
const wordMetrics = await page.evaluate(() => {
  const pada = document.querySelector('.pada');
  const cs = getComputedStyle(pada);
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const px = Number.parseFloat(cs.fontSize);
  const lead = Number.parseFloat(cs.lineHeight);
  return {
    family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
    sizePt: (px / root) * 12,
    leadingRatio: lead / px,
    /* A holding box is an INSET BOX-SHADOW, not a border — reading
       `borderTopColor` returned the initial `currentColor` for every theme, so
       this line reported black however the theme was set. */
    holdShort: getComputedStyle(document.querySelector('.hold-short') ?? pada).boxShadow,
    ink: cs.color,
  };
});
console.log(`  word metrics                 ${JSON.stringify(wordMetrics)}`);
notes.push({ name: 'word-metrics', what: 'the VU Word theme, measured', seen: wordMetrics });

await page.evaluate(() => document.querySelector('.canvas')?.setAttribute('data-doc', 'plain'));
await wait(200);

/* ── 5. dark mode ───────────────────────────────────────────────────────── */
await page.evaluate(() => document.querySelector('.app')?.setAttribute('data-mode', 'dark'));
await wait(250);
await shot('05-dark', 'dark shell');
await page.evaluate(() => document.querySelector('.app')?.setAttribute('data-mode', 'light'));
await wait(200);

/* ── 6. editing: enter the mode, type, select, mark ─────────────────────── */
await setMode(page, 'write');
await page.waitForSelector('[data-u]', { timeout: 10000 });
await wait(400);
await shot('06-editing', 'edit mode: caret placed in the first editable verse');

const target = await page.evaluate(() => {
  const letters = document.querySelectorAll('[data-verse]:not([data-attested]) [data-u]');
  const el = letters[Math.min(24, letters.length - 1)];
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width * 0.25, y: b.top + b.height / 2 };
});
await page.mouse.click(target.x, target.y);
await wait(250);
await shot('07-click', 'clicked a letter — the caret is on it');

await page.keyboard.type('oṁ ');
await wait(450);
await shot('08-typed', 'typed "oṁ " — re-derived, marks intact');

await page.keyboard.down('Shift');
for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowRight');
await page.keyboard.up('Shift');
await wait(350);
await shot('09-selected', "shift+arrow — the browser's own selection, over marked text");

await mark(page, 'Long');
await wait(450);
await shot('10-marked', 'a long holding applied to the selection');

await page.keyboard.down('Control');
await page.keyboard.press('KeyZ');
await page.keyboard.up('Control');
await wait(400);
await shot('11-undone', 'Ctrl+Z — the mark withdrawn');

/* ── 7. a transcribed verse refuses, visibly ────────────────────────────── */
const frozen = await page.evaluate(() => {
  const el = document.querySelector('[data-verse][data-attested] [data-u]');
  if (el === null) return null;
  const b = el.getBoundingClientRect();
  return { x: b.left + 2, y: b.top + b.height / 2 };
});
if (frozen !== null) {
  await page.mouse.click(frozen.x, frozen.y);
  await wait(200);
  await page.keyboard.type('x');
  await wait(400);
  await shot('12-refused', 'a transcribed verse refuses the keystroke, and says so');
}

/* ── 8. the other two views, while editing ──────────────────────────────── */
await setView(page, 'Pages');
await page.waitForSelector('.page', { timeout: 20000 });
await wait(900);
await shot('13-paged', 'paged view — the page the PDF will be');

await setView(page, 'Web');
await wait(600);
await shot('14-web', 'web view — the vedaunion.org look');

await setView(page, 'Flow');
await wait(400);

/* ── 9. the window, pulled around ───────────────────────────────────────── */
for (const width of [1200, 900, 620, 400]) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  await wait(450);
  await shot(`15-width-${width}`, `${width}px — the ribbon collapses like Word's`);
}

await page.setViewport({ width: 1500, height: 950, deviceScaleFactor: 2 });
await wait(300);
await shot('16-end', 'back at 1500px');

console.log(`\n  ${notes.length} shots in ${out}/`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
writeFileSync(join(out, 'walkthrough.json'), `${JSON.stringify({ notes, errors }, null, 2)}\n`);
await browser.close();
if (errors.length > 0) process.exit(1);
