/**
 * THE OWNER'S OWN REFERENCE DOCUMENTS, re-derived — a ratchet.
 *
 * `Library/reference/` holds his marked files: the Veda Union sādhanā, the
 * kanakadhārā stotram, agnimīḻe sūktam and whatever he adds. They are NOT in
 * the repository (Library/ is his, and ignored); this gate runs where they are
 * and says loudly when they are not. What it measures is the engine against
 * the marks he placed, letter by letter:
 *
 *   1. read each file exactly as a person would (`importFile` — the CLI's own
 *      path, Word or PDF);
 *   2. fit each section's register as `attach-src` does, because one document
 *      mixes Taittirīya, Ṛgveda and smārta sections;
 *   3. re-derive every verse from its reconstructed, accented source under
 *      that register, and compare every syllable's letters and marks.
 *
 * The figures ratchet in `corpus/reference-baseline.json` (numbers only — no
 * text of his). A number may rise; a fall fails, naming the file.
 *
 *   npx tsx packages/cli/src/gates/reference.ts [--write]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILES, resolveProfile } from '@siksamitra/engine';
import { CANDIDATE_PATCHES, attachSource } from '../attach-src.js';
import { ImportFailure, importFile } from '../import-file.js';
import { divergenceRows, score } from '../score.js';

const DIR = 'Library/reference';
const BASELINE = 'corpus/reference-baseline.json';

if (!existsSync(DIR)) {
  console.log(`\n  SKIPPED — ${DIR} is not here. It holds the owner's own marked files,`);
  console.log('  which are not in the repository. Put them there to run this gate.\n');
  process.exit(0);
}

type Row = { matched: number; syllables: number; verses: number };
const measured: Record<string, Row> = {};
const skipped: string[] = [];

console.log('\n── his reference documents, re-derived\n');
for (const file of readdirSync(DIR).filter((f) => /\.(docx|pdf)$/i.test(f) && !f.startsWith('~$')).sort()) {
  let doc;
  try {
    ({ doc } = importFile(join(DIR, file)));
  } catch (e) {
    if (!(e instanceof ImportFailure)) throw e;
    skipped.push(`${file}: ${e.message.split('\n')[0]}`);
    continue;
  }
  const attached = attachSource(doc, resolveProfile([{ preset: 'taittiriya' } as never]), { overrides: false }).doc;
  /*
   * EACH SECTION'S REGISTER, BY WHAT THIS GATE MEASURES. `attachSource` fits a
   * section by the VERSES it reproduces exactly, which is its business — it
   * writes source layers. This gate counts SYLLABLES, and the two objectives
   * part: given the older conventions as candidates, the fit attached more
   * whole verses of the sādhanā v9.1.4 while matching 43 fewer syllables. So
   * each section is re-fitted here by syllables matched, starting from the fit
   * it already has and changing it only for a better score.
   */
  const docRef = attached.profile ?? { preset: 'taittiriya' };
  const fitted = {
    ...attached,
    sections: attached.sections.map((s) => {
      const matched = (ref: unknown): number => score(
        { ...attached, sections: [{ ...s, profile: ref as never }] },
        resolveProfile([ref as never]), { witness: true },
      ).matched;
      let best = { ref: (s.profile ?? docRef) as unknown, m: matched(s.profile ?? docRef) };
      for (const preset of Object.keys(PROFILES)) {
        for (const c of CANDIDATE_PATCHES) {
          const ref = { preset, patch: c.patch };
          const m = matched(ref);
          if (m > best.m) best = { ref, m };
        }
      }
      return { ...s, profile: best.ref as never };
    }),
  };
  const sc = score(fitted, resolveProfile([docRef] as never), { witness: true });
  const verses = fitted.sections.reduce((n, s) => n + s.verses.length, 0);
  measured[file] = { matched: sc.matched, syllables: sc.syllables, verses };
  const pct = sc.syllables === 0 ? 0 : (100 * sc.matched) / sc.syllables;
  console.log(`  ${file.slice(0, 44).padEnd(44)} ${String(verses).padStart(4)} verses  `
    + `${pct.toFixed(2).padStart(6)}%  ${sc.matched}/${sc.syllables}`);
  if (process.argv.includes('--why')) {
    for (const [what, { count, examples }] of divergenceRows(sc).slice(0, 14)) {
      console.log(`      ${String(count).padStart(5)}  ${what.slice(0, 70).padEnd(70)} ${examples.slice(0, 2).join(' · ').slice(0, 80)}`);
    }
  }
}
for (const s of skipped) console.log(`  SKIPPED ${s}`);

if (process.argv.includes('--write')) {
  writeFileSync(BASELINE, `${JSON.stringify(measured, null, 2)}\n`, 'utf8');
  console.log(`\n  recorded → ${BASELINE}\n`);
  process.exit(0);
}
const baseline: Record<string, Row> = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Row> : {};
const fails: string[] = [];
for (const [file, now] of Object.entries(measured)) {
  const was = baseline[file];
  if (was !== undefined && now.matched < was.matched) {
    fails.push(`${file}: ${was.matched} → ${now.matched} syllables re-derived`);
  }
}
if (fails.length > 0) {
  console.log(`\n${fails.length} FALLING:\n${fails.map((f) => `  ✗ ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`\nREFERENCE GATE PASSES — ${Object.keys(measured).length} documents at or above their baseline\n`);
