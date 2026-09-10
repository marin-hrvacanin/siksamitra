#!/usr/bin/env node
/**
 * ZOOM, FIT TO WIDTH, FIT TO PAGE — measured in a real browser.
 *
 * The owner's report: "all zooming in and out logic, fitting to screen width,
 * page width and so on ... It should all work seamlessly and smoothly."
 *
 * WHAT WAS WRONG, and it is the kind of thing only a rendered page can say:
 * "Fit page" fitted the page to `window.innerHeight`, while "Fit width" fitted
 * it to the SCROLLER. The scroller is one row of the app's grid, under the
 * title bar, the tab strip and the ribbon and above the status bar — 693 px in
 * a 900 px window. So Fit page produced an 804 px page in a 693 px box: it
 * overflowed by the height of the chrome, every time, which is the one thing
 * the command is named after.
 *
 * WHAT IT IS ASSERTED AGAINST — the browser's own layout, never our
 * arithmetic. `getBoundingClientRect()` on the sheet and on the scroller, and
 * `scrollHeight > clientHeight` for "does this actually scroll". `resolveZoom`
 * is never asked what it thinks it did.
 *
 * AND THE CONTROL: the same measurement is taken with a zoom that is
 * deliberately too large, and it must report the page as NOT fitting. A
 * "does it fit" check that cannot say no is measuring nothing.
 *
 *   npm run dev
 *   node tools/interaction-zoom.mjs
 */
import { browser, page, errors, wait, check, passed, failures } from './_editor-probe.mjs';

console.log('\n── zoom, and what actually fits\n');

const pressTab = (label) => page.evaluate((want) => {
  [...document.querySelectorAll('.rbn__tab')].find((t) => t.textContent.trim() === want)?.click();
}, label);
const pressButton = (label) => page.evaluate((want) => {
  const b = [...document.querySelectorAll('.rbb')].find((x) => x.textContent.trim() === want);
  if (b === undefined) return 'missing';
  if (b.disabled) return 'disabled';
  b.click();
  return 'clicked';
}, label);

/** The scroller and the first page a person can see, in CSS pixels. */
const geometry = () => page.evaluate(() => {
  const canvas = document.querySelector('.canvas');
  const sheet = [...document.querySelectorAll('.page')]
    .find((e) => e.closest('.paged__probe') === null);
  const c = canvas?.getBoundingClientRect();
  const s = sheet?.getBoundingClientRect();
  return {
    canvasW: c === undefined ? -1 : c.width,
    canvasH: c === undefined ? -1 : c.height,
    pageW: s === undefined ? -1 : s.width,
    pageH: s === undefined ? -1 : s.height,
    windowH: window.innerHeight,
    scrolls: canvas === null ? false : canvas.scrollHeight > canvas.clientHeight + 1,
  };
});
/*
 * THE ZOOM IN FORCE, read off the document element.
 *
 * Not off a label: `ZoomControl.tsx` draws one and NOTHING RENDERS IT — the
 * ribbon's Zoom group replaced it and the component was left behind. A gate
 * that asked `.zoom__v` would be asking an element that is not on the page,
 * and `querySelector` returning null is the silence this repository keeps
 * losing checks to.
 */
const zoomOf = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.doc')].find((e) => e.closest('.paged__probe') === null);
  return d === undefined ? -1 : Number(getComputedStyle(d).getPropertyValue('--doc-zoom')) || -1;
});

await pressButton('Write');
await wait(300);
await pressTab('View');
await wait(250);
check('the paged view is available', (await pressButton('Pages')) === 'clicked');
await wait(1600);

const start = await geometry();
check('there is a page on screen to measure', start.pageH > 0,
  `${start.pageW.toFixed(0)} x ${start.pageH.toFixed(0)} px`);
check('and the canvas is shorter than the window, because the chrome is above it',
  start.canvasH < start.windowH - 20,
  `canvas ${start.canvasH.toFixed(0)} px of a ${start.windowH} px window`);

/* ── fit width ───────────────────────────────────────────────────────────── */
check('Fit width is offered', (await pressButton('Fit width')) === 'clicked');
await wait(900);
const wide = await geometry();
check('a page fitted to the width is no wider than the canvas',
  wide.pageW <= wide.canvasW + 1,
  `page ${wide.pageW.toFixed(0)} px, canvas ${wide.canvasW.toFixed(0)} px`);
