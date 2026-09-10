#!/usr/bin/env node
/**
 * WHAT IS ACTUALLY ON A PAGE.
 *
 * Two faults, both of them the page map and the drawn page disagreeing.
 *
 * A VERSE A PAGE BREAK RAN THROUGH WAS DRAWN TWICE. `paginate` splits a verse
 * between its recitation lines and says which lines went where — `lineRange`,
 * `continuesFrom`, `continuesOnto`. Nothing read them: the view filtered
 * blocks by id, and a split verse's id is on both pages. MEASURED before the
 * fix, on the sample document at A4: verse `v-4` on two pages, eight pādas
 * where the verse has four, one below the paper's edge; at Letter the same for
 * `v-7`.
 *
 * AND A PAGE HELD MORE THAN IT COULD. A block's measured height was its border
 * box, which excludes every margin, so the map filled a page with the sum of
 * the boxes and the browser drew the boxes AND the gaps between them.
 * MEASURED: 40 to 101 px unaccounted per page, 16 of 58 A4 pages of Śrī Rudram
 * over the foot of their text column.
 *
 * A VERSE IS NOW KEPT WHOLE unless it cannot fit a page by itself — his
 * `Translit` style's `w:keepLines`, and `break-inside: avoid` in the print
 * sheet. So nothing in the corpus splits any more, and the splitting machinery
 * is tested where a verse taller than the paper can be constructed:
 * `tests/integration/paged-map.test.ts` and
 * `tests/component/paged-slices.test.tsx`. What is left for a real browser is
 * what only a real browser can see — the rectangles.
 *
 * WHAT THIS COMPARES AGAINST, and it is not the program. How many lines a
 * verse has comes from the DOCUMENT'S OWN BYTES — `text.split('\n')`, fetched
 * from `/chants/…json`, which is the format's line separator and is written by
 * nothing on the drawing path. The page map is `@siksamitra/layout`'s, the
 * drawn lines are the view's, and the expected count is the file's: three
 * different things, which is what makes the check able to fail.
 *
 * AND IT MUST NOT BE VACUOUS. Every count below is satisfied by a page that
 * drew nothing, so each is paired with the number it came from and the last
 * two check the totals: that every verse of the file was found, and that the
 * documents really do run to many pages.
 *
 *   npm run dev            # or serve a built bundle
 *   node tools/interaction-pages.mjs
 */
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { openApp, setView } from './_ui.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  ok    ${name}${detail === '' ? '' : `  — ${detail}`}`); return; }
  failures.push(name);
  console.log(`  FAIL  ${name}  ${detail}`);
};

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.setViewport({ width: 1400, height: 950, deviceScaleFactor: 1 });
await openApp(page);
await setView(page, 'Pages');
await page.waitForSelector('.page [data-block-id]');
await wait(1400);

console.log('\n── what is actually on a page\n');

/* ── what the document itself says ──────────────────────────────────────── */
/*
 * Straight out of the served file, and deliberately NOT through the program's
 * reader: a line is a `\n` in the stored text, which is the format's rule, and
 * the number of them is what the page had better draw between them.
 *
 * `items ?? verses` because a composed section stores its verses in `items`
 * and `verses` is rebuilt from those on load — read the wrong one and half the
 * corpus looks empty (rule 11).
 */
const fromFile = (slug) => page.evaluate(async (s) => {
  const doc = await fetch(`/chants/${s}.json`).then((r) => r.json());
  const out = {};
  for (const section of doc.sections ?? []) {
    for (const item of section.items ?? section.verses ?? []) {
      if (item === null || typeof item !== 'object') continue;
      if (item.t !== undefined && item.t !== 'verse') continue;
      if (typeof item.id !== 'string') continue;
      const lines = typeof item.text === 'string'
        ? item.text.split('\n').length
        : (item.tokens ?? []).filter((t) => t.t === 'br').length + 1;
      out[item.id] = { lines, translated: item.translation !== undefined };
    }
  }
  return out;
}, slug);

