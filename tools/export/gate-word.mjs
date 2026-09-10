#!/usr/bin/env node
/**
 * THE WORD EXPORT GATE — is the `.docx` lossless, and is it his page?
 *
 * OWNER'S REQUIREMENT: "each of the exports should the user be able to select a
 * style, and if veda union style is selected, for example, then it should be
 * identical", and "if there is even 0.001 % loss, then fix the logic".
 *
 * Lossless is only worth claiming if it is measured, so this exports all eleven
 * corpus documents, reads each one back with `importWord`, and compares the
 * recovered document with the ORIGINAL — the object loaded from disk, field for
 * field, not the manifest the exporter wrote and not the hash the exporter
 * computed. A test that asked the exporter whether it had done its job would
 * pass over a broken exporter, which is the whole reason for the rule.
 *
 * FIVE THINGS ARE CHECKED, and each answers a different way of being wrong:
 *
 *   1. THE DOCUMENT. `canonicalJson` before and after, byte for byte, plus a
 *      structural walk that names the first paths that differ.
 *   2. THE ASSETS. A recording is attached and compared byte for byte on the
 *      way back, through the same call the app makes.
 *   3. THE PACKAGE. Every part the content types declare is present, every part
 *      present has a content type, and every relationship points at something
 *      that is there. The exporter this replaced failed all three, and Word's
 *      only report of it was "The file appears to be corrupted."
 *   4. THE STYLE IS HIS. `word/styles.xml` is parsed back into POINTS and
 *      compared with `WORD_PARAGRAPHS` — the table measured out of his own
 *      `.docx` — and then with the styles of that file itself, which is on
 *      disk. The second comparison is the one that is not circular: the table
 *      and the exporter could agree with each other and both be wrong about
 *      him.
 *   5. DETERMINISM. The same document exported twice gives the same bytes.
 *
 * WHAT THIS GATE CANNOT CHECK is what WORD does with the file, because a build
 * machine has no Word. `tools/export/word-survives.ps1` does that by hand and
 * `docs/EXPORT-WORD-PDF.md` records what it found.
 *
 *   npm run check:export:word
 *   npm run check:export:word -- --show 12    # print more of a difference
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { canonicalJson } from '@siksamitra/format';
import { importDocx, importWord, WORD_PARTS } from '@siksamitra/interop';
import { EXPORT_STYLES } from '@siksamitra/tokens/export-styles';
import { WORD_PARAGRAPHS } from '@siksamitra/tokens/word';
import { compareLook } from './gate-word-look.mjs';
import { SCRIPTS, loadDoc } from './page.mjs';
import { buildWord } from './word.mjs';
import { packageProblems, stylesOf } from './docx-metrics.mjs';
import { bodyDifferences, bodyShape, separatorDrift } from './word-body.mjs';
import { pictureProblems } from './word-pictures.mjs';

const CORPUS = 'corpus/chants';
const OUT = 'artifacts/export';
const FIXED = '2026-01-01T00:00:00.000Z';
/** His own file, stripped to its style parts. The external control for §4. */
const HIS = 'tools/chant/templates/vu-word-template.docx';
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

mkdirSync(OUT, { recursive: true });
const files = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort();
console.log(`\n── exporting ${files.length} documents as .docx and reading them back\n`);

let bytes = 0;
for (const file of files) {
  const original = loadDoc(join(CORPUS, file));
  const built = await buildWord(original, { style: 'veda-union', savedAt: FIXED });
  const withAudio = await buildWord(original, {
    style: 'veda-union', savedAt: FIXED, assets: { 'take-1.mp3': TAKE },
  });
  bytes += built.bytes.length;

  const back = await importWord(withAudio.bytes);
  const before = canonicalJson(original);
  const after = canonicalJson(back.doc);
  if (before !== after) {
    fail(file, `the document changed (${before.length} vs ${after.length} canonical bytes)`);
    for (const d of differences(original, back.doc)) fail(`  ${file}`, d);
  }
  if (!back.intact) fail(file, `the recorded hash does not match: ${back.docHash}`);
  if (back.from !== 'custom-xml') fail(file, `it came back from "${back.from}"`);

  const got = back.assets['take-1.mp3'];
  if (got === undefined) fail(file, 'the attached recording did not come back');
  else if (got.length !== TAKE.length || got.some((b, i) => b !== TAKE[i])) {
    fail(file, `the recording came back as ${[...got].join(',')}`);
  }

  for (const p of packageProblems(built.bytes)) fail(file, p);

  const twice = await buildWord(original, { style: 'veda-union', savedAt: FIXED });
  if (Buffer.compare(Buffer.from(twice.bytes), Buffer.from(built.bytes)) !== 0) {
    fail(file, 'two exports of one document differ');
  }

  const verses = original.sections.reduce((n, s) => n + s.verses.length, 0);
  console.log(`  ${file.padEnd(32)} ${String(verses).padStart(4)} verses  `
    + `${(built.bytes.length / 1024).toFixed(0).padStart(5)} KB  `
    + `${back.intact && before === after ? 'exact' : 'LOSSY'}`);
}

