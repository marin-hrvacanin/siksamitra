/**
 * DRIVING THE EDITOR FROM OUTSIDE IT.
 *
 * The browser, the counters, and the ways of asking the running program what
 * it thinks — shared by `interaction.mjs` and by anything else that needs to
 * drive a real editor rather than call into one.
 *
 * The rule these exist to keep: nothing here asks the editor to confirm its
 * own arithmetic. `verseText` reads the rendered document, `caret` reads the
 * status bar, and the selection is read from the BROWSER. A check that
 * compared the program against itself is how a tautology passed for a test
 * in this repository once already.
 */
import puppeteer from 'puppeteer-core';
import { APP_URL, openApp } from './_ui.mjs';

const exe = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = APP_URL;

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'shell',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

let passed = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  ok    ${name}${detail === '' ? '' : `  — ${detail}`}`); return; }
  failures.push(name);
  console.log(`  FAIL  ${name}  ${detail}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** The column out of a status line like `v-2 · line 1 · col 9`. */
const column = (status) => Number(/col (\d+)/.exec(status)?.[1] ?? -1);

await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });
/* The custom title bar is forced on, so the layout under test is the one the
   desktop app has rather than the browser's. */
await page.goto(`${URL}?chrome=native&os=windows`, { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-block-id]');
await page.evaluate(() => document.fonts.ready);
await wait(600);


/** Click the nth letter of v-2, having scrolled it into view first. */
async function clickLetter(n) {
  const at = await page.evaluate((i) => {
    const letters = [...document.querySelectorAll('[data-verse="v-2"] [data-u]')];
    if (letters[i] === undefined) return null;
    letters[i].scrollIntoView({ block: 'center' });
    const r = letters[i].getBoundingClientRect();
    return { x: r.left + 1, y: r.top + r.height / 2 };
  }, n);
  if (at === null) throw new Error(`v-2 has no letter ${n}`);
  await page.mouse.click(at.x, at.y);
  await wait(180);
}

/** The verse's text as the DOCUMENT reads it, with the verse number removed. */
const verseText = () => page.evaluate(() => [...document.querySelectorAll('[data-verse="v-2"] .pada')]
  .map((line) => [...line.childNodes]
    .filter((c) => !(c instanceof HTMLElement && c.classList.contains('verse__n')))
    .map((c) => c.textContent).join(''))
  .join(' | '));
const caret = () => page.evaluate(() => document.querySelector('.status__caret')?.textContent ?? '');
const warning = () => page.evaluate(() => document.querySelector('.status__warn')?.textContent ?? '');
const thickBoxes = () => page.evaluate(
  () => document.querySelectorAll('[data-verse="v-2"] .hold-long').length,
);

export {
  URL,
  browser, page, errors, wait, column, check, clickLetter,
  verseText, caret, warning, thickBoxes, passed, failures,
};
