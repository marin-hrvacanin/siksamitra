#!/usr/bin/env node
/**
 * DO THE PUBLISHED PAGES ACTUALLY RENDER — Settings and both dialogs?
 *
 *   CHROME=<path> npm run check:word:pane
 *   CHROME=<path> node tools/word-pane.mjs --base https://localhost:3000
 *
 * THE ONE THING NOTHING ELSE CAN ANSWER. The component tests build these
 * pages into a jsdom, which has no layout engine and no stylesheet; the live
 * gate drives Word but never loads them; and Word draws a page that fails to
 * load as a BLANK WHITE RECTANGLE with no message in it. So this loads the
 * three pages Word loads — `taskpane.html` (the Settings panel), `said.html`
 * (a message, and a question) and `type.html` (the typing help) — in a real
 * browser, at the sizes Word gives them, in Word's light and dark themes and
 * in Windows high contrast, and measures what a person would see:
 *
 *   - it built at all, nothing 404ed, nothing threw, and office.js was asked for;
 *   - every text is legible against what is actually behind it;
 *   - nothing is wider than the window, and no control lies on another;
 *   - every control has a label, and every dialog button its words;
 *   - the faces the page names are the ones that drew it.
 *
 * IT LOADS THE PUBLISHED URL by default — the pages Word will load, over the
 * internet — because a bundle that works from disk and 404s from the server is
 * exactly the failure this exists for. `--base` points it at a local build.
 *
 * THE OFFICE HOST IS STUBBED, only as far as the pages need: `office.js` from
 * the CDN finds no Word around it and never resolves `Office.onReady`, so the
 * stub is installed before the bundle runs and answers as Word would.
 *
 * The pictures go to `artifacts/word-pane/` — LOOK at them.
 */
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { flatPackage } from '../apps/word-addin/src/model/opc.js';
import { styleSheet } from '../apps/word-addin/src/model/sheet.js';
import { ADDIN_HOSTS } from '../scripts/word-addin.mjs';
import { DIALOG_SIZE } from '../apps/word-addin/src/word/dialog.js';

const OUT = 'artifacts/word-pane';
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const base = (flag('base') ?? ADDIN_HOSTS.pages.base).replace(/\/$/, '');

/* A document that already has every style, built by the add-in's own code. */
const DOCUMENT = flatPackage('<w:p><w:r><w:t>agnim</w:t></w:r></w:p>', styleSheet());

const THEMES = {
  light: { bodyBackgroundColor: '#FFFFFF' },
  dark: { bodyBackgroundColor: '#1B1A19' },
};
const CONTRAST = 4.5;

/*
 * THE PAGES, at the sizes Word gives them. Settings is a side panel a person
 * drags between about 300 and 600 px. The dialogs are sized in PERCENT of the
 * screen, by `DIALOG_SIZE` in `word/dialog.ts` — measured here on a 1366 × 768
 * laptop, the smallest screen they must fit, and on a 1920 × 1080 one.
 */
const q = (o) => new URLSearchParams(o).toString();
const sized = (pct, sw, sh) => ({ width: Math.round((sw * pct.width) / 100), height: Math.round((sh * pct.height) / 100) });
const PAGES = [
  ...[300, 360, 600].map((w) => ({ name: `settings-${w}`, path: 'taskpane.html', width: w, height: 900, root: '.set' })),
  ...[[1366, 768], [1920, 1080]].flatMap(([sw, sh]) => [
    {
      name: `said-warn-${sw}`, ...sized(DIALOG_SIZE.said, sw, sh), root: '.dlg',
      path: `said.html?${q({ text: 'Nothing to mark: the caret is not after a letter.', kind: 'warn', lines: JSON.stringify(['Type the letter first, or select the letters, and press again.']) })}`,
    },
    {
      name: `said-ask-${sw}`, ...sized(DIALOG_SIZE.said, sw, sh), root: '.dlg',
      path: `said.html?${q({ text: 'Write the whole document in Devanāgarī?', kind: 'ask', yes: 'Write it', lines: JSON.stringify(['Every mantra line is rewritten in Devanāgarī, with every mark kept. Headings and translations stay as they are.']) })}`,
    },
    { name: `type-${sw}`, path: 'type.html', ...sized(DIALOG_SIZE.type, sw, sh), root: '.dlg' },
  ]),
];

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

