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
 * IT LOADS THE REAL URL by default â€” the published one, over the internet â€”
 * because that is the page Word will load. A bundle that works from disk and
 * 404s from the server is exactly the failure this exists for.
 *
 * THE OFFICE HOST IS STUBBED, and only as far as the pane needs. `office.js`
 * from Microsoft's CDN does load (the page asks for it), but it finds no Word
 * around it and never resolves `Office.onReady` â€” so the stub is installed
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

/** A task pane's real width, and a narrow one at that â€” a person can drag it. */
const WIDTH = Number(flag('width') ?? 320);

/* What the stubbed Word hands back: one marked paragraph, and a document that
   already has the styles. Both built by the add-in's own code. */
const tm = {
  text: 'oáą agnim Ä«á¸·e puraá¸Ą',
  marks: [
    mark({ k: 'hold', from: 3, to: 8, v: 'short' }),
    mark({ k: 'svara', from: 13, to: 14, v: 'anudatta' }),
  ],
};
const body = paragraphsXml(tm);
const PARAGRAPH = flatPackage(body, styleSheetFor(body));
const DOCUMENT = flatPackage(body, styleSheet());

/*
 * THE MATRIX. The pane is looked at at every width a person can drag it to,
 * in every theme Word can be in, because that is where it used to fail: light
 * inside a dark Word. Each case is a fresh page, with Word's own theme stubbed
 * the way Word on the web reports it (`Office.context.officeTheme`, measured:
 * #1B1A19 in dark), plus Windows high contrast.
 */
const THEMES = {
  light: { bodyBackgroundColor: '#FFFFFF' },
  dark: { bodyBackgroundColor: '#1B1A19' },
};
const WIDTHS = flag('width') === undefined ? [300, 320, 400, 600] : [WIDTH];
const CONTRAST = 4.5;

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

const ours = (u) => !u.startsWith('https://appsforoffice.microsoft.com/')
  && !u.endsWith('/favicon.ico');

