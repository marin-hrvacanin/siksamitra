#!/usr/bin/env node
/**
 * MARK FIVE ADJACENT LETTERS AND LOOK AT THE BOX.
 *
 * The owner's report was that holdings "only include two letters and don't
 * combine when adjacent". The arithmetic is checked elsewhere; this is here to
 * be LOOKED AT, because whether three boxes have become one box is a question
 * about a picture and no assertion about class names answers it.
 */
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { APP_URL, openApp, openTab, press, setMode } from './_ui.mjs';

const OUT = 'artifacts/marking';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME,
  headless: 'shell',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 6 });
await openApp(page, `${APP_URL}?chrome=native&os=windows`, { selector: '[data-block-id]' });
await new Promise((r) => setTimeout(r, 600));

await setMode(page, 'write');

/** Select letters `from`..`to` of the first verse, the way a drag does. */
async function selectUnits(from, to) {
  const box = await page.evaluate((args) => {
    const [a, b] = args;
    const first = document.querySelector(`[data-u="${a}"]`);
    const last = document.querySelector(`[data-u="${b}"]`);
    if (first === null || last === null) return null;
    const r1 = first.getBoundingClientRect();
    const r2 = last.getBoundingClientRect();
    return {
      x1: r1.left + 1, y1: r1.top + r1.height / 2,
      x2: r2.right - 1, y2: r2.top + r2.height / 2,
    };
  }, [from, to]);
  if (box === null) throw new Error(`no letters ${from}..${to} on the page`);
  await page.mouse.move(box.x1, box.y1);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y2, { steps: 12 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 250));
}

/** A tight shot of the letters around the marked run. */
async function shot(name, from, to) {
  const clip = await page.evaluate((args) => {
    const [a, b] = args;
    const first = document.querySelector(`[data-u="${Math.max(0, a - 4)}"]`);
    const last = document.querySelector(`[data-u="${b + 4}"]`)
      ?? document.querySelector(`[data-u="${b}"]`);
    if (first === null || last === null) return null;
    const r1 = first.getBoundingClientRect();
    const r2 = last.getBoundingClientRect();
    return {
      x: Math.max(0, r1.left - 12), y: Math.max(0, r1.top - 34),
      width: Math.min(420, r2.right - r1.left + 24), height: 70,
    };
  }, [from, to]);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip === null ? {} : { clip }) });
  console.log(`  ${OUT}/${name}.png`);
}

const boxes = () => page.evaluate(() => {
  const held = [...document.querySelectorAll('.hold')];
  return {
    total: held.length,
    joined: held.filter((e) => e.className.includes('join')).length,
    runs: held.slice(0, 40).map((e) => ({
      text: e.textContent,
      cls: e.className.replace('hold ', ''),
    })),
  };
});

/** Light or dark, set the way the app itself sets it. */
const setMode2 = (mode) => page.evaluate((m) => {
  document.querySelector('.app')?.setAttribute('data-mode', m);
  document.documentElement.setAttribute('data-mode', m);
}, mode);

const before = await boxes();
await shot('01-before', 10, 14);

await selectUnits(10, 14);
const sel = await page.evaluate(() => document.querySelector('.status')?.textContent?.trim());
console.log('  status after the drag:', sel?.replace(/\s+/g, ' ').slice(0, 90));

await press(page, 'Long', { tab: 'home' });
await new Promise((r) => setTimeout(r, 400));

const after = await boxes();
/* The selection's own highlight sits behind the letters and reads as a line
   between them. It is not the box, and a picture meant to answer "is this one
   box" must not contain it. */
await page.evaluate(() => { window.getSelection()?.removeAllRanges(); });
await new Promise((r) => setTimeout(r, 200));
await shot('02-after-long', 10, 14);

/* THE SAME BOX IN THE LIGHT. The join is a border in `--c-hold`, and a border
   that only works on one ground is a border that has not been looked at. */
await setMode2('light');
await new Promise((r) => setTimeout(r, 300));
await shot('02-after-long-light', 10, 14);
await setMode2('dark');
await new Promise((r) => setTimeout(r, 300));

/* And again: pressing Long on letters that are already long takes it off. */
await press(page, 'Long', { tab: 'home' });
await new Promise((r) => setTimeout(r, 400));
const off = await boxes();
await shot('03-pressed-again', 10, 14);

console.log(`\n  boxes before ${before.total}, after marking ${after.total}, `
  + `after pressing Long again ${off.total}`);
console.log(`  joined edges after marking: ${after.joined}`);
console.log('  the run:', JSON.stringify(
  after.runs.filter((r) => r.cls.includes('join') || r.cls.includes('long')).slice(0, 8),
));

await browser.close();