/* EVERY STYLE HAS TO BUILD, and the document has to survive every one of them.
   A stylesheet cannot touch the embedded document — but "cannot" is the kind of
   claim that stops being true when someone adds a style, and one entry in a
   registry is exactly the change nobody re-runs the corpus for. */
console.log('');
const sample = loadDoc(join(CORPUS, 'durga-suktam.json'));
for (const style of EXPORT_STYLES) {
  const built = await buildWord(sample, { style: style.id, savedAt: FIXED });
  const back = await importWord(built.bytes);
  const same = canonicalJson(back.doc) === canonicalJson(sample);
  if (!same) fail(style.id, 'the document did not survive this style');
  if (back.manifest.style !== style.id) fail(style.id, `the manifest says "${back.manifest.style}"`);
  for (const p of packageProblems(built.bytes)) fail(style.id, p);
  const styles = stylesOf(strFromU8(unzipSync(built.bytes)[WORD_PARTS.styles]));
  console.log(`  ${style.id.padEnd(16)} ${style.doc.padEnd(14)} `
    + `${(built.bytes.length / 1024).toFixed(0).padStart(4)} KB  `
    + `${String(Object.keys(styles).length).padStart(2)} styles  `
    + `${styles.Translit.size} pt ${styles.Translit.face}  ${same ? 'exact' : 'LOSSY'}`);
  writeFileSync(join(OUT, `gate-${style.id}.docx`), built.bytes);
}

/* Every script, because the script is recorded and must not reach the
   document; and a slice, because a file showing one verse must carry one. */
console.log('');
for (const script of SCRIPTS) {
  const built = await buildWord(sample, { style: 'veda-union', script, savedAt: FIXED });
  const back = await importWord(built.bytes);
  if (canonicalJson(back.doc) !== canonicalJson(sample)) {
    fail(script, 'the document did not survive this script');
  }
  if (back.manifest.script !== script) fail(script, `the manifest says "${back.manifest.script}"`);
}
const slice = await buildWord(sample, {
  style: 'veda-union', select: '#sec-1/v-1', savedAt: FIXED,
});
const sliced = await importWord(slice.bytes);
const kept = sliced.doc.sections.reduce((n, s) => n + s.verses.length, 0);
if (kept !== 1) fail('#sec-1/v-1', `${kept} verses came back, not 1`);
console.log(`  scripts ${SCRIPTS.join(' ')} · one verse ${kept === 1 ? 'exact' : `${kept} verses`}`);

/* ── the fallback location ─────────────────────────────────────────────── */
/* The datastore is the primary and the hidden paragraph is the documented
   second place. It is only worth documenting if it is exercised, so the reader
   is made to fall back to it by deleting the part the writer prefers. */
const both = await buildWord(sample, {
  style: 'veda-union', savedAt: FIXED, fallback: 'hidden-text',
});
const stripped = unzipSync(both.bytes);
delete stripped[WORD_PARTS.item];
const { zipSync } = await import('fflate');
const withoutDatastore = zipSync(stripped, { level: 6, mtime: 315532800000 });
const fromBody = await importWord(withoutDatastore);
if (fromBody.from !== 'hidden-text') fail('fallback', `read from "${fromBody.from}"`);
if (canonicalJson(fromBody.doc) !== canonicalJson(sample)) {
  fail('fallback', 'the hidden-text copy is not the document');
}
console.log(`  fallback  hidden text carries the document too `
  + `(+${((both.bytes.length - slice.bytes.length) / 1024).toFixed(0)} KB)`);

