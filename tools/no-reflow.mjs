#!/usr/bin/env node
/**
 * DOES MARKING MOVE THE TEXT?
 *
 * The owner's report: "applying holdings changes the letter spacing… that is
 * not good". It did — the box was an inline-block with padding and a margin, so
 * every marked letter grew by 0.2em and pushed the rest of the line along.
 *
 * This is the check that it no longer does, and it is a measurement rather than
 * a screenshot: the position of EVERY letter in the line is recorded before the
 * marking is applied and compared with its position afterwards. A picture can
 * hide a shift of a pixel; two lists of numbers cannot.
 *
 * THE TOLERANCE IS NOT ZERO, AND THAT IS MEASURED RATHER THAN CONCEDED. The box
 * is drawn on an overlay and takes no space — padding, margin and the ring are
 * all out of flow, confirmed against the browser's own computed styles. What is
 * left is text shaping: the marked letters gain one more inline element around
 * them, and the browser shapes across an element boundary a fraction
 * differently. Measured at 0.34px across a five-letter run, against the ~13px
 * the padding and margin used to cost.
 *
 * Reaching exactly zero means not wrapping the letters at all — drawing every
 * box from measured coordinates on a layer above the text, the way a selection
 * highlight is drawn. That belongs to the render model in
 * `openspec/changes/text-and-marks`, not to a stylesheet.
 */
import puppeteer from 'puppeteer-core';
import { APP_URL, openApp, press, setMode } from './_ui.mjs';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME,
  headless: 'shell',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
await openApp(page, `${APP_URL}?chrome=native&os=windows`, { selector: '[data-block-id]' });
await new Promise((r) => setTimeout(r, 500));
await setMode(page, 'write');

/** Where every letter of the first line sits, to a hundredth of a pixel. */
const positions = () => page.evaluate(() => {
  const line = document.querySelector('.pada');
  if (line === null) return null;
  return [...line.querySelectorAll('[data-u]')].map((el) => {
    const r = el.getBoundingClientRect();
    return [el.getAttribute('data-u'), Math.round(r.left * 100) / 100, Math.round(r.width * 100) / 100];
  });
});

async function selectUnits(from, to) {
  const box = await page.evaluate((args) => {
    const [a, b] = args;
    const first = document.querySelector(`[data-u="${a}"]`);
    const last = document.querySelector(`[data-u="${b}"]`);
    if (first === null || last === null) return null;
    const r1 = first.getBoundingClientRect();
    const r2 = last.getBoundingClientRect();
    return { x1: r1.left + 1, y1: r1.top + r1.height / 2, x2: r2.right - 1, y2: r2.top + r2.height / 2 };
  }, [from, to]);
  if (box === null) throw new Error('no such letters on the page');
  await page.mouse.move(box.x1, box.y1);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y2, { steps: 10 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 200));
}

const before = await positions();
if (before === null || before.length === 0) throw new Error('no letters found');

await selectUnits(10, 14);
await press(page, 'Long', { tab: 'home' });
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => { window.getSelection()?.removeAllRanges(); });

const after = await positions();

/** A third of a pixel is text shaping; anything a person could see is not. */
const TOLERANCE = 1;

const moved = [];
let worst = 0;
for (const [i, was] of before.entries()) {
  const now = after[i];
  if (now === undefined) { moved.push(`letter ${was[0]} vanished`); continue; }
  const shift = Math.max(Math.abs(now[1] - was[1]), Math.abs(now[2] - was[2]));
  if (shift > worst) worst = shift;
  if (shift > TOLERANCE) {
    moved.push(`letter ${was[0]}: ${was[1]}+${was[2]} → ${now[1]}+${now[2]}  (${shift.toFixed(2)}px)`);
  }
}

console.log(`\n  ${before.length} letters measured before and after marking five of them`);
console.log(`  the largest movement was ${worst.toFixed(2)}px, and the limit is ${TOLERANCE}px\n`);
if (moved.length === 0) {
  console.log('  THE TEXT DID NOT MOVE.\n');
  process.exit(0);
}
console.log(`  ${moved.length} letter(s) moved too far:\n`);
for (const m of moved.slice(0, 20)) console.log(`    ${m}`);
if (moved.length > 20) console.log(`    … and ${moved.length - 20} more`);
console.log('');
process.exit(1);
