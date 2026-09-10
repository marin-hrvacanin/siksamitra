#!/usr/bin/env node
/**
 * DOES THE PUBLISHED TASK PANE ACTUALLY RENDER?
 *
 *   CHROME=<path> npm run check:word:pane
 *   CHROME=<path> node tools/word-pane.mjs --url https://localhost:3000/taskpane.html
 *
 * THE ONE THING NOTHING ELSE COULD ANSWER. The component test builds the pane
 * into a jsdom, which has no layout engine and no stylesheet; the live gate
 * drives Word but never loads the page; and Word draws a task pane that fails
 * to load as a BLANK WHITE RECTANGLE with no message in it. So the failures
 * this catches are the ones with no symptom anywhere:
 *
 *   - the bundle 404s, because it was built with a root-relative base and the
 *     add-in is served from a folder;
 *   - the stylesheet 404s, so the pane renders as unstyled black-on-white
 *     text with every button full width;
 *   - `tokens.css` did not arrive, so every colour resolves to nothing and
 *     the marking buttons are indistinguishable;
 *   - something in the bundle throws before `build()` runs, and `#root` stays
 *     empty.
 *
 * IT LOADS THE REAL URL by default — the published one, over the internet —
 * because that is the page Word will load. A bundle that works from disk and
 * 404s from the server is exactly the failure this exists for.
 *
 * THE OFFICE HOST IS STUBBED, and only as far as the pane needs. `office.js`
 * from Microsoft's CDN does load (the page asks for it), but it finds no Word
 * around it and never resolves `Office.onReady` — so the stub is installed
 * BEFORE the bundle runs and answers as Word would. What it hands back is a
 * real flat OPC package, built by the add-in's own writer, so the pane shows a
 * real marked paragraph rather than an error.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { mark } from '@siksamitra/format';
import { flatPackage } from '../apps/word-addin/src/model/opc.js';
import { paragraphsXml } from '../apps/word-addin/src/model/paragraph.js';
import { styleSheet, styleSheetFor } from '../apps/word-addin/src/model/sheet.js';
import { ADDIN_HOSTS } from '../scripts/word-addin.mjs';

const OUT = 'artifacts/word-pane';
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const url = flag('url') ?? `${ADDIN_HOSTS.pages.base}/taskpane.html`;

/** A task pane's real width, and a narrow one at that — a person can drag it. */
const WIDTH = Number(flag('width') ?? 320);

/* What the stubbed Word hands back: one marked paragraph, and a document that
   already has the styles. Both built by the add-in's own code. */
const tm = {
  text: 'oṁ agnim īḷe puraḥ',
  marks: [
    mark({ k: 'hold', from: 3, to: 8, v: 'short' }),
    mark({ k: 'svara', from: 13, to: 14, v: 'anudatta' }),
  ],
};
const body = paragraphsXml(tm);
const PARAGRAPH = flatPackage(body, styleSheetFor(body));
const DOCUMENT = flatPackage(body, styleSheet());

const results = [];
const check = (what, got, want) => {
  results.push({ ok: JSON.stringify(got) === JSON.stringify(want), what, got, want });
};

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: browserPath(),
  headless: 'shell',
  args: ['--no-sandbox', '--ignore-certificate-errors'],
});
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: 900, deviceScaleFactor: 2 });

const failures = [];

/**
 * Which of the browser's complaints are the add-in's fault.
 *
 * TWO ARE NOT, and counting them made this gate fail for reasons that have
 * nothing to do with the pane:
 *   - `office.js`, which this gate aborts ITSELF, a few lines below;
 *   - `/favicon.ico`, which a browser asks for unprompted and Word never
 *     does — and which is served from the SITE root, not the add-in's folder.
 * Everything else counts, including any 404 under the add-in's own base, which
 * is the failure the gate is for.
 */
const ours = (url) => !url.startsWith('https://appsforoffice.microsoft.com/')
  && !url.endsWith('/favicon.ico');

page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400 && ours(r.url())) failures.push(`${r.status()} ${r.url()}`);
});

/*
 * OFFICE.JS IS REFUSED, and it has to be.
 *
 * The page asks Microsoft's CDN for it, and it is the real library — so it
 * REPLACES the `window.Office` installed below and then waits forever for a
 * host that is not there. `Office.onReady` never settles, `build()` never
 * runs, and the pane is the blank rectangle this gate exists to catch, for
 * the wrong reason.
 *
 * Refused rather than allowed-and-overwritten because there is nothing it
 * could usefully do here: outside Word it has no bridge. That the page ASKS
 * for it is checked instead — a page that had stopped loading office.js would
 * be a page that cannot work in Word at all.
 */
let askedForOfficeJs = false;
await page.setRequestInterception(true);
page.on('request', (r) => {
  if (r.url().startsWith('https://appsforoffice.microsoft.com/')) {
    askedForOfficeJs = true;
    void r.abort();
    return;
  }
  void r.continue();
});
page.on('requestfailed', (r) => {
  if (ours(r.url())) failures.push(`failed: ${r.url()}`);
});

/*
 * THE STUB, installed before any script on the page runs.
 *
 * `Office.onReady` is what the add-in waits on, and outside Word it never
 * settles. Everything below answers the way the host would, with the two
 * packages node built above.
 */
