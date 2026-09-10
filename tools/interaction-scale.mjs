#!/usr/bin/env node
/**
 * ZOOM MOVES EVERYTHING BY ONE NUMBER, OR IT IS NOT ZOOM.
 *
 * THE FAULT THIS GATE EXISTS FOR was in front of everybody for a long time:
 * zoom moved the paper and not one letter. Zoom was a multiplier inside every
 * document token — `calc(1.06rem * var(--doc-zoom))` — and it was INERT, because
 * those tokens are declared on `:root` and on `[data-doc]`, where a custom
 * property's `var()` is substituted, so each one computed once against the
 * root's zoom of 1. MEASURED at 100 % and at 250 %, in all three views: the
 * mantra line 25.92 px both times, the translation 16 px, the heading 20.48 px,
 * the source line 11.52 px, the leading and the marks unchanged. The column
 * and the picture DID grow, because those two were multiplied in rules on the
 * column itself where the variable is live — so a picture at 250 % was two and
 * a half times its size beside letters that had not moved, with the air around
 * it still at its 100 % height.
 *
 * WHY NOTHING CAUGHT IT. `interaction-zoom.mjs` measures the page's own
 * geometry and the column's width, which were correct throughout, and a
 * comment in `document.css` said so in as many words: "which is why
 * `interaction-zoom.mjs` measures the COLUMN'S WIDTH rather than a font size".
 * The gate was calibrated to the bug.
 *
 * SO EVERY MEASUREMENT HERE IS A DRAWN RECTANGLE, and every assertion is a
 * RATIO against the zoom the program reports:
 *
 *   a letter    `[data-u]`'s advance width. One letter, no wrapping.
 *   a picture   `.fig`'s width.
 *   the air     the gap between the picture's foot and the block under it —
 *               `--doc-body-after`, a token that could not scale.
 *   the steps   the five sizes, whose RATIOS to each other must not change
 *               with the zoom, or the list has stopped being a scale.
 *
 * `getComputedStyle(...).fontSize` is useless for this and it matters: under
 * the browser's `zoom` it reports the PRE-ZOOM value, so it reads 25.92 px at
 * every zoom — exactly what the broken build reported.
 *
 *   npm run dev            # or serve a built bundle
 *   node tools/interaction-scale.mjs
 */
import {
  browser, page, errors, wait, check, passed, failures,
} from './_editor-probe.mjs';
import { DRAWN, figureProbe, probePicture } from './_figure-probe.mjs';

const { figureWidth } = figureProbe(page);

console.log('\n── zoom, and everything it has to move\n');

const pressTab = (label) => page.evaluate((want) => {
  [...document.querySelectorAll('.rbn__tab')].find((t) => t.textContent.trim() === want)?.click();
}, label);
const pressButton = (label) => page.evaluate((want) => {
  const b = [...document.querySelectorAll('.rbb')].find((x) => x.textContent.trim() === want);
  if (b === undefined) return 'missing';
  b.click();
  return 'clicked';
}, label);

/** The zoom the program says is in force. */
const zoomOf = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.doc')].find((e) => e.closest('.paged__probe') === null);
  return d === undefined ? -1 : Number(getComputedStyle(d).getPropertyValue('--doc-zoom')) || -1;
});

/**
 * A letter's advance width, and the air under the picture.
 *
 * THE WIDTH AND NOT THE HEIGHT for a letter: an inline box's height is snapped
 * to whole pixels by the layout engine — measured 37, 41, 48, 57, 67, 76, 95 px
 * over the seven zoom steps, up to 4 % off the ratio — while the advance width
 * is fractional and tracks the zoom to a quarter of a per cent.
 */
