#!/usr/bin/env node
/**
 * DOES THE RUN RENDERER DRAW WHAT THE TOKEN RENDERER DRAWS?
 *
 * The document is moving from `src` + `tokens` to one text and a list of
 * markings, and while both shapes exist both are drawn. Two drawing functions
 * is the one thing this repository forbids, and the only reason it is tolerable
 * is that it is temporary AND checked: the old one goes when the corpus has
 * moved, and until then this says whether they agree.
 *
 * IT COMPARES PIXELS, not markup. The two emit deliberately different elements
 * — a span per letter against one element per run — so comparing the DOM would
 * only restate that. What has to match is what a reader sees, so the same verse
 * is drawn twice into the same page at the same size and the two are
 * differenced.
 *
 * THE TOLERANCE IS NOT ZERO, and the figure is measured rather than chosen. A
 * run of letters shaped as one text node kerns across letter boundaries that a
 * span-per-letter markup breaks, so identical text differs by a fraction of a
 * pixel at some glyph pairs. What must not differ is a mark's presence, its
 * weight or its colour, and that shows up as clusters of changed pixels rather
 * than a hairline at a letter edge — which is why the threshold is on the SHARE
 * of pixels that moved and the report prints the worst verse either way.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, Fragment } from 'react';
import { toTextAndMarks } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { renderSyl, toLines, toRuns, renderRunLine } from '@siksamitra/render';
import { appCss } from './export/css.mjs';
import { browserPath, withBrowser } from './export/raster.mjs';

const DIR = 'corpus/chants';
const OUT = 'artifacts/run-parity';
mkdirSync(OUT, { recursive: true });

/**
 * Above this share of pixels differing, the two are not drawing the same thing.
 *
 * A RATCHET. The worst verse measures 0.97% and the limit is 1.5%, so there is
 * room for the shaping difference and none for a mark going missing. It started
 * at 3% and found three real faults on the way down, each of which had been
 * invisible to every other check in this repository:
 *
 *   6.92%  every svara and anudātta absent, because their CSS is keyed to `.u`
 *          and a run wore `run sv-anudatta`
 *   5.64%  the candrabindu absent — it was a marking, and a run has one text
 *          node with no room for a combining mark laid over it. It is a
 *          character in the text now, which is where an author types it
 *   4%+    the daṇḍa drawn in the letter colour with no space around it,
 *          because a run held it without saying it was structure
 */
const LIMIT = 0.015;
/** A pixel counts as moved only if a channel changed by more than this. */
const CHANNEL = 28;

const FONT = '"Gentium Book Plus", "Noto Serif Devanagari", serif';

/** One verse, drawn from its tokens — the way the page draws today. */
function fromTokens(verse, script) {
  const lines = [[]];
  for (const t of verse.tokens) {
    if (t.t === 'br') { lines.push([]); continue; }
    lines[lines.length - 1].push(t);
  }
  return lines.map((line, i) => createElement(
    'div',
    { className: 'pada', key: i },
    line.map((t, j) => (t.t === 'syl'
      ? renderSyl(t, script, j, { showMarks: true, fontStack: FONT })
      : createElement('span', { className: t.t, key: j },
        t.t === 'sp' ? ' ' : t.t === 'danda' || t.t === 'num' ? t.s
          : t.t === 'bar' ? '|' : t.t === 'pause' ? (t.len === 'long' ? '||' : '|')
            : t.t === 'text' ? t.s : ''))),
  ));
}

/** The same verse, drawn from its text and markings. */
function fromRuns(verse, script) {
  const { text, marks } = toTextAndMarks(verse);
  return toLines(toRuns(text, marks)).map((line, i) => createElement(
    'div',
    { className: 'pada', key: i },
    renderRunLine(line, { showMarks: true, fontStack: FONT, script }),
  ));
}

const html = (body) => `<!doctype html><meta charset="utf-8"><style>${appCss()}
  body { margin: 0; background: #fff; }
  .half { width: 1100px; padding: 24px 32px; background: #fff; }
  .pada { white-space: pre-wrap; }
</style><div class="canvas doc" data-doc="warm">${body}</div>`;

/** The share of pixels that differ, and where. */
function differ(a, b) {
  const x = PNG.sync.read(a);
  const y = PNG.sync.read(b);
  if (x.width !== y.width || x.height !== y.height) return { share: 1, note: 'different sizes' };
  let moved = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    if (Math.abs(x.data[i] - y.data[i]) > CHANNEL
      || Math.abs(x.data[i + 1] - y.data[i + 1]) > CHANNEL
      || Math.abs(x.data[i + 2] - y.data[i + 2]) > CHANNEL) moved += 1;
  }
  return { share: moved / (x.width * x.height), note: '' };
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();
console.log('\n── the run renderer against the token renderer\n');

let checked = 0;
let worst = 0;
let worstAt = '';
const bad = [];

await withBrowser(async (browser) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 600, deviceScaleFactor: 2 });

  for (const file of files) {
    const doc = openChantDoc(JSON.parse(await readFile(join(DIR, file), 'utf8')));
    const verse = doc.sections.flatMap((s) => s.verses).find((v) => v?.tokens?.length > 0);
    if (verse === undefined) continue;
    const script = doc.primaryScript === 'devanagari' ? 'deva' : 'iast';

    const shots = [];
    for (const build of [fromTokens, fromRuns]) {
      const body = `<div class="half">${
        renderToStaticMarkup(createElement(Fragment, null, build(verse, script)))}</div>`;
      /* Wait for the DOM, not for the network to fall idle: the app's
         stylesheets name font files by URL and nothing serves them here, so
         the page never goes idle at all.
         Both halves then draw in the same fallback face, which is all parity
         needs — this compares two renderings, not a rendering to a reference. */
      await page.setContent(html(body), { waitUntil: 'domcontentloaded' });
      await new Promise((r) => { setTimeout(r, 120); });
      const el = await page.$('.half');
      shots.push(await el.screenshot({ type: 'png' }));
    }

    const { share, note } = differ(shots[0], shots[1]);
    checked += 1;
    if (share > worst) { worst = share; worstAt = `${file} ${verse.id}`; }
    if (share > LIMIT) {
      bad.push(`${file} ${verse.id}: ${(share * 100).toFixed(2)}% of pixels differ ${note}`);
      writeFileSync(join(OUT, `${file.replace('.json', '')}-tokens.png`), shots[0]);
      writeFileSync(join(OUT, `${file.replace('.json', '')}-runs.png`), shots[1]);
    }
    console.log(`  ${file.replace('.json', '').padEnd(28)}${(share * 100).toFixed(2).padStart(7)}%`
      + (share > LIMIT ? '  DIFFERS' : ''));
  }
});

console.log(`\n  ${checked} verses drawn both ways; the worst is `
  + `${(worst * 100).toFixed(2)}% of pixels, at ${worstAt}`);
console.log(`  the limit is ${(LIMIT * 100).toFixed(0)}%`);
if (bad.length > 0) {
  console.log(`\n  ${bad.length} differ too much — the images are in ${OUT}:\n`);
  for (const b of bad) console.log(`    ${b}`);
  console.log('');
  process.exit(1);
}
console.log('\n  THE TWO RENDERERS AGREE.\n');
