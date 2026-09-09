#!/usr/bin/env node
/**
 * DOES THE WINDOW SURVIVE BEING PULLED AROUND?
 *
 * The claim the ribbon makes is Word's: one row at any width, groups fold into
 * a labelled button and then into one shared overflow rather than wrapping or
 * scrolling, and nothing ever becomes unreachable. The claim the shell makes is
 * that the document keeps its measure, the panel gets out of the way when there
 * is no room for it, and the window never scrolls sideways.
 *
 * All of that is checkable, and none of it was checked: three separate overflow
 * bugs shipped past the previous version of this file, which inferred the
 * collapse from class names and reported the row as fine while 97px of it hung
 * past the edge. So this one reads the FIT DECISION the hook publishes
 * (`data-fit` on the ribbon body — see `useOverflow`) and compares it against
 * what the browser actually laid out.
 *
 *   npm run dev
 *   CHROME=<path> node tools/responsive.mjs
 */
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { APP_URL, openApp, openTab } from './_ui.mjs';

const WIDTHS = [1920, 1600, 1400, 1200, 1024, 900, 880, 800, 700, 620, 560, 500, 440, 400, 380];
const TABS = ['home', 'marking', 'audio', 'view'];
/** Below this the navigation panel hides itself — see `App.tsx`. */
const NAV_MIN = 880;

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await openApp(page, APP_URL);

const problems = [];
const rows = [];

for (const width of WIDTHS) {
  await page.setViewport({ width, height: 900 });
  /* The fit is measured by a ResizeObserver and re-run when the fonts land, so
     a frame is not enough — this waits for the layout to settle rather than
     racing it, which is what made the old gate's readings arbitrary. */
  await new Promise((r) => setTimeout(r, 320));

  for (const tab of TABS) {
    await openTab(page, tab);
    const seen = await page.evaluate((navMin) => {
      const body = document.querySelector('.rbn__body');
      const fit = JSON.parse(body.dataset.fit ?? '{}');
      /* The DECLARED groups — `[data-group]`. The folded button and the shared
         overflow group are affordances the ribbon adds, not groups the toolbar
         declared, and counting them made the gate report one unreachable group
         at every width where anything collapsed. */
      const groups = document.querySelectorAll('.rbn__body [data-group]').length;
      const canvas = document.querySelector('.canvas');
      const paper = document.querySelector('.flow__column') ?? document.querySelector('.page');
      return {
        /* The row's own overflow — the thing three bugs got wrong. */
        over: Math.round(body.scrollWidth - body.getBoundingClientRect().width),
        rowHeight: Math.round(body.getBoundingClientRect().height),
        visible: fit.visible?.length ?? 0,
        folded: fit.collapsed?.length ?? 0,
        overflow: fit.overflow?.length ?? 0,
        /* Every group is in exactly one of the three states. */
        declared: groups,
        /* The window itself must never scroll sideways. */
        hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        /* The paper must fit the space it is given, at whatever zoom. */
        paperOver: paper === null || canvas === null
          ? 0
          : Math.round(paper.getBoundingClientRect().width - canvas.getBoundingClientRect().width),
        nav: document.querySelector('.nav') !== null,
        navMin,
        status: document.querySelector('.status')?.getBoundingClientRect().height ?? 0,
      };
    }, NAV_MIN);

    const say = (why) => problems.push(`${width}px ${tab}: ${why}`);
    if (seen.over > 0) say(`the ribbon runs ${seen.over}px past the window`);
    if (seen.hScroll) say('the window scrolls sideways');
    if (seen.paperOver > 1) say(`the page is ${seen.paperOver}px wider than the canvas`);
    if (seen.status < 8) say('the status bar has no height');
    /* Nothing may be unreachable: every group is inline, folded, or in the
       overflow popover. */
    const reachable = seen.visible + seen.folded + seen.overflow;
    if (reachable !== seen.declared) {
      say(`${seen.declared} groups but ${reachable} reachable`);
    }
    if (width >= NAV_MIN && !seen.nav) say('the navigation panel is missing where there is room');
    if (width < NAV_MIN && seen.nav) say('the navigation panel is still taking space');

    if (tab === 'view') {
      rows.push(
        `  ${String(width).padStart(5)}  ${String(seen.rowHeight).padStart(4)}  `
        + `${String(seen.visible).padStart(7)}  ${String(seen.folded).padStart(6)}  `
        + `${String(seen.overflow).padStart(8)}  ${seen.nav ? 'panel' : '—    '}`,
      );
    }
  }
}

await browser.close();

console.log('\n── the window at each width (View tab)\n');
console.log('  width  body  inline  folded  overflow  panel');
for (const r of rows) console.log(r);

if (errors.length > 0) problems.push(...errors.map((e) => `console: ${e}`));
if (problems.length > 0) {
  console.error(`\n  RESPONSIVE — ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('');
  process.exit(1);
}
console.log(
  `\n  RESPONSIVE ok — ${WIDTHS.length} widths x ${TABS.length} tabs, `
  + 'no overflow, nothing unreachable, no sideways scroll\n',
);