const drawn = () => page.evaluate((drawnFn) => {
  // eslint-disable-next-line no-eval
  const ok = eval(drawnFn);
  const seen = (el) => ok(el) && el.closest('.paged__probe') === null;
  const letter = [...document.querySelectorAll('[data-u]')].find(seen);
  const fig = [...document.querySelectorAll('.fig')].find(seen);
  if (letter === undefined || fig === undefined) return null;
  const f = fig.getBoundingClientRect();
  /* The block after the picture, whichever kind it is — the air between them
     is the picture's own bottom margin, drawn. */
  let after = fig.nextElementSibling;
  while (after !== null && !seen(after)) after = after.nextElementSibling;
  return {
    letterW: letter.getBoundingClientRect().width,
    letterH: letter.getBoundingClientRect().height,
    figW: f.width,
    air: after === null ? -1 : after.getBoundingClientRect().top - f.bottom,
  };
}, DRAWN);

const actualSize = async () => { await pressButton('Actual size'); await wait(700); };
const zoomIn = async (n) => {
  for (let i = 0; i < n; i += 1) { await pressButton('Zoom in'); await wait(260); }
  await wait(700);
};

/* ── put a picture in ────────────────────────────────────────────────────── */
await pressButton('Write');
await wait(300);
const letterAt = await page.evaluate(() => {
  const u = document.querySelector('[data-verse="v-2"] [data-u]') ?? document.querySelector('[data-u]');
  u.scrollIntoView({ block: 'center' });
  const r = u.getBoundingClientRect();
  return { x: r.left + 1, y: r.top + r.height / 2 };
});
await page.mouse.click(letterAt.x, letterAt.y);
await wait(250);
await pressTab('Insert');
await wait(250);
const picker = await page.$('input[type=file]');
if (picker === null) throw new Error('the Insert tab has no file picker');
await picker.uploadFile(probePicture('artifacts/scale-gate.png'));
await wait(1300);
check('there is a picture and a letter to measure', (await drawn()) !== null);

/* ── the three views ─────────────────────────────────────────────────────── */
/*
 * FLOW AND PAGES MEASURE THE PICTURE TOO; WEB DOES NOT, and the difference is
 * the point of the web shape rather than a gap. A page is 210 mm wide whatever
 * the window is, so zooming it changes nothing about the layout inside — every
 * drawn length is the same length times the zoom. The web shape has no page:
 * its measure is bounded by the WINDOW, so zooming it narrows the column in
 * layout terms and the text re-wraps, exactly as the browser's own zoom does
 * on a web page. A picture that is a fraction of that column therefore does
 * not scale by the zoom, and asserting that it does would be asserting the
 * web view is a sheet of paper.
 */
const STEPS = 2;
for (const view of ['Flow', 'Pages', 'Web']) {
  await pressTab('View');
  await wait(200);
  check(`${view} is reachable`, (await pressButton(view)) === 'clicked');
  await wait(1300);
  await actualSize();
  const small = await drawn();
  await zoomIn(STEPS);
  const zoom = await zoomOf();
  const big = await drawn();
  if (small === null || big === null) {
    check(`${view}: the picture and a letter are both drawn`, false, 'one of them is missing');
    continue;
  }

  const ratio = (a, b) => b / a;
  check(`${view}: a letter is drawn ${zoom}x bigger`,
    Math.abs(ratio(small.letterW, big.letterW) - zoom) < 0.01,
    `${small.letterW.toFixed(3)} → ${big.letterW.toFixed(3)} px `
    + `(x${ratio(small.letterW, big.letterW).toFixed(4)})`);

  if (view !== 'Web') {
    check(`${view}: and the picture by the same number`,
      Math.abs(ratio(small.figW, big.figW) - zoom) < 0.01,
      `${small.figW.toFixed(1)} → ${big.figW.toFixed(1)} px `
      + `(x${ratio(small.figW, big.figW).toFixed(4)})`);
    /*
     * THE AIR, which is the half that had no chance of working: the gap is
     * `--doc-body-after`, a token on `:root`, and a token could not see the
     * zoom at all. Measured at 250 %: the picture 2.5x and the gap 1.0x.
     */
    check(`${view}: and the air under it by the same number`,
      small.air > 0 && Math.abs(ratio(small.air, big.air) - zoom) < 0.03,
      `${small.air.toFixed(1)} → ${big.air.toFixed(1)} px `
      + `(x${ratio(small.air, big.air).toFixed(4)})`);
  } else {
    /* The web column is bounded by the window, so the picture must stay
       INSIDE it rather than track the zoom. */
    const inside = await page.evaluate((drawnFn) => {
      // eslint-disable-next-line no-eval
      const ok = eval(drawnFn);
      const fig = [...document.querySelectorAll('.fig')].find(ok);
      const col = fig.closest('.web__column');
      return fig.getBoundingClientRect().width <= col.getBoundingClientRect().width + 1;
    }, DRAWN);
    check('Web: the picture stays inside the reading column, which the window bounds',
      inside, `${big.figW.toFixed(0)} px`);
  }
  await actualSize();
}

