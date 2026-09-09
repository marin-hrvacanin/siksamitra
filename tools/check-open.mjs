#!/usr/bin/env node
/**
 * A DOCUMENT READ FROM DISK MUST BE OPENED.
 *
 * A verse on disk is one text and a list of markings; its syllables are
 * rebuilt by `openChantDoc`. `normalizeChantDoc` and `readChantFile` do not do
 * that — they cannot, they live in `@siksamitra/format`, which has no engine —
 * so a document that reaches a renderer through either of them has verses with
 * NO TOKENS AT ALL.
 *
 * And nothing catches it: `ChantVerse.tokens` is typed as present, because a
 * hundred places read it and they must keep compiling while they are moved
 * over. So the type says the field is there and the value is `undefined`, and
 * what happens next is a page that draws nothing, or `tokens is not iterable`
 * from somewhere three packages away.
 *
 * It happened eleven times in one afternoon — gates, tools, tests, and the
 * window itself. This is a one-line rule against the one shape the mistake
 * takes: parsing a file and normalising it.
 *
 * IT GOES AWAY WITH THE TOKENS (`text-and-marks` §10.1). When nothing reads
 * `verse.tokens`, nothing needs opening, and this file is deleted.
 *
 *   node tools/check-open.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const LOOK = ['packages', 'apps', 'tools', 'tests'];
const SKIP = new Set(['node_modules', 'dist', '.git', 'artifacts', 'generated']);
const EXT = /\.(ts|tsx|mjs|js)$/;

/**
 * Where normalising IS the right thing.
 *
 * `format` owns the function. `open-doc.ts` is what this rule exists to send
 * people to, and it normalises on the way. Nothing else parses a document file
 * and stops there.
 */
const ALLOWED = [
  'packages/format/',
  'packages/engine/src/open-doc.ts',
];

/** Parsing a file and normalising it: the exact shape of the mistake. */
const PATTERN = /normalizeChantDoc\(\s*(?:await\s+)?JSON\.parse/;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { yield* files(full); continue; }
    if (EXT.test(name)) yield full;
  }
}

const bad = [];
for (const root of LOOK) {
  for (const file of files(join(ROOT, root))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (ALLOWED.some((a) => rel.startsWith(a))) continue;
    const text = readFileSync(file, 'utf8');
    for (const [i, line] of text.split('\n').entries()) {
      if (PATTERN.test(line)) bad.push(`${rel}:${i + 1}`);
    }
  }
}

console.log('\n── every document read from disk is opened\n');
if (bad.length > 0) {
  console.log(`  ${bad.length} place(s) parse a document and normalise it instead of`
    + ' opening it. The verses will have no tokens:\n');
  for (const b of bad) console.log(`    ${b}`);
  console.log('\n  Use `openChantDoc` from `@siksamitra/engine`.\n');
  process.exit(1);
}
console.log('  NOTHING PARSES A DOCUMENT WITHOUT OPENING IT.\n');
