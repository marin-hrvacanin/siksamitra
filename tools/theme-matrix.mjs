/**
 * Prove every theme combination actually renders.
 *
 * Six chrome themes x five document themes x two modes is sixty settings, and
 * "it's all just tokens" is a claim until something has visited all sixty. What
 * this catches is the failure mode of a token system: a name that exists in one
 * theme and not another resolves to nothing, and the element renders
 * transparent — invisible rather than wrong, so it survives review.
 *
 * So every combination is visited and asserted to have a resolved background,
 * a resolved ink, and a contrast between them.
 */
import puppeteer from 'puppeteer-core';
import { UI, openApp } from './_ui.mjs';

/* Both from the environment, like every other gate: a hard-coded port works
   until somebody serves the built bundle on a different one, and then reports
   a connection refused against a server that is plainly running. */
const exe = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.URL ?? 'http://localhost:5273/';

const b = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
await openApp(p, URL, { selector: '[data-block-id]' });

const lum = (rgb) => {
  const [r, g, bl] = rgb.match(/\d+/g).slice(0, 3).map(Number);
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
};

/* Read in Node and passed in, not imported through the dev server's own
   file route from an absolute path on one machine — see `doc-fidelity.mjs`. */
const { CHROME_IDS, DOCUMENT_IDS, MODES } = await import('../packages/tokens/generated/tokens.ts');

const result = await p.evaluate(async (sel, CHROME_IDS, MODES, DOCUMENT_IDS) => {
  const app = document.querySelector('.app');
  const canvas = document.querySelector('.canvas');
  const out = [];
  for (const chrome of CHROME_IDS) {
    for (const mode of MODES) {
      for (const doc of DOCUMENT_IDS) {
        app.setAttribute('data-chrome', chrome);
        app.setAttribute('data-mode', mode);
        canvas.setAttribute('data-doc', doc);
        /*
          * `.rbn` is the ribbon. This gate has now asked for three different
          * class names over three rebuilds of the toolbar — `.tb`, then `.rb`,
          * now this — which is exactly why the selectors live in `_ui.mjs` and
          * this one is read from there rather than written again.
          */
        const probe = document.createElement('span');
        probe.style.cssText = 'background:var(--chrome-accent);color:var(--chrome-accent-on)';
        document.body.append(probe);
        const ac = getComputedStyle(probe);
        const accentBg = ac.backgroundColor;
        const accentInk = ac.color;
        probe.remove();
        const tb = getComputedStyle(document.querySelector(sel.ribbon));
        const page = document.querySelector('.flow__column') ?? canvas;
        const pg = getComputedStyle(page);
        out.push({
          accentBg,
          accentInk,
          chrome, doc, mode,
          tbBg: tb.backgroundColor, tbInk: tb.color,
          docBg: pg.backgroundColor, docInk: pg.color,
          accent: getComputedStyle(app).getPropertyValue('--chrome-accent').trim(),
        });
      }
    }
  }
  return out;
}, UI, CHROME_IDS, MODES, DOCUMENT_IDS);

let bad = 0;
/* Reported, not just asserted: a threshold that nothing comes near is a
   threshold nobody can tell is still being measured. */
const tightest = {
  accent: { ratio: Infinity, where: '' },
  chrome: { ratio: Infinity, where: '' },
};
const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent' || c === '';
for (const r of result) {
  const problems = [];
  if (transparent(r.tbBg)) problems.push('toolbar has no background');
  if (transparent(r.docBg)) problems.push('page has no background');
  if (r.accent === '') problems.push('accent unresolved');
  const cBg = lum(r.tbBg), cInk = lum(r.tbInk);
  const chromeContrast = (Math.max(cBg, cInk) + 0.05) / (Math.min(cBg, cInk) + 0.05);
  const dBg = lum(r.docBg), dInk = lum(r.docInk);
  const docContrast = (Math.max(dBg, dInk) + 0.05) / (Math.min(dBg, dInk) + 0.05);
  if (chromeContrast < 4.5) problems.push(`chrome contrast ${chromeContrast.toFixed(2)}`);
  /*
   * TEXT ON THE ACCENT, which nothing measured until the light/dark toggle
   * turned out to be white on a clean saffron at 3.39:1 — the chosen half of
   * a two-way switch, unreadable. It is a small label on a filled control, so
   * it takes the 4.5 that normal text takes.
   */
  const aBg = lum(r.accentBg), aInk = lum(r.accentInk);
  const accentContrast = (Math.max(aBg, aInk) + 0.05) / (Math.min(aBg, aInk) + 0.05);
  if (accentContrast < 4.5) problems.push(`accent contrast ${accentContrast.toFixed(2)}`);
  if (accentContrast < tightest.accent.ratio) {
    tightest.accent = { ratio: accentContrast, where: `${r.chrome}/${r.mode}` };
  }
  if (chromeContrast < tightest.chrome.ratio) {
    tightest.chrome = { ratio: chromeContrast, where: `${r.chrome}/${r.mode}` };
  }
  if (docContrast < 7) problems.push(`document contrast ${docContrast.toFixed(2)}`);
  if (problems.length > 0) {
    bad += 1;
    console.log(`  FAIL ${r.chrome}/${r.doc}/${r.mode}: ${problems.join('; ')}`);
  }
}
console.log(`\n  ${result.length} combinations checked, ${result.length - bad} ok`);
console.log(`  tightest chrome ${tightest.chrome.ratio.toFixed(2)}:1 (${tightest.chrome.where})`);
console.log(`  tightest accent ${tightest.accent.ratio.toFixed(2)}:1 (${tightest.accent.where})\n`);
await b.close();
process.exit(bad > 0 ? 1 : 0);