/* ── the five size steps are a SCALE ─────────────────────────────────────── */
/*
 * Four of the five widths are fractions of the column and `thumb` is one fixed
 * length, so they were on two different mechanisms: the fractions followed the
 * column and the fixed one was multiplied by the zoom in a rule of its own.
 * MEASURED in the web view before the fix, from 100 % to 250 %: thumb x2.500
 * and every other step x1.785, so the list stopped being an ordered scale and
 * a thumbnail crept up on a small picture. Under the browser's `zoom` there is
 * one mechanism and the ratios cannot move.
 */
await pressTab('View');
await pressButton('Flow');
await wait(1200);
await actualSize();
await page.evaluate(() => {
  const fig = document.querySelector('.fig');
  fig?.scrollIntoView({ block: 'center' });
  fig?.click();
});
await wait(400);
await pressTab('Picture');
await wait(300);

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
  await wait(500);
};

const stepNames = await page.evaluate(() => {
  const sel = document.querySelector('select[aria-label="Picture size"]');
  return sel === null ? [] : [...sel.options].map((o) => o.text).filter((t) => !t.startsWith('Custom'));
});
check('the Size list offers the five steps', stepNames.length === 5, stepNames.join(' · '));

/** Every step's drawn width, at whatever zoom is in force. */
const widths = async () => {
  const out = {};
  for (const name of stepNames) {
    await chooseSize(name);
    out[name] = await figureWidth();
  }
  return out;
};

const atOne = await widths();
check('and they are strictly increasing at 100%',
  stepNames.every((n, i) => i === 0 || atOne[n] > atOne[stepNames[i - 1]]),
  stepNames.map((n) => `${n} ${atOne[n].toFixed(0)}`).join(' < '));

await pressTab('View');
await zoomIn(4);
const zoomNow = await zoomOf();
await pressTab('Picture');
await wait(300);
const atZoom = await widths();

const off = stepNames.filter((n) => Math.abs((atZoom[n] / atOne[n]) - zoomNow) > 0.02);
check(`EVERY STEP SCALES BY THE SAME NUMBER at ${zoomNow}x`, off.length === 0,
  stepNames.map((n) => `${n} x${(atZoom[n] / atOne[n]).toFixed(3)}`).join(', '));

/* And they are still a scale — ordered, with the same ratios. */
check('and the steps keep their ratios to each other',
  stepNames.every((n, i) => i === 0
    || Math.abs((atZoom[n] / atZoom[stepNames[i - 1]]) - (atOne[n] / atOne[stepNames[i - 1]])) < 0.02),
  stepNames.map((n, i) => (i === 0 ? '' : `${n}/${stepNames[i - 1]} `
    + `${(atOne[n] / atOne[stepNames[i - 1]]).toFixed(2)}→`
    + `${(atZoom[n] / atZoom[stepNames[i - 1]]).toFixed(2)}`)).filter(Boolean).join(' '));

/* THE CONTROL: the zoom really did change, so "everything moved by it" is not
   a statement about the number 1. */
check('and the zoom really was not 1 (else every ratio above is trivial)',
  zoomNow > 1.2, `zoom ${zoomNow}`);

await page.screenshot({ path: 'artifacts/scale-gate.png' });
console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nSCALE FAILED\n');
  process.exit(1);
}
console.log('\nSCALE PASSES\n');
