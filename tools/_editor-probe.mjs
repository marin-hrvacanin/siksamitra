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
import { browserPath } from './_browser.mjs';
import { APP_URL, openApp } from './_ui.mjs';

const URL = APP_URL;

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
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
/**
 * WHAT THE MODEL THINKS the caret is — the status bar's reading.
 *
 * USE `drawnCaret` AS WELL, ALWAYS. This asks the program where its caret is,
 * and the program answers from its own state. A gate built on this alone
 * reported "the caret is at the start of the new line" while the browser drew
 * it a line lower, and the owner found the bug by pressing Enter. Two readings
 * that must agree; only one of them is independent.
 */
const caret = () => page.evaluate(() => document.querySelector('.status__caret')?.textContent ?? '');

/**
 * WHERE THE BROWSER HAS ACTUALLY PUT THE CARET.
 *
 * `document.getSelection()` — the selection the person's caret is drawn from,
 * which nothing in this program computes. It reports which drawn line the
 * caret's rectangle sits in, so "the caret is on the line I typed into" is a
 * measurement rather than a claim.
 *
 * `line` is the index among the pādas a person can SEE (the paged view's
 * off-screen measuring probe excluded), so it can be compared with the line
 * the text went into. `-1` means the caret is not inside any pāda at all.
 */
const drawnCaret = () => page.evaluate(() => {
  const sel = document.getSelection();
  if (sel === null || sel.rangeCount === 0) return { present: false, line: -1, verse: '' };
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const box = range.getBoundingClientRect();
  const padas = [...document.querySelectorAll('[data-verse] .pada')]
    .filter((p) => p.closest('.paged__probe') === null);
  /* Which drawn line the caret's own rectangle is inside. Not which node the
     selection is anchored to — an anchor on a verse element says nothing about
     where the caret was PAINTED, and that difference is the whole bug. */
  const line = padas.findIndex((p) => {
    const r = p.getBoundingClientRect();
    return box.top >= r.top - 2 && box.bottom <= r.bottom + 2;
  });
  const node = sel.anchorNode;
  const host = node === null ? null
    : (node.nodeType === 3 ? node.parentElement : node);
  return {
    present: true,
    line,
    verse: host?.closest?.('[data-verse]')?.dataset?.verse ?? '',
    y: Math.round(box.top),
    /* The pāda the ANCHOR is in, which should be the same one. When it is not,
       the model and the paint disagree and the number says by how much. */
    anchorLine: host === null ? -1 : padas.indexOf(host.closest('.pada')),
  };
});

/** The pādas a person can see, as their text — for saying which line is which. */
const drawnLines = () => page.evaluate(() =>
  [...document.querySelectorAll('[data-verse] .pada')]
    .filter((p) => p.closest('.paged__probe') === null)
    .map((p) => p.textContent.replace(/\s+/g, ' ').trim()));
const warning = () => page.evaluate(() => document.querySelector('.status__warn')?.textContent ?? '');
const thickBoxes = () => page.evaluate(
  () => document.querySelectorAll('[data-verse="v-2"] .hold-long').length,
);

export {
  URL,
  browser, page, errors, wait, column, check, clickLetter,
  verseText, caret, drawnCaret, drawnLines, warning, thickBoxes, passed, failures,
};
