#!/usr/bin/env node
/**
 * TYPING, AS A PERSON EXPERIENCES IT — the three bugs the owner found by hand.
 *
 * THIS GATE FAILS ON PURPOSE while the editing surface is ours. It is written
 * first, and green is what the Lexical handover has to earn. See rule 16 of
 * `CLAUDE.md` and `openspec/changes/text-and-marks/`.
 *
 * WHY THE EXISTING GATES MISSED ALL THREE, which matters more than the bugs:
 * every one of them read the caret from the STATUS BAR. The status bar reports
 * the MODEL's caret, so a check asked the program where its caret was and the
 * program answered from its own state — the same arithmetic on both sides,
 * which is the tautology this repository has a written rule against. The model
 * was right every time. The browser was drawing the caret somewhere else.
 *
 * So everything here is measured from `document.getSelection()` and from the
 * rendered text, and the model's own reading is only ever used to say that the
 * two DISAGREE.
 *
 *   1. ENTER. "I pressed enter, it put it in the next line but my cursor was
 *      shown 2 lines below." Measured: the model says line 2 column 1 and the
 *      browser paints the caret one pāda lower.
 *
 *   2. A SVARA SPREADS. "When I type, that new character also carries a
 *      svara." A svara belongs to the ONE letter it was placed on. Typing to
 *      the left of it must not inherit it — the same question bold answers
 *      with `canInsertTextBefore`, which is Lexical's to own.
 *
 *   3. BACKSPACE TAKES THE WRONG LETTER. "When I press backspace, the
 *      character left of it gets deleted" — one further left than the one
 *      beside the caret.
 *
 * AND WHAT MEASURING (3) FOUND: Backspace is CORRECT. With the caret placed by
 * a click it takes exactly the letter to its left — `"-" at 4 went; expected
 * "-" at 4`. What is wrong is (1): the caret is PAINTED one line below the
 * line the text is going into, so from where a person is looking every
 * keystroke afterwards acts in the wrong place. One bug, three symptoms.
 *
 * That is worth the gate on its own: the check that would have "fixed"
 * Backspace was about to chase something that was not broken.
 *
 *
 *   npm run dev
 *   node tools/interaction-typing.mjs
 */
import {
  browser, page, errors, wait, check, caret, drawnCaret, drawnLines,
  passed, failures,
} from './_editor-probe.mjs';

console.log('\n── typing, as a person experiences it\n');

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

/** Which drawn line a piece of text is on, and what that line says. */
const lineWith = async (text) => {
  const lines = await drawnLines();
  return { index: lines.findIndex((l) => l.includes(text)), lines };
};

await pressButton('Write');
await wait(400);

/* ══ 1 · ENTER, and where the caret is PAINTED ═══════════════════════════ */
await clickLetterOf('v-2', 4);
await wait(200);

const beforeLines = await drawnLines();
const beforeDrawn = await drawnCaret();
check('the caret is painted inside a line to begin with',
  beforeDrawn.present && beforeDrawn.line >= 0,
  `line ${beforeDrawn.line}, model says ${await caret()}`);

await page.keyboard.press('Enter');
await wait(700);

const afterLines = await drawnLines();
const afterDrawn = await drawnCaret();
const afterModel = await caret();
check('Enter adds a line to the document',
  afterLines.length === beforeLines.length + 1,
  `${beforeLines.length} → ${afterLines.length} lines`);

/*
 * THE PAINTED CARET IS ON THE LINE THE MODEL NAMES.
 *
 * `beforeDrawn.line + 1` is the new line: Enter split the line the caret was
 * on, so the caret belongs on the one immediately after it. Both readings are
 * printed, because the interesting failure is that they disagree.
 */
check('and the caret is PAINTED on the new line, not below it',
  afterDrawn.line === beforeDrawn.line + 1,
  `painted on line ${afterDrawn.line}, expected ${beforeDrawn.line + 1} `
  + `(the model says ${afterModel})`);
