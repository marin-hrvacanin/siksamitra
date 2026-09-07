/**
 * Does the ribbon behave like Word's at every width?
 *
 * The claim is: one row at any size, groups collapse into the overflow button
 * rather than wrapping or scrolling, and nothing becomes unreachable. That is
 * three assertions per width, and the only way to know is to resize a real
 * window and look.
 */
import puppeteer from 'puppeteer-core';

const WIDTHS = [1920, 1600, 1400, 1200, 1024, 900, 800, 700, 600, 520, 440, 380];
const b = await puppeteer.launch({ executablePath: process.env.CHROME, headless: 'shell', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://localhost:5273/', { waitUntil: 'networkidle0' });
await p.waitForSelector('.rb');

let bad = 0;
console.log('\n── ribbon at each width\n');
console.log('  width  rows  visible  collapsed  overflow  h-scroll');
for (const w of WIDTHS) {
  await p.setViewport({ width: w, height: 900 });
  await new Promise((r) => setTimeout(r, 260));
  const m = await p.evaluate(() => {
    const rb = document.querySelector('.rb');
    const groups = [...document.querySelectorAll('.rb__grp')];
    const shown = groups.filter((g) => !g.classList.contains('is-collapsed'));
    // WRAPPING is a group starting BELOW another group's bottom. Counting
    // distinct `top` values is wrong: the groups have different heights and are
    // centre-aligned, so their tops legitimately differ within one row — that
    // read every width as two rows.
    const boxes = shown.map((g) => g.getBoundingClientRect()).sort((a, z) => a.top - z.top);
    let rows = boxes.length === 0 ? 0 : 1;
    let rowBottom = boxes[0]?.bottom ?? 0;
    for (const box of boxes.slice(1)) {
      if (box.top >= rowBottom - 1) { rows += 1; rowBottom = box.bottom; }
      else rowBottom = Math.max(rowBottom, box.bottom);
    }
    return {
      rbH: Math.round(rb.getBoundingClientRect().height),
      rows,
      visible: shown.length,
      collapsed: groups.length - shown.length,
      overflow: document.querySelector('.rb__more') !== null,
      // The page must never scroll sideways.
      docScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rowScroll: (() => { const r = document.querySelector('.rb__row'); return r.scrollWidth > r.clientWidth + 1; })(),
    };
  });
  const problems = [];
  if (m.rows > 1) problems.push('ribbon wrapped to multiple rows');
  if (m.docScroll) problems.push('document scrolls horizontally');
  // The ribbon's own row, too. It was measured and printed and NOT checked,
  // which is a gate reporting a fault it does not fail on.
  if (m.rowScroll) problems.push('the ribbon row scrolls horizontally');
  if (m.collapsed > 0 && !m.overflow) problems.push('groups collapsed with no overflow button');
  if (m.collapsed === 0 && m.visible === 0) problems.push('no groups at all');
  if (problems.length > 0) bad += 1;
  console.log(`  ${String(w).padStart(5)}  ${m.rows}     ${String(m.visible).padStart(2)}       ${String(m.collapsed).padStart(2)}        ${m.overflow ? 'yes' : 'no '}       ${m.rowScroll ? 'YES' : 'no'}`
    + (problems.length ? `   ${problems.join('; ')}` : ''));
}
console.log(`\n  ${WIDTHS.length} widths, ${WIDTHS.length - bad} ok\n`);
await b.close();
process.exit(bad > 0 ? 1 : 0);
