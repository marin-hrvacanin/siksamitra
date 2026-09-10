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
import { canonicalJson, documentFigureFaults, figuresOf } from '@siksamitra/format';
import { importHtml } from '@siksamitra/interop';
import { DEFAULT_PAGE, contentBox, pageGeometry } from '@siksamitra/layout';
import { buildPage, loadDoc } from './page.mjs';
import { toPng, withBrowser } from './raster.mjs';
import { analyse } from './pixels.mjs';
import {
  ALT, CORPUS, FIXED, INK, MISSING_ALT, PICTURE, SRC, TALL_SRC,
  withFloat, withPictures,
} from './_figure-fixtures.mjs';

const problems = [];
const fail = (what, detail) => problems.push(`${what}: ${detail}`);

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
   5 · the wrap, which is now the PICTURE's to decide
   ========================================================================== */
/*
 * WHAT A FLOAT COSTS A PĀDA, measured on both settings.
 *
 * A pāda is a metrical line, and text narrowed by a picture breaks at a WIDTH
 * instead of at the metre. That used to be enforced for every picture —
 * `.verse { clear: both }`, unconditionally — which made `top-bottom` the only
 * behaviour the program had, and a picture set to Left had nothing beside it.
 * It also was not Word, whose wrap is a property of the picture.
 *
 * So the picture decides, and both readings are taken here:
 *
 *   top-bottom (the DEFAULT)  no pāda wraps, and the picture does not float
 *                             at all — there is nothing to clear.
 *   square (asked for)        pādas DO wrap. This is the control, and it is
 *                             the real feature rather than an injected
 *                             `!important`: if asking for Square changes
 *                             nothing, Square does not work.
 */

console.log('');
await withBrowser(async (browser) => {
  /** How many pādas level with the picture are taller than one line. */
  const read = (page) => page.evaluate(() => {
    const fig = document.querySelector('.fig');
    const box = fig.getBoundingClientRect();
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
      float: getComputedStyle(fig).float,
      room: Math.round(column.clientWidth - parseFloat(pad.paddingLeft)
        - parseFloat(pad.paddingRight) - box.width),
      beside: beside.length,
      wrapped: beside.filter((p) => p.getBoundingClientRect().height > one * 1.5).length,
    };
  });

  const open = async (wrap) => {
    const page = await browser.newPage();
    const made = await buildPage(withFloat({ wrap }), { style: 'veda-union', savedAt: FIXED });
    await page.setContent(made.html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const seen = await read(page);
    await page.close();
    return seen;
  };

  const band = await open('top-bottom');
  const square = await open('square');

  if (band.wrapped !== 0) {
    fail('top and bottom', `${band.wrapped} pāda(s) wrap beside a banded picture`);
  }
  /*
   * AND IT IS NOT A FLOAT AT ALL. Top-and-bottom used to be a float that every
   * verse then cleared; it is a block with a side now, so nothing downstream
   * has to know a float happened.
   */
  if (band.float !== 'none') {
    fail('top and bottom', `the picture still floats (${band.float})`);
  }
  /*
   * THE CONTROL, and it is the feature itself. If asking for Square narrows
   * nothing, either Square does not work or this page has no pāda level with
   * the picture — and both are worth failing for.
   */
  if (square.wrapped === 0) {
    fail('square', `nothing wrapped beside a squared picture (${square.beside} pāda(s) level with it)`);
  }
  if (square.float !== 'left') {
    fail('square', `the picture does not float (${square.float})`);
  }
  console.log(`  top and bottom: no pāda wraps           ${band.wrapped} wrapped, float ${band.float}`);
  console.log(`  square: the text really runs beside it   ${square.wrapped} of ${square.beside} wrapped, `
    + `${square.room} px beside the picture`);
});

/* ==========================================================================
   5b · and the PROSE beside it does wrap
   ========================================================================== */
/*
 * A RULE THAT ONLY EVER SAYS NO IS NOT A WRAP.
 *
 * Check 5 proves a float never narrows a pāda. On its own that is also what a
 * float nothing flows around looks like, and the owner's report was precisely
 * "setting the text wrap and all that … it should all be fully supported". So
 * the same page is asked the opposite question about the item that IS allowed
 * to flow: an instruction level with the picture must come out NARROWER than
 * the column.
 *
 * MEASURED AS LINE BOXES, not as the paragraph. A block beside a float is
 * still full width — what shortens is each line inside it, so the rectangles
 * of a Range over the text are the only honest measurement.
 *
 * WITH THE CONTROL: the float is turned off and the same lines are measured
 * again. If they do not get longer, the picture was not narrowing them and
 * this check is reading something else.
 */
console.log('');
await withBrowser(async (browser) => {
  const page = await browser.newPage();
  /* SQUARE, explicitly: this check is about the prose that IS allowed to flow
     beside a picture, which only happens when the picture asks for it. */
  const built = await buildPage(withFloat({ wrap: 'square' }), { style: 'veda-union', savedAt: FIXED });
  await page.setContent(built.html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);

  const read = () => page.evaluate(() => {
    const fig = document.querySelector('.fig--wrap-square') ?? document.querySelector('.fig');
    const box = fig.getBoundingClientRect();
    const column = document.querySelector('.flow__column');
    const pad = getComputedStyle(column);
    const room = column.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    /* THE SAME PARAGRAPH BOTH TIMES. Found by standing level with the picture
       on the first reading and TAGGED, because turning the float off moves it
       out from beside the picture — which is the whole point — and a second
       search by overlap would then find nothing and report a control that
       measured itself. */
    const para = document.querySelector('[data-wrap-probe]')
      ?? [...document.querySelectorAll('.doc__instruction')].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top < box.bottom - 2 && r.bottom > box.top + 2;
      });
    if (para === undefined || para === null) return null;
    para.dataset.wrapProbe = '1';
    const range = document.createRange();
    range.selectNodeContents(para);
    const lines = [...range.getClientRects()].filter((r) => r.width > 1);
    return {
      room: Math.round(room),
      first: Math.round(lines[0]?.width ?? 0),
      lines: lines.length,
    };
  });

  const shipped = await read();
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = '.fig--flow-start { float: none !important; }';
    document.head.appendChild(s);
  });
  const control = await read();
  await page.close();

  if (shipped === null) {
    fail('prose beside a float', 'no instruction is level with the picture');
  } else if (shipped.first >= shipped.room - 20) {
    fail('prose beside a float',
      `its first line is ${shipped.first} px in a ${shipped.room} px column — nothing wrapped`);
  } else if (control === null || control.first <= shipped.first + 20) {
    fail('the control',
      'the line did not get longer with the float off, so this measures nothing');
  } else {
    console.log(`  and prose beside it IS narrowed          ${shipped.first} px of `
      + `${shipped.room}, ${control.first} px with the float off`);
  }
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