/** Everything measured inside the page, for one case. */
function measure(limit) {
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
  /* Every element that draws text of its own, and its contrast against what
     is actually behind it. A disabled control is allowed 3:1 (WCAG exempts
     it; 3:1 keeps it readable). */
  const poor = [];
  for (const el of document.querySelectorAll('.pane *')) {
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
  const buttons = [...document.querySelectorAll('.pane button')].map((b) => {
    const r = b.getBoundingClientRect();
    return {
      label: (b.textContent ?? '').trim(), w: Math.round(r.width), h: Math.round(r.height),
      icon: b.querySelector('svg') !== null, title: b.title,
    };
  });
  return {
    mode: document.querySelector('.pane')?.getAttribute('data-mode'),
    groups: [...document.querySelectorAll('.pane .grp__label')].map((h) => h.textContent.trim()),
    buttons,
    poor,
    where: document.querySelector('.where')?.getAttribute('data-state') ?? '',
    version: (document.querySelector('.pane__foot span')?.textContent ?? '').trim(),
    widest: Math.max(...[...document.querySelectorAll('.pane *')]
      .map((e) => Math.ceil(e.getBoundingClientRect().right))),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    /* No control lies on another — measured, because a ribbon button that
       wrapped out of its group once sat on top of the Register box and every
       other check passed. */
    overlaps: (() => {
      const els = [...document.querySelectorAll('.pane button, .pane select, .pane summary, .pane .grp__label')]
        .map((e) => ({ n: (e.textContent ?? '').trim().slice(0, 20), r: e.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0 && x.r.height > 0);
      const out = [];
      for (let i = 0; i < els.length; i += 1) {
        for (let j = i + 1; j < els.length; j += 1) {
          const a = els[i].r; const b = els[j].r;
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 1 && h > 1) out.push(`${els[i].n} × ${els[j].n}`);
        }
      }
      return out;
    })(),
    /* Nothing sticks out of the group frame that holds it. */
    escaped: [...document.querySelectorAll('.pane .grp')].flatMap((g) => {
      const f = g.getBoundingClientRect();
      return [...g.querySelectorAll('button')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.bottom > f.bottom + 1 || r.top < f.top - 1 || r.right > f.right + 1 || r.left < f.left - 1;
      }).map((b) => (b.textContent ?? '').trim());
    }),
    unlabelled: [...document.querySelectorAll('.pane button, .pane select, .pane input')]
      .filter((e) => (e.textContent ?? '').trim() === '' && e.closest('label') === null
        && !e.getAttribute('aria-label')).length,
  };
}

async function look(width, themeName, forced) {
  const theme = THEMES[themeName];
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  /* Puppeteer's helper refuses forced-colors; the protocol itself does not. */
  if (forced) {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
  }
  const failures = [];
  let askedForOfficeJs = false;
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && ours(r.url())) failures.push(`${r.status()} ${r.url()}`);
  });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.url().startsWith('https://appsforoffice.microsoft.com/')) {
      askedForOfficeJs = true;
      void r.abort();
      return;
    }
    void r.continue();
  });
  page.on('requestfailed', (r) => { if (ours(r.url())) failures.push(`failed: ${r.url()}`); });

  await page.evaluateOnNewDocument((paragraphPkg, documentPkg, theme) => {
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
      context: { document: { addHandlerAsync: () => {} }, officeTheme: theme },
      onReady: (cb) => { setTimeout(() => cb({ host: 'Word' }), 0); },
    },
    Word: {
      InsertLocation: { replace: 'Replace', end: 'End' },
      RangeLocation: { content: 'Content', whole: 'Whole' },
      run: async (fn) => fn(context),
    },
  });
}, PARAGRAPH, DOCUMENT, theme);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  try {
    await page.waitForSelector('.pane .grp', { timeout: 20_000 });
  } catch {
    const root = await page.evaluate(() => document.getElementById('root')?.innerHTML ?? '(no #root)');
    console.error(`\n  the pane did not build at ${width} px ${themeName}. #root held:\n    ${root.slice(0, 400)}\n`);
    for (const f of failures) console.error(`    ${f}`);
    await browser.close();
    process.exit(1);
  }
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  /* Open what is folded, so it is measured too. */
  await page.evaluate(() => { const d = document.querySelector('details.rules'); if (d) d.open = true; });
  await new Promise((r) => setTimeout(r, 200));
  const seen = await page.evaluate(measure, CONTRAST);

  /* Hover a disabled button: its tooltip must say why. */
  const target = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.pane button')].find((x) => x.disabled && x.dataset.why);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, why: b.dataset.why };
  });
  let tipSaid = null;
  if (target !== null) {
    await page.mouse.move(target.x, target.y);
    await new Promise((r) => setTimeout(r, 700));
    tipSaid = await page.evaluate(() => document.querySelector('[role="tooltip"]')?.textContent ?? null);
  }

  const name = `${width}-${forced ? 'contrast' : themeName}`;
  await page.screenshot({ path: `${OUT}/pane-${name}.png`, fullPage: true });
  const at = ` â€” ${name}`;
  check(`follows Word's theme${at}`, forced || seen.mode === themeName, true);
  check(`every group is there${at}`, seen.groups, ['Holding', 'Svara', 'Aids']);
  check(`every button has its icon${at}`, seen.buttons.filter((b) => !b.icon).map((b) => b.label), []);
  check(`none is invisible${at}`, seen.buttons.filter((b) => b.w === 0 || b.h === 0).map((b) => b.label), []);
  check(`every tooltip is ours, not the browser's${at}`,
    seen.buttons.filter((b) => b.title !== '').map((b) => b.label), []);
  check(`nothing wider than the pane, no sideways scroll${at}`, seen.widest <= width && !seen.sideways, true);
  check(`every control has a label${at}`, seen.unlabelled, 0);
  check(`no control lies on another${at}`, seen.overlaps, []);
  check(`no button escapes its group${at}`, seen.escaped, []);
  if (!forced) check(`every text is legible, ${CONTRAST}:1 or better${at}`, seen.poor, []);
  check(`a disabled button's tooltip says why${at}`,
    target === null || (tipSaid ?? '').includes(target.why), true);
  check(`it read the selection${at}`, seen.where === 'range' || seen.where === 'caret', true);
  check(`it says which build it is${at}`, /^v\d+\.\d+\.\d+/.test(seen.version), true);
  check(`nothing 404ed and nothing threw${at}`, failures, []);
  check(`it asks Word for office.js${at}`, askedForOfficeJs, true);
  await page.close();
  return seen;
}

console.log(`\nâ”€â”€ the task pane\n\n  ${url}\n`);
let last;
for (const width of WIDTHS) {
  for (const t of Object.keys(THEMES)) last = await look(width, t, false);
}
await look(WIDTHS[0], 'light', true);
await browser.close();

for (const r of results) {
  if (!r.ok || argv.includes('--all')) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what.padEnd(62)} ${
      r.ok ? '' : `${JSON.stringify(r.got)} (want ${JSON.stringify(r.want)})`}`);
  }
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n  ${results.length} checks over ${WIDTHS.length} widths Ă— light, dark, and high contrast; ${bad} failed`);
console.log(`  ${last.groups.length} groups, ${last.buttons.length} buttons`);
console.log(`  the pictures are ${OUT}/pane-*.png â€” look at them\n`);
if (bad > 0) process.exit(1);
console.log(`WORD PANE GATE PASSES â€” ${results.length} checks`);
