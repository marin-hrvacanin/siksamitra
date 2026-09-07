#!/usr/bin/env node
/**
 * ARE THE COPIED GUIDES STILL THE GUIDES?
 *
 * `docs/authoring/` holds copies of the marking and authoring documents whose
 * originals live in the Veda Union platform. A copy is only useful while it is
 * true, and a copy nobody checks is worse than a link: it goes stale silently
 * and then somebody follows it.
 *
 * So this compares them, byte for byte, and prints what differs.
 *
 * IT SKIPS RATHER THAN FAILS when the platform is not checked out beside this
 * repository. Somebody with only śikṣāmitra is a supported case — it is its
 * own program — and a gate that failed for them would be switched off within a
 * week, which costs more than the check is worth.
 *
 *   npm run check:authoring            beside ../vedaunion
 *   VU=<path> npm run check:authoring  somewhere else
 *   npm run sync:authoring             copy the originals over the copies
 */
import { copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mine = join(here, 'docs', 'authoring');
const theirs = process.env.VU !== undefined
  ? resolve(process.env.VU)
  : resolve(here, '..', 'vedaunion', 'app', 'docs');

const sync = process.argv.includes('--sync');

if (!existsSync(theirs)) {
  console.error(`\n  AUTHORING skipped — no platform docs at ${theirs}`);
  console.error('  Set VU=<path to vedaunion/app/docs> to check them.\n');
  process.exit(0);
}

const files = readdirSync(mine).filter((f) => f.endsWith('.md') && f !== 'README.md');
const stale = [];
const missing = [];

for (const file of files) {
  const from = join(theirs, file);
  if (!existsSync(from)) { missing.push(file); continue; }
  const a = readFileSync(join(mine, file), 'utf8');
  const b = readFileSync(from, 'utf8');
  if (a === b) continue;
  if (sync) { copyFileSync(from, join(mine, file)); continue; }
  /* The first differing line, because "these files differ" sends the reader
     to a diff tool for something this can answer in one line. */
  const la = a.split('\n');
  const lb = b.split('\n');
  const at = la.findIndex((l, i) => l !== lb[i]);
  stale.push({ file, at: at + 1, mine: la[at] ?? '(end)', theirs: lb[at] ?? '(end)' });
}

console.error(`\n── authoring guides, against ${theirs}\n`);
for (const file of files) {
  const bad = stale.find((s) => s.file === file);
  const gone = missing.includes(file);
  const mark = gone ? 'gone' : bad === undefined ? 'ok  ' : 'OLD ';
  console.error(`  ${mark} ${file}`);
  if (bad !== undefined) {
    console.error(`         line ${bad.at}`);
    console.error(`         here:     ${bad.mine.slice(0, 90)}`);
    console.error(`         platform: ${bad.theirs.slice(0, 90)}`);
  }
}

if (sync) {
  console.error(`\n  synced ${stale.length} file(s).\n`);
  process.exit(0);
}
if (stale.length === 0 && missing.length === 0) {
  console.error(`\n  AUTHORING ok — ${files.length} guides match the platform\n`);
  process.exit(0);
}
console.error(
  `\n  ${stale.length} guide(s) have drifted`
  + `${missing.length > 0 ? `, ${missing.length} no longer exist upstream` : ''}.`,
);
console.error('  Run `npm run sync:authoring` to bring the copies up to date.\n');
process.exit(1);
