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
import { isOn, mark, setMode } from './_ui.mjs';

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

/* ── 1. it opens ready to write ─────────────────────────────────────────── */
/*
 * It used to open read-only, and the cost was "writing and editing text
 * doesn't work at all": keystrokes went nowhere until you found the mode
 * switch. A word processor opens ready to type, and the safety that matters is
 * rule zero — which refuses an edit into a transcribed verse whatever the mode
 * says, and is checked further down.
 */
check(
  'opens ready to write',
  (await isOn(page, 'Write')) === true && (await isOn(page, 'Read')) === false,
  'the Write button is the pressed one',
);

/* ── 2. and Read really does stop it ────────────────────────────────────── */
await setMode(page, 'read');
const reading = await page.evaluate(() => ({
  addressable: document.querySelectorAll('[data-u]').length,
  caret: document.querySelectorAll('.caret').length,
}));
check('no letters addressable while reading', reading.addressable === 0, `${reading.addressable} elements carry data-u`);
check('no caret while reading', reading.caret === 0);

await setMode(page, 'write');
await page.waitForSelector('[data-u]', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 300));

const entered = await page.evaluate(() => {
  const caret = document.querySelector('.caret');
  const rect = caret?.getBoundingClientRect();
  return {
    addressable: document.querySelectorAll('[data-u]').length,
    caret: caret === null ? null : { x: Math.round(rect.left), y: Math.round(rect.top), h: Math.round(rect.height) },
    marks: [...document.querySelectorAll('.rbb')]
      .map((b) => (b.textContent ?? '').trim())
      .filter((t) => ['Short', 'Long', 'None', 'Clear'].includes(t)),
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
const wasInVerse = await page.evaluate((sel) => {
  const verse = document.querySelector(sel);
  return {
    text: verse?.textContent,
    holds: verse?.querySelectorAll('.hold').length,
    svaras: verse?.querySelectorAll('[class*="sv-"]').length,
  };
}, editableSelector);
const textBefore = wasInVerse.text;
await page.keyboard.type('oṁ');
await new Promise((r) => setTimeout(r, 400));
const typed = await page.evaluate((sel) => {
  const verse = document.querySelector(sel);
  return {
    text: verse?.textContent,
    syllables: verse?.querySelectorAll('.syl').length,
    /* IN THIS VERSE, not across the page: `holds > 0` page-wide is true of
       this corpus before anything is typed, so it could not have failed. What
       matters is that the verse being edited did not LOSE marks when it was
       re-derived — and that includes its transcribed svaras, which is the
       defect this caught in the walkthrough (156 became 151). */
    holds: verse?.querySelectorAll('.hold').length,
    svaras: verse?.querySelectorAll('[class*="sv-"]').length,
  };
}, editableSelector);
/** The window around the first difference — evidence, rather than two
 *  identical-looking prefixes. The old report sliced the first 24 characters
 *  of a verse whose change was 20 characters in, so a passing check and a
 *  failing one printed the same line. */
const differenceBetween = (a = '', b = '') => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return `…${a.slice(Math.max(0, i - 6), i + 8)}… → …${b.slice(Math.max(0, i - 6), i + 8)}…`;
};
check(
  'typing changes the drawn text',
  typed.text !== textBefore,
  differenceBetween(textBefore, typed.text),
);
check(
  'the edited verse keeps its marks through the re-derive',
  typed.holds >= wasInVerse.holds && typed.svaras >= wasInVerse.svaras,
  `holdings ${wasInVerse.holds} → ${typed.holds}, svaras ${wasInVerse.svaras} → ${typed.svaras}`,
);

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
/*
 * ON A LETTER CHOSEN FOR HAVING NO HOLDING, and that is the whole point.
 *
 * This used to click wherever the earlier caret test clicked, press Long, and
 * count `.hold-long` across the page — passing on `long > 0`. This corpus
 * ships 29 long holdings, so the assertion was true before the button existed;
 * and the letter it happened to click was already inside a long box, so the
 * count did not move even when the command worked. Both halves were wrong.
 *
 * So: find a letter that carries no holding, remember which letter it is,
 * mark it, and require THAT letter to be inside a long box afterwards.
 */
const bare = await page.evaluate(() => {
  const letters = [...document.querySelectorAll('[data-verse]:not([data-attested]) [data-u]')];
  const el = letters.find((l) => l.closest('.hold') === null);
  if (el === undefined) return null;
  const verse = el.closest('[data-verse]');
  const box = el.getBoundingClientRect();
  return {
    u: el.dataset.u,
    verse: verse.dataset.verse,
    glyph: el.textContent,
    x: box.left + box.width * 0.3,
    y: box.top + box.height / 2,
    long: verse.querySelectorAll('.hold-long').length,
  };
});
if (bare === null) {
  check('a letter with no holding exists to mark', false, 'every letter is already held');
} else {
  await page.mouse.click(bare.x, bare.y);
  await new Promise((r) => setTimeout(r, 200));
  await mark(page, 'Long');
  await new Promise((r) => setTimeout(r, 250));
  const after = await page.evaluate((b) => {
    const verse = document.querySelector(`[data-verse="${b.verse}"]`);
    const el = verse?.querySelector(`[data-u="${b.u}"]`);
    return {
      held: el?.closest('.hold-long') !== null && el?.closest('.hold-long') !== undefined,
      long: verse?.querySelectorAll('.hold-long').length,
      glyph: el?.textContent,
    };
  }, bare);
  check(
    'a long holding appears on the letter it was applied to',
    after.held && after.long === bare.long + 1 && after.glyph === bare.glyph,
    `${bare.verse} "${bare.glyph}" (unit ${bare.u}): held=${after.held}, `
    + `${bare.long} → ${after.long} long boxes in the verse`,
  );
}

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
  /*
   * IN WORDS SOMEONE CAN ACT ON.
   *
   * This used to assert the verse's internal id and the word "evidence",
   * which is what the refusal used to say — "whose marks are evidence rather
   * than output — edit the transcription itself, or give the verse a source
   * layer first". That is this program's private vocabulary, and the owner
   * read it on screen and asked what it meant. So the assertion is now about
   * the two things that matter: the keystroke was refused and said so, and it
   * said so without the jargon.
   */
  const jargon = ['evidence rather than output', 'source layer', 'attested', 'derive'];
  const text = refusal ?? '';
  check(
    'a transcribed verse refuses the keystroke, in plain words',
    text.includes('copied') && text.includes('marks')
      && jargon.every((w) => !text.includes(w)),
    refusal,
  );
} else {
  check('a transcribed verse refuses the keystroke, in plain words', false, 'no transcribed verse on screen to test');
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
