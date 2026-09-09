#!/usr/bin/env node
/**
 * Does the editor behave like an editor? Measured in a real browser.
 *
 * WHY THIS REPLACED `edit-smoke.mjs`.
 *
 * That smoke test asked the caret where it was and then asserted it was
 * there: it found a letter with `getBoundingClientRect`, clicked the middle of
 * that rectangle, and checked the caret had been drawn at the same rectangle.
 * Both sides used the same geometry, so they agreed by construction. It passed
 * every time while the editor was, in the owner's words, "so buggy and off" —
 * a tautology wearing the clothes of a test.
 *
 * So every assertion here is against something the editor does NOT control:
 *
 *   the browser's own selection   `document.getSelection()`
 *   the document's own text       what the model says the verse now reads
 *   the count of drawn marks      thick boxes before and after a command
 *
 * and the interactions are driven the way a person drives them — real mouse
 * moves, real key presses — rather than by calling into the program.
 *
 *   npm run dev            # or serve a built bundle
 *   node tools/interaction.mjs
 *
 * The browser and the ways of asking the program what it thinks live in
 * `_editor-probe.mjs`. What is here is the sequence of things a person does.
 */
import {
  URL,
  browser, page, errors, wait, column, check, clickLetter,
  verseText, caret, warning, thickBoxes, passed, failures,
} from './_editor-probe.mjs';

console.log('\n── the editor, driven like a person drives it\n');

/* ── the keyboard, before anything has been clicked ─────────────────────── */
/*
 * FIRST, AND DELIBERATELY BEFORE ANY CLICK.
 *
 * Every other check here begins by clicking a letter, which focuses the page
 * as a side effect and hides the question. A `contenteditable` receives keys
 * only while it holds the focus, and for a while nothing gave it any: the
 * program opened editable, unfocused, and swallowed the first thing typed.
 */
const openedWith = await caret();
const beforeCold = await verseText();
await page.keyboard.type('oṁ ');
await wait(600);
check(
  'typing works before anything has been clicked',
  (await verseText()) !== beforeCold,
  openedWith,
);
check(
  'and the caret opens in a verse that can actually take one',
  /^v-2 · /.test(openedWith),
  `${openedWith} (v-1 is transcribed and refuses everything)`,
);
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
await wait(450);

/* ── the pointer ────────────────────────────────────────────────────────── */
await clickLetter(4);
const placed = await caret();
check('a click puts the caret in the verse and line clicked', /^v-2 · line 1/.test(placed), placed);

/* ── motion, which is the browser's now ─────────────────────────────────── */
await page.keyboard.press('ArrowRight'); await wait(120);
const moved = await caret();
check('ArrowRight moves it on', moved !== placed, `${placed} → ${moved}`);
await page.keyboard.press('ArrowLeft'); await wait(120);
check('ArrowLeft brings it back', (await caret()) === placed);
await page.keyboard.press('ArrowDown'); await wait(150);
check('ArrowDown changes line', /line 2/.test(await caret()), await caret());
await page.keyboard.press('Home'); await wait(120);
check('Home reaches the start of the line', /col 1\b/.test(await caret()), await caret());

/* ── the caret the eye sees and the caret the model has ─────────────────── */
/*
 * THE ONE CHECK THAT WOULD HAVE CAUGHT THE WORST OF IT.
 *
 * These are two independent sources of truth — the browser's own selection,
 * and the offset the model thinks it is at — so they can disagree, and they
 * did. The key table still bound the arrow keys, so pressing one ran our
 * motion AND `preventDefault`ed the browser's: four presses of ArrowRight
 * advanced the model four columns while the visible caret never moved at all,
 * and the next letter typed appeared where no caret had ever been. That is
 * "the pointer is off" and "the writing is off", and nothing that compares the
 * program against itself can see it.
 */
