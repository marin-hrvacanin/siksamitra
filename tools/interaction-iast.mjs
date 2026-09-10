#!/usr/bin/env node
/**
 * TYPING IAST — his own F9 leader, and his own character palette.
 *
 * A person marking a Vedic text types `ā`, `ṛ`, `ṁ`, `ṭh`, `ś` and `ḥ` all
 * day, and no keyboard layout has them. v1 answered that twice and both
 * answers are HIS, so both were transcribed rather than redesigned:
 * `editor-quill.js` `setupIASTShortcuts` (L5626) for the leader, and
 * `dialog-iast.html` for the palette. See `apps/web/src/editor/iast.ts`.
 *
 * WHAT ONLY A BROWSER CAN SAY. The unit tests check the table and the
 * component tests check the events; neither can tell you that the character
 * reaches the DOCUMENT, that the plain letter did not arrive as well, or that
 * clicking a key on the palette does not take the caret away from the text.
 * All of that is measured here from the drawn document.
 *
 *   npm run dev
 *   node tools/interaction-iast.mjs
 */
import {
  browser, page, errors, wait, check, passed, failures,
} from './_editor-probe.mjs';

console.log('\n── typing IAST\n');

const pressButton = (label) => page.evaluate((want) => {
  const b = [...document.querySelectorAll('.rbb')].find((x) => x.textContent.trim() === want);
  if (b === undefined) return 'missing';
  if (b.disabled) return 'disabled';
  b.click();
  return 'clicked';
}, label);

/** Click the nth letter of a verse, having scrolled it into view. */
const clickLetterOf = async (verseId, n) => {
  const at = await page.evaluate((args) => {
    const [id, i] = args;
    const letters = [...document.querySelectorAll(`[data-verse="${id}"] [data-u]`)]
      .filter((e) => e.closest('.paged__probe') === null);
    if (letters[i] === undefined) return null;
    letters[i].scrollIntoView({ block: 'center' });
    const r = letters[i].getBoundingClientRect();
    return { x: r.left + 1, y: r.top + r.height / 2 };
  }, [verseId, n]);
  if (at === null) throw new Error(`${verseId} has no letter ${n}`);
  await page.mouse.click(at.x, at.y);
  await wait(250);
};

await pressButton('Write');
await wait(400);

const verseSays = (id) => page.evaluate((v) => {
  const el = [...document.querySelectorAll(`[data-verse="${v}"]`)]
    .find((e) => e.closest('.paged__probe') === null);
  return el === null || el === undefined ? '' : (el.textContent ?? '');
}, id);

const leader = async (letter, shift = false) => {
  await page.keyboard.press('F9');
  await wait(120);
  if (shift) {
    await page.keyboard.down('Shift');
    await page.keyboard.press(`Key${letter.toUpperCase()}`);
    await page.keyboard.up('Shift');
  } else {
    await page.keyboard.press(letter);
  }
  await wait(320);
};

await clickLetterOf('v-2', 3);
const beforeIast = await verseSays('v-2');
await leader('a');
const afterIast = await verseSays('v-2');
check('F9 then a letter puts the diacritic in the document',
  afterIast.length === beforeIast.length + 1 && afterIast !== beforeIast,
  `${beforeIast.length} → ${afterIast.length} characters`);
/*
 * AND NOT THE PLAIN LETTER TOO. F9+a must insert `ā`, not `āa` — the diacritic
 * from the leader and the letter from the input path, which is where every
 * printable character comes from.
 *
 * ASSERTED AS A SPLICE rather than by looking for `āa`, because a substring
 * check is the wrong tool here and said so on the first run: the caret landed
 * before an `a`, so inserting `ā` correctly PRODUCES `āa` and the check
 * failed on right behaviour. What is true is that the text afterwards is the
 * text before with exactly one `ā` put into it and nothing else changed.
 */
const splicedOnce = (before, after, ch) => {
  for (let i = 0; i <= before.length; i += 1) {
    if (before.slice(0, i) + ch + before.slice(i) === after) return i;
  }
  return -1;
};
const putAt = splicedOnce(beforeIast, afterIast, 'ā');
check('and the plain letter does not arrive as well',
  putAt >= 0, putAt >= 0 ? `one "ā" at ${putAt}, nothing else changed` : afterIast.slice(0, 40));

/* The capital half of the table needs Shift, and Shift must not spend the
   leader: F9 then Shift+T is `ṭh`, two characters. */
const beforeShift = await verseSays('v-2');
await leader('t', true);
const afterShift = await verseSays('v-2');
check('F9 then Shift and a letter gives the capital entry',
  afterShift.includes('ṭh'), `${beforeShift.length} → ${afterShift.length} characters`);

/* A key the map does not have inserts NOTHING — not the letter that was
   pressed. `q` in a mantra is worse than nothing. */
const beforeMiss = await verseSays('v-2');
await leader('q');
const afterMiss = await verseSays('v-2');
check('F9 then an unmapped key inserts nothing at all',
  afterMiss === beforeMiss, `${beforeMiss.length} → ${afterMiss.length} characters`);

/* And a plain letter with no leader still types — the control, without which
   the checks above would pass on a build that swallowed every keystroke. */
const beforePlain = await verseSays('v-2');
await page.keyboard.press('KeyZ');
await wait(320);
const afterPlain = await verseSays('v-2');
check('a letter with no leader still types — the control',
  afterPlain.length === beforePlain.length + 1,
  `${beforePlain.length} → ${afterPlain.length} characters`);

/* ── the palette ─────────────────────────────────────────────────────────── */
await page.evaluate(() => document.querySelector('#rbn-tab-insert')?.click());
await wait(300);
check('the IAST button is on the Insert tab', (await pressButton('IAST')) === 'clicked');
await wait(400);
const keysDrawn = await page.evaluate(
  () => document.querySelectorAll('.iast__key').length,
);
check('and it opens a keyboard of characters', keysDrawn > 40, `${keysDrawn} keys`);

/*
 * A KEY INSERTS, AND THE CARET DOES NOT MOVE. This is the half that only a
 * browser can check: the palette is portalled out of the ribbon and its
 * buttons must not take the focus, or the insertion has no caret to land at.
 */
const beforePalette = await verseSays('v-2');
const hit = await page.evaluate(() => {
  const key = [...document.querySelectorAll('.iast__key')]
    .find((b) => (b.querySelector('.iast__ch')?.textContent ?? '') === 'ṛ');
  if (key === undefined) return null;
  const r = key.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (hit === null) check('the palette offers ṛ', false, 'no such key');
else {
  await page.mouse.click(hit.x, hit.y);
  await wait(400);
  const afterPalette = await verseSays('v-2');
  check('pressing a key on the keyboard inserts into the document',
    afterPalette.includes('ṛ') && afterPalette.length === beforePalette.length + 1,
    `${beforePalette.length} → ${afterPalette.length} characters`);
  /* Still open: these are pressed in bursts. */
  check('and the keyboard stays open',
    (await page.evaluate(() => document.querySelectorAll('.iast__key').length)) > 40);
}

console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nIAST INTERACTION FAILED\n');
  process.exit(1);
}
console.log('\nIAST INTERACTION PASSES\n');
