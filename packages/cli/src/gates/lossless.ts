/**
 * The losslessness gate — can every script give back what it was given?
 *
 * OWNER'S REQUIREMENT (2026-09-06): all scripts should be lossless.
 *
 * "Lossless" is only worth asserting if it is measured, so this takes every
 * syllable of the eleven corpus documents, writes it in each registered script
 * with lossless mode on, reads it back, and compares. A script that cannot
 * return what it was handed is reported with the syllables it lost.
 *
 * Why the whole corpus rather than a sample: the losses are not evenly spread.
 * They cluster on the constructs a table cannot express — Tamil's missing
 * aspiration and voicing, the vocalic vowels it has no sign for, the conjunct
 * choices a romanisation flattens — and those appear in a handful of words that
 * a sample misses and a real document does not.
 *
 * It is a RATCHET. Scripts start where they are and may only improve.
 *
 *   npm run check:lossless
 *   npm run check:lossless -- --show 20     # print the losing syllables
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ZWJ, ZWNJ, registeredScripts, toIast, transliterateSyllable,
  type ScriptKey, type ScriptUnit,
} from '@siksamitra/engine';
import { normalizeChantDoc, type ChantDoc } from '@siksamitra/format';

const CORPUS = 'corpus/chants';
const BASELINE = 'corpus/lossless-baseline.json';
const show = Number(process.argv[process.argv.indexOf('--show') + 1]) || 0;

interface Syl {
  t: string;
  iast?: string;
  units?: { c: string; cj?: 'split' | 'join'; candra?: boolean }[];
}

/** Every syllable in the corpus, descending into slots. */
function corpusSyllables(): Syl[] {
  const out: Syl[] = [];
  const walk = (tokens: unknown[]): void => {
    for (const raw of tokens ?? []) {
      const t = raw as Syl & { tokens?: unknown[] };
      if (t.t === 'syl') out.push(t);
      else if (t.t === 'slot' && Array.isArray(t.tokens)) walk(t.tokens);
    }
  };
  for (const file of readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort()) {
    /* NORMALISED, not raw. A composed section stores its verses in `items`
       and no longer repeats them in `verses` on disk, so a raw read sees an
       empty section and this gate would silently measure nothing. */
    const doc = normalizeChantDoc(
      JSON.parse(readFileSync(join(CORPUS, file), 'utf8')) as ChantDoc,
    );
    for (const s of doc.sections) for (const v of s.verses) walk(v.tokens ?? []);
  }
  return out;
}

/**
 * The virama tick, the svara marks and the candrabindu.
 *
 * These are MARKS. In this system they are data on the token, drawn by the
 * renderer, and never emitted as glyphs into any script — `bare()` in the
 * transliterator strips them for exactly that reason. So a script text that
 * does not carry them back is not lossy: the information never left the token
 * model.
 *
 * The halanta is a different thing and IS the script's business, which is why
 * the conjunct control below is included rather than stripped. Conflating the
 * two made this gate report 1 471 false losses.
 */
const MARKS = new Set(['̱', '̍', '̎', '̐', 'ˎ', '·']);

/**
 * The `:` of the special visarga `ḥ:` is also IAST-only.
 *
 * It is an ASCII notation for a visarga before `kṣ`; no Indic script writes a
 * colon, and the corpus renders `maḥ:` as `मः`. Like the marks, it never
 * entered the script text, so its absence on the way back is not a loss.
 */
function withoutMarks(s: string): string {
  return [...s].filter((c) => !MARKS.has(c) && c !== ':').join('');
}

/**
 * The pranava has one meaning and several spellings.
 *
 * A script with its own ligature writes every spelling as that one glyph, and
 * reading it back gives the canonical form. `om` returning as `oṁ` is the
 * ligature doing its job, not information lost.
 */
function normalisePranava(s: string): string {
  return s === 'om' || s === 'oṃ' || s === 'auṁ' ? 'oṁ' : s;
}

/**
 * What a round trip must return: the letters, plus any conjunct choice.
 *
 * Built from the UNITS rather than the stored `iast` string, because the string
 * is a display form that drops the conjunct control — precisely the information
 * under test.
 */
function expectedOf(syl: Syl): string {
  return (syl.units ?? [])
    .map((u) => withoutMarks(u.c) + (u.cj === 'split' ? ZWNJ : u.cj === 'join' ? ZWJ : ''))
    .join('');
}

const syllables = corpusSyllables();
const scripts = registeredScripts();

console.log(`\n── round-tripping ${syllables.length} syllables through ` +
  `${scripts.length} scripts\n`);

const results: Record<string, { total: number; exact: number; lost: string[] }> = {};

for (const script of scripts) {
  let exact = 0;
  const lost: string[] = [];
  for (const syl of syllables) {
    const units = (syl.units ?? []) as ScriptUnit[];
    if (units.length === 0) continue;
    const want = expectedOf(syl);
    let got: string;
    try {
      const id = script.id as ScriptKey;
      const written = transliterateSyllable(units, id, { lossless: true });
      got = withoutMarks(toIast(written, id).iast);
    } catch {
      got = '<threw>';
    }
    if (normalisePranava(got) === normalisePranava(want)) exact += 1;
    else if (lost.length < 400) lost.push(`${want} -> ${got}`);
  }
  results[script.id] = { total: syllables.length, exact, lost };
  const pct = (exact / syllables.length) * 100;
  const flag = exact === syllables.length ? 'lossless' : `${syllables.length - exact} lost`;
  console.log(`  ${script.id.padEnd(8)} ${pct.toFixed(2).padStart(6)}%  ` +
    `${String(exact).padStart(6)}/${syllables.length}  ${flag}` +
    `${script.verified ? '' : '   (forms unverified)'}`);
  if (show > 0 && lost.length > 0) {
    for (const l of [...new Set(lost)].slice(0, show)) console.log(`             ${l}`);
  }
}

if (process.argv.includes('--write')) {
  writeFileSync(BASELINE, JSON.stringify({
    note: 'Round-trip exactness per script over the corpus. May only go UP. '
        + 'The requirement is that every script reach 100 %.',
    total: syllables.length,
    exact: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.exact])),
  }, null, 2) + '\n');
  console.log(`\n  baseline recorded\n`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`\nno baseline — run: npm run check:lossless -- --write\n`);
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as {
  total: number; exact: Record<string, number>;
};

let failed = 0;
console.log('');
for (const [id, r] of Object.entries(results)) {
  const was = base.exact[id];
  if (was === undefined) {
    console.log(`  NEW  ${id} — record a baseline`);
  } else if (r.exact < was) {
    console.log(`  DOWN ${id}: ${was} -> ${r.exact}  REGRESSION`);
    failed += 1;
  }
}

const perfect = Object.values(results).filter((r) => r.exact === r.total).length;
console.log(`\n     ${perfect} of ${scripts.length} scripts round-trip exactly.`);
if (perfect < scripts.length) {
  console.log(`     The requirement is all of them. Run with --show to see what is lost.`);
}

if (failed > 0) {
  console.log(`\n${failed} script(s) regressed\n`);
  process.exit(1);
}
console.log('\nLOSSLESS GATE PASSES (no regression)\n');