const whereBoth = () => page.evaluate(() => {
  const sel = document.getSelection();
  const node = sel.focusNode;
  const el = node === null ? null : (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
  return {
    unit: el?.closest?.('[data-u]')?.getAttribute('data-u') ?? null,
    model: document.querySelector('.status__caret')?.textContent ?? '',
  };
});
await clickLetter(4);
const from = await whereBoth();
for (let i = 0; i < 4; i += 1) { await page.keyboard.press('ArrowRight'); await wait(110); }
const to = await whereBoth();
check(
  'the visible caret moves with the model, not against it',
  from.unit !== null && to.unit !== null
    && Number(to.unit) - Number(from.unit) === 4
    && column(to.model) - column(from.model) === 4,
  `unit ${from.unit} → ${to.unit}, ${from.model} → ${to.model}`,
);

/* ── selection, asserted against the BROWSER's own ──────────────────────── */
const dragged = await page.evaluate(async () => {
  const letters = [...document.querySelectorAll('[data-verse="v-2"] [data-u]')];
  letters[0].scrollIntoView({ block: 'center' });
  const a = letters[0].getBoundingClientRect();
  const b = letters[Math.min(8, letters.length - 1)].getBoundingClientRect();
  return { x: a.left + 1, y: a.top + a.height / 2, tx: b.right - 1, ty: b.top + b.height / 2 };
});
await page.mouse.move(dragged.x, dragged.y);
await page.mouse.down();
for (let i = 1; i <= 10; i += 1) {
  await page.mouse.move(
    dragged.x + ((dragged.tx - dragged.x) * i) / 10,
    dragged.y + ((dragged.ty - dragged.y) * i) / 10,
  );
}
await page.mouse.up();
await wait(250);
const selection = await page.evaluate(() => ({
  native: document.getSelection().toString().length,
  status: document.querySelector('.status__caret')?.textContent ?? '',
}));
check(
  'dragging selects, and the browser and the model agree that it did',
  selection.native > 0 && /letters selected/.test(selection.status),
  `${selection.native} chars natively · ${selection.status}`,
);

/* ── a mark, applied by hand to what is selected ────────────────────────── */
const boxesBefore = await thickBoxes();
await page.keyboard.down('Control'); await page.keyboard.down('Shift');
await page.keyboard.press('KeyH');
await page.keyboard.up('Shift'); await page.keyboard.up('Control');
await wait(500);
const boxesAfter = await thickBoxes();
check(
  'a hand-placed long holding reaches the selected letters',
  boxesAfter > boxesBefore,
  `${boxesBefore} → ${boxesAfter} thick boxes`,
);
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
await wait(400);
check('and one undo takes it back', (await thickBoxes()) === boxesBefore);

/* ── the keyboard after the ribbon has taken it ─────────────────────────── */
/*
 * Pressing a ribbon button focuses the button. Without handing the keyboard
 * back, the page then looked editable and took nothing — which is exactly the
 * report the previous surface's focus helper was written for, and exactly
 * what the rewrite dropped.
 */
await clickLetter(2);
const beforeRibbon = await verseText();
await page.evaluate(() => [...document.querySelectorAll('.rbb')]
  .find((x) => x.textContent?.trim() === 'Short')?.click());
await wait(500);
await page.keyboard.type('a');
await wait(500);
check('typing works after a ribbon button has taken the focus', (await verseText()) !== beforeRibbon);
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
await wait(400);
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
await wait(400);

/* ── typing, asserted against the document's own text ───────────────────── */
await clickLetter(0);
const before = await verseText();
await page.keyboard.type('oṁ ');
await wait(500);
const after = await verseText();
check(
  'typing goes in where the caret is',
  after !== before && after.trimStart().startsWith('oṁ'),
  after.slice(0, 28),
);
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
await wait(450);
check(
  'ONE undo takes back a whole burst of typing, not one letter of it',
  (await verseText()) === before,
);

/* ── ENTER, which nothing in this repository had ever pressed ───────────── */
/*
 * The owner's report: "Enter doesn't work and behaves strangely". Both halves
 * were true, and nothing could see it — `range.test.ts` has a case named
 * "Enter at the end of a verse starts a new one" which calls `splitVerse`, a
 * function the application never invokes. It was green the whole time.
 *
 * Asserted against the RENDERED document: how many `.pada` lines the page
 * draws, and the verse's own text as the DOM has it. The session is never
 * asked what it thinks it did.
 */
const padaCount = () => page.$$eval('[data-verse="v-2"] .pada', (els) => els.length);
const verseCount = () => page.evaluate(() => [...document.querySelectorAll('[data-verse]')]
  .filter((el) => el.closest('.paged__probe') === null).length);
const undoUntil = async (want, read) => {
  for (let i = 0; i < 4 && (await read()) !== want; i += 1) {
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
    await wait(350);
  }
};

/* (a) in the middle of a pāda: the line divides, in the same verse. */
await clickLetter(4);
const linesBefore = await padaCount();
const versesBefore = await verseCount();
await page.keyboard.press('Enter');
await wait(500);
check('Enter in the middle of a pāda divides the line',
  (await padaCount()) === linesBefore + 1, `${linesBefore} → ${await padaCount()} lines`);
check('and does not make a new verse',
  (await verseCount()) === versesBefore, `${versesBefore} → ${await verseCount()} verses`);

/*
 * AND THE CARET IS ON THE NEW LINE, not the one above it. This is the
 * "behaves strangely" half: the caret came back one character short, so it was
 * drawn at the end of the line ABOVE the break — and the next letter typed
 * went back onto it. Read from the status bar, which reports the caret's line
 * and column from the document rather than from the DOM.
 */
const afterEnter = await caret();
check('and the caret is at the start of the NEW line, not the end of the old one',
  /col 1\b/.test(afterEnter), afterEnter);

/* The proof a person would recognise: what you type next appears after the
   break. */
await page.keyboard.type('na');
await wait(450);
const typedAfter = await verseText();
check('so the next letter typed lands after the break',
  /\|\s*na/.test(typedAfter) || typedAfter.includes('| na'), typedAfter.slice(0, 40));

await undoUntil(linesBefore, padaCount);
check('and undo puts the line back together', (await padaCount()) === linesBefore,
  `${await padaCount()} lines`);

/* (b) at the END of a verse: a new verse, which is how the next one is written. */
await clickLetter(0);
await page.keyboard.press('End');
await wait(250);
const versesAtEnd = await verseCount();
await page.keyboard.press('Enter');
await wait(600);
check('Enter at the end of a line starts a new verse',
  (await verseCount()) === versesAtEnd + 1, `${versesAtEnd} → ${await verseCount()} verses`);

/*
 * AND THERE IS SOMEWHERE TO TYPE IN IT. A verse with no text renders as a
 * `.pada` with no children — zero height, no line box — and `unitOfAddress`
 * returned null for it, so the caret was never placed and Enter looked like
 * it had done nothing even though the document had changed.
 */
/* Which verse the caret went to, from the status bar — so the check follows
   the caret rather than guessing which of the ten verses is the new one. */
const newVerseId = /^(\S+)/.exec(await caret())?.[1] ?? '';
const caretAtNew = await caret();
check('and the caret is in the verse Enter just made', /· col 1\b/.test(caretAtNew), caretAtNew);

await page.keyboard.type('agni');
await wait(500);
const newVerseText = await page.evaluate((id) => {
  const el = [...document.querySelectorAll(`[data-verse="${id}"]`)]
    .find((e) => e.closest('.paged__probe') === null);
  return el === undefined ? null : el.textContent.replace(/\s+/g, ' ').trim();
}, newVerseId);
check('and the empty verse it made can be typed into',
  newVerseText !== null && newVerseText.includes('agni'),
  newVerseText === null ? `no ${newVerseId} on the page` : JSON.stringify(newVerseText));
check('and the caret moved by the four letters typed',
  /col 5\b/.test(await caret()), await caret());

await undoUntil(versesAtEnd, verseCount);
check('and undo takes the new verse away again',
  (await verseCount()) === versesAtEnd, `${await verseCount()} verses`);

/* ── deleting ───────────────────────────────────────────────────────────── */
await clickLetter(3);
const kept = await verseText();
await page.keyboard.press('Backspace');
await wait(400);
check('Backspace takes out a letter', (await verseText()) !== kept);
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
await wait(400);
check('and undo restores it', (await verseText()) === kept);

/* ── an IME, which is how a dead key produces "ā" ───────────────────────── */
/*
 * WHY THIS IS HERE. While an IME composes — and a dead key on a European
 * layout is an IME, which is how half the diacritics in this program get
 * typed — the browser writes its own text into the page. React knows nothing
 * about it, so a later re-render PATCHES a tree it has a stale picture of and
 * the browser's characters survive beside the model's. Measured: composing
 * "na" and committing it left "nana" on the page. The fix is a forced rebuild;
 * this is the check that it is still forced.
 */
const composed = await (async () => {
  await clickLetter(0);
  const was = await verseText();
  const cdp = await page.target().createCDPSession();
  await cdp.send('Input.imeSetComposition', { text: 'na', selectionStart: 2, selectionEnd: 2 });
  await wait(250);
  await cdp.send('Input.insertText', { text: 'na' });
  await wait(500);
  const now = await verseText();
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await wait(400);
  return { was, now, undone: await verseText() };
})();
check(
  'a composed character lands ONCE, not once from the browser and once from us',
  (composed.now.match(/na/g) ?? []).length === (composed.was.match(/na/g) ?? []).length + 1,
  composed.now.slice(0, 26),
);
check('and undo takes the composition back', composed.undone === composed.was);

/* ── cut and paste, which go through the model rather than the DOM ──────── */
/*
 * TWO THINGS AT ONCE, and both were broken.
 *
 * Cut was bound to the copy handler, which calls `preventDefault()` — so the
 * browser cancelled the cut and never sent the delete. Ctrl+X was a copy, and
 * the `deleteByCut` branch that made the code look correct was unreachable.
 *
 * And what leaves this program must be the SOURCE, not the projection: the
 * page draws `gṁ` where the document says `ṁ`, so copying the DOM would put a
 * spelling the author never wrote onto the clipboard.
 */
await page.browserContext().overridePermissions(new global.URL(URL).origin,
  ['clipboard-read', 'clipboard-write']);
await page.evaluate(() => {
  const letters = [...document.querySelectorAll('[data-verse="v-2"] [data-u]')];
  letters[0].scrollIntoView({ block: 'center' });
  const range = document.createRange();
  range.setStart(letters[0].firstChild ?? letters[0], 0);
  const last = letters[5];
  range.setEnd(last.firstChild ?? last, (last.firstChild?.textContent ?? '').length);
  const sel = document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});
await wait(250);
const beforeCut = await verseText();
await page.keyboard.down('Control'); await page.keyboard.press('KeyX'); await page.keyboard.up('Control');
await wait(600);
const afterCut = await verseText();
const clipped = await page.evaluate(async () => {
  try { return await navigator.clipboard.readText(); } catch { return ''; }
});
check('Ctrl+X removes the text, and does not merely copy it',
  afterCut !== beforeCut, `${beforeCut.slice(0, 14)} → ${afterCut.slice(0, 14)}`);
check('and what reaches the clipboard is the SOURCE, not what is drawn',
  clipped !== '' && beforeCut.includes(clipped.slice(0, 4)), JSON.stringify(clipped.slice(0, 12)));

await page.keyboard.down('Control'); await page.keyboard.press('KeyV'); await page.keyboard.up('Control');
await wait(600);
check('and Ctrl+V puts it back', (await verseText()) === beforeCut, (await verseText()).slice(0, 20));
/* Whatever the paste did, leave the verse as it was found. */
for (let i = 0; i < 3 && (await verseText()) !== beforeCut; i += 1) {
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await wait(350);
}

console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nINTERACTION FAILED\n');
  process.exit(1);
}
console.log('\nINTERACTION PASSES\n');