/** Every page, and what it drew of each verse. */
const drawn = () => page.evaluate(() => {
  const per = {};
  let overflowing = 0;
  let pastPaper = 0;
  let worst = 0;
  const pages = [...document.querySelectorAll('.page')];
  for (const pg of pages) {
    const box = pg.getBoundingClientRect();
    /*
     * THE TEXT COLUMN, not the sheet. The page's padding IS the document's
     * margins, so the column's foot is the sheet's foot less the bottom
     * margin — and that is the line the export honours. Measuring against the
     * sheet let a page overflow its column by the whole bottom margin
     * unnoticed: 25 mm of A4, which is most of the fault.
     */
    const foot = box.bottom - parseFloat(getComputedStyle(pg).paddingBottom);
    for (const el of pg.querySelectorAll('[data-verse]')) {
      const id = el.getAttribute('data-verse');
      const was = per[id] ?? { pages: 0, padas: 0, translations: 0, lines: [] };
      const padas = [...el.querySelectorAll('.pada')];
      per[id] = {
        pages: was.pages + 1,
        padas: was.padas + padas.length,
        translations: was.translations + el.querySelectorAll('.doc__translation').length,
        lines: [...was.lines, ...padas.map((l) => Number(l.getAttribute('data-line')))],
      };
    }
    /* Anything drawn below the column is content a page does not have room
       for. The tolerance is a couple of pixels, for the sub-pixel rounding of
       a zoomed page. */
    for (const el of pg.querySelectorAll('.pada, .doc__translation, .doc__source, .doc__instruction')) {
      const bottom = el.getBoundingClientRect().bottom;
      if (bottom > foot + 2) { overflowing += 1; worst = Math.max(worst, bottom - foot); }
      if (bottom > box.bottom + 1) pastPaper += 1;
    }
  }
  return { per, overflowing, pastPaper, worst: Math.round(worst), pages: pages.length };
});

