/**
 * WHAT MAKES A LINE TALLER THAN ITS STYLE — asked of the browser, not guessed.
 *
 * Opens an exported page in print emulation and, for each mantra line, reports
 * its height against the height its style says, and the inline element whose
 * box reaches furthest outside the line's own: the one making it taller.
 *
 *   node tools/fidelity/line-boxes.mjs out/fid/sadhana-veda-union.html [n]
 */
import { readFileSync } from 'node:fs';
import { launch } from '../_browser.mjs';

const [file, n = '12'] = process.argv.slice(2);
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.emulateMediaType('print');
  await page.setContent(readFileSync(file, 'utf8'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const rows = await page.evaluate((limit) => {
    const px = 0.75;
    const out = [];
    for (const line of [...document.querySelectorAll('.doc .pada')].slice(0, limit)) {
      const box = line.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(line).lineHeight);
      let worst = { what: '', above: 0, below: 0 };
      for (const el of line.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.height === 0 && r.width === 0) continue;
        const above = box.top - r.top;
        const below = r.bottom - box.bottom;
        if (Math.max(above, below) > Math.max(worst.above, worst.below)) {
          worst = { what: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.slice(0, 8)}"`, above, below };
        }
      }
      out.push(`${(box.height * px).toFixed(2)}pt (style ${(lh * px).toFixed(2)}pt) ${line.textContent.slice(0, 30)} | reaching out: ${worst.what} above ${(worst.above * px).toFixed(2)} below ${(worst.below * px).toFixed(2)}`);
    }
    return out;
  }, Number(n));
  for (const r of rows) console.log(r);
} finally {
  await browser.close();
}
