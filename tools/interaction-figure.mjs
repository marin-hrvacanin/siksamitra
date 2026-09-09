#!/usr/bin/env node
/**
 * A PICTURE, DRIVEN THE WAY A PERSON DRIVES ONE. Measured in a real browser.
 *
 * The owner's report, and the whole reason this file exists: "I can't select
 * the photo to pull it to resize it and freely move it around and also setting
 * the text wrap and all that." Four gestures, none of which a unit test can
 * see — a mousedown that has to beat `selectionchange`, a drag against a
 * column whose width only the layout knows, a drop rule drawn from viewport
 * rectangles, and a float that only means anything once text has flowed round
 * it.
 *
 * WHAT IS ASSERTED AGAINST, in each case something the editor does not compute:
 *
 *   selection      the class the RENDERER put on the element, and the tab the
 *                  RIBBON is showing — not the session's own idea of it.
 *   the resize     the element's measured `getBoundingClientRect().width`,
 *                  before and after, in CSS pixels.
 *   one undo step  ONE Ctrl+Z has to give the whole drag back. A resize that
 *                  wrote a command per mousemove passes every unit test and
 *                  fails this, which is what it was doing.
 *   the move       the ORDER OF THE BLOCKS in the DOM, read as a sequence of
 *                  verse ids. The document is never asked where it put the
 *                  picture.
 *   the wrap       `getComputedStyle(...).float`, and then the thing that
 *                  actually matters: whether an instruction beside the picture
 *                  is NARROWER than the column. A float that nothing flows
 *                  around is not a wrap.
 *
 * Run against the dev server, like the other interaction gates:
 *   npm run dev
 *   node tools/interaction-figure.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { browser, page, errors, wait, check, passed, failures } from './_editor-probe.mjs';

console.log('\n── a picture, driven the way a person drives one\n');

/* A picture to insert: a solid colour, so it is unmistakable on the page. */
mkdirSync('artifacts', { recursive: true });
const PROBE = 'artifacts/figure-gate.png';
const png = new PNG({ width: 240, height: 160 });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 210; png.data[i + 1] = 120; png.data[i + 2] = 60; png.data[i + 3] = 255;
}
writeFileSync(PROBE, PNG.sync.write(png));

const tabs = () => page.$$eval('.rbn__tab', (bs) => bs.map((b) => b.textContent.trim()));
const activeTab = () => page.$eval('.rbn__tab.is-on', (e) => e.textContent.trim()).catch(() => '');
const pressTab = (label) => page.evaluate((want) => {
  [...document.querySelectorAll('.rbn__tab')].find((t) => t.textContent.trim() === want)?.click();
}, label);
const pressButton = (label) => page.evaluate((want) => {
  [...document.querySelectorAll('.rbb')].find((b) => b.textContent.trim() === want)?.click();
}, label);
/*
 * THE PICTURE A PERSON CAN SEE, and not the other one.
 *
 * The paged view lays the whole document out a SECOND time, off-screen under
 * `visibility: hidden`, to measure where the pages break — so `.fig` matches
 * the probe's copy first and every measurement here was of an element nobody
 * can click. `checkVisibility` is the browser's own answer, and it is the same
 * test `figure-drag.ts` uses to decide what a drop may land on.
 */
const DRAWN = 'el => el.checkVisibility({ visibilityProperty: true })';
const visibleFig = (extra = '') => page.evaluateHandle((args) => {
  const [sel, drawn] = args;
  // eslint-disable-next-line no-eval
  const ok = eval(drawn);
  return [...document.querySelectorAll(sel)].find(ok) ?? null;
}, [`.fig${extra}`, DRAWN]);
const countVisible = (sel) => page.evaluate((args) => {
  const [s, drawn] = args;
  // eslint-disable-next-line no-eval
  const ok = eval(drawn);
  return [...document.querySelectorAll(s)].filter(ok).length;
}, [sel, DRAWN]);
const selectedCount = () => countVisible('.fig.is-selected');
const figureWidth = async () => {
  const h = await visibleFig();
  return h.evaluate((f) => (f === null ? 0 : f.getBoundingClientRect().width));
};
const undoOnce = async () => {
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyZ');
  await page.keyboard.up('Control');
  await wait(450);
};

