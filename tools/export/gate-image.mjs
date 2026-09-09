#!/usr/bin/env node
/**
 * THE IMAGE EXPORT GATE — is the picture the page, and is the card sendable?
 *
 * OWNER'S REQUIREMENT: "when someone asks me to prepare a particular mantra I
 * can send a clear card with the mantra to the WhatsApp chat", and "if veda
 * union style is selected then it should be identical".
 *
 * A file existing is not an image working, so nothing here asserts that a PNG
 * was written. Every check is a MEASUREMENT of the pixels that came out, or of
 * the page they came out of:
 *
 *   THE PAGE IS HIS. The `veda-union` export's own computed styles, read in a
 *   browser and converted to points, against `WORD_PARAGRAPHS` — the table
 *   measured out of his `.docx`. This is deliberately the same comparison
 *   `tools/doc-fidelity.mjs` makes of the live editor; two artefacts, one table
 *   of expectations, so "the export looks like the editor looks like his file"
 *   is a chain of measurements rather than an assertion.
 *
 *   THE PICTURE HAS SOMETHING IN IT. The proportion of pixels that differ from
 *   the paper, and the contrast between the paper and the darkest ink. A PNG of
 *   a page whose fonts failed to load is still a valid PNG.
 *
 *   THE CARD IS ROUNDED. Measured off the image, not off the stylesheet: the
 *   card's left edge starts further in at its top row than it does forty pixels
 *   lower, which is what a rounded corner IS. A square corner gives zero.
 *
 *   THE ALPHA IS WHERE IT WAS PROMISED. `transparent` has none behind it;
 *   `card` is opaque, because WhatsApp flattens transparency to black.
 *
 *   SCALE IS A SCALE. Three halves the pixels of two, to the pixel.
 *
 * The PNGs are written to `artifacts/export/` and left there. An image gate
 * whose output nobody can look at is a gate that will one day pass on a page of
 * empty boxes.
 *
 *   npm run check:export:image
 *   CHROME=<path to chrome or edge> npm run check:export:image
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPORT_STYLES, exportStyle } from '@siksamitra/tokens/export-styles';
import { WORD_PARAGRAPHS } from '@siksamitra/tokens/word';
import { buildPage, loadDoc } from './page.mjs';
import { toPng, toSvg, withBrowser } from './raster.mjs';
import { analyse, analyseSvg, fidelity } from './pixels.mjs';

const OUT = 'artifacts/export';
const SOURCE = 'corpus/chants/durga-suktam.json';
/** One verse for the cards — that is what gets sent — and one section for the
 *  page frames, so the sheet is a page rather than a scroll. */
const ONE_VERSE = '#sec-1/v-1';
const ONE_SECTION = '#sec-1';

/** WhatsApp resamples an image whose long edge is over this before it
 *  compresses it, which costs a second generation of loss on the marks. */
const CHAT_LONG_EDGE = 1600;

const problems = [];
const fail = (what, detail) => problems.push(`${what}: ${detail}`);
const atLeast = (what, got, want) => {
  if (!(got >= want)) fail(what, `${typeof got === 'number' ? got.toFixed(2) : got} < ${want}`);
};

mkdirSync(OUT, { recursive: true });
const doc = loadDoc(SOURCE);