check('and it uses most of it, rather than sitting in a corner',
  wide.pageW > wide.canvasW * 0.6,
  `${((wide.pageW / wide.canvasW) * 100).toFixed(0)}% of the canvas`);

/* ── fit page: the one that was wrong ────────────────────────────────────── */
check('Fit page is offered', (await pressButton('Fit page')) === 'clicked');
await wait(900);
const whole = await geometry();
check('A WHOLE PAGE FITS THE CANVAS — the command\'s entire promise',
  whole.pageH <= whole.canvasH + 1,
  `page ${whole.pageH.toFixed(0)} px, canvas ${whole.canvasH.toFixed(0)} px `
  + `(window ${whole.windowH})`);
check('and it fits the width too',
  whole.pageW <= whole.canvasW + 1,
  `page ${whole.pageW.toFixed(0)} px, canvas ${whole.canvasW.toFixed(0)} px`);
check('and it is not shrunk far below what fits, which would waste the screen',
  whole.pageH > whole.canvasH * 0.7,
  `${((whole.pageH / whole.canvasH) * 100).toFixed(0)}% of the canvas`);

/*
 * THE CONTROL. Fitting to the WINDOW instead of the canvas is the fault this
 * gate exists for, so the page that choice WOULD have produced is computed
 * from the two heights and required to be too tall. If this ever says such a
 * page fits, the check above has stopped being able to fail.
 */
const wouldBe = whole.pageH * (whole.windowH / whole.canvasH);
check('the ruler calls a window-sized page too tall (else it measures nothing)',
  wouldBe > whole.canvasH + 1,
  `fitting the window would draw ${wouldBe.toFixed(0)} px into ${whole.canvasH.toFixed(0)} px`);

/* ── the steps ───────────────────────────────────────────────────────────── */
await pressButton('Actual size');
await wait(700);
const actual = await geometry();
check('Actual size is 100%', (await zoomOf()) === 1, `--doc-zoom ${await zoomOf()}`);

await pressButton('Zoom in');
await wait(700);
const bigger = await geometry();
check('Zoom in makes the page bigger', bigger.pageH > actual.pageH + 5,
  `${actual.pageH.toFixed(0)} → ${bigger.pageH.toFixed(0)} px, zoom ${await zoomOf()}`);

await pressButton('Zoom out');
await wait(700);
check('and Zoom out brings it back', Math.abs((await geometry()).pageH - actual.pageH) < 2,
  `${(await geometry()).pageH.toFixed(0)} px, was ${actual.pageH.toFixed(0)}`);

/* Every step is reachable and none of them is degenerate. */
await pressButton('Actual size');
await wait(500);
const sizes = [];
for (let i = 0; i < 8; i += 1) {
  await pressButton('Zoom out');
  await wait(320);
  sizes.push((await geometry()).pageH);
}
check('zooming out repeatedly never reaches zero or a negative page',
  sizes.every((h) => h > 10), sizes.map((h) => h.toFixed(0)).join(' → '));
check('and it stops rather than shrinking for ever',
  sizes[sizes.length - 1] === sizes[sizes.length - 2],
  `floor at ${sizes[sizes.length - 1].toFixed(0)} px`);

await pressButton('Actual size');
await wait(400);
const ups = [];
for (let i = 0; i < 14; i += 1) {
  await pressButton('Zoom in');
  await wait(320);
  ups.push((await geometry()).pageH);
}
check('and zooming in stops at a ceiling too',
  ups[ups.length - 1] === ups[ups.length - 2],
  `ceiling at ${ups[ups.length - 1].toFixed(0)} px`);

/* ── the other two views ─────────────────────────────────────────────────── */
/*
 * THE WIDTH, not the height. Zoom widens the column and the type follows it
 * through a container query, so a taller column is not what a bigger zoom
 * produces in the flow view — the text re-wraps into FEWER lines and the
 * column gets slightly shorter. Measured: 794 → 873 px wide, 2525 → 2494 px
 * tall. Asserting the height here would have failed on correct behaviour.
 */