/** The middle of a DRAWN element, in viewport coordinates, scrolled to. */
const centre = (selector) => page.evaluate((args) => {
  const [sel, drawn] = args;
  // eslint-disable-next-line no-eval
  const el = [...document.querySelectorAll(sel)].find(eval(drawn));
  if (el === undefined) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, [selector, DRAWN]);

/**
 * The order of the document's blocks, as the DOM has them.
 *
 * Verses keep their own id — which does NOT change when a picture moves past
 * them — and everything else is reduced to its kind. So a picture moving is
 * visible as `F` changing place in a sequence whose other entries must not.
 */
const blockOrder = () => page.evaluate((drawn) => [...document.querySelectorAll('[data-block-id]')]
  // eslint-disable-next-line no-eval
  .filter(eval(drawn))
  .map((el) => {
    const id = el.dataset.blockId;
    return id.startsWith('v:') ? id : id.slice(0, 1).toUpperCase();
  }), DRAWN);

/* ── put one in ──────────────────────────────────────────────────────────── */
await pressButton('Write');
await wait(300);
/* The caret goes in a verse first: a new picture lands after the verse the
   caret is in, and a caret nowhere puts it at the end of the step. */
const letter = await page.evaluate(() => {
  const u = document.querySelector('[data-verse="v-2"] [data-u]') ?? document.querySelector('[data-u]');
  u.scrollIntoView({ block: 'center' });
  const r = u.getBoundingClientRect();
  return { x: r.left + 1, y: r.top + r.height / 2 };
});
await page.mouse.click(letter.x, letter.y);
await wait(250);

const tabsAtRest = await tabs();
check('there is no Picture tab while nothing is selected',
  !tabsAtRest.includes('Picture'), tabsAtRest.join(' · '));

await pressTab('Insert');
await wait(250);
const picker = await page.$('input[type=file]');
if (picker === null) throw new Error('the Insert tab has no file picker');
await picker.uploadFile(PROBE);
await wait(1200);

check('the picture is on the page', (await countVisible('.fig')) > 0);
check('and it is selected, without being clicked', (await selectedCount()) === 1);
const tabsNow = await tabs();
check('the Picture tab has appeared', tabsNow.includes('Picture'), tabsNow.join(' · '));
check('and it is the tab in front', (await activeTab()) === 'Picture', await activeTab());

/* ── drag a corner ───────────────────────────────────────────────────────── */
const beforeResize = await figureWidth();
const handle = await centre('.fig__handle--se');
await page.mouse.move(handle.x, handle.y);
await page.mouse.down();
await page.mouse.move(handle.x + 150, handle.y + 90, { steps: 14 });
const midDrag = await figureWidth();
await page.mouse.up();
await wait(400);
const afterResize = await figureWidth();
check('dragging a corner makes the picture wider',
  afterResize > beforeResize + 20, `${beforeResize.toFixed(0)} → ${afterResize.toFixed(0)} px`);
check('and it grows WHILE the corner is held, not only on release',
  midDrag > beforeResize + 20, `${midDrag.toFixed(0)} px mid-drag`);
const styleWidth = await (await visibleFig()).evaluate((f) => f.style.width);
check('the width is stored as a percentage of the column', /%$/.test(styleWidth), styleWidth);

await undoOnce();
check('ONE Ctrl+Z gives the whole drag back',
  Math.abs((await figureWidth()) - beforeResize) < 2,
  `${(await figureWidth()).toFixed(0)} px, was ${beforeResize.toFixed(0)}`);

/* ── carry it somewhere else ─────────────────────────────────────────────── */
const orderBefore = await blockOrder();
const wasAt = orderBefore.indexOf('F');
const grab = await centre('.fig');
const top = await page.evaluate((drawn) => {
  // eslint-disable-next-line no-eval
  const el = [...document.querySelectorAll('[data-block-id]')].find(eval(drawn));
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + 2 };
}, DRAWN);
await page.mouse.move(grab.x, grab.y);
await page.mouse.down();
await page.mouse.move(grab.x + 12, grab.y - 30, { steps: 6 });
const ruleDuring = await page.$$eval('.fig-drop', (r) => r.length);
const ghost = await page.$$eval('.fig.is-moving', (f) => f.length);
await page.mouse.move(top.x, top.y, { steps: 18 });
await wait(120);
const ruleWidth = await page.$eval('.fig-drop', (r) => r.getBoundingClientRect().width)
  .catch(() => 0);
await page.mouse.up();
await wait(500);

