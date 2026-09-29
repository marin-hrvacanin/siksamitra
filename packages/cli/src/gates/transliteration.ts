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
 * Tamil is held to the published forms IN ITS CONVENTION, below.
 */
const SCRIPTS = new Set(['deva', 'tel']);
/**
 * TAMIL IS HELD TO THE PUBLISHED FORMS IN THE CONVENTION.
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
 * So every Tamil syllable must be either the published form or the published
 * form with exactly the convention's marks added (see `convention` below), and
 * the report is agreement with THAT. It used to be agreement with the bare
 * published letters, held to a fixed count of 2,467 — which printed "84.47%"
 * for a script that was correct everywhere, and could not say WHICH rows the
 * count was made of. A difference of any other kind fails, row by row.
 */
const REPORTED = 'tam';
const show = Number(process.argv[process.argv.indexOf('--show') + 1]) || 12;

type Row = [script: string, units: ScriptUnit[], form: string, occurrences: number];
const ref = JSON.parse(readFileSync(REFERENCE, 'utf8')) as { syllables: number; rows: Row[] };

type Miss = { units: ScriptUnit[]; want: string; got: string; n: number };
const miss: Record<string, Miss[]> = {
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

/*
 * THE CONVENTION, WRITTEN OUT INDEPENDENTLY OF THE ENGINE'S TABLES.
 *
 * Where the engine's Tamil differs from the published form, the difference
 * must be the convention and nothing else: take the convention's marks off the
 * engine's form and the published form must come back exactly, and the marks
 * taken off must be exactly the ones the IAST letters call for. The convention
 * is the four decisions of commit 214764f, and only those:
 *
 *   - a superscript for each voiced or aspirated stop, in order (`ப⁴` = bha);
 *   - one `'` after the approximation of each vocalic ṛ / ṝ / ḷ / ḹ;
 *   - `ऽ` for the avagraha, which Tamil Sanskrit borrows (published: `'`);
 *   - `ஂ` for the anusvāra, keeping ṁ apart from a real m (published: `ம்`).
 *
 * A row that fails any of it is a real difference, and fails.
 */
/* `j` is the Grantha letter ஜ and needs no digit, so its aspirate is ஜ². */
const SERIES: Record<string, string> = {
  kh: '²', g: '³', gh: '⁴', ch: '²', jh: '²', ṭh: '²', ḍ: '³', ḍh: '⁴',
  th: '²', d: '³', dh: '⁴', ph: '²', b: '³', bh: '⁴',
};
const VOCALIC = new Set(['ṛ', 'ṝ', 'ḷ', 'ḹ']);
const AVAGRAHA = '\u0001';
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function convention(units: readonly ScriptUnit[], published: string, engine: string): boolean {
  /* The engine's side, with the convention's marks counted and taken off. */
  const digits = engine.replace(/[^²³⁴]/g, '');
  const ticks = count(engine, /'/g);
  const bare = engine.replace(/[²³⁴']/g, '').replace(/ऽ/g, AVAGRAHA);
  /* The published side: a `'` after a vowel sign was the ṛ mark, applied to
     about half the occurrences; any other `'`, or a `ऽ`, is the avagraha. */
  const pub = published.replace(/(?<=[ுூ])'/g, '').replace(/['ऽ]/g, AVAGRAHA);
  /* Where the engine writes ஂ, the published side may have either spelling. */
  const same = new RegExp(`^${escape(bare).replace(/ஂ/g, '(?:ஂ|ம்)')}$`);
  return same.test(pub)
    && digits === units.map((u) => SERIES[u.c] ?? '').join('')
    && ticks === units.filter((u) => VOCALIC.has(u.c)).length
    && count(bare, /\u0001/g) === units.filter((u) => u.c === "'").length
    && count(bare, /ஂ/g) === units.filter((u) => u.c === 'ṁ').length;
}

const shown = (rows: readonly Miss[], label: string): void => {
  for (const e of [...rows].sort((x, y) => y.n - x.n).slice(0, show)) {
    console.log(`  ${iastOf(e.units).padEnd(10)} ${label} ${e.want.padEnd(12)}`
      + ` engine ${e.got.padEnd(12)} ×${e.n}`);
  }
};

let bad = 0;
for (const script of ['deva', 'tel']) {
  const rows = miss[script] ?? [];
  const n = rows.reduce((a, b) => a + b.n, 0);
  bad += n;
  const seen = carried[script] ?? 0;
  const pct = seen ? ((1 - n / seen) * 100).toFixed(2) : '0';
  console.log(`
${script}: ${n} of ${seen} syllables disagree (${rows.length} distinct) — ${pct}% agree`);
  shown(rows, 'published');
}

/*
 * Tamil: every syllable must be the published form, or the published form in
 * the convention — and nothing else. The convention rows are counted and shown
 * so the difference from the published data stays visible, but they are
 * correct by the convention and count as agreeing.
 */
const tamRows = miss[REPORTED] ?? [];
const inConvention = tamRows.filter((e) => convention(e.units, e.want, e.got));
const unexplained = tamRows.filter((e) => !convention(e.units, e.want, e.got));
const tamSeen = carried[REPORTED] ?? 0;
const tamConv = inConvention.reduce((a, b) => a + b.n, 0);
const tamBad = unexplained.reduce((a, b) => a + b.n, 0);
checked += tamSeen;
bad += tamBad;
console.log(`
tam: ${tamBad} of ${tamSeen} syllables disagree (${unexplained.length} distinct)`
  + ` — ${tamSeen ? ((1 - tamBad / tamSeen) * 100).toFixed(2) : '0'}% agree`
  + `
     ${tamSeen - tamConv - tamBad} exactly as published,`
  + ` ${tamConv} in the convention (superscript series, vocalic-ṛ mark)`);
shown(unexplained, 'published');
/* The control: the convention has to be DOING something. If no row differs
   from the published forms, the engine has stopped writing the convention and
   the check above would pass on bare letters. */
if (tamConv === 0) {
  console.log('\ntam: no syllable is in the convention — the superscript series is not being written.');
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
