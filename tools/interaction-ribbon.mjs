#!/usr/bin/env node
/**
 * THE RIBBON'S CONTROLS, MEASURED — can you read what they say?
 *
 * The owner's report, and the whole reason this file exists: "all dropdowns
 * seem to have too little width and so they look weird", and "Home / File /
 * Style dropdown doesn't look good". Both were one declaration —
 * `.tb__sel { max-width: var(--space-9) }`, 48 px — applied to every
 * `<select>` in the program. The export style read "Ved" for "Veda Union /
 * web" and the picture size list had been rewritten shorter to fit the cap.
 *
 * Nothing could have caught it. `check:responsive` asks whether the ribbon
 * fits its strip, which a control clipped to 48 px does better than a correct
 * one; the component tier renders in jsdom, which has no layout at all. A
 * label being cut off is only visible to something that measures a real box.
 *
 * WHAT IT IS ASSERTED AGAINST — not our stylesheet, and not the select's own
 * `scrollWidth`, which for a `<select>` in Chromium reports the box rather
 * than the text. The control is the widest option's text MEASURED IN A CANVAS
 * using the select's own computed font, plus the room a drop-down arrow needs.
 * That number comes from the font rasteriser; nothing in this repository
 * computes it, and it moves if the theme's face or size moves.
 *
 * AND THE CONTROL IS ITSELF CONTROLLED. A measurement whose control does not
 * fail is measuring nothing, so the last check puts the old 48 px cap back on
 * a live select and requires this gate to call it clipped. If that check ever
 * passes, the ruler has stopped reading.
 *
 * Run against the dev server, like the other interaction gates:
 *   npm run dev
 *   node tools/interaction-ribbon.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { browser, page, errors, wait, check, passed, failures } from './_editor-probe.mjs';

console.log('\n── the ribbon\'s controls, measured\n');

/* Chromium's own drop-down arrow, and the gap it wants before the text. A
   select whose content box is exactly its text is a select whose last letter
   sits under the arrow. */
const ARROW = 16;

const pressTab = (label) => page.evaluate((want) => {
  [...document.querySelectorAll('.rbn__tab')].find((t) => t.textContent.trim() === want)?.click();
}, label);
const pressButton = (label) => page.evaluate((want) => {
  [...document.querySelectorAll('.rbb')].find((b) => b.textContent.trim() === want)?.click();
}, label);
const tabNames = () => page.$$eval('.rbn__tab', (bs) => bs.map((b) => b.textContent.trim()));

/**
 * Every dropdown the ribbon is showing, with the room its words need.
 *
 * `widestText` is the control. `content` is what the browser gave it.
 */
const dropdowns = () => page.evaluate((arrow) => {
  const ctx = document.createElement('canvas').getContext('2d');
  return [...document.querySelectorAll('.rbn select')].map((sel) => {
    const cs = getComputedStyle(sel);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const options = [...sel.options].map((o) => o.text);
    const widest = options.reduce(
      (best, o) => (ctx.measureText(o).width > ctx.measureText(best).width ? o : best),
      options[0] ?? '',
    );
    const box = sel.getBoundingClientRect();
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    return {
      name: sel.getAttribute('aria-label') ?? '(unlabelled)',
      box: Math.round(box.width),
      content: Math.round(box.width - padX),
      needs: Math.round(ctx.measureText(widest).width) + arrow,
      widest,
      options: options.length,
      visible: box.width > 0 && box.height > 0,
    };
  });
}, ARROW);

/** The dropdowns of every tab that has any, at the current window width. */
async function sweep() {
  const found = [];
  for (const tab of await tabNames()) {
    await pressTab(tab);
    await wait(220);
    for (const d of await dropdowns()) found.push({ tab, ...d });
  }
  return found;
}

/* ── a picture, so the contextual Picture tab and its two dropdowns exist ── */
mkdirSync('artifacts', { recursive: true });
const PROBE = 'artifacts/ribbon-gate.png';
const png = new PNG({ width: 240, height: 160 });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 90; png.data[i + 1] = 140; png.data[i + 2] = 200; png.data[i + 3] = 255;
}
writeFileSync(PROBE, PNG.sync.write(png));