check('a drop rule is drawn while the picture is in the air', ruleDuring === 1);
check('and the picture itself is shown as the one being carried', ghost === 1);
check('the rule is a real width, not a hairline artefact', ruleWidth > 40,
  `${ruleWidth.toFixed(0)} px`);
check('the drop rule is gone once the button comes up',
  (await page.$$eval('.fig-drop', (r) => r.length)) === 0);

const orderAfter = await blockOrder();
const nowAt = orderAfter.indexOf('F');
check('the picture has moved up the document', nowAt < wasAt, `${wasAt} → ${nowAt}`);
check('and it is still selected after the drop', (await selectedCount()) === 1);
check('the Picture tab is still in front', (await activeTab()) === 'Picture');
const verses = (list) => list.filter((b) => b.startsWith('v:'));
check('nothing else changed order',
  verses(orderAfter).join(',') === verses(orderBefore).join(','),
  verses(orderAfter).slice(0, 4).join(' '));

await undoOnce();
check('ONE Ctrl+Z puts it back where it was',
  (await blockOrder()).indexOf('F') === wasAt,
  `${(await blockOrder()).indexOf('F')}, was ${wasAt}`);

/* ── the wrap ────────────────────────────────────────────────────────────── */
/*
 * A FLOAT THAT NOTHING FLOWS AROUND IS NOT A WRAP, which is the only reading
 * that would have caught the case where the picture floats and the text simply
 * starts below it. So the instruction beside the picture is measured against
 * the column, and the column against itself: the paragraph must be NARROWER
 * than the column it is in.
 */
await centre('.fig');
await wait(200);
await pressTab('Picture');
await pressButton('Right');
await wait(500);
const floated = await (await visibleFig()).evaluate((f) => getComputedStyle(f).float);
check('the Right button floats the picture right', floated === 'right', floated);

const wrap = await page.evaluate((drawn) => {
  // eslint-disable-next-line no-eval
  const fig = [...document.querySelectorAll('.fig')].find(eval(drawn));
  const column = fig.parentElement;
  const box = fig.getBoundingClientRect();
  const col = column.getBoundingClientRect();
  /* The CONTENT box, not the border box: the column carries the page's own
     margins as padding, so measuring to `col.right` finds the paper's edge and
     reports a 94 px gap for a picture that is flush with the text. */
  const pad = getComputedStyle(column);
  const contentRight = col.right - parseFloat(pad.paddingRight || '0');
  const contentWidth = col.width
    - parseFloat(pad.paddingRight || '0') - parseFloat(pad.paddingLeft || '0');
  /* The first verse whose top is below the picture's top: the one the float
     is standing beside, or would be if a verse were allowed to wrap. */
  const verse = [...column.querySelectorAll('.verse')]
    .find((el) => el.getBoundingClientRect().top >= box.top - 1);
  return {
    gap: Math.round(contentRight - box.right),
    width: Math.round(box.width),
    column: Math.round(contentWidth),
    verseTop: verse === undefined ? null : Math.round(verse.getBoundingClientRect().top - box.bottom),
  };
}, DRAWN);

/*
 * A FLOAT HAS TO BE IN THE LAYOUT, not only in the computed style. The picture
 * is narrower than the column, so a right float puts its right edge ON the
 * column's right edge; a picture that merely says `float: right` while sitting
 * in the middle of the column would pass the check above and fail this one.
 */
check('and the picture really is at the right edge of the column',
  wrap.gap <= 1 && wrap.width < wrap.column - 20,
  `${wrap.width} px picture, ${wrap.gap} px to the column edge of ${wrap.column} px`);

/*
 * AND THE VERSE STILL GETS THE WHOLE COLUMN. `.verse { clear: both }` is the
 * standing rule and it is the opposite of a bug: text narrowed by a picture
 * wraps where the picture ends rather than at the metre, so a pada beside a
 * float breaks in the wrong place. Measured in `gate-figures.mjs` against the
 * control; measured HERE as the thing a person would see, which is that the
 * verse starts below the picture instead of beside it.
 */
check('and the verse below it still gets the whole column, as the rule says',
  wrap.verseTop !== null && wrap.verseTop >= -1,
  `the verse begins ${wrap.verseTop} px below the picture`);

await pressButton('Centre');
await wait(400);
check('and Centre puts it back on its own line',
  (await (await visibleFig()).evaluate((f) => getComputedStyle(f).float)) === 'none');

