/**
 * THE MEASUREMENTS the image gate judges by — of the pixels, and of the page
 * they came from.
 *
 * Separate from the gate because they are two jobs: this one takes readings,
 * the gate decides what a reading means. Which also keeps the gate under the
 * size the module rule allows, which is that rule doing what it is for.
 *
 * Everything here reads through the browser rather than through a library.
 * There is one open already, and a PNG decoder added to read back what that
 * same browser has just written would be two implementations of one thing.
 */

/** What is actually in a PNG. */
export async function analyse(browser, bytes) {
  const page = await browser.newPage();
  try {
    const uri = `data:image/png;base64,${bytes.toString('base64')}`;
    return await page.evaluate(async (src) => {
      const bitmap = await createImageBitmap(await (await fetch(src)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const at = (x, y) => {
        const i = (y * width + x) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
      };
      const key = (p) => `${p[0]},${p[1]},${p[2]},${p[3]}`;

      /*
       * COMPOSITED OVER WHITE before any colour is read, because that is what
       * a reader does with a transparent PNG. Left as-is, the `transparent`
       * style's own ground is (0,0,0,0): its paper had luminance 0, its ink had
       * luminance 0, and the contrast came out 1:1 on an image that reads
       * perfectly well.
       */
      const over = (p) => {
        const a = p[3] / 255;
        return [
          Math.round(p[0] * a + 255 * (1 - a)),
          Math.round(p[1] * a + 255 * (1 - a)),
          Math.round(p[2] * a + 255 * (1 - a)),
        ];
      };

      /* The paper is whatever colour most of the image is. */
      const tally = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const k = over([data[i], data[i + 1], data[i + 2], data[i + 3]]).join(',');
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
      let paper = null;
      let most = 0;
      for (const [k, n] of tally) if (n > most) { most = n; paper = k; }
      const ground = paper.split(',').map(Number);

      const lum = (p) => {
        const c = [p[0], p[1], p[2]].map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const ratio = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);

      /*
       * The FURTHEST pixel from the paper in either direction, not the darkest
       * one. On the dark card the paper IS the darkest thing in the image, so
       * "paper against darkest ink" compared it with itself and reported 1:1
       * for a card that is perfectly legible.
       */
      const paperLum = lum(ground);
      let contrast = 1;
      let different = 0;
      for (let i = 0; i < data.length; i += 4) {
        const p = over([data[i], data[i + 1], data[i + 2], data[i + 3]]);
        contrast = Math.max(contrast, ratio(paperLum, lum(p)));
        if (p.join(',') !== paper) different += 1;
      }

      /*
       * How far the content's left edge moves in over the first forty rows of
       * it. On a rounded corner the top row starts well inside and the edge
       * walks out; on a square one it does not move at all.
       */
      const corner = at(1, 1);
      const leftAt = (y) => {
        for (let x = 0; x < width; x += 1) if (key(at(x, y)) !== key(corner)) return x;
        return -1;
      };
      let top = -1;
      for (let y = 0; y < height && top === -1; y += 1) if (leftAt(y) !== -1) top = y;
      const rounded = top === -1 || top + 40 >= height
        ? 0
        : leftAt(top) - leftAt(top + 40);

      return {
        width,
        height,
        corner,
        ground,
        contrast,
        inked: different / (data.length / 4),
        rounded,
      };
    }, uri);
  } finally {
    await page.close();
  }
}

/**
 * The exported Veda Union page, measured against his file.
 *
 * In POINTS, because that is the unit his document is written in and the unit
 * `WORD_PARAGRAPHS` records. The conversion is the one `doc-fidelity.mjs` uses
 * on the live app: pixels over the root size, times twelve.
 */
export async function fidelity(browser, html) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1200, height: 900 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return await page.evaluate(() => {
      const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const pt = (px) => Math.round((Number.parseFloat(px) / root) * 12 * 1000) / 1000;
      const of = (sel) => {
        const el = document.querySelector(sel);
        if (el === null) return null;
        const cs = getComputedStyle(el);
        const size = pt(cs.fontSize);
        return {
          size,
          lead: Math.round((pt(cs.lineHeight) / size) * 1000) / 1000,
          family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
          bold: Number(cs.fontWeight) >= 600,
          indent: pt(cs.marginLeft),
          right: pt(cs.marginRight),
          italic: cs.fontStyle === 'italic',
        };
      };
      return {
        first: of('.flow__column .pada[data-line="0"]'),
        cont: of('.flow__column .verse .pada[data-line="1"]'),
        translation: of('.flow__column .doc__translation'),
        counts: {
          verses: document.querySelectorAll('.flow__column .verse').length,
          translations: document.querySelectorAll('.flow__column .doc__translation').length,
          numbers: [...document.querySelectorAll('.flow__column .verse__n')]
            .filter((e) => getComputedStyle(e).display !== 'none').length,
        },
      };
    });
  } finally {
    await page.close();
  }
}

/**
 * The same measurements, of the SVG form.
 *
 * Shown in an `<img>`, which is how anyone will open the file, and then
 * PHOTOGRAPHED rather than read off a canvas. Two things went wrong before
 * this: `createImageBitmap` refused a 1.2 MB SVG data URI outright, and a blob
 * URL drawn into a canvas from an `about:blank` page tainted it, so
 * `getImageData` threw a SecurityError. A screenshot has neither problem and
 * goes through `analyse`, so the SVG and the PNG are judged by exactly the same
 * numbers — which is the point: they are two forms of one picture and any
 * difference between them is a bug in one of them.
 */
export async function analyseSvg(browser, text) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><body style="margin:0">', { waitUntil: 'load' });
    const shown = await page.evaluate(async (svg) => {
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const error = parsed.querySelector('parsererror');
      if (error !== null) {
        return { ok: false, why: error.textContent.replace(/\s+/g, ' ').slice(0, 140) };
      }
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image();
      img.src = url;
      document.body.append(img);
      await img.decode();
      return { ok: true, width: img.naturalWidth, height: img.naturalHeight };
    }, text);
    if (!shown.ok) return shown;
    await page.setViewport({ width: shown.width, height: shown.height });
    /* `omitBackground`, so a transparent SVG comes back transparent. Without
       it the browser composites the picture over the page's own ground, which
       in a headless shell is #121212 — and the check below then reported that
       the transparent style's paper had gone black. */
    const shot = await (await page.$('img')).screenshot({ omitBackground: true });
    return { ...shown, seen: await analyse(browser, Buffer.from(shot)) };
  } finally {
    await page.close();
  }
}