const setSize = async (id) => {
  await page.evaluate((want) => {
    const el = document.querySelector('[aria-label="Page size"]');
    if (el === null) throw new Error('no page-size control — the View tab has changed');
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    set.call(el, want);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, id);
  await wait(1200);
};

const openDoc = async (title) => {
  await page.evaluate(() => {
    const el = document.querySelector('.rbn__file');
    if (el === null) throw new Error('no File tab');
    el.click();
  });
  await wait(400);
  await page.evaluate((want) => {
    const row = [...document.querySelectorAll('.bs__item')]
      .find((b) => (b.querySelector('.bs__item-name')?.textContent ?? '').trim() === want);
    if (row === undefined) throw new Error(`no library document "${want}"`);
    row.click();
  }, title);
  await wait(2200);
  await page.waitForSelector('.page [data-block-id]');
  await wait(1400);
};

/*
 * TWO DOCUMENTS AND THREE PAGE SIZES. Śrī Rudram is here because it is the one
 * long enough for breaks to fall in interesting places — 64 pages at A4 — and
 * the small document is here because a bug that only shows at scale is usually
 * a bug that shows at three pages too, and it runs in a second.
 */
const SUBJECTS = [
  { title: 'Durgā Sūktam', slug: 'durga-suktam' },
  { title: 'Śrī Rudram', slug: 'sri-rudram' },
];

let versesSeen = 0;
let pagesSeen = 0;
let combinations = 0;

for (const { title, slug } of SUBJECTS) {
  await openDoc(title);
  const truth = await fromFile(slug);
  const names = Object.keys(truth);
  check(`${title} is read from its own file`, names.length > 0, `${names.length} verses`);

  for (const size of ['a4', 'a5', 'letter']) {
    await setSize(size);
    const { per, overflowing, pastPaper, worst, pages } = await drawn();
    const where = `${title} / ${size}`;

    /* Every verse the file has is on some page, exactly once over. */
    const missing = names.filter((id) => per[id] === undefined);
    check(`${where}: every verse is drawn`, missing.length === 0,
      `${pages} pages, missing ${missing.slice(0, 4).join(', ')}`);

    /*
     * THE ONE THIS FILE EXISTS FOR. The lines drawn for a verse, added up over
     * every page it appears on, must be the lines the FILE says it has — no
     * more (drawn twice) and no fewer (a slice lost).
     */
    const wrong = names
      .filter((id) => per[id] !== undefined && per[id].padas !== truth[id].lines)
      .map((id) => `${id}: drew ${per[id].padas} of ${truth[id].lines} on ${per[id].pages} pages`);
    check(`${where}: a split verse is drawn once, not twice`, wrong.length === 0,
      wrong.slice(0, 4).join(' | '));

    /* And each of its lines exactly once — a slice that overlapped its
       neighbour would keep the total right while drawing line 2 twice and
       line 3 never. */
    const repeated = names
      .filter((id) => per[id] !== undefined && new Set(per[id].lines).size !== per[id].lines.length)
      .map((id) => `${id}: ${per[id].lines.join(',')}`);
    check(`${where}: no recitation line is drawn twice`, repeated.length === 0,
      repeated.slice(0, 3).join(' | '));

    /* A translation belongs to the verse once, under its last line. Drawn on
       both halves it is the same sentence twice. */
    const dupTranslation = names
      .filter((id) => per[id] !== undefined
        && per[id].translations !== (truth[id].translated ? 1 : 0))
      .map((id) => `${id}: ${per[id].translations}`);
    check(`${where}: a translation is drawn once`, dupTranslation.length === 0,
      dupTranslation.slice(0, 4).join(' | '));

    /*
     * NOTHING HANGS PAST THE TEXT COLUMN, and this is the check that found the
     * second fault. `paginate` was given each block's border box, which
     * excludes every margin, so it filled a page with the sum of the boxes and
     * the browser drew the boxes AND the gaps between them. Measured: 40 to
     * 101 px unaccounted per page, 16 of 58 A4 pages over their column.
     *
     * Measured against the page's OWN padding — the document's margins — and
     * not against the map, which is the thing under test.
     */
    check(`${where}: nothing is drawn below the text column`, overflowing === 0,
      `${overflowing} elements over, worst by ${worst}px`);
    check(`${where}: and nothing past the edge of the paper`, pastPaper === 0,
      `${pastPaper} elements past the sheet`);

    /*
     * AND NONE OF THEM IS SPLIT. A verse that fits a page is kept whole, which
     * is what Word does with `w:keepLines` and what a printing browser does
     * with `break-inside: avoid`. The view was the only one of the three that
     * split a verse for tidiness — 22 of Śrī Rudram's at A4 — so the three
     * files of one document disagreed about what was on the page.
     */
    const split = names
      .filter((id) => per[id] !== undefined && per[id].pages > 1)
      .map((id) => `${id} on ${per[id].pages} pages`);
    check(`${where}: a verse that fits a page is kept whole`, split.length === 0,
      split.slice(0, 4).join(' | '));

    versesSeen += names.filter((id) => per[id] !== undefined).length;
    pagesSeen += pages;
    combinations += 1;
  }
}

/*
 * THE TWO CONTROLS. Every check above is about what is NOT on a page, and a
 * build that drew nothing at all would pass all of them — which is how a
 * conformance suite here once passed 90 assertions while testing nothing.
 */
check('every verse of both documents was actually examined',
  versesSeen === (9 + 198) * 3, `${versesSeen} of ${(9 + 198) * 3}`);
check('and they ran to real numbers of pages',
  pagesSeen > 200, `${pagesSeen} pages over ${combinations} page sizes`);

console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nPAGES FAILED\n');
  process.exit(1);
}
console.log('\nPAGES PASSES\n');
