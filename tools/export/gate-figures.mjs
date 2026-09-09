#!/usr/bin/env node
/**
 * THE PICTURE GATE — does a picture survive every view, every export and the
 * round trip, and does it stay off the network?
 *
 * OWNER'S REQUIREMENT: images in documents, "exactly the functionality of
 * Microsoft Word", working in every view and every export.
 *
 * FIVE THINGS ARE CHECKED, and each answers a different way of being wrong:
 *
 *   1. THE BYTES COME BACK. A document with an embedded picture is exported and
 *      read again, and the recovered `src` is compared with the one that went
 *      in — character for character, and then decoded and compared with the
 *      original PNG byte for byte. A picture that survives as a slightly
 *      different string is a picture that has been re-encoded by something.
 *   2. NOTHING IS FETCHED. The exported file must contain no URL that is not a
 *      `data:` one. This is the same rule `gate-html.mjs` holds the page to and
 *      the reason the renderer resolves nothing but the bytes: an `<img
 *      src="/figures/…">` in a file someone was sent is a hole.
 *   3. A PICTURE THE DOCUMENT DOES NOT CARRY SAYS SO. The pūjā manual names 22
 *      PNGs that live on the platform. Exported from here they must draw as the
 *      placeholder carrying their alt text — not as nothing, and not as a
 *      broken image.
 *   4. IT IS ACTUALLY THERE, IN PIXELS. The picture is a solid colour, the page
 *      is rasterised, and the most common colour in the resulting PNG is read
 *      back. A file existing is not a picture rendering, and an `<img>` whose
 *      `src` never decoded is still valid markup.
 *   5. A FLOAT DOES NOT BREAK A PĀDA, measured WITH THE CONTROL. A `medium`
 *      picture is floated beside Durgā Sūktam and the pādas level with it are
 *      measured twice: as the stylesheet ships, and again with `clear: none`
 *      injected. The rule is only worth having if the control shows the fault
 *      it prevents, so the gate fails if the control does NOT wrap a line.
 *   6. A PICTURE ALWAYS FITS A PAGE. A 300x4000 picture is put in at full
 *      width and its drawn height compared with the page's content box, which
 *      comes from `@siksamitra/layout` rather than from the stylesheet under
 *      test. Without the cap it measured 8 063 px on a 934 px page.
 *   7. THE CORPUS IS SOUND. `documentFigureFaults` over all eleven documents:
 *      every figure has alternative text, a legal size and a reserved box.
 *
 *   npm run check:export:figures
 *   CHROME=<path to chrome or edge> npm run check:export:figures
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { canonicalJson, documentFigureFaults, figuresOf } from '@siksamitra/format';
import { importHtml } from '@siksamitra/interop';
import { DEFAULT_PAGE, contentBox, pageGeometry } from '@siksamitra/layout';
import { buildPage, loadDoc } from './page.mjs';
import { toPng, withBrowser } from './raster.mjs';
import { analyse } from './pixels.mjs';

const CORPUS = 'corpus/chants';
const FIXED = '2026-01-01T00:00:00.000Z';

const problems = [];
const fail = (what, detail) => problems.push(`${what}: ${detail}`);

/* ==========================================================================
   A picture, made here rather than fetched
   ========================================================================== */

const CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return (bytes) => {
    let c = -1;
    for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(name, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(Buffer.concat([Buffer.from(name, 'ascii'), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/**
 * A solid rectangle, as a real PNG.
 *
 * Written by hand rather than taken from a fixture file so that the gate's
 * input is a known quantity: the colour asserted against in check 4 is the one
 * put in here, and there is no chance of a fixture being replaced by something
 * that happens to be nearly the same colour.
 */
function solidPng(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A colour nothing in any theme uses, so a pixel of it can only be the
 *  picture: full-strength magenta. */
const INK = [255, 0, 255];
const PICTURE = solidPng(400, 300, INK);
/** Taller than any page this program prints — for check 6. */
const TALL = solidPng(300, 4000, [0, 160, 90]);
const TALL_SRC = `data:image/png;base64,${TALL.toString('base64')}`;
const SRC = `data:image/png;base64,${PICTURE.toString('base64')}`;
const ALT = 'A solid magenta rectangle, four hundred by three hundred.';
const MISSING_ALT = 'A lit brass oil lamp on a tall stand.';

/** One step, one embedded picture, one picture the document only names. */
const withPictures = () => ({
  title: 'A step with pictures',
  titleForms: {},
  version: 3,
  sections: [{
    id: 'sec-1',
    title: 'Dīpa',
    verses: [],
    items: [
      {
        t: 'figure',
        figure: {
          id: 'fig-1', src: SRC, alt: ALT, width: 400, height: 300,
          size: 'full', flow: 'block', captionAt: 'below', crop: 'auto',
          frame: 'none', rounded: true, caption: { en: 'The test rectangle' },
        },
      },
      {
        t: 'figure',
        figure: {
          id: 'fig-2', src: '/figures/puja-vidhi/step-dipa.png?v=2be24db2',
          alt: MISSING_ALT, width: 512, height: 512, size: 'small', crop: 'square',
        },
      },
    ],
  }],
});

/* ==========================================================================
   1-3 · the file
   ========================================================================== */

const doc = withPictures();
console.log('\n── a document with an embedded picture, exported and read back\n');

const built = await buildPage(doc, { style: 'veda-union', savedAt: FIXED });

const back = await importHtml(built.html);
if (canonicalJson(back.doc) !== canonicalJson(doc)) {
  fail('round trip', 'the document changed');
}
const recovered = figuresOf(back.doc).find((f) => f.figure.id === 'fig-1');
if (recovered === undefined) fail('round trip', 'the embedded picture did not come back');
else if (recovered.figure.src !== SRC) {
  fail('round trip', `the src changed (${recovered.figure.src.length} chars, was ${SRC.length})`);
} else {
  /* Decoded and compared with the PNG this file built — not with the string,
     which the check above already covered. Two different ways of being the
     same picture. */
  const bytes = Buffer.from(recovered.figure.src.split(',')[1], 'base64');
  if (Buffer.compare(bytes, PICTURE) !== 0) {
    fail('round trip', `the bytes changed: ${bytes.length} against ${PICTURE.length}`);
  } else {
    console.log(`  the picture came back byte for byte      ${bytes.length} bytes`);
  }
}

/* Anything the file would have to fetch — the same reading `gate-html.mjs`
   takes, because the answer has to be the same. */
const external = new Set();
for (const m of built.html.matchAll(/(?:src|href)\s*=\s*"([^"]*)"/g)) {
  if (!m[1].startsWith('data:') && !m[1].startsWith('#')) external.add(m[1]);
}
if (external.size > 0) fail('self-containment', `would fetch: ${[...external].slice(0, 3).join(', ')}`);
else console.log('  nothing to fetch                         0 external URLs');

if (!built.html.includes(`src="${SRC}"`)) {
  fail('the page', 'the embedded picture is not drawn as an <img> with its bytes');
} else console.log('  the picture is drawn from its bytes      <img src="data:image/png…">');

/*
 * The named one is not fetched and is not dropped: it draws as the plate that
 * carries its alt text, so a person can see what is missing.
 *
 * Read off the PAGE and not the file. The document itself rides inside a
 * `<script type="application/json">` block and still says `/figures/…` —
 * that is the round trip working, not a leak — so the markup is taken up to
 * the first block and the name must not appear in it.
 */
const markup = built.html.slice(0, built.html.indexOf('<script type="application/json"'));
if (markup.includes('step-dipa.png')) {
  fail('a picture the file does not carry', 'was emitted as a URL the reader would fetch');
} else if (!markup.includes('picture not in this file')
  || !markup.includes(MISSING_ALT)) {
  fail('a picture the file does not carry', 'drew neither the plate nor its alt text');
} else {
  console.log('  a picture this file lacks says so        plate + alternative text');
}

/* Every style, because a frame is markup and must not be able to reach a
   picture — the same argument `gate-html.mjs` makes about the document. */
for (const style of ['veda-union', 'card', 'plain', 'transparent']) {
  const page = await buildPage(doc, { style, savedAt: FIXED });
  if (!page.html.includes(`src="${SRC}"`)) fail(style, 'the picture is not in this frame');
}
console.log('  every frame draws it                     veda-union, card, plain, transparent');

/* ==========================================================================
   4 · the pixels
   ========================================================================== */

console.log('');
await withBrowser(async (browser) => {
  /* `bare` shrink-wraps the content, so a page holding one full-width picture
     is almost entirely that picture — which makes the most common colour in
     the raster a reading of whether it rendered at all. */
  const page = await buildPage(doc, { style: 'transparent', savedAt: FIXED });
  const shot = await toPng(browser, page.html, { frame: 'bare', scale: 1 });
  const seen = await analyse(browser, shot.bytes);
  const near = (a, b) => Math.abs(a - b) <= 2;
  const isInk = near(seen.ground[0], INK[0]) && near(seen.ground[1], INK[1])
    && near(seen.ground[2], INK[2]);
  if (!isInk) {
    fail('the raster', `the commonest colour is rgb(${seen.ground.join(',')}), not the picture`);
  }
  console.log(`  the picture is in the image              ${seen.width}x${seen.height}, `
    + `commonest colour rgb(${seen.ground.join(',')})`);
});

/* ==========================================================================
   5 · a float, and the pada beside it
   ========================================================================== */

/**
 * A real chant with a picture floated into it.
 *
 * Durgā Sūktam rather than a made-up verse, because the question is whether a
 * PĀDA fits, and only a real pāda has a real length.
 */
function withFloat() {
  const it = loadDoc(join(CORPUS, 'durga-suktam.json'));
  const items = [...it.sections[0].items];
  const at = items.findIndex((x, i) => i > 1 && x.t === 'verse');
  items.splice(at, 0, {
    t: 'figure',
    figure: {
      id: 'fig-float', src: SRC, alt: ALT, width: 400, height: 300,
      size: 'medium', flow: 'start', captionAt: 'none', crop: 'portrait',
      frame: 'thin', rounded: true,
    },
  });
  return { ...it, sections: [{ ...it.sections[0], items }, ...it.sections.slice(1)] };
}

console.log('');
await withBrowser(async (browser) => {
  const page = await browser.newPage();
  const built = await buildPage(withFloat(), { style: 'veda-union', savedAt: FIXED });
  await page.setContent(built.html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);

  /** How many pādas level with the float are taller than one line. */
  const read = () => page.evaluate(() => {
    const box = document.querySelector('.fig--flow-start').getBoundingClientRect();
    const column = document.querySelector('.flow__column');
    const pad = getComputedStyle(column);
    const padas = [...document.querySelectorAll('.pada')];
    /* A wrapped pāda is still a block with one client rect; what changes is its
       HEIGHT. The shortest pāda on the page is one line. */
    const one = Math.min(...padas.map((p) => p.getBoundingClientRect().height));
    const beside = padas.filter((p) => {
      const r = p.getBoundingClientRect();
      return r.top < box.bottom && r.bottom > box.top;
    });
    return {
      room: Math.round(column.clientWidth - parseFloat(pad.paddingLeft)
        - parseFloat(pad.paddingRight) - box.width),
      beside: beside.length,
      wrapped: beside.filter((p) => p.getBoundingClientRect().height > one * 1.5).length,
    };
  });

  const shipped = await read();
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = '.verse { clear: none !important; }';
    document.head.appendChild(s);
  });
  const control = await read();
  await page.close();

  if (shipped.wrapped !== 0) {
    fail('a float beside a verse', `${shipped.wrapped} pāda(s) wrap as it ships`);
  }
  /*
   * THE CONTROL HAS TO FAIL. If removing the clear changes nothing, the rule is
   * defending against nothing on this page and the measurement behind it has
   * gone stale — which is worth knowing, and is not something a green
   * assertion would ever say.
   */
  if (control.wrapped === 0) {
    fail('the control', 'no pāda wrapped with `clear: none`, so this measures nothing');
  }
  console.log(`  a float never narrows a pāda             ${shipped.wrapped} wrapped, `
    + `${control.wrapped} of ${control.beside} with the clear off `
    + `(${control.room} px beside the picture)`);
});

/* ==========================================================================
   6 · a picture taller than the page
   ========================================================================== */

console.log('');
await withBrowser(async (browser) => {
  const page = await browser.newPage();
  const tall = {
    ...withPictures(),
    sections: [{
      id: 'sec-1', title: 'Dīpa', verses: [],
      items: [{
        t: 'figure',
        figure: {
          id: 'fig-tall', src: TALL_SRC, alt: 'A very tall green bar.',
          width: 300, height: 4000, size: 'full', flow: 'block',
          captionAt: 'none', crop: 'auto', frame: 'none', rounded: false,
        },
      }],
    }],
  };
  const built = await buildPage(tall, { style: 'veda-union', savedAt: FIXED });
  await page.setContent(built.html, { waitUntil: 'domcontentloaded' });
  const drawn = await page.evaluate(
    () => Math.round(document.querySelector('.fig').getBoundingClientRect().height),
  );
  await page.close();

  /* The expectation comes from the page geometry, not from the stylesheet the
     check is about — a cap read out of the same CSS that set it would agree
     with itself whatever it said. */
  const room = Math.round(contentBox(pageGeometry(DEFAULT_PAGE)).height * (96 / 72));
  if (drawn > room) {
    fail('a picture taller than the page', `drew ${drawn} px on a ${room} px page`);
  }
  console.log(`  a picture can never outgrow a page       ${drawn} px drawn, `
    + `${room} px of page (4000 px of picture)`);
});

/* ==========================================================================
   7 · the corpus
   ========================================================================== */

console.log('');
for (const file of readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort()) {
  const it = loadDoc(join(CORPUS, file));
  const found = figuresOf(it);
  if (found.length === 0) continue;
  const faults = documentFigureFaults(it);
  for (const f of faults) fail(file, f);
  console.log(`  ${file.padEnd(32)} ${String(found.length).padStart(3)} figures  `
    + `${faults.length === 0 ? 'sound' : `${faults.length} FAULTS`}`);
}

if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}
console.log('\nPICTURE GATE PASSES — a picture survives the file, the frames and the raster\n');
