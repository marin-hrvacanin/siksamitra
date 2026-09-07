#!/usr/bin/env tsx
/**
 * The source-layer gate: does every derived verse actually re-derive?
 *
 * A verse with a `src` layer is a PROMISE — that feeding those lines back
 * through the engine reproduces the verse exactly, so a rule fix can be rolled
 * forward and the editor may touch it. This gate is the promise checked.
 *
 * WHY IT HAD TO EXIST. `sm attach-src` decides which verses get a source
 * layer, and `check:engine` measures the engine against the corpus — but
 * `check:engine` re-inverts the tokens instead of reading `src.lines`, and it
 * compares syllables only. So neither one could see whether the stored source
 * was right. It wasn't, twice over: a Tamil column copied back by token index
 * garbled 239 verses, and an emitter adding a space after every daṇḍa would
 * have rendered 176 verses with a space the document does not have. Both were
 * found by an outside reviewer writing exactly this check by hand.
 *
 * It is a TEST, not a ratchet: a verse either reproduces or it does not, and
 * there is no number here that may drift. `attach-src` is what decides how
 * many verses make the claim; this decides whether the claim is true.
 *
 *   npx tsx packages/cli/src/gates/source.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { derive, resolveProfile } from '@siksamitra/engine';
import { profileChain } from '@siksamitra/edit';
import { canonicalJson, normalizeChantDoc } from '@siksamitra/format';
import type { ChantDoc, ChantToken } from '@siksamitra/format';

const DIR = join(process.cwd(), 'corpus', 'chants');

interface Row {
  file: string;
  verses: number;
  derived: number;
  ok: number;
  bad: { verse: string; why: string }[];
}

/** The first difference between two token streams, in words. */
function firstDifference(want: readonly ChantToken[], got: readonly ChantToken[]): string {
  if (want.length !== got.length) {
    return `${want.length} tokens stored, ${got.length} derived`;
  }
  for (const [i, a] of want.entries()) {
    const b = got[i]!;
    if (canonicalJson(a) === canonicalJson(b)) continue;
    const label = a.t === 'syl' ? `syllable "${a.iast}"` : `${a.t} token`;
    return `token ${i} (${label}): ${canonicalJson(a).slice(0, 90)} stored, `
      + `${canonicalJson(b).slice(0, 90)} derived`;
  }
  return 'no difference found, which should be impossible here';
}

const rows: Row[] = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const doc = normalizeChantDoc(
    JSON.parse(readFileSync(join(DIR, file), 'utf8')) as ChantDoc,
  );
  const row: Row = { file, verses: 0, derived: 0, ok: 0, bad: [] };
  const overrides = doc.overrides ?? [];

  for (const section of doc.sections) {
    for (const verse of section.verses) {
      row.verses += 1;
      if (verse.src === undefined) continue;
      row.derived += 1;

      const profile = resolveProfile(profileChain(verse, section, doc.profile));
      const result = derive(
        {
          lines: [...verse.src.lines],
          ...(verse.src.accented === undefined ? {} : { accented: [...verse.src.accented] }),
        },
        profile,
        { verseId: verse.id, verseN: verse.n ?? null, overrides, trace: false },
      );

      if (canonicalJson(result.tokens) === canonicalJson(verse.tokens)) {
        row.ok += 1;
        continue;
      }
      row.bad.push({ verse: verse.id, why: firstDifference(verse.tokens, result.tokens) });
    }
  }
  rows.push(row);
}

console.log('\n── the source layer, re-derived\n');
console.log('       verses  derived  reproduce  file');
let verses = 0;
let derived = 0;
let ok = 0;
for (const row of rows) {
  verses += row.verses;
  derived += row.derived;
  ok += row.ok;
  const mark = row.bad.length === 0 ? 'ok  ' : 'FAIL';
  console.log(
    `  ${mark} ${String(row.verses).padStart(6)}  ${String(row.derived).padStart(7)}`
    + `  ${String(row.ok).padStart(9)}  ${row.file}`,
  );
  for (const bad of row.bad.slice(0, 3)) {
    console.log(`         ${bad.verse}: ${bad.why}`);
  }
  if (row.bad.length > 3) console.log(`         … and ${row.bad.length - 3} more`);
}

const frozen = verses - derived;
console.log(
  `\n     ${derived} of ${verses} verses carry a source layer; ${ok} of those `
  + `re-derive exactly.\n     ${frozen} are transcribed and are not this gate's `
  + 'business — rule zero.\n',
);

if (ok !== derived) {
  console.log(`${derived - ok} verse(s) claim a source layer that does not reproduce them.\n`);
  process.exit(1);
}
console.log('SOURCE GATE PASSES\n');
