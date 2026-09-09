#!/usr/bin/env node
/**
 * THE HTML EXPORT GATE — is the file lossless, and does it stand alone?
 *
 * OWNER'S REQUIREMENT: "it should be lossless if in any way at all physically
 * possible", and "all the information/tags can be saved in the code itself, as
 * well as audio and all that".
 *
 * Lossless is only worth claiming if it is measured, so this exports all eleven
 * corpus documents, reads each one back with `importHtml`, and compares the
 * recovered document with the ORIGINAL — the object loaded from disk, field for
 * field, not the manifest the exporter wrote and not the hash the exporter
 * computed. A test that asked the exporter whether it had done its job would
 * pass over a broken exporter, which is the whole reason for the rule.
 *
 * FOUR THINGS ARE CHECKED, and each answers a different way of being wrong:
 *
 *   1. THE DOCUMENT. `canonicalJson` before and after, byte for byte, plus a
 *      structural walk that names the first paths that differ — because
 *      "1 048 576 bytes differ" is not a bug report.
 *   2. THE ASSETS. A recording is attached and compared byte for byte on the
 *      way back. The corpus keeps no audio locally, so this uses a synthetic
 *      one: the point is that the path is exercised, and a path that is only
 *      exercised by a document nobody has is a path that does not work.
 *   3. SELF-CONTAINMENT. Not one URL in the file that is not a `data:` one. A
 *      single `href` to a CDN would make "open it on a plane" false, and the
 *      failure would be silent: a missing face falls through to whatever the
 *      machine has and the diacritics quietly change shape.
 *   4. DETERMINISM. The same document exported twice gives the same bytes.
 *      Without it, "has this changed?" cannot be answered by comparing files.
 *
 * WHAT THIS GATE DOES NOT CHECK is what the page LOOKS like. That needs a
 * browser and it is `gate-image.mjs`, which measures the exported page's own
 * computed styles against the numbers read out of his `.docx`.
 *
 *   npm run check:export:html
 *   npm run check:export:html -- --show 12    # print more of a difference
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from '@siksamitra/format';
import { importHtml } from '@siksamitra/interop';
import { EXPORT_STYLES } from '@siksamitra/tokens/export-styles';
import { SCRIPTS, buildPage, loadDoc } from './page.mjs';

const CORPUS = 'corpus/chants';
const FIXED = '2026-01-01T00:00:00.000Z';
const show = Number(process.argv[process.argv.indexOf('--show') + 1]) || 4;

/**
 * A recording, near enough. Eleven bytes with a high bit set and a NUL in the
 * middle, because those are what a text round trip mangles: base64 that lost
 * its padding, or bytes that went through a string, come back wrong here.
 */
const TAKE = new Uint8Array([0x49, 0x44, 0x33, 0x00, 0xff, 0xfb, 0x90, 0x00, 0x01, 0xfe, 0x7f]);

const problems = [];
const fail = (what, detail) => problems.push(`${what}: ${detail}`);

/** Where two documents first differ, as paths a person can look up. */
function differences(a, b, path = '', out = []) {
  if (out.length >= show) return out;
  if (a === b) return out;
  const shape = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  if (shape(a) !== shape(b)) {
    out.push(`${path || '<root>'}: ${shape(a)} became ${shape(b)}`);
    return out;
  }
  if (shape(a) === 'array') {
    if (a.length !== b.length) out.push(`${path}: ${a.length} items became ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      differences(a[i], b[i], `${path}[${i}]`, out);
    }
    return out;
  }
  if (shape(a) === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differences(a[key], b[key], path === '' ? key : `${path}.${key}`, out);
    }
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} became ${JSON.stringify(b)}`);
  return out;
}

/** Anything the file would have to fetch. */
function externalRefs(html) {
  const found = new Set();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]*)"/g)) {
    if (!m[1].startsWith('data:') && !m[1].startsWith('#')) found.add(m[1]);
  }
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (!m[1].startsWith('data:')) found.add(m[1]);
  }
  for (const m of html.matchAll(/@import\s+[^;]+;/g)) found.add(m[0]);
  return [...found];
}

const files = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort();
console.log(`\n── exporting ${files.length} documents as HTML and reading them back\n`);

