#!/usr/bin/env node
/**
 * CAN EVERY TRANSCRIBED VERSE IN THE CORPUS ADOPT A SOURCE LAYER?
 *
 * `adoptSource` is only safe because it verifies its own result and refuses
 * when it cannot reproduce the marks. That makes it safe; it does not make it
 * USEFUL. If it refuses on most of the corpus, the marking buttons are still
 * dead and the feature is a comment.
 *
 * So this counts. It is a measurement with the answer written down, not an
 * assertion that something did not throw.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { adoptSource, unitsOf } from '@siksamitra/edit';
import { normalizeChantDoc } from '@siksamitra/format';

const DIR = 'corpus/chants';
const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));

let verses = 0;
let transcribed = 0;
let adopted = 0;
let clean = 0;
let witnesses = 0;
let letters = 0;
const refused = [];

for (const file of files.sort()) {
  const doc = normalizeChantDoc(JSON.parse(await readFile(join(DIR, file), 'utf8')));
  let overrides = doc.overrides ?? [];
  let docAdopted = 0;
  let docRefused = 0;
  let docWitness = 0;

  for (const section of doc.sections) {
    for (const verse of section.verses) {
      verses += 1;
      if (verse.src !== undefined) continue;
      transcribed += 1;
      const r = adoptSource(verse, section, doc.profile, overrides);
      if (!r.ok) {
        docRefused += 1;
        refused.push(`${file} ${verse.id}: ${r.why}`);
        continue;
      }
      adopted += 1;
      docAdopted += 1;
      letters += unitsOf(verse.tokens).length;
      if (r.changed) {
        overrides = r.overrides;
        witnesses += r.witnessed;
        docWitness += r.witnessed;
        if (r.witnessed === 0) clean += 1;
      } else clean += 1;
    }
  }
  if (transcribed > 0) {
    console.log(
      `  ${file.replace('.json', '').padEnd(28)}`
      + `${String(docAdopted).padStart(4)} adopted`
      + `${docRefused > 0 ? `, ${docRefused} refused` : ''}`
      + `${docWitness > 0 ? `, ${docWitness} witness(es)` : ''}`,
    );
  }
}

console.log(`\n  ${verses} verses, ${transcribed} of them transcribed`);
if (transcribed > 0) {
  const pct = ((adopted / transcribed) * 100).toFixed(1);
  console.log(`  ${adopted} adopted a source layer (${pct}%), ${clean} needed no override at all`);
  console.log(`  ${witnesses} witness override(s) over ${letters} letters`);
}
if (refused.length > 0) {
  console.log(`\n  ${refused.length} refused — the marks could not be reproduced:`);
  for (const r of refused.slice(0, 25)) console.log(`    ${r}`);
  if (refused.length > 25) console.log(`    … and ${refused.length - 25} more`);
}
console.log('');