check('and the selection is anchored to that same line',
  afterDrawn.anchorLine === beforeDrawn.line + 1,
  `anchored to line ${afterDrawn.anchorLine}, painted on ${afterDrawn.line}`);

/*
 * And the proof a person would recognise: what you type appears where the
 * caret is drawn.
 *
 * WHICH LINE CHANGED, not which line contains the letters — `na` occurs all
 * over the corpus, and searching for it found line 0 of another verse and
 * reported a fault that was the check's own. The lines before and after are
 * compared, and exactly one of them must differ.
 */
const linesBeforeTyping = await drawnLines();
await page.keyboard.type('na');
await wait(600);
const linesAfterTyping = await drawnLines();
const changed = linesAfterTyping
  .map((l, i) => (l === linesBeforeTyping[i] ? -1 : i))
  .filter((i) => i >= 0);
const typedDrawn = await drawnCaret();
check('typing changes exactly one line',
  changed.length === 1, `lines changed: ${changed.join(', ') || 'none'}`);
check('and it is the line the caret was drawn on',
  changed.length === 1 && changed[0] === afterDrawn.line,
  `the text went to line ${changed[0] ?? -1}, the caret was drawn on ${afterDrawn.line}`);
check('and the caret is still painted on that line after typing',
  changed.length === 1 && typedDrawn.line === changed[0],
  `caret on ${typedDrawn.line}, text on ${changed[0] ?? -1}`);

/* Put it back. */
for (let i = 0; i < 5 && (await drawnLines()).length !== beforeLines.length; i += 1) {
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyZ');
  await page.keyboard.up('Control');
  await wait(350);
}

/* ══ 2 · A SVARA MUST NOT SPREAD TO A LETTER TYPED BESIDE IT ═════════════ */
/*
 * A svara belongs to the ONE letter it was placed on: it is an accent, not a
 * span. Typing to its left must produce a plain letter — the same question
 * bold answers, and Lexical's `canInsertTextBefore` is the hook for it.
 */
const svaraAt = await page.evaluate(() => {
  const marked = [...document.querySelectorAll('[data-verse] [data-u][class*="sv-"]')]
    .filter((e) => e.closest('.paged__probe') === null);
  const first = marked[0];
  if (first === undefined) return null;
  first.scrollIntoView({ block: 'center' });
  const r = first.getBoundingClientRect();
  return {
    verse: first.closest('[data-verse]')?.dataset.verse ?? '',
    unit: Number(first.dataset.u),
    classes: first.className,
    /* The LEFT edge, so the caret lands before the letter rather than after. */
    x: r.left + 1,
    y: r.top + r.height / 2,
  };
});
check('there is a letter with a svara on the page to type beside',
  svaraAt !== null, svaraAt === null ? 'none found' : `${svaraAt.verse} unit ${svaraAt.unit}`);

if (svaraAt !== null) {
  await page.mouse.click(svaraAt.x, svaraAt.y);
  await wait(300);
  await page.keyboard.type('ka');
  await wait(600);

  /*
   * WHICH LETTERS CARRY A SVARA NOW, by INDEX — and that precision matters.
   *
   * This first asked whether any svara'd letter's text was `k` or `a`, which
   * every `a` in the verse already answered yes to: the check reported the bug
   * as unfixed after it was fixed. The two letters just typed sit at the
   * caret's own unit and the one after it, and those are the two that must be
   * clean.
   */
  const svaras = await page.evaluate((args) => {
    const [verse] = args;
    return [...document.querySelectorAll(`[data-verse="${verse}"] [data-u]`)]
      .filter((e) => e.closest('.paged__probe') === null)
      .map((e, i) => ({ i, text: e.textContent, svara: /\bsv-/.test(e.className) }))
      .filter((l) => l.svara)
      .map((l) => ({ at: l.i, text: l.text }));
  }, [svaraAt.verse]);
  const typedAt = [svaraAt.unit, svaraAt.unit + 1];
  const inherited = svaras.filter((l) => typedAt.includes(l.at));
  check('a letter typed beside a svara does NOT inherit it',
    inherited.length === 0,
    inherited.length === 0
      ? `the two typed letters at ${typedAt.join(' and ')} are plain; `
        + `the svara stayed on "${svaras[0]?.text ?? '?'}" at ${svaras[0]?.at ?? -1}`
      : `${inherited.map((l) => `${l.at}:${l.text}`).join(' ')} inherited it`);

  /* AND THE SVARA IS STILL THERE, on the letter it was placed on. Losing it
     would also pass the check above, and losing somebody's accent is worse
     than spreading it. */
  check('and the svara it was placed on is still there, two letters along',
    svaras.some((l) => l.at === svaraAt.unit + 2),
    `svaras at ${svaras.map((l) => l.at).slice(0, 6).join(', ')}; expected one at ${svaraAt.unit + 2}`);

  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await wait(320);
  }
}