let bytes = 0;
for (const file of files) {
  const original = loadDoc(join(CORPUS, file));
  const assets = { 'take-1.mp3': TAKE };
  const built = await buildPage(original, { style: 'veda-union', savedAt: FIXED });

  /* `buildPage` renders the whole document when nothing is selected, so the
     document in the file is the document on disk — which is what makes the
     comparison below meaningful. Assets go in through the same call the app
     makes, so they travel the export path rather than a test-only one. */
  const withAudio = await buildPage(original, { style: 'veda-union', savedAt: FIXED, assets });
  bytes += built.html.length;

  const back = await importHtml(withAudio.html);

  const before = canonicalJson(original);
  const after = canonicalJson(back.doc);
  if (before !== after) {
    const diff = differences(original, back.doc);
    fail(file, `the document changed (${before.length} vs ${after.length} canonical bytes)`);
    for (const d of diff) fail(`  ${file}`, d);
  }
  if (!back.intact) fail(file, `the recorded hash does not match: ${back.docHash}`);

  const got = back.assets['take-1.mp3'];
  if (got === undefined) fail(file, 'the attached recording did not come back');
  else if (got.length !== TAKE.length || got.some((b, i) => b !== TAKE[i])) {
    fail(file, `the recording came back as ${[...got].join(',')}`);
  }

  const external = externalRefs(built.html);
  if (external.length > 0) fail(file, `would fetch: ${external.slice(0, 3).join(', ')}`);

  const twice = await buildPage(original, { style: 'veda-union', savedAt: FIXED });
  if (twice.html !== built.html) fail(file, 'two exports of one document differ');

  const verses = original.sections.reduce((n, s) => n + s.verses.length, 0);
  console.log(`  ${file.padEnd(32)} ${String(verses).padStart(4)} verses  `
    + `${(built.html.length / 1048576).toFixed(2)} MB  `
    + `${back.intact && before === after ? 'exact' : 'LOSSY'}`);
}

/*
 * EVERY STYLE HAS TO BUILD, and the document has to survive every one of them.
 * A frame is markup and a theme is a set of tokens, so neither can touch the
 * embedded document — but "cannot" is the kind of claim that stops being true
 * when someone adds a style that slices something, and one entry in a registry
 * is exactly the change nobody re-runs the corpus for.
 */
console.log('');
const sample = loadDoc(join(CORPUS, 'durga-suktam.json'));
for (const style of EXPORT_STYLES) {
  const built = await buildPage(sample, { style: style.id, savedAt: FIXED });
  const back = await importHtml(built.html);
  const same = canonicalJson(back.doc) === canonicalJson(sample);
  if (!same) fail(style.id, 'the document did not survive this style');
  if (back.manifest.style !== style.id) {
    fail(style.id, `the manifest says "${back.manifest.style}"`);
  }
  console.log(`  ${style.id.padEnd(16)} ${style.frame.padEnd(6)} `
    + `${(built.html.length / 1048576).toFixed(2)} MB  `
    + `${built.fonts.faces} faces  ${same ? 'exact' : 'LOSSY'}`);
}

/* And every script, because the view is the only thing a script changes and
   the view must not be able to reach the document. */
console.log('');
for (const script of SCRIPTS) {
  const built = await buildPage(sample, { style: 'card', script, savedAt: FIXED });
  const back = await importHtml(built.html);
  const same = canonicalJson(back.doc) === canonicalJson(sample);
  if (!same) fail(script, 'the document did not survive this script');
  if (back.manifest.script !== script) fail(script, `the manifest says "${back.manifest.script}"`);
  console.log(`  ${script.padEnd(16)} ${same ? 'exact' : 'LOSSY'}`);
}

/*
 * A SLICE IS A DOCUMENT TOO. Exporting one verse embeds that verse and nothing
 * else — what you see is what you can open again — so the file has to come back
 * as the slice, not as the whole chant with one verse drawn.
 */
const slice = await buildPage(sample, { style: 'card', select: '#sec-1/v-1', savedAt: FIXED });
const sliced = await importHtml(slice.html);
const kept = sliced.doc.sections.reduce((n, s) => n + s.verses.length, 0);
if (kept !== 1) fail('#sec-1/v-1', `${kept} verses came back, not 1`);
if (sliced.manifest.select !== '#sec-1/v-1') fail('#sec-1/v-1', 'the manifest lost the selection');
console.log(`\n  one verse             ${kept === 1 ? 'exact' : `${kept} verses`}`);

/* A page saved out of a browser has the text and not the document, and saying
   so is the difference between a clear refusal and a confusing crash. */
let refused = '';
try {
  await importHtml('<!doctype html><html><body><p>a mantra</p></body></html>');
} catch (e) {
  refused = e.message;
}
if (!/no "siksamitra-\w+" block/.test(refused)
  || !refused.includes('Only a file this program wrote')) {
  fail('someone else\'s HTML', `was not refused clearly — said "${refused}"`);
}

console.log(`\n     ${(bytes / files.length / 1048576).toFixed(2)} MB per document, `
  + 'fonts and stylesheets included, nothing fetched.');

if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}
console.log('\nHTML EXPORT GATE PASSES — every document round-trips exactly\n');
