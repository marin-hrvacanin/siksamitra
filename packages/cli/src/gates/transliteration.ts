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
 * Devanāgarī and Telugu are verified. The owner has confirmed the TAMIL forms
 * in the shipped chants were never reviewed, so they are not a verification
 * target — fitting the tables to them would bake in their errors.
 */
const SCRIPTS = new Set(['deva', 'tel']);
/**
 * Tamil is REPORTED, never failed on.
 *
 * Leaving it unmeasured meant nobody knew how far it had drifted, and it has:
 * 215 of 15,881 syllables disagree with the engine. The shipped side is
 * demonstrably the wrong one in places — `ऽ`, the DEVANĀGARĪ avagraha, sits in
 * the Tamil field of ten syllables — and it disagrees WITH ITSELF: 43 syllables
 * are spelled two ways, `saṁ` as `ஸம்` in one place and `ஸஂ` in another inside
 * one document. Each spelling is its own row in the fixture, so the count above
 * is exact; collapsing them reported 353 where the truth is 215.
 *
 * That self-contradiction is why the corpus could not simply be carried
 * forward when the forms stopped being stored: there is no single spelling to
 * carry. The engine's is consistent, so the engine's is what a rebuilt
 * document now shows. It prints here so the number cannot grow quietly, and so
 * the list is in front of whoever reviews Tamil.
 */
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
    + (SCRIPTS.has(script) ? '' : '   [REPORTED, not a target — see the note in this file]'));
  for (const e of [...rows].sort((a, b) => b.n - a.n).slice(0, show)) {
    console.log(`  ${iastOf(e.units).padEnd(10)} published ${e.want.padEnd(12)}`
      + ` engine ${e.got.padEnd(12)} ×${e.n}`);
  }
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
