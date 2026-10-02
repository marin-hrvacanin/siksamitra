/**
 * A MARK IS NOT CUT BY ITS LINE'S CLIP — checked in print, where the clip is.
 *
 * The printed page clips each line to its box and a margin (`export.css`), so
 * a svara cannot be painted on a page its letter left. His report (2026-10-02):
 * "the svaras look just a bit cut off at the top in the export, svarita and
 * dirgha svarita". They were: Chromium drops `overflow-clip-margin: calc(…)`
 * unless a box is named with it, so every line was clipped at its very edge.
 *
 * WHAT THIS COMPARES AGAINST is the same page with the clip taken away: the
 * band across each line's top edge is photographed both ways, and the svara
 * ink in it must be the same. The browser against itself — nothing of ours
 * computes the expectation, so it can fail, and did.
 */

/** His svara colour, `#943634`, and the antialiased pixels around it. */
const isSvara = (r, g, b) => r > 110 && r < 210 && g < 100 && b < 100 && r - g > 50;

/** Svara pixels in a PNG screenshot. */
async function inkOf(png) {
  const { PNG } = await import('pngjs');
  const img = PNG.sync.read(png);
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) if (isSvara(img.data[i], img.data[i + 1], img.data[i + 2])) n += 1;
  return n;
}

/**
 * `{ lines, cut }`: how many lines with a svara were looked at, and each one
 * whose svaras the clip cut, said with how much of their ink was lost.
 */
export async function uncutMarks(browser, html, { most = 8 } = {}) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 900, height: 1300, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMediaType('print');
    await page.evaluate(() => document.fonts.ready);
    const bands = await page.evaluate((most) => [...document.querySelectorAll('.export--page .doc .pada')]
      .filter((p) => p.querySelector('.sv-svarita, .sv-dirgha-svarita') !== null)
      .slice(0, most)
      .map((p) => {
        const r = p.getBoundingClientRect();
        const em = parseFloat(getComputedStyle(p).fontSize);
        return { x: r.left, y: r.top - 0.75 * em, width: r.width, height: 1.05 * em, text: p.textContent.trim().slice(0, 40) };
      }), most);
    const shots = async () => Promise.all(bands.map(async (b) => inkOf(await page.screenshot({ clip: { x: b.x, y: b.y, width: b.width, height: b.height } }))));
    const clipped = await shots();
    await page.addStyleTag({ content: '.export--page .doc .pada { overflow: visible !important; }' });
    const whole = await shots();
    const cut = bands.flatMap((b, i) => (clipped[i] < 0.98 * whole[i]
      ? [`"${b.text}…" kept ${clipped[i]} of ${whole[i]} svara pixels`] : []));
    return { lines: bands.length, cut };
  } finally {
    await page.close();
  }
}