await page.evaluateOnNewDocument((paragraphPkg, documentPkg) => {
  const loaded = (value) => ({ value, load() {}, });
  const range = () => ({
    load() {}, insertOoxml() {}, getRange: () => range(), expandTo: () => range(),
    getOoxml: () => loaded(paragraphPkg), text: 'agnim',
  });
  const paragraph = () => ({
    ...range(), style: 'Translit', delete() {},
  });
  const context = {
    document: {
      getSelection: () => ({
        ...range(),
        text: 'agnim',
        paragraphs: { getFirst: paragraph, load() {}, items: [paragraph()] },
      }),
      body: {
        getOoxml: () => loaded(documentPkg),
        insertOoxml() {},
        paragraphs: { load() {}, items: [paragraph()] },
      },
    },
    sync: async () => {},
  };
  Object.assign(window, {
    Office: {
      HostType: { Word: 'Word' },
      EventType: { DocumentSelectionChanged: 'sel' },
      context: { document: { addHandlerAsync: () => {} } },
      onReady: (cb) => { setTimeout(() => cb({ host: 'Word' }), 0); },
    },
    Word: {
      InsertLocation: { replace: 'Replace', end: 'End' },
      RangeLocation: { content: 'Content', whole: 'Whole' },
      run: async (fn) => fn(context),
    },
  });
}, PARAGRAPH, DOCUMENT);

console.log(`\n── the task pane at ${WIDTH} px\n\n  ${url}\n`);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
try {
  await page.waitForSelector('#sm-add-styles', { timeout: 20_000 });
} catch {
  const root = await page.evaluate(() => document.getElementById('root')?.innerHTML ?? '(no #root)');
  console.error('\n  the pane did not build. #root held:\n');
  console.error(`    ${root.slice(0, 400)}\n`);
  for (const f of failures) console.error(`    ${f}`);
  await browser.close();
  process.exit(1);
}
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 600));

const seen = await page.evaluate(() => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
  };
  const buttons = [...document.querySelectorAll('button')].map((b) => ({
    label: (b.textContent ?? '').trim(),
    mark: b.getAttribute('data-mark'),
    colour: getComputedStyle(b).color,
    ...box(b),
  }));
  const root = document.getElementById('root');
  return {
    buttons,
    groups: [...document.querySelectorAll('.group h2')].map((h) => (h.textContent ?? '').trim()),
    rootHeight: root === null ? 0 : Math.round(root.getBoundingClientRect().height),
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    paneFont: getComputedStyle(document.body).fontFamily,
    where: (document.querySelector('.where')?.textContent ?? '').trim(),
    whereState: document.querySelector('.where')?.getAttribute('data-state') ?? '',
    document: (document.querySelector('.says')?.textContent ?? '').trim(),
    version: (document.querySelector('.foot span')?.textContent ?? '').trim(),
    /* The widest thing on the page: nothing may be wider than the pane. */
    widest: Math.max(...[...document.querySelectorAll('.pane *')]
      .map((e) => Math.ceil(e.getBoundingClientRect().right))),
  };
});

await page.screenshot({ path: `${OUT}/pane.png`, fullPage: true });

/* ── what it showed ─────────────────────────────────────────────────────── */

check('the pane rendered something', seen.rootHeight > 300, true);
check('every marking group is there',
  seen.groups, ['Holding', 'Svara', 'Aids', 'The rules', 'This document']);
check('the buttons are there', seen.buttons.length >= 12, true);
check('and none of them is invisible', seen.buttons.filter((b) => b.w === 0 || b.h === 0), []);
check('nothing is wider than the pane', seen.widest <= WIDTH, true);

/*
 * THE STYLESHEET ARRIVED, and this is how you can tell: the marking buttons
 * carry the mark's OWN colour out of `tokens.css`. Unstyled, every button is
 * the same inherited ink — which looks like a working pane until you try to
 * tell Short from Anudātta.
 */
const colours = new Set(seen.buttons.filter((b) => b.mark !== null).map((b) => b.colour));
check('the design tokens arrived — the marks are different colours',
  colours.size >= 4, true);
check('and the pane is not on a transparent ground',
  seen.bodyBackground !== 'rgba(0, 0, 0, 0)', true);

/* And it read the stubbed document. */
check('it read the selection',
  /* The STATE, not the words: `locate` resolves Word's character offsets into
     model offsets, and which letters that lands on depends on what the stub
     says the selection is — not on whether the pane read it. An unread
     selection leaves `data-state="none"` and "Put the caret in a line". */
  seen.whereState === 'range' || seen.whereState === 'caret', true);
check('and the document’s styles', seen.document.includes('śikṣāmitra styles'), true);
check('and it says which build it is', /^v\d+\.\d+\.\d+/.test(seen.version), true);
check('nothing 404ed and nothing threw', failures, []);
check('and the page does ask Word for office.js', askedForOfficeJs, true);

for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what.padEnd(52)} ${
    r.ok ? '' : `${JSON.stringify(r.got)} (want ${JSON.stringify(r.want)})`}`);
}
console.log(`\n  ${seen.groups.length} groups, ${seen.buttons.length} buttons, `
  + `${colours.size} mark colours, widest ${seen.widest} px of ${WIDTH}`);
console.log(`  ${seen.document}`);
console.log(`\n  the picture is ${OUT}/pane.png — look at it\n`);

await browser.close();
const bad = results.filter((r) => !r.ok);
if (bad.length > 0) {
  writeFileSync(`${OUT}/seen.json`, `${JSON.stringify(seen, null, 1)}\n`, 'utf8');
  console.error(`WORD PANE GATE FAILS — ${bad.length} of ${results.length}\n`);
  process.exit(1);
}
console.log(`WORD PANE GATE PASSES — ${results.length} checks\n`);
