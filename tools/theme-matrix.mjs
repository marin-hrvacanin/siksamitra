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

const b = await puppeteer.launch({ executablePath: process.env.CHROME, headless: 'shell', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
await p.goto('http://localhost:5273/', { waitUntil: 'networkidle0' });
await p.waitForSelector('[data-block-id]');

const lum = (rgb) => {
  const [r, g, bl] = rgb.match(/\d+/g).slice(0, 3).map(Number);
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
};

const result = await p.evaluate(async () => {
  const { CHROME_IDS, DOCUMENT_IDS, MODES } = await import('/@fs/D:/Projects/siksamitra/packages/tokens/generated/tokens.ts');
  const app = document.querySelector('.app');
  const canvas = document.querySelector('.canvas');
  const out = [];
  for (const chrome of CHROME_IDS) {
    for (const mode of MODES) {
      for (const doc of DOCUMENT_IDS) {
        app.setAttribute('data-chrome', chrome);
        app.setAttribute('data-mode', mode);
        canvas.setAttribute('data-doc', doc);
        const tb = getComputedStyle(document.querySelector('.tb'));
        const page = document.querySelector('.flow__column') ?? canvas;
        const pg = getComputedStyle(page);
        out.push({
          chrome, doc, mode,
          tbBg: tb.backgroundColor, tbInk: tb.color,
          docBg: pg.backgroundColor, docInk: pg.color,
          accent: getComputedStyle(app).getPropertyValue('--chrome-accent').trim(),
        });
      }
    }
  }
  return out;
});

let bad = 0;
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
  if (docContrast < 7) problems.push(`document contrast ${docContrast.toFixed(2)}`);
  if (problems.length > 0) {
    bad += 1;
    console.log(`  FAIL ${r.chrome}/${r.doc}/${r.mode}: ${problems.join('; ')}`);
  }
}
console.log(`\n  ${result.length} combinations checked, ${result.length - bad} ok\n`);
await b.close();
process.exit(bad > 0 ? 1 : 0);