await withBrowser(async (browser) => {
  console.log(`\n── rasterising ${EXPORT_STYLES.length} styles of ${doc.title}\n`);
  console.log('  style            frame   pixels        ink    contrast  corner  alpha  svg');

  for (const style of EXPORT_STYLES) {
    const select = style.frame === 'card' || style.frame === 'bare' ? ONE_VERSE : ONE_SECTION;
    const built = await buildPage(doc, { style: style.id, script: 'deva', select });
    const png = await toPng(browser, built.html, { frame: style.frame, scale: 2 });
    const file = join(OUT, `gate-${style.id}.png`);
    writeFileSync(file, png.bytes);

    const seen = await analyse(browser, png.bytes);
    const alpha = seen.corner[3];

    /*
     * THE VECTOR FORM IS THE SAME PICTURE, and this is the check that says so.
     * The SVG carries the clipped element out of the page into a
     * `foreignObject`, and an ancestor left behind there is an ancestor whose
     * attributes stop matching: the sheet frames clip `.flow__column`, whose
     * `data-doc` is on its PARENT, and a Veda Union SVG came back set in the
     * default theme — Gentium instead of Arimo, the wrong greens, gutter
     * numbers printed, no hanging indent. It rasterised, it was 7.8 % inked and
     * it passed every check there was. Comparing its PAPER COLOUR with the
     * PNG's names that failure in one number.
     */
    const vector = await analyseSvg(
      browser, (await toSvg(browser, built.html, { frame: style.frame, doc: style.doc })).text,
    );
    if (!vector.ok) fail(`${style.id} svg`, `a browser will not parse it — ${vector.why}`);
    else {
      const a = seen.ground.join(',');
      const b = vector.seen.ground.join(',');
      if (a !== b) fail(`${style.id} svg`, `paper is rgb(${b}) where the PNG's is rgb(${a})`);
      if (Math.abs(vector.width * 2 - seen.width) > 2) {
        fail(`${style.id} svg`, `${vector.width} CSS px wide against the PNG's ${seen.width / 2}`);
      }
      atLeast(`${style.id} svg ink`, vector.seen.inked * 100, 1.5);
    }

    console.log(`  ${style.id.padEnd(16)} ${style.frame.padEnd(7)} `
      + `${`${seen.width}x${seen.height}`.padEnd(13)} `
      + `${(seen.inked * 100).toFixed(1).padStart(4)}%  `
      + `${seen.contrast.toFixed(1).padStart(6)}:1  `
      + `${String(seen.rounded).padStart(5)}   ${String(alpha).padStart(3)}  `
      + `${vector.ok ? `${vector.width}x${vector.height}` : 'BROKEN'}`);

    /* Something is drawn, and it can be read. 1.5 % is the least a page of
       verse ever inks; an empty page and a page of tofu boxes are both under
       it, and a page whose faces failed to load fails the contrast instead. */
    atLeast(`${style.id} ink`, seen.inked * 100, 1.5);
    atLeast(`${style.id} contrast`, seen.contrast, 4.5);

    if (style.frame === 'bare') {
      if (alpha !== 0) fail(style.id, `the transparent style has an opaque corner (a=${alpha})`);
    } else if (alpha !== 255) {
      fail(style.id, `a ${style.frame} image is see-through (a=${alpha}) — a chat will `
        + 'flatten it to black');
    }

    if (style.frame === 'card') {
      atLeast(`${style.id} rounded corner`, seen.rounded, 8);
      if (seen.width > CHAT_LONG_EDGE) {
        fail(style.id, `${seen.width} px wide — over the ${CHAT_LONG_EDGE} px a chat resends `
          + 'without resampling');
      }
      atLeast(`${style.id} legible at phone size`, seen.width, 900);
      /* The band has to be a different colour from the card or the rounding is
         drawn and invisible. */
      const band = seen.corner.join(',');
      const paper = seen.ground.join(',');
      if (band === paper) fail(style.id, 'the band around the card is the card colour');
    }
  }

  /* ── the Veda Union page, against his own file ─────────────────────────── */
  console.log('\n── the veda-union export, measured against his .docx\n');
  const vu = await buildPage(doc, {
    style: 'veda-union', script: 'deva', select: ONE_SECTION,
  });
  const seen = await fidelity(browser, vu.html);
  const line = WORD_PARAGRAPHS.find((p) => p.role === 'verse-line');
  const near = (what, got, want, tol = 0.05) => {
    if (got === null || got === undefined) fail(what, 'not rendered');
    else if (Math.abs(got - want) > tol) fail(what, `${got} ≠ ${want}`);
  };
  const is = (what, got, want) => {
    if (got !== want) fail(what, `${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  };

  near('mantra size', seen.first?.size, line.size);
  near('mantra leading', seen.first?.lead, line.leading / line.size, 0.01);
  is('mantra face', seen.first?.family, 'Arimo');
  is('mantra bold', seen.first?.bold, false);
  /* His `Translit` is `w:left="284" w:hanging="284"`: the first line comes out
     to the margin and the continuations sit in. */
  near('first-line indent', seen.first?.indent, line.indent - line.hanging);
  near('continuation indent', seen.cont?.indent, line.indent);
  near('right indent', seen.first?.right, line.right);
  is('translation italic', seen.translation?.italic, true);
  /* His document prints its verse numbers inside the line between daṇḍas, so a
     gutter number there would be the number twice. */
  is('gutter numbers drawn', seen.counts.numbers, 0);
  atLeast('translations drawn', seen.counts.translations, seen.counts.verses);

  console.log(`  mantra      ${seen.first?.size} pt on ${seen.first?.lead} `
    + `(${line.size} pt on ${(line.leading / line.size).toFixed(3)}), ${seen.first?.family}`);
  console.log(`  indents     first ${seen.first?.indent} pt, continuation `
    + `${seen.cont?.indent} pt (${line.indent - line.hanging} / ${line.indent})`);
  console.log(`  drawn       ${seen.counts.verses} verses, `
    + `${seen.counts.translations} translations, ${seen.counts.numbers} gutter numbers`);

  /* ── scale, and the vector form ────────────────────────────────────────── */
  console.log('');
  const card = exportStyle('card');
  const one = await buildPage(doc, { style: card.id, script: 'deva', select: ONE_VERSE });
  const at2 = await toPng(browser, one.html, { frame: card.frame, scale: 2 });
  const at3 = await toPng(browser, one.html, { frame: card.frame, scale: 3 });
  const a = await analyse(browser, at2.bytes);
  const b = await analyse(browser, at3.bytes);
  if (Math.abs(b.width / a.width - 1.5) > 0.01 || Math.abs(b.height / a.height - 1.5) > 0.01) {
    fail('scale', `2x is ${a.width}x${a.height} and 3x is ${b.width}x${b.height}`);
  }
  console.log(`  scale       ${a.width}x${a.height} at 2x, ${b.width}x${b.height} at 3x`);

  /* The card's vector form, kept on disk, so a person can open one and see for
     themselves what a foreignObject SVG is and is not. */
  const svg = await toSvg(browser, one.html, { frame: card.frame, doc: card.doc });
  writeFileSync(join(OUT, 'gate-card.svg'), svg.text, 'utf8');
  const drawn = await analyseSvg(browser, svg.text);
  if (!drawn.ok) fail('svg', `a browser will not parse it — ${drawn.why}`);
  else {
    console.log(`  svg         ${drawn.width}x${drawn.height}, `
      + `${(drawn.seen.inked * 100).toFixed(1)}% inked at `
      + `${drawn.seen.contrast.toFixed(1)}:1, ${(svg.text.length / 1024).toFixed(0)} KB`);
  }
});

console.log(`\n     the images are in ${OUT}/ — look at them.`);

if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}
console.log('\nIMAGE EXPORT GATE PASSES\n');
