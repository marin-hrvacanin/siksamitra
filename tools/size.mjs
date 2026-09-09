#!/usr/bin/env node
/**
 * WHAT A DOCUMENT COSTS ON DISK — a ratchet, and one structural rule.
 *
 * The owner's objection is the standing requirement: a document must be
 * kilobytes, not megabytes, and must hold a book — the whole Devī Māhātmyam —
 * the way a `.docx` does. This is what stops that number going the wrong way
 * between one change and the next.
 *
 * TWO CHECKS, and the first is the one that matters.
 *
 * NO VERSE IS STORED TWICE. A composed section holds its verses in `items`,
 * interleaved with instructions and figures, and `normalizeChantDoc` rebuilds
 * `verses` from that on every load. Both were being written. Śrī Rudram was
 * 1618.8 kB of which `items` was 798.9 kB and `verses` 794.1 kB — the same
 * bytes twice, 49% of the corpus. Nothing caught it: the study that asked
 * where the bytes went, `tools/size-study.mjs`, reads `s.items ?? s.verses`
 * and so counted each verse exactly once. A structural rule catches what an
 * arithmetic one cannot.
 *
 * THE SIZES ARE A RATCHET, not a target. Each document's measured size is
 * recorded in `corpus/size-baseline.json` and may only fall. A target would
 * have to be either so loose it never fires or so tight it fails on the day it
 * is written; a ratchet fires the moment something grows, which is when the
 * cause is still findable.
 *
 * WHERE THE REST OF THE BYTES ARE, measured on Śrī Rudram after the duplicate
 * went (`tools/size-study.mjs` prints the full breakdown):
 *
 *     the text itself        22.3 kB   irreducible — this is the mantra
 *     `syl` markings        373.5 kB   syllable division, which the engine
 *                                      derives; stored only until it does
 *     other markings        372.0 kB   svara, holdings, substitutions
 *     `stage` on each mark  205.1 kB   derivable from the kind — STAGE_OF
 *     `by` on each mark     135.7 kB   'rule' on all but a handful
 *
 * So the remaining work is not compression, it is not storing what is derived:
 * `openspec/changes/text-and-marks` tasks 4.5 and 5.2. Update the baseline
 * when a change makes a document smaller; never to make a failure go away.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'corpus/chants';
const BASELINE = 'corpus/size-baseline.json';
const update = process.argv.includes('--update');

/** Every verse in the file, by where it was found. */
function versesIn(doc) {
  const seen = [];
  for (const s of doc.sections ?? []) {
    for (const v of s.verses ?? []) seen.push({ section: s.id, id: v.id, where: 'verses' });
    for (const it of s.items ?? []) {
      if (it.t === 'verse') seen.push({ section: s.id, id: it.id, where: 'items' });
    }
  }
  return seen;
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const kb = (n) => (n / 1024).toFixed(1).padStart(9);

const twice = [];
const grew = [];
const next = {};
let total = 0;

console.log('\n── what each document costs\n');
console.log(`  ${'document'.padEnd(30)}${'on disk'.padStart(9)}${'recorded'.padStart(10)}`);

for (const f of files) {
  const raw = readFileSync(join(DIR, f), 'utf8');
  const bytes = Buffer.byteLength(raw);
  total += bytes;
  next[f] = bytes;

  const doc = JSON.parse(raw);
  /* A verse id that appears in BOTH arrays of one section is the duplicate. */
  for (const s of doc.sections ?? []) {
    const inItems = new Set((s.items ?? []).filter((i) => i.t === 'verse').map((i) => i.id));
    for (const v of s.verses ?? []) {
      if (inItems.has(v.id)) twice.push(`${f} ${s.id} ${v.id}`);
    }
  }

  const was = base.files?.[f];
  if (was !== undefined && bytes > was) grew.push({ f, was, bytes });
  console.log(`  ${f.replace('.json', '').padEnd(30)}${kb(bytes)}${was === undefined ? '         —' : kb(was)}`
    + (was !== undefined && bytes > was ? '  GREW' : ''));
}

console.log(`  ${'TOTAL'.padEnd(30)}${kb(total)}${base.total === undefined ? '' : kb(base.total)}`);

if (update) {
  writeFileSync(BASELINE, `${JSON.stringify({ total, files: next }, null, 2)}\n`);
  console.log(`\n  baseline updated — ${kb(total)} kB\n`);
  process.exit(0);
}

let bad = false;
if (twice.length > 0) {
  bad = true;
  console.log(`\n  ${twice.length} verse(s) are stored TWICE — in \`items\` and again in`
    + ' `verses`. `writeChantFile` omits the derived array; something wrote this file'
    + ' another way:\n');
  for (const t of twice.slice(0, 10)) console.log(`    ${t}`);
}
if (grew.length > 0) {
  bad = true;
  console.log('\n  larger than recorded:\n');
  for (const g of grew) {
    console.log(`    ${g.f}  ${kb(g.was)} → ${kb(g.bytes)} kB`
      + `  (+${((g.bytes / g.was - 1) * 100).toFixed(1)}%)`);
  }
  console.log('\n  If the growth is intended and understood, record it:'
    + '\n    npm run check:size -- --update\n');
}
if (bad) process.exit(1);

console.log('\n  NO VERSE IS STORED TWICE, AND NOTHING GREW.\n');
