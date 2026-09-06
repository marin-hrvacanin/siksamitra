/**
 * Gate 02 G6 — transliteration parity against the shipped corpus.
 *
 * Re-derives every syllable's `deva` / `tel` / `tam` form from its `iast` and
 * compares with what the 11 shipped documents actually store. That corpus is
 * the owner's own published output, so it is the authority; any mismatch is a
 * defect in our tables, not in his files.
 *
 *   npx tsx tools/verify-transliteration.ts [--show N]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { transliterateSyllable } from '@siksamitra/engine';
import type { ScriptUnit } from '@siksamitra/engine';

const DIR = 'corpus/chants';
/**
 * Devanāgarī and Telugu only. The owner has confirmed the TAMIL forms in the
 * shipped chants were never reviewed, so they are not a verification target —
 * fitting the tables to them would bake in their errors.
 */
const SCRIPTS = ['deva', 'tel'] as const;
const show = Number(process.argv[process.argv.indexOf('--show') + 1]) || 12;

interface Syl {
  t: string;
  units?: ScriptUnit[];
  iast?: string;
  deva?: string;
  tel?: string;
  tam?: string;
  tokens?: Syl[];
}

const miss: Record<string, Map<string, { iast: string; want: string; got: string; n: number }>> = {
  deva: new Map(), tel: new Map(),
};
let total = 0;
let checked = 0;

function walk(tokens: Syl[]): void {
  for (const t of tokens) {
    if (t.t === 'slot' && t.tokens) { walk(t.tokens); continue; }
    if (t.t !== 'syl' || !t.units) continue;
    total += 1;
    for (const script of SCRIPTS) {
      const want = t[script];
      if (typeof want !== 'string' || want === '') continue;
      checked += 1;
      const got = transliterateSyllable(t.units, script);
      if (got === want) continue;
      const key = `${t.iast ?? ''}→${want}`;
      const hit = miss[script]!.get(key);
      if (hit) hit.n += 1;
      else miss[script]!.set(key, { iast: t.iast ?? '', want, got, n: 1 });
    }
  }
}

for (const f of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as {
    sections?: { verses?: { tokens?: Syl[] }[] }[];
  };
  for (const s of doc.sections ?? []) {
    for (const v of s.verses ?? []) walk(v.tokens ?? []);
  }
}

let bad = 0;
for (const script of SCRIPTS) {
  const m = miss[script]!;
  const n = [...m.values()].reduce((a, b) => a + b.n, 0);
  bad += n;
  const pct = checked ? ((1 - n / (checked / SCRIPTS.length)) * 100).toFixed(2) : '0';
  console.log(`\n${script}: ${n} mismatched syllables (${m.size} distinct) — ${pct}% agree`);
  for (const e of [...m.values()].sort((a, b) => b.n - a.n).slice(0, show)) {
    console.log(`  ${e.iast.padEnd(10)} want ${e.want.padEnd(12)} got ${e.got.padEnd(12)} ×${e.n}`);
  }
}
console.log(`\n${total} syllables, ${checked} assertions, ${checked - bad} pass, ${bad} fail`);
process.exit(bad === 0 ? 0 : 1);