const ours = (u) => !u.startsWith('https://appsforoffice.microsoft.com/') && !u.endsWith('/favicon.ico');

/** Everything measured inside the page, for one case. */
function measure([rootSel, limit]) {
  const rgb = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => [r, g, b]
    .map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ground = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c;
    }
    return [255, 255, 255];
  };
  const root = document.querySelector(rootSel);
  const all = root === null ? [] : [root, ...root.querySelectorAll('*')];
  const poor = [];
  for (const el of all) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
    if (!own || el.getClientRects().length === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const fg = lum(rgb(cs.color));
    const bg = lum(ground(el));
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    const disabled = el.closest('button:disabled') !== null;
    if (ratio < (disabled ? 3 : limit)) poor.push(`${el.textContent.trim().slice(0, 30)} ${ratio.toFixed(2)}`);
  }
  const controls = [...(root?.querySelectorAll('button, input, select, a') ?? [])];
  const boxes = controls.map((e) => ({ n: (e.textContent ?? '').trim().slice(0, 20), r: e.getBoundingClientRect() }))
    .filter((x) => x.r.width > 0 && x.r.height > 0);
  const overlaps = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i].r; const b = boxes[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1 && h > 1) overlaps.push(`${boxes[i].n} × ${boxes[j].n}`);
    }
  }
  /* The faces that actually drew: every family a text element asks for that
     the document has loaded. A family asked for and not loaded falls back to
     whatever the machine has, which is the failure. */
  const asked = new Set(all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''))
    .map((e) => getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')));
  const loaded = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/^["']|["']$/g, '')));
  return {
    built: root !== null,
    mode: root?.getAttribute('data-mode') ?? null,
    poor,
    overlaps,
    widest: Math.max(0, ...all.map((e) => Math.ceil(e.getBoundingClientRect().right))),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    tall: document.documentElement.scrollHeight > window.innerHeight + 1,
    /* An icon draws in its element's colour (`currentColor`): one that drew
       black on a dark dialog was invisible, and no text check can see it. */
    blackIcons: [...(root?.querySelectorAll('svg') ?? [])]
      .filter((g) => getComputedStyle(g).fill !== getComputedStyle(g).color).length,
    unlabelled: controls.filter((e) => (e.textContent ?? '').trim() === '' && e.closest('label') === null
      && !e.getAttribute('aria-label')).length,
    buttons: [...(root?.querySelectorAll('button') ?? [])].map((b) => (b.textContent ?? '').trim()).filter((t) => t.length < 40),
    unloadedFaces: [...asked].filter((f) => !loaded.has(f) && !/^(system-ui|sans-serif|serif|monospace)$/i.test(f)),
    version: (document.querySelector('.set__foot span')?.textContent ?? '').trim(),
  };
}

async function look(pg, themeName, forced) {
  const page = await browser.newPage();
  await page.setViewport({ width: pg.width, height: pg.height, deviceScaleFactor: 2 });
  if (forced) {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
  }
  const failures = [];
  let askedForOfficeJs = false;
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && ours(r.url())) failures.push(`${r.status()} ${r.url()}`); });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.url().startsWith('https://appsforoffice.microsoft.com/')) { askedForOfficeJs = true; void r.abort(); return; }
    void r.continue();
  });
  page.on('requestfailed', (r) => { if (ours(r.url())) failures.push(`failed: ${r.url()}`); });

  await page.evaluateOnNewDocument((documentPkg, theme) => {
    const loaded = (value) => ({ value, load() {} });
    const control = { isNullObject: true, tag: '', load() {} };
    const paragraph = () => ({ load() {}, parentContentControlOrNullObject: control });
    const context = {
      document: {
        getSelection: () => ({ paragraphs: { getFirst: paragraph, load() {}, items: [paragraph()] } }),
        body: { getOoxml: () => loaded(documentPkg), paragraphs: { load() {}, items: [] } },
        getStyles: () => ({ getByNameOrNullObject: () => ({ isNullObject: true, load() {} }) }),
      },
      sync: async () => {},
    };
    const settings = new Map();
    Object.assign(window, {
      Office: {
        HostType: { Word: 'Word' },
        EventType: { DocumentSelectionChanged: 'sel', DialogMessageReceived: 'm', DialogEventReceived: 'e' },
        context: {
          document: {
            addHandlerAsync: () => {}, removeHandlerAsync: () => {},
            settings: { get: (k) => settings.get(k) ?? null, set: (k, v) => settings.set(k, v), saveAsync: (d) => d() },
          },
          officeTheme: theme,
          requirements: { isSetSupported: () => true },
          ui: { messageParent: () => {} },
        },
        addin: { onVisibilityModeChanged: () => {}, showAsTaskpane: async () => {} },
        actions: { associate: () => {} },
        onReady: (cb) => { setTimeout(() => cb({ host: 'Word' }), 0); },
      },
      Word: { run: async (fn) => fn(context) },
    });
  }, DOCUMENT, THEMES[themeName]);

  const url = `${base}/${pg.path}`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  try {
    await page.waitForSelector(pg.root, { timeout: 20_000 });
  } catch {
    const root = await page.evaluate(() => document.body.innerHTML.slice(0, 400));
    console.error(`\n  ${pg.name} did not build (${themeName}). The body held:\n    ${root}\n`);
    for (const f of failures) console.error(`    ${f}`);
    await browser.close();
    process.exit(1);
  }
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 500));
  const seen = await page.evaluate(measure, [pg.root, CONTRAST]);
  const name = `${pg.name}-${forced ? 'contrast' : themeName}`;
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: pg.name.startsWith('settings') });
  const at = ` — ${name}`;
  check(`it built${at}`, seen.built, true);
  check(`follows Word's theme${at}`, forced || seen.mode === themeName, true);
  check(`nothing wider than the window, no sideways scroll${at}`, seen.widest <= pg.width && !seen.sideways, true);
  check(`every control has a label${at}`, seen.unlabelled, 0);
  check(`every icon draws in its own colour${at}`, seen.blackIcons, 0);
  if (!pg.name.startsWith('settings')) check(`it fits its window with no scrollbar${at}`, seen.tall, false);
  check(`no control lies on another${at}`, seen.overlaps, []);
  if (!forced) check(`every text is legible, ${CONTRAST}:1 or better${at}`, seen.poor, []);
  check(`every face it asks for is the one that drew it${at}`, seen.unloadedFaces, []);
  check(`nothing 404ed and nothing threw${at}`, failures, []);
  check(`it asks Word for office.js${at}`, askedForOfficeJs, true);
  if (pg.name.startsWith('settings')) check(`it says which build it is${at}`, /^v\d+\.\d+\.\d+/.test(seen.version), true);
  if (pg.name.startsWith('said-warn')) check(`a message has one OK${at}`, seen.buttons, ['OK']);
  if (pg.name.startsWith('said-ask')) check(`a question offers Cancel and its yes${at}`, seen.buttons, ['Cancel', 'Write it']);
  await page.close();
}

console.log(`\n── the published pages\n\n  ${base}\n`);
for (const pg of PAGES) {
  for (const t of Object.keys(THEMES)) await look(pg, t, false);
  await look(pg, 'light', true);
}
await browser.close();

for (const r of results) {
  if (!r.ok || argv.includes('--all')) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what.padEnd(70)} ${
      r.ok ? '' : `${JSON.stringify(r.got)} (want ${JSON.stringify(r.want)})`}`);
  }
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n  ${results.length} checks over ${PAGES.length} pages × light, dark, and high contrast; ${bad} failed`);
console.log(`  the pictures are ${OUT}/*.png — look at them\n`);
if (bad > 0) process.exit(1);
console.log(`WORD PAGES GATE PASSES — ${results.length} checks`);