/* ══ 3 · BACKSPACE TAKES THE LETTER BESIDE THE CARET ═════════════════════ */
/*
 * Measured against the RENDERED TEXT: the line before, the line after, and
 * which character went. Backspace with the caret after the 5th letter must
 * remove the 5th, not the 4th.
 */
/**
 * The letters of a verse as the page draws them, in order.
 *
 * `[data-u]` is one element per letter, so a deletion is visible as exactly
 * one entry leaving the list — and WHICH one, which is the whole question.
 */
const lettersOf = (verseId) => page.evaluate((id) =>
  [...document.querySelectorAll(`[data-verse="${id}"] [data-u]`)]
    .filter((e) => e.closest('.paged__probe') === null)
    .map((e) => e.textContent), verseId);

/*
 * THE CARET GOES BEFORE LETTER 5, so Backspace must take letter 4 — the one
 * immediately to its left, which is what Backspace means. The owner's report
 * is that it takes one further left again.
 *
 * Asserted by NAMING THE LETTER, not by an index: the drawn letters before and
 * after, and the one that is missing. An index alone would not say whether the
 * right character went, and the letters of a mantra are not interchangeable.
 */
await clickLetterOf('v-2', 5);
await wait(250);
const lettersBefore = await lettersOf('v-2');
const caretBefore = await drawnCaret();
const shouldGo = lettersBefore[4];

await page.keyboard.press('Backspace');
await wait(600);
const lettersAfter = await lettersOf('v-2');

check('Backspace removes exactly one letter',
  lettersAfter.length === lettersBefore.length - 1,
  `${lettersBefore.length} → ${lettersAfter.length} letters`);

/* Which one went: the first index at which the two lists differ. */
let gone = 0;
while (gone < lettersAfter.length && lettersBefore[gone] === lettersAfter[gone]) gone += 1;
check('and it is the letter immediately LEFT of the caret',
  gone === 4 && lettersBefore[gone] === shouldGo,
  `"${lettersBefore[gone] ?? ''}" at ${gone} went; expected "${shouldGo}" at 4 `
  + `(${lettersBefore.slice(0, 8).join('')} → ${lettersAfter.slice(0, 8).join('')})`);
check('and the caret stays on the line the deletion happened on',
  (await drawnCaret()).line === caretBefore.line,
  `line ${(await drawnCaret()).line}, was ${caretBefore.line}`);

for (let i = 0; i < 4 && (await lettersOf('v-2')).length !== lettersBefore.length; i += 1) {
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyZ');
  await page.keyboard.up('Control');
  await wait(320);
}

/* ── TYPING IAST ─────────────────────────────────────────────────────────── */
/*
 * HIS F9 LEADER AND HIS CHARACTER PALETTE are `tools/interaction-iast.mjs`,
 * their own gate — a separate subject, and this file had reached the 400-line
 * module limit, which is the signal to split rather than to raise.
 */

console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0) {
  console.log('\nTYPING INTERACTION FAILED\n');
  process.exit(1);
}
console.log('\nTYPING INTERACTION PASSES\n');
