#!/usr/bin/env node
/**
 * The architecture gate — separation of concerns, enforced by size.
 *
 * OWNER'S REQUIREMENT (2026-09-07): nicely separated, atomically divided, not a
 * monolith of kilobytes and kilobytes.
 *
 * Size is a proxy for cohesion and a crude one, but it is the only proxy that
 * can be measured on every commit, and the failure it catches is real: v1 ended
 * with a 720 KB `editor-quill.js` and a 169 KB stylesheet, and nobody could say
 * what was in either. The platform's `ChantReader.tsx` arrived here at 95 KB
 * and `blocks.tsx` at 98 KB. A file nobody can hold in their head is a file
 * where two contradictory rules can live for a year.
 *
 * A RATCHET, like the others. Inherited monoliths are recorded at their current
 * size and may only shrink; anything new is held to the limit.
 *
 *   node tools/check-modules.mjs
 *   node tools/check-modules.mjs --write     # record a baseline (may only fall)
 *   node tools/check-modules.mjs --worst 20
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE = 'tools/module-baseline.json';

/**
 * The limit for new code.
 *
 * 400 lines is about what fits in a reading, and comfortably holds one concern
 * with its documentation. Generated files are exempt: their size is the
 * generator's business and reviewing them by eye is not the point.
 */
const LIMIT = 400;

/*
 * Generated or copied output. Its size is the generator's business, and
 * reviewing it by eye is not the point of this gate — it flagged the vendored
 * `fonts.css` (642 machine-written @font-face rules) as a monolith to split.
 */
const SKIP = [
  '/generated/', '.generated.', '/node_modules/', '/dist/', '/target/',
  '/public/fonts/', '/assets/fonts/', '/corpus/',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = relative(ROOT, path).replace(/\\/g, '/');
    if (SKIP.some((s) => `/${rel}`.includes(s))) continue;
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs|css|rs)$/.test(entry)) out.push(rel);
  }
  return out;
}

const roots = ['packages', 'apps', 'tools', 'tests'].filter((d) => existsSync(d));
const files = roots.flatMap((d) => walk(join(ROOT, d)));

const sizes = {};
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n').length;
  if (lines > LIMIT) sizes[f] = lines;
}
const over = Object.entries(sizes).sort((a, b) => b[1] - a[1]);

if (process.argv.includes('--worst')) {
  const n = Number(process.argv[process.argv.indexOf('--worst') + 1]) || 20;
  console.log(`\n  files over ${LIMIT} lines, worst first\n`);
  for (const [f, n2] of over.slice(0, n)) console.log(`  ${String(n2).padStart(6)}  ${f}`);
  console.log('');
  process.exit(0);
}

if (process.argv.includes('--write')) {
  const prev = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { files: {} };
  const risen = over.filter(([f, n]) => (prev.files[f] ?? Infinity) < n);
  if (risen.length > 0 && !process.argv.includes('--force')) {
    console.error('\nrefusing to raise the baseline:');
    for (const [f, n] of risen) console.error(`  ${f}: ${prev.files[f]} -> ${n}`);
    console.error('');
    process.exit(1);
  }
  writeFileSync(BASELINE, JSON.stringify({
    note: `Files over ${LIMIT} lines. Inherited monoliths may only SHRINK; new files `
        + 'must not appear here at all. See tools/check-modules.mjs.',
    limit: LIMIT,
    files: Object.fromEntries(over),
  }, null, 2) + '\n');
  console.log(`\n  baseline: ${over.length} file(s) over ${LIMIT} lines\n`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('no baseline — run: node tools/check-modules.mjs --write');
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));

let failed = 0;
console.log(`\n── modules over ${LIMIT} lines (limit for new code)\n`);
for (const [f, n] of over) {
  const was = base.files[f];
  if (was === undefined) {
    console.log(`  NEW  ${f}  ${n} lines — split it, or it becomes the next monolith`);
    failed += 1;
  } else if (n > was) {
    console.log(`  UP   ${f}  ${was} -> ${n}`);
    failed += 1;
  } else if (n < was) {
    console.log(`  down ${f}  ${was} -> ${n}`);
  } else {
    console.log(`  ok   ${f}  ${n}`);
  }
}
for (const f of Object.keys(base.files)) {
  if (sizes[f] === undefined) console.log(`  FIXED ${f} is now under the limit`);
}

const total = over.reduce((a, [, n]) => a + n, 0);
console.log(`\n     ${over.length} file(s) over the limit, ${total} lines in them`);

if (failed > 0) {
  console.log(`\n${failed} file(s) grew or appeared over the limit.\n`);
  process.exit(1);
}
console.log('\nMODULE GATE PASSES\n');
