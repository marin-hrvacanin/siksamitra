#!/usr/bin/env node
/**
 * WHAT DRAGGING A SELECTION ACTUALLY COSTS, with a control.
 *
 * This exists because a measurement without a control produced a confident
 * wrong answer once already. Profiling a drag showed almost all of the time
 * inside the engine's own layout, and the hand-drawn caret's
 * `getBoundingClientRect` was blamed for it. The control disproves that: the
 * same drag in READ mode, with no editor code running at all, costs slightly
 * MORE. The cost is the browser extending a selection across a very large
 * inline tree, and it is paid whoever owns the caret.
 *
 * It prints four numbers and they only mean anything together:
 *
 *   the harness alone   40 CDP mouse moves with nothing listening
 *   a drag off the text over the navigation panel, which does not select
 *   a drag in the text   the real cost, on the biggest document there is
 *   in READ mode         the same drag with the editor uninvolved
 *
 * Not a gate — there is no threshold worth failing a build on, and a slower
 * machine is not a regression. It is here so the numbers in
 * `dom-selection.ts` can be re-run rather than believed.
 *
 *   npm run dev            # or serve a built bundle
 *   node tools/perf-selection.mjs
 */
import puppeteer from 'puppeteer-core';

const exe = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.URL ?? 'http://localhost:5273/';
const MOVES = 40;

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'shell',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.setViewport({ width: 1360, height: 880, deviceScaleFactor: 1 });
await page.goto(`${URL}?chrome=native&os=windows`, { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-block-id]');
await page.evaluate(() => document.fonts.ready);
await wait(800);

/** Drag `MOVES` times from a point, and report the milliseconds per move. */
async function drag(from) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const began = Date.now();
  for (let i = 0; i < MOVES; i += 1) await page.mouse.move(from.x + i * 14, from.y + i * 8);
  const took = Date.now() - began;
  await page.mouse.up();
  await wait(150);
  return Math.round(took / MOVES);
}

/* THE HARNESS ALONE. Every number below includes this, and without it a drag
   looks eight times more expensive than it is. */
let began = Date.now();
for (let i = 0; i < MOVES; i += 1) await page.mouse.move(20 + i, 700 + i * 2);
const harness = Math.round((Date.now() - began) / MOVES);

/* A drag that selects nothing, over the navigation panel. */
const overNav = await drag({ x: 60, y: 300 });

/* The biggest document there is. */
await page.evaluate(() => document.querySelector('.rbn__file')?.click());
await page.waitForSelector('.bs');
await wait(300);
await page.evaluate(() => [...document.querySelectorAll('.bs__item')]
  .find((b) => b.textContent?.includes('Śrī Rudram'))?.click());
await page.waitForFunction(() => document.querySelectorAll('.verse').length > 50, { timeout: 30000 });
await wait(1500);
const size = await page.evaluate(() => ({
  verses: document.querySelectorAll('.verse').length,
  letters: document.querySelectorAll('[data-u]').length,
}));

const aim = () => page.evaluate(() => {
  const letters = [...document.querySelectorAll('[data-verse] [data-u]')];
  letters[3].scrollIntoView({ block: 'center' });
  const r = letters[3].getBoundingClientRect();
  return { x: r.left + 2, y: r.top + r.height / 2 };
});
const editing = await drag(await aim());

/* THE CONTROL. Read mode: no editor code, no `contenteditable`, same text. */
await page.evaluate(() => [...document.querySelectorAll('.rbb')]
  .find((b) => b.textContent?.trim() === 'Read')?.click());
await wait(700);
const hosts = await page.evaluate(() => document.querySelectorAll('[contenteditable="true"]').length);
const reading = await drag(await page.evaluate(() => {
  const line = document.querySelectorAll('.pada')[2];
  line.scrollIntoView({ block: 'center' });
  const r = line.getBoundingClientRect();
  return { x: r.left + 4, y: r.top + r.height / 2 };
}));

console.log(`
── dragging a selection, ${MOVES} moves each
`);
console.log(`  the harness alone            ${String(harness).padStart(3)} ms/move`);
console.log(`  over the navigation panel    ${String(overNav).padStart(3)} ms/move   (selects nothing)`);
console.log(`  in the text, writing         ${String(editing).padStart(3)} ms/move   `
  + `(${size.verses} verses, ${size.letters} letters)`);
console.log(`  in the text, READING         ${String(reading).padStart(3)} ms/move   `
  + `(${hosts} editable elements — the control)`);
console.log('');
console.log('  The last two are the point: if they are close, the cost is the browser');
console.log('  extending a selection over a large inline tree, not this program.');
console.log('');
await browser.close();