/* ── the Size list, AFTER a drag ─────────────────────────────────────────── */
/*
 * THE FAULT THIS EXISTS FOR — the owner's words: "I resized it by pulling the
 * edge and all of a sudden Size doesn't work at all."
 *
 * A corner drag writes `widthPct`, which the renderer applies as an INLINE
 * `style.width`; the five sizes are CLASSES. An inline width beats a class, so
 * the Size list went on writing `size` into the document, faithfully, and
 * nothing on the screen moved — every one of the five dead, permanently, after
 * one gesture.
 *
 * Nothing above could have caught it. The resize checks measure the drag, and
 * they pass either way; a unit test on `setSize` sees the document get the
 * size it asked for, which it always did. Only the picture's MEASURED WIDTH
 * before and after choosing a size can tell you the control does anything, and
 * that number comes from the browser's layout.
 */
const chooseSize = async (label) => {
  const ok = await page.evaluate((want) => {
    const sel = document.querySelector('select[aria-label="Picture size"]');
    if (sel === null) return 'no size control';
    const option = [...sel.options].find((o) => o.text === want);
    if (option === undefined) return `no option "${want}"`;
    sel.value = option.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return 'chosen';
  }, label);
  if (ok !== 'chosen') throw new Error(`could not choose the size "${label}": ${ok}`);
  await wait(450);
};
/** What the Size list is SHOWING — its selected option's text. */
const sizeShown = () => page.evaluate(() => {
  const sel = document.querySelector('select[aria-label="Picture size"]');
  return sel === null ? null : sel.options[sel.selectedIndex]?.text ?? null;
});

await centre('.fig');
await wait(200);
await pressTab('Picture');
await pressButton('Centre');
await wait(400);
await chooseSize('Medium ½');
await wait(300);
const atMedium = await figureWidth();

const corner = await centre('.fig__handle--se');
await page.mouse.move(corner.x, corner.y);
await page.mouse.down();
await page.mouse.move(corner.x + 170, corner.y + 100, { steps: 14 });
await page.mouse.up();
await wait(450);
const dragged = await figureWidth();
check('a corner drag widens it past its Medium width',
  dragged > atMedium + 20, `${atMedium.toFixed(0)} → ${dragged.toFixed(0)} px`);
check('and the Size list stops claiming one of the five',
  /^Custom \d+%$/.test((await sizeShown()) ?? ''), await sizeShown());

await chooseSize('Thumb');
const atThumb = await figureWidth();
check('choosing a Size after a drag actually resizes the picture',
  atThumb < dragged - 20, `${dragged.toFixed(0)} → ${atThumb.toFixed(0)} px`);
check('and the dragged width is gone from the element, not merely overridden',
  (await (await visibleFig()).evaluate((f) => f.style.width)) === '',
  await (await visibleFig()).evaluate((f) => f.style.width || '(none)'));
check('and the list names the size that is now in force',
  (await sizeShown()) === 'Thumb', await sizeShown());

await chooseSize('Full');
const atFull = await figureWidth();
check('and every other size in the list works too',
  atFull > atThumb + 40, `Thumb ${atThumb.toFixed(0)} → Full ${atFull.toFixed(0)} px`);

/*
 * THE CONTROL FOR THIS CHECK. Put the inline width back the way a drag does
 * and require the measurement to see it: if choosing a size passed above
 * because widths stopped being applied inline at all, this fails.
 */
await (await visibleFig()).evaluate((f) => { f.style.width = '30%'; });
await wait(150);
const forced = await figureWidth();
check('the ruler sees an inline width beat a size class (else it measures nothing)',
  forced < atFull - 40, `${atFull.toFixed(0)} → ${forced.toFixed(0)} px with an inline 30%`);
await chooseSize('Medium ½');
await wait(300);

/* ── and on a page ───────────────────────────────────────────────────────── */
await pressTab('View');
await pressButton('Pages');
await wait(1400);
const onPage = await centre('.fig');
await wait(300);
await page.mouse.click(onPage.x, onPage.y);
await wait(400);
check('a picture on a page selects too', (await selectedCount()) === 1);
check('and carries its handles', (await countVisible('.fig__handle')) === 4);

await page.screenshot({ path: 'artifacts/figure-gate.png' });
console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nFIGURE INTERACTION FAILED\n');
  process.exit(1);
}
console.log('\nFIGURE INTERACTION PASSES\n');
