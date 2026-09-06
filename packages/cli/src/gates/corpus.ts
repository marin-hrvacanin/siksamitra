/**
 * The engine's corpus gate.
 *
 * Re-derives every verse of every shipped document from its own letters and
 * compares the result with what the document already says — the syllable text
 * in each verified script, and every mark on every letter.
 *
 * The numbers below are a RATCHET, not a target. They are what the engine
 * reproduces today; a change may raise them and may not lower them. Where a
 * document falls short, the shortfall is named — several are the corpus
 * disagreeing with itself, and one is an unresolved question waiting on the
 * owner (00-OVERVIEW §5.6).
 *
 *   npx tsx tools/verify-engine.ts          # the gate
 *   npx tsx tools/verify-engine.ts --write  # re-record the baselines
 *
 * The measuring is `vu-chant`'s, not this file's — `vu-chant roundtrip <doc>`
 * shows any one of these documents letter by letter.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CORPUS = 'corpus/chants';
const BASELINE = 'corpus/engine-baseline.json';

interface Row {
  /** Syllables reproduced in every compared field. */
  matched: number;
  syllables: number;
  /** Why the rest fall short — one line, so a regression is legible in a diff. */
  note?: string;
}

const NOTES: Readonly<Record<string, string>> = {
  'bhagya-suktam':
    'holdings: word-initial sibilant hosts, unresolved (00 §5.6)',
  'durga-suktam':
    'the transcription sets 10 avagrahas apart as their own syllable; the corpus '
    + 'joins them 131 times to 10, so the engine follows the majority',
  'ganapati-atharvashirsham':
    'holdings: word-initial sibilant hosts, unresolved (00 §5.6)',
  'lakshmi-ashtottara':
    'praṇava written `om` in the file, `oṁ` by the engine',
  'mantra-pushpam':
    'praṇava written `om` in the file, `oṁ` by the engine',
  'puja-vidhi':
    'praṇava written `om` in the file, `oṁ` by the engine; scored under '
    + 'taittiriya, where its own profile is `prose` (99.34%)',
  'purusha-suktam':
    'holdings: word-initial sibilant hosts, unresolved (00 §5.6); scored under '
    + 'taittiriya, where its own profile drops the bīja pause',
  'sri-rudram':
    'holdings: word-initial sibilant hosts, unresolved (00 §5.6); scored under '
    + 'taittiriya, where its own profile drops the bīja pause',
};

function measure(file: string): Row {
  const args = [
    join('node_modules', 'tsx', 'dist', 'cli.mjs'),
    'packages/cli/src/main.ts', 'roundtrip', file, '--json',
  ];
  let out: string;
  try {
    out = execFileSync(process.execPath, args,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    // `roundtrip` exits 1 when a document has ANY divergence, which is the
    // right answer for one document and not for this gate: several of the
    // shortfalls below are the corpus disagreeing with itself. The report is
    // still on stdout, so read it and let the ratchet decide.
    const err = e as { status?: number; stdout?: string };
    if (err.status !== 1 || typeof err.stdout !== 'string') throw e;
    out = err.stdout;
  }
  const r = JSON.parse(out) as { matched: number; syllables: number };
  return { matched: r.matched, syllables: r.syllables };
}

const files = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error(`no documents in ${CORPUS}`);
  process.exit(2);
}

const measured: Record<string, Row> = {};
console.log(`\n── re-deriving ${files.length} documents\n`);
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  const r = measure(join(CORPUS, f));
  const note = NOTES[slug];
  measured[slug] = note === undefined ? r : { ...r, note };
}

if (process.argv.includes('--write')) {
  writeFileSync(BASELINE, `${JSON.stringify(measured, null, 2)}\n`, 'utf8');
  console.log(`recorded ${Object.keys(measured).length} baselines → ${BASELINE}\n`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`no baseline at ${BASELINE} — run with --write to record one`);
  process.exit(2);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Row>;

const fails: string[] = [];
let syllables = 0;
let matched = 0;
for (const [slug, got] of Object.entries(measured)) {
  const want = baseline[slug];
  syllables += got.syllables;
  matched += got.matched;
  const pct = (got.matched / got.syllables) * 100;
  if (want === undefined) {
    console.log(`new  ${slug.padEnd(26)} ${pct.toFixed(2).padStart(6)}%`
      + `  ${got.matched}/${got.syllables} — not in the baseline`);
    fails.push(`${slug} is not in the baseline — run --write after reviewing it`);
    continue;
  }
  // The ratchet: fewer syllables reproduced, or fewer syllables compared at
  // all, both mean the engine now does less with this document than it did.
  const worse = got.matched < want.matched || got.syllables < want.syllables;
  console.log(`${worse ? 'FAIL' : 'ok  '} ${slug.padEnd(26)} ${pct.toFixed(2).padStart(6)}%`
    + `  ${got.matched}/${got.syllables}`
    + (got.matched === want.matched && got.syllables === want.syllables
      ? ''
      : `  (was ${want.matched}/${want.syllables})`));
  if (worse) fails.push(`${slug}: ${want.matched}/${want.syllables} → ${got.matched}/${got.syllables}`);
}
for (const slug of Object.keys(baseline)) {
  if (measured[slug] === undefined) fails.push(`${slug} is in the baseline but was not measured`);
}

console.log(`\n     ${matched} of ${syllables} syllables across ${files.length} documents`
  + ` (${((matched / syllables) * 100).toFixed(2)}%)`);
console.log('     one profile for all of them — `vu-chant profile <doc>` finds each document\'s own');

console.log(`\n${fails.length === 0 ? 'ALL GATES PASS' : `${fails.length} FAILING:`}`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length === 0 ? 0 : 1);