await pressButton('Write');
await wait(300);
await pressTab('Insert');
await wait(250);
const picker = await page.$('input[type=file]');
if (picker === null) throw new Error('the Insert tab has no file picker');
await picker.uploadFile(PROBE);
await wait(1200);
check('the Picture tab is available to measure', (await tabNames()).includes('Picture'));

/*
 * PAGES VIEW, so the page-size control exists to be measured.
 *
 * It is built only where there are pages (`ctx.paginated` in `Toolbar.tsx`),
 * so a sweep of the flow view finds three dropdowns and reports itself
 * complete — which is how a fourth one could stay unmeasured.
 */
await pressTab('View');
await wait(250);
await pressButton('Pages');
await wait(1400);

/* ── every dropdown, at three window widths ──────────────────────────────── */
const WIDTHS = [1100, 1360, 1920];
const all = [];
for (const width of WIDTHS) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await wait(500);
  for (const d of await sweep()) all.push({ width, ...d });
}

/* Every dropdown the program HAS, not merely every one this run happened to
   walk past. The four are the export style, the picture's size, where its
   caption goes, and the page size; a fifth added without a thought for its
   width would arrive here as a name this gate has never measured. */
const seen = [...new Set(all.filter((d) => d.visible).map((d) => d.name))].sort();
check('all four of the program\'s dropdowns were reached', seen.length === 4, seen.join(' · '));

const shown = all.filter((d) => d.visible);
check('there are dropdowns to measure', shown.length > 0, `${shown.length} renderings`);

const clipped = shown.filter((d) => d.content < d.needs);
check(
  'every dropdown is wide enough for the longest thing it can say',
  clipped.length === 0,
  clipped.length === 0
    ? `${shown.length} renderings, widest need ${Math.max(...shown.map((d) => d.needs))} px`
    : clipped.map((d) => `${d.width}px ${d.tab}/${d.name}: box ${d.content} < needs ${d.needs} ("${d.widest}")`).join('; '),
);

/*
 * A CONTROL THAT IS NOT MERELY UNCAPPED. `max-width: none` would pass the
 * check above and still leave a select free to grow across the whole ribbon,
 * which is the fault the cap was there to prevent. So: capped, but above what
 * the words need.
 */
const runaway = shown.filter((d) => d.box > 420);
check('and none of them has grown without a ceiling', runaway.length === 0,
  runaway.map((d) => `${d.tab}/${d.name} ${d.box}px`).join('; '));

/* Every option a person can pick must be REACHABLE, not just measurable — a
   dropdown with one option is a label wearing a control's clothes. */
const single = shown.filter((d) => d.options < 2);
check('every dropdown offers more than one thing', single.length === 0,
  single.map((d) => `${d.tab}/${d.name}`).join('; '));

/* ── the ruler, checked against a known-bad box ──────────────────────────── */
const control = await page.evaluate((arrow) => {
  const sel = [...document.querySelectorAll('.rbn select')].find((s) => s.getBoundingClientRect().width > 0);
  if (sel === undefined) return null;
  const before = sel.style.maxWidth;
  sel.style.maxWidth = '3rem'; // exactly the cap this gate exists to catch
  const cs = getComputedStyle(sel);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const widest = [...sel.options].reduce(
    (best, o) => (ctx.measureText(o.text).width > ctx.measureText(best).width ? o.text : best),
    sel.options[0]?.text ?? '',
  );
  const box = sel.getBoundingClientRect();
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const verdict = (box.width - padX) < ctx.measureText(widest).width + arrow;
  sel.style.maxWidth = before;
  return { verdict, content: Math.round(box.width - padX), needs: Math.round(ctx.measureText(widest).width) + arrow };
}, ARROW);

check(
  'the ruler reports the old 48 px cap as clipped (if this passes, it is measuring nothing)',
  control !== null && control.verdict,
  control === null ? 'no dropdown to test the ruler on' : `content ${control.content} vs needs ${control.needs}`,
);

await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });
await pressTab('Home');
await wait(300);
await page.screenshot({ path: 'artifacts/ribbon-gate.png', clip: { x: 0, y: 0, width: 1360, height: 200 } });

console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nRIBBON INTERACTION FAILED\n');
  process.exit(1);
}
console.log('\nRIBBON INTERACTION PASSES\n');