await pressButton('Actual size');
await wait(400);
const columnWidth = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.doc')].find((e) => e.closest('.paged__probe') === null);
  return d === undefined ? -1 : d.getBoundingClientRect().width;
});
for (const view of ['Flow', 'Web']) {
  check(`${view} is reachable`, (await pressButton(view)) === 'clicked');
  await wait(900);
  await pressButton('Actual size');
  await wait(600);
  const before = await columnWidth();
  await pressButton('Zoom in');
  await wait(800);
  const after = await columnWidth();
  check(`and zoom widens the column in ${view}`, after > before + 2,
    `${before.toFixed(0)} → ${after.toFixed(0)} px`);
  const bigger = await zoomOf();
  check(`and ${view} really is at a larger zoom`, bigger > 1, `--doc-zoom ${bigger}`);
  await pressButton('Actual size');
  await wait(500);
}


/* ── the reader's place ──────────────────────────────────────────────────── */
/*
 * ZOOM MUST NOT MOVE THE WORDS UNDER THE EYE.
 *
 * Only a change of VIEW was anchored. A zoom scales every length and re-wraps
 * the column, so every block moves while `scrollTop` stays where it was — and
 * `.canvas { overflow-anchor: none }` deliberately stops the browser from
 * compensating. Measured on Śrī Rudram at the middle of the document: one
 * press of Zoom in moved the reader ELEVEN blocks, from the ninth verse of the
 * tenth praśna to the sixth of the eleventh.
 *
 * DURGĀ SŪKTAM CANNOT SHOW THIS. It is nine verses and 2 621 px, so a step of
 * zoom moves the top block by less than its own height and the check passes on
 * a broken program. So this opens the longest document in the library.
 */
const openLibraryDoc = async (title) => {
  const opened = await page.evaluate(() => {
    const b = document.querySelector('.rbn__file');
    if (b === null) return false;
    b.click();
    return true;
  });
  if (!opened) throw new Error('no File tab in the ribbon');
  await page.waitForSelector('.bs__item', { timeout: 5000 });
  await wait(400);
  const hit = await page.evaluate((want) => {
    const b = [...document.querySelectorAll('.bs__item')]
      .find((x) => x.querySelector('.bs__item-name')?.textContent.trim() === want);
    if (b === undefined) return 'missing';
    b.click();
    return 'clicked';
  }, title);
  if (hit !== 'clicked') throw new Error(`no library document "${title}"`);
  await wait(3500);
  await page.evaluate(() => document.fonts.ready);
};

/** The block at the top of the viewport, and how far down the list it is. */
const atTop = () => page.evaluate(() => {
  const c = document.querySelector('.canvas');
  if (c === null) return null;
  const top = c.getBoundingClientRect().top;
  const blocks = [...document.querySelectorAll('[data-block-id]')]
    .filter((e) => e.closest('.paged__probe') === null);
  const hit = blocks.find((b) => b.getBoundingClientRect().bottom > top + 4);
  return {
    id: hit?.dataset.blockId ?? 'none',
    index: blocks.indexOf(hit),
    total: blocks.length,
    height: Math.round(c.scrollHeight),
  };
});

await openLibraryDoc('Śrī Rudram');
await pressTab('View');
await wait(300);
await pressButton('Flow');
await wait(1500);
await pressButton('Actual size');
await wait(900);
await page.evaluate(() => {
  const c = document.querySelector('.canvas');
  c.scrollTop = Math.round(c.scrollHeight * 0.5);
});
await wait(800);

const placeBefore = await atTop();
check('a long document is open, and we are in the middle of it',
  placeBefore !== null && placeBefore.total > 100 && placeBefore.index > 20,
  placeBefore === null ? 'no canvas' : `block ${placeBefore.index} of ${placeBefore.total}`);

await pressButton('Zoom in');
await wait(1400);
const placeAfter = await atTop();
check("ZOOM KEEPS THE READER'S PLACE",
  placeAfter !== null && Math.abs(placeAfter.index - placeBefore.index) <= 1,
  `${placeBefore.id} → ${placeAfter?.id ?? 'none'} `
  + `(block ${placeBefore.index} → ${placeAfter?.index ?? -1}, `
  + `document ${placeBefore.height} → ${placeAfter?.height ?? -1} px)`);

await pressButton('Zoom out');
await wait(1400);
const placeBack = await atTop();
check('and zooming back out keeps it too',
  placeBack !== null && Math.abs(placeBack.index - placeBefore.index) <= 1,
  `block ${placeBack?.index ?? -1}, was ${placeBefore.index}`);

