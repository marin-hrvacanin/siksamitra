#!/usr/bin/env node
/**
 * Does the editor actually edit? Measured in a real browser.
 *
 * The unit tests prove the editing LOGIC — 121 of them, with no DOM. This
 * proves the part they cannot: that a click lands on the letter under the
 * pointer, that a keystroke reaches the document, that the caret is drawn
 * where the text is, and that a refusal is visible.
 *
 * Written because this repository has a history of confident wrong answers
 * from checks that never ran the thing they were checking — see
 * "Before you claim something works" in CLAUDE.md.
 *
 *   npm run dev            # in another terminal
 *   node tools/edit-smoke.mjs
 */
import puppeteer from 'puppeteer-core';

const exe = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.URL ?? 'http://localhost:5273/';

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'shell',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.setViewport({ width: 1400, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-block-id]', { timeout: 20000 });

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail === '' ? '' : `  — ${detail}`}`);
};

/* ── 1. read-only until asked ───────────────────────────────────────────── */
const before = await page.evaluate(() => ({
  addressable: document.querySelectorAll('[data-u]').length,
  caret: document.querySelectorAll('.caret').length,
  toggle: [...document.querySelectorAll('button')].find((b) => /Read only|Editing/.test(b.textContent ?? ''))?.textContent,
}));
check('starts read-only', before.toggle === 'Read only', `toggle says "${before.toggle}"`);
check('no letters addressable while reading', before.addressable === 0, `${before.addressable} elements carry data-u`);
check('no caret while reading', before.caret === 0);

/* ── 2. entering edit mode ──────────────────────────────────────────────── */
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Read only')?.click();
});
await page.waitForSelector('[data-u]', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 300));

const entered = await page.evaluate(() => {
  const caret = document.querySelector('.caret');
  const rect = caret?.getBoundingClientRect();
  return {
    addressable: document.querySelectorAll('[data-u]').length,
    caret: caret === null ? null : { x: Math.round(rect.left), y: Math.round(rect.top), h: Math.round(rect.height) },
    marks: [...document.querySelectorAll('button')].map((b) => b.textContent).filter((t) => ['Short', 'Long', 'None', 'Clear'].includes(t)),
  };
});
check('letters become addressable', entered.addressable > 100, `${entered.addressable} carry data-u`);
check('a caret is drawn', entered.caret !== null, JSON.stringify(entered.caret));
check('the caret has real height', (entered.caret?.h ?? 0) > 4, `${entered.caret?.h}px`);
check('the marking buttons appear', entered.marks.length === 4, entered.marks.join(', '));

/* ── 3. clicking lands on the letter under the pointer ──────────────────── */
const clicked = await page.evaluate(() => {
  /*
   * Inside an EDITABLE verse. A transcribed verse has no source layer and
   * refuses every keystroke — correctly — and aiming at one would test the
   * refusal while claiming to test typing. Four of Durga Suktam's nine verses
   * are transcribed, and the first is one of them.
   */
  const letters = document.querySelectorAll('[data-verse]:not([data-attested]) [data-u]');
  const target = letters[Math.min(20, letters.length - 1)];
  const box = target.getBoundingClientRect();
  return {
    unit: target.dataset.u,
    text: target.textContent,
    x: box.left + box.width * 0.25,
    y: box.top + box.height / 2,
    left: Math.round(box.left),
  };
});
await page.mouse.click(clicked.x, clicked.y);
await new Promise((r) => setTimeout(r, 250));
const afterClick = await page.evaluate(() => {
  const caret = document.querySelector('.caret')?.getBoundingClientRect();
  return {
    caretX: caret === undefined ? null : Math.round(caret.left),
    status: document.querySelector('.status__caret')?.textContent,
  };
});
check(
  'a click puts the caret at the letter it hit',
  afterClick.caretX !== null && Math.abs(afterClick.caretX - clicked.left) <= 2,
  `letter "${clicked.text}" (unit ${clicked.unit}) at x=${clicked.left}, caret at x=${afterClick.caretX}`,
);
check('the status bar says where the caret is', /line \d+ · col \d+/.test(afterClick.status ?? ''), afterClick.status);

/* ── 4. typing reaches the document, and is re-derived ──────────────────── */
const editableSelector = '[data-verse]:not([data-attested])';
const textBefore = await page.evaluate(
  (sel) => document.querySelector(sel)?.textContent,
  editableSelector,
);
await page.keyboard.type('oṁ');
await new Promise((r) => setTimeout(r, 400));
const typed = await page.evaluate((sel) => ({
  text: document.querySelector(sel)?.textContent,
  syllables: document.querySelectorAll('.syl').length,
  holds: document.querySelectorAll('.hold').length,
}), editableSelector);
check('typing changes the drawn text', typed.text !== textBefore, `"${textBefore?.slice(0, 24)}" → "${typed.text?.slice(0, 24)}"`);
check('the marks are re-derived, not dropped', typed.holds > 0, `${typed.holds} holding boxes`);

/* ── 5. undo ────────────────────────────────────────────────────────────── */
await page.keyboard.down('Control');
await page.keyboard.press('KeyZ');
await page.keyboard.up('Control');
await new Promise((r) => setTimeout(r, 400));
const undone = await page.evaluate(
  (sel) => document.querySelector(sel)?.textContent,
  editableSelector,
);
check('Ctrl+Z puts it back', undone === textBefore, `"${undone?.slice(0, 24)}"`);

/* ── 6. a hand-placed holding ───────────────────────────────────────────── */
await page.mouse.click(clicked.x, clicked.y);
await new Promise((r) => setTimeout(r, 150));
const holdsBefore = await page.evaluate(() => document.querySelectorAll('.hold').length);
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Long')?.click();
});
await new Promise((r) => setTimeout(r, 400));
const marked = await page.evaluate(() => ({
  holds: document.querySelectorAll('.hold').length,
  long: document.querySelectorAll('.hold-long').length,
}));
check(
  'a hand-placed long holding appears',
  marked.long > 0 && marked.holds >= holdsBefore,
  `${holdsBefore} → ${marked.holds} boxes, ${marked.long} long`,
);

/* ── 6b. rule zero: a transcribed verse refuses the keystroke, by name ──── */
const attested = await page.evaluate(() => {
  const el = document.querySelector('[data-verse][data-attested] [data-u]');
  if (el === null) return null;
  const box = el.getBoundingClientRect();
  return { x: box.left + 2, y: box.top + box.height / 2, verse: el.closest('[data-verse]').dataset.verse };
});
if (attested !== null) {
  await page.mouse.click(attested.x, attested.y);
  await new Promise((r) => setTimeout(r, 200));
  await page.keyboard.type('x');
  await new Promise((r) => setTimeout(r, 350));
  const refusal = await page.evaluate(() => document.querySelector('.status__warn')?.textContent);
  check(
    'a transcribed verse refuses the keystroke and says which',
    (refusal ?? '').includes(attested.verse) && (refusal ?? '').includes('evidence'),
    refusal,
  );
} else {
  check('a transcribed verse refuses the keystroke and says which', false, 'no transcribed verse on screen to test');
}

/* ── 7. selection ───────────────────────────────────────────────────────── */
await page.mouse.click(clicked.x, clicked.y);
await new Promise((r) => setTimeout(r, 150));
await page.keyboard.down('Shift');
for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowRight');
await page.keyboard.up('Shift');
await new Promise((r) => setTimeout(r, 300));
const selected = await page.evaluate(() => ({
  painted: document.querySelectorAll('.is-selected').length,
  status: document.querySelector('.status__caret')?.textContent,
}));
check('shift+arrow paints a selection', selected.painted > 0, `${selected.painted} letters, "${selected.status}"`);

/* ── 8. leaving ─────────────────────────────────────────────────────────── */
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));
const left = await page.evaluate(() => ({
  caret: document.querySelectorAll('.caret').length,
  addressable: document.querySelectorAll('[data-u]').length,
}));
check('Escape leaves edit mode', left.caret === 0 && left.addressable === 0);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();

const failed = checks.filter((c) => !c.ok);
console.log(`\n  ${checks.length - failed.length}/${checks.length} checks passed\n`);
if (failed.length > 0) {
  console.log('EDIT SMOKE FAILED\n');
  process.exit(1);
}
console.log('EDIT SMOKE PASSES\n');