/* ── the BODY says the same thing as the document ──────────────────────── */
/* What is compared and why is in `word-body.mjs`, with the six faults it
   guards against. */
console.log('\n── the body, read back by importDocx\n');
let drift = 0;
for (const file of files) {
  const original = loadDoc(join(CORPUS, file));
  const written = await buildWord(original, { style: 'veda-union', savedAt: FIXED });
  const before = bodyShape(original);
  const after = bodyShape(importDocx(written.bytes, original.title).doc);
  const wrong = bodyDifferences(before, after);
  for (const d of wrong) fail(`${file} body`, d);
  const gaps = separatorDrift(before, after);
  drift += gaps;
  console.log(`  ${file.padEnd(32)} ${String(before.lines).padStart(4)} lines  `
    + `${String(before.counts['hold-short'] + before.counts['hold-long']).padStart(4)} boxes  `
    + `${String(before.counts.svara).padStart(4)} svaras  `
    + `${String(before.bars).padStart(3)} bars  `
    + `${wrong.length === 0 ? 'same' : 'DIFFERS'}${gaps === 0 ? '' : `  (${gaps} separators)`}`);
}

/*
 * A RATCHET, like `check:modules` and `check:literals`. It may fall, and it
 * may rise only for a reason written down here.
 *
 * 108 was what the two re-derivation heuristics cost over all 573 corpus
 * verses. It is 145 since the text stopped collapsing runs of spaces: a pause
 * is a space, the mark, and a space, and the body renders the mark as a glyph
 * while the document carries it as a point marking with the two spaces around
 * it. Śrī Rudram has 148 such runs and accounts for 136 of the difference.
 *
 * It does not touch losslessness — every document still round-trips EXACT, and
 * `separatorDrift` measures a heuristic that re-derives from a RENDERING,
 * which the document never travels in.
 */
const SEPARATOR_DRIFT = 145;
if (drift > SEPARATOR_DRIFT) {
  fail('body separators', `${drift} against a ceiling of ${SEPARATOR_DRIFT}`);
}
console.log(`\n  ${drift} separator differences over ${files.length} documents `
  + `(ceiling ${SEPARATOR_DRIFT}) — no letter and no mark differs.`);

/* ── the veda-union style, against his own file ────────────────────────── */
console.log('\n── the veda-union .docx, measured against his .docx\n');
const vu = await buildWord(sample, { style: 'veda-union', savedAt: FIXED });
const mine = stylesOf(strFromU8(unzipSync(vu.bytes)[WORD_PARTS.styles]));
const near = (what, got, want, tol = 0.005) => {
  if (got === null || got === undefined) fail(what, `not written (want ${want})`);
  else if (Math.abs(got - want) > tol) fail(what, `${got} pt ≠ ${want} pt`);
};

console.log('  style      size   leading  after  indent  hang   right   source');
for (const m of WORD_PARAGRAPHS) {
  const got = mine[m.style];
  if (got === undefined) {
    fail(m.style, 'no such style in the exported file');
    continue;
  }
  near(`${m.style} size`, got.size, m.size);
  /* `null` means Word's automatic spacing, and "automatic" is not a number to
     be near — the file either says `lineRule="exact"` or it does not. */
  if (m.leading === null) {
    if (got.leading !== null) fail(`${m.style} leading`, `${got.leading} pt, want automatic`);
  } else near(`${m.style} leading`, got.leading, m.leading, 0.05);
  if (got.kind === 'paragraph') {
    near(`${m.style} after`, got.after, m.after, 0.05);
    near(`${m.style} indent`, got.indent, m.indent, 0.05);
    near(`${m.style} hanging`, got.hanging, m.hanging, 0.05);
    near(`${m.style} right`, got.right, m.right, 0.05);
  }
  console.log(`  ${m.style.padEnd(10)} ${String(got.size).padStart(5)}  `
    + `${String(got.leading ?? 'auto').padStart(6)}  ${String(got.after).padStart(5)}  `
    + `${String(got.indent).padStart(6)} ${String(got.hanging).padStart(5)}  `
    + `${String(got.right).padStart(6)}   WORD_PARAGRAPHS`);
}

/*
 * THE CONTROL. Everything above compares the exporter with the table, and the
 * table with the exporter is a closed loop: both are generated from
 * `WORD_PARAGRAPHS`, so both could be wrong about him together. His own file is
 * on disk, so the loop can be opened — this reads the styles out of it and
 * compares the same six numbers.
 */