/*
 * THE CONTROL. The document really did change shape under the reader — if it
 * had not, "the place was kept" would be true of doing nothing at all.
 */
check('and the document really did change shape (else nothing was kept)',
  placeAfter !== null && placeAfter.height !== placeBefore.height,
  `${placeBefore.height} → ${placeAfter?.height ?? -1} px`);

/* Switching INTO the paged view, which restores against a view that is still
   measuring — the case that needed the retry. */
await pressButton('Pages');
await wait(2500);
const paged = await atTop();
check('and switching into Pages does not throw the reader back to the top',
  paged !== null && paged.index > 5, `block ${paged?.index ?? -1} of ${paged?.total ?? -1}`);

/* ── the keyboard, as a browser delivers it ──────────────────────────────── */
/*
 * CTRL AND PLUS. On a US or Croatian layout typing `+` means holding Shift, so
 * the gesture every browser and editor uses for zoom-in arrives as
 * `Ctrl+Shift+=`. `matches` compared Shift for equality and refused it — one
 * line above a comment saying the two were the same gesture. MEASURED here
 * before the fix: `Ctrl+=` took the page from 100 % to 110 % and
 * `Ctrl+Shift++` did nothing at all.
 *
 * Driven through `page.keyboard`, so the modifiers and the `key` are the
 * BROWSER'S, not an object this script made up — a synthetic event is the
 * shape the unit test already covers.
 */
await pressButton('Actual size');
await wait(900);
const beforeKeys = await zoomOf();
check('the keyboard test starts from actual size', Math.abs(beforeKeys - 1) < 0.001,
  `zoom ${beforeKeys}`);

const chord = async (keys) => {
  for (const k of keys) await page.keyboard.down(k);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
  await wait(700);
};

await chord(['Control', '=']);
const afterPlain = await zoomOf();
check('Ctrl and equals zooms in', afterPlain > beforeKeys + 0.001,
  `${beforeKeys} → ${afterPlain}`);

await chord(['Control', 'Shift', '=']);
const afterShifted = await zoomOf();
check('AND SO DOES CTRL AND PLUS, which is Shift and equals on this keyboard',
  afterShifted > afterPlain + 0.001, `${afterPlain} → ${afterShifted}`);

await chord(['Control', '-']);
const afterMinus = await zoomOf();
check('Ctrl and minus zooms out', afterMinus < afterShifted - 0.001,
  `${afterShifted} → ${afterMinus}`);

/*
 * THE CONTROL. Ignoring Shift for every accelerator would make Ctrl+Shift+M
 * toggle the marks as well as Ctrl+M, so a gesture that belongs to nobody
 * would start doing something. The marks button says whether it happened.
 */
const marksBefore = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.rbb')].find((b) => (b.textContent ?? '').trim() === 'Marks');
  return el === undefined ? null : el.getAttribute('aria-pressed');
});
await chord(['Control', 'Shift', 'm']);
const marksAfter = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.rbb')].find((b) => (b.textContent ?? '').trim() === 'Marks');
  return el === undefined ? null : el.getAttribute('aria-pressed');
});
check('the Marks toggle was found, so the control below means something',
  marksBefore !== null, `aria-pressed ${marksBefore}`);
check('and Shift is still compared for accelerators that are not a punctuation pair',
  marksBefore !== null && marksAfter === marksBefore,
  `Marks ${marksBefore} → ${marksAfter}`);

/* And Ctrl+M alone DOES toggle it — otherwise the check above would pass on a
   build where no accelerator worked at all. */
await chord(['Control', 'm']);
const marksPlain = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.rbb')].find((b) => (b.textContent ?? '').trim() === 'Marks');
  return el === undefined ? null : el.getAttribute('aria-pressed');
});
check('while Ctrl+M on its own does toggle the marks', marksPlain !== marksBefore,
  `Marks ${marksBefore} → ${marksPlain}`);
await chord(['Control', 'm']);

await page.screenshot({ path: 'artifacts/zoom-gate.png' });
console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nZOOM INTERACTION FAILED\n');
  process.exit(1);
}
console.log('\nZOOM INTERACTION PASSES\n');
