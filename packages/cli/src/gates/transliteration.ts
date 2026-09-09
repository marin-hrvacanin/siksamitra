/**
 * Gate 02 G6 — transliteration parity against the owner's published forms.
 *
 * Every syllable's `deva` / `tel` / `tam` form, re-derived from its letters and
 * compared with what the eleven shipped documents actually carried. The corpus
 * is the owner's own published output, so it is the authority; a mismatch is a
 * defect in our tables, not in his files.
 *
 * IT READS A FIXTURE, NOT THE CORPUS, AND THAT IS THE POINT. The documents used
 * to store a `deva`, `tel` and `tam` string on every syllable — 45% of the file
 * — and they no longer do: a verse is text and markings, and the script forms
 * are rebuilt on open by the same `transliterateSyllable` this gate is meant to
 * check. Pointed at the corpus it would now compare the engine with itself and
 * pass on anything.
 *
 * So the published forms were frozen at the commit before they stopped being
 * stored — 4,825 rows covering 15,881 syllables — and
 * that file is the authority now. It never changes unless somebody decides it
 * should.
 *
 *   npx tsx packages/cli/src/gates/transliteration.ts [--show N]
 */
import { readFileSync } from 'node:fs';
import { transliterateSyllable } from '@siksamitra/engine';
import type { ScriptUnit } from '@siksamitra/engine';

const REFERENCE = 'corpus/transliteration-reference.json';
/**
 * Devanāgarī and Telugu must reproduce the published forms exactly.
 *
 * Tamil cannot, ON PURPOSE, and is held to a different standard below.
 */
const SCRIPTS = new Set(['deva', 'tel']);
/**
 * TAMIL IS HELD TO A FIXED DELTA, not to the published forms.
 *
 * The shipped documents write Sanskrit in bare Tamil letters, so `ba`, `bha`,
 * `pa` and `pha` are all `ப` — 24, 140, 302 and 7 times — and their Tamil
 * collides 215 ways. They are also inconsistent with themselves: 43 syllables
 * appear spelled two ways, `நஂ` 24 times against `நம்` three, sometimes
 * inside one document. There was never a single published spelling to preserve.
 *
 * So the engine now prints the convention Tamil Sanskrit is actually printed
 * in — superscript digits for the stop series, `க க² க³ க⁴` — which is
 * what Ramakrishna Math, Giri and most stotra publishing use. With the series
 * marked, Tamil collides on 30 syllables over the corpus, which is exactly what
 * Devanāgarī and Telugu collide on, and every one of those is the virāma tick
 * rather than a letter. It round-trips 15881/15881 with NO hidden marker.
 *
 * The difference from the published forms is therefore expected, and its size
 * is recorded. A NEW difference — a letter that changes for any other reason —
 * moves the number and fails.
 */
const TAM_EXPECTED_DELTA = 2467;
const REPORTED = 'tam';
const show = Number(process.argv[process.argv.indexOf('--show') + 1]) || 12;

type Row = [script: string, units: ScriptUnit[], form: string, occurrences: number];
const ref = JSON.parse(readFileSync(REFERENCE, 'utf8')) as { syllables: number; rows: Row[] };

const miss: Record<string, { units: ScriptUnit[]; want: string; got: string; n: number }[]> = {
  deva: [], tel: [], tam: [],
};
const carried: Record<string, number> = { deva: 0, tel: 0, tam: 0 };
let checked = 0;

for (const [script, units, want, n] of ref.rows) {
  const bucket = miss[script];
  if (bucket === undefined) continue;
  carried[script] = (carried[script] ?? 0) + n;
  if (SCRIPTS.has(script)) checked += n;
  const got = transliterateSyllable(units, script as Parameters<typeof transliterateSyllable>[1]);
  if (got === want) continue;
  bucket.push({ units, want, got, n });
}

const iastOf = (units: readonly ScriptUnit[]): string => units.map((u) => u.c).join('');

let bad = 0;
for (const script of ['deva', 'tel', REPORTED]) {
  const rows = miss[script] ?? [];
  const n = rows.reduce((a, b) => a + b.n, 0);
  if (SCRIPTS.has(script)) bad += n;
  const seen = carried[script] ?? 0;
  const pct = seen ? ((1 - n / seen) * 100).toFixed(2) : '0';
  console.log(`\n${script}: ${n} of ${seen} syllables disagree (${rows.length} distinct)`
    + ` — ${pct}% agree`
    + (SCRIPTS.has(script) ? '' : `   [the convention change: ${TAM_EXPECTED_DELTA} expected]`));
  for (const e of [...rows].sort((a, b) => b.n - a.n).slice(0, show)) {
    console.log(`  ${iastOf(e.units).padEnd(10)} published ${e.want.padEnd(12)}`
      + ` engine ${e.got.padEnd(12)} ×${e.n}`);
  }
}

/*
 * Tamil: the delta must be exactly the convention change, no more and no less.
 * More means something else moved; fewer means the convention is not being
 * applied everywhere it should be.
 */
const tamDelta = (miss[REPORTED] ?? []).reduce((a, b) => a + b.n, 0);
if (tamDelta !== TAM_EXPECTED_DELTA) {
  console.log(`\ntam departs from the published forms in ${tamDelta} syllables;`
    + ` ${TAM_EXPECTED_DELTA} is the recorded convention change.`
    + '\nSomething other than the superscript convention has moved.');
  process.exit(1);
}

/* The fixture has to actually contain something. An empty or truncated one
   would make every line above read 0 of 0 and the gate pass on nothing. */
if (ref.rows.length < 4700) {
  console.log(`\n${REFERENCE} holds only ${ref.rows.length} rows — it is truncated.`);
  process.exit(1);
}

console.log(`\n${ref.syllables} syllables, ${checked} assertions,`
  + ` ${checked - bad} pass, ${bad} fail`);
process.exit(bad === 0 ? 0 : 1);