if (!existsSync(HIS)) {
  console.log(`\n  ${HIS} is not here — the control comparison is skipped.`);
} else {
  const his = stylesOf(strFromU8(unzipSync(new Uint8Array(readFileSync(HIS)))['word/styles.xml']));
  console.log('\n  style      what          ours       his');
  let worst = 0;
  for (const m of WORD_PARAGRAPHS) {
    const a = mine[m.style];
    const b = his[m.style];
    if (a === undefined || b === undefined) continue;
    for (const key of ['size', 'leading', 'after', 'indent', 'hanging', 'right']) {
      if (a.kind !== 'paragraph' && key !== 'size') continue;
      const x = a[key];
      const y = b[key];
      if (x === null && y === null) continue;
      if (x === null || y === null) {
        fail(`${m.style} ${key}`, `ours ${x}, his ${y}`);
        continue;
      }
      worst = Math.max(worst, Math.abs(x - y));
      if (Math.abs(x - y) > 0.05) {
        fail(`${m.style} ${key}`, `ours ${x} pt, his ${y} pt`);
        console.log(`  ${m.style.padEnd(10)} ${key.padEnd(12)} ${String(x).padStart(7)}  `
          + `${String(y).padStart(7)}  ✗`);
      }
    }
  }
  console.log(`  every measured paragraph value agrees with his file to `
    + `${worst.toFixed(3)} pt.`);

  /* The marks. His holding boxes are 0.25 pt and 1.5 pt; ours are what the
     PAGE draws, because the `.docx` and the PDF have to agree with each other
     first. Reported rather than failed — see docs/EXPORT-WORD-PDF.md. */
  const box = (id) => [mine[id]?.border?.weight ?? null, his[id]?.border?.weight ?? null];
  const [shortMine, shortHis] = box('Holding');
  const [longMine, longHis] = box('2Holding');
  console.log(`  holding box stroke: ours ${shortMine}/${longMine} pt, `
    + `his ${shortHis}/${longHis} pt — the page draws max(1px, 0.032em).`);
  if (mine.Holding?.border?.color !== his.Holding?.border?.color) {
    fail('Holding colour', `ours ${mine.Holding?.border?.color}, his ${his.Holding?.border?.color}`);
  }
  if (mine.Svara?.color !== his.Svara?.color) {
    fail('Svara colour', `ours ${mine.Svara?.color}, his ${his.Svara?.color}`);
  }
}

/* ==========================================================================
   6 · the pictures, in the part Word actually reads
   ========================================================================== */
console.log('\n── a picture, in the part Word reads\n');
const pictures = await pictureProblems(
  async (d) => (await buildWord(d, { style: 'veda-union', savedAt: FIXED })).bytes,
);
for (const p of pictures) problems.push(p);
if (pictures.length === 0) {
  console.log('  three pictures, one file       inline + two square-wrapped anchors');
  console.log('  and back through importDocx    bytes, alt text, side, wrap and order');
}

/* A Word file the owner typed has the text and not the document, and saying so
   is the difference between a clear refusal and a confusing crash. */
let refused = '';
try {
  await importWord(new Uint8Array(readFileSync(HIS)));
} catch (e) {
  refused = e.message;
}
if (!refused.includes('customXml/item1.xml') || !refused.includes('importDocx')) {
  fail("someone else's .docx", `was not refused clearly — said "${refused}"`);
}


/*
 * WHAT EACH STYLE LOOKS LIKE — the half the six numbers above cannot see.
 *
 * Every measured paragraph value agreed with his file to 0.000 pt while our
 * `Svara` was set in the wrong face and two styles he has never had were in
 * every file's Styles pane. See `gate-word-look.mjs`.
 */
if (existsSync(HIS)) {
  compareLook(
    mine,
    stylesOf(strFromU8(unzipSync(new Uint8Array(readFileSync(HIS)))['word/styles.xml'])),
    fail,
  );
}

console.log(`\n     ${(bytes / files.length / 1024).toFixed(0)} KB per document. `
  + `The files are in ${OUT}/ — open one in Word.`);

if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}
console.log('\nWORD EXPORT GATE PASSES — every document round-trips exactly\n');
