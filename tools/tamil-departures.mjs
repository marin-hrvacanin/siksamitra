#!/usr/bin/env node
/**
 * THE TAMIL DEPARTURES, WRITTEN DOWN ONE BY ONE.
 *
 * The eleven shipped documents spell 77 Tamil syllables differently from the
 * engine. The owner's instruction was that Tamil be "consistent as any other
 * script and all preserved exactly" — and the second half of that turned out
 * to be impossible, because the published data is not consistent with ITSELF:
 * 43 syllables are written two ways, sometimes in one document. There is no
 * single published spelling to preserve.
 *
 * So every departure is classified, decided, and recorded here, and
 * `check:transliteration` then holds Tamil to the same standard as Devanāgarī
 * and Telugu: it must match the published forms EXCEPT at these rows, and a
 * row that stops applying is an error too. Nothing can drift quietly again.
 *
 *   node tools/tamil-departures.mjs           check the file is current
 *   node tools/tamil-departures.mjs --write   rebuild it
 *
 * THE THREE CLASSES, and why the engine's form was taken in each.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { transliterateSyllable } from '@siksamitra/engine';

const REFERENCE = 'corpus/transliteration-reference.json';
const OUT = 'corpus/tamil-departures.json';

const CLASSES = {
  avagraha: {
    why: 'The published form contains U+093D DEVANAGARI SIGN AVAGRAHA inside a '
      + 'Tamil string. A Devanāgarī codepoint in a Tamil field is a defect by any '
      + "standard, and the corpus writes the same syllables with `'` elsewhere — "
      + "`'ஹ` three times against `ऽஹ` once. The engine's apostrophe is taken.",
  },
  anusvara: {
    why: 'The published form writes the anusvāra as ம் — the consonant ma plus a '
      + 'virama — where the engine writes ஂ, U+0B82 TAMIL SIGN ANUSVARA, which is '
      + 'the character for exactly this. ம் also conflates `ṁ` with a real `m`, so '
      + 'the distinction the IAST source makes is lost on the page. The corpus '
      + 'uses both spellings for the same syllable — `நஂ` 24 times against `நம்` '
      + "three — so there is nothing consistent to preserve. The engine's is taken.",
  },
  'vocalic-r': {
    why: "The published form appends an apostrophe to ரு / லு for vocalic ṛ and ḷ. "
      + 'It looks like notation and is not: it is applied to about half the '
      + 'occurrences (`க்ரு` 19 times against `க்ரு`+apostrophe 11), and it '
      + 'disambiguates nothing — the published data ALREADY writes `ப்ரு` for '
      + '`bru`, `bṛ`, `bhṛ` and `pṛ` alike. Tamil is a many-to-one script here by '
      + 'nature: `ba`, `bha`, `pa` and `pha` are all `ப` in the corpus as shipped. '
      + 'An inconsistent mark that separates nothing is noise, so it is dropped.',
  },
};

const iastOf = (units) => units.map((u) => u.c).join('');
const hasDevanagari = (s) => /[ऀ-ॿ]/.test(s);

/** Which class a departure falls in, or null if it is a new kind. */
function classify(published, engine) {
  if (hasDevanagari(published)) return 'avagraha';
  if (published.includes('ம்') && engine.includes('ஂ')) return 'anusvara';
  if (published.replace(/'/g, '') === engine && published.includes("'")) return 'vocalic-r';
  return null;
}

const ref = JSON.parse(readFileSync(REFERENCE, 'utf8'));
const rows = [];
const unclassified = [];
for (const [script, units, published, n] of ref.rows) {
  if (script !== 'tam') continue;
  const engine = transliterateSyllable(units, 'tam');
  if (engine === published) continue;
  const cls = classify(published, engine);
  if (cls === null) { unclassified.push({ units, published, engine, n }); continue; }
  rows.push([iastOf(units), published, engine, cls, n]);
}
rows.sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0].localeCompare(b[0])));

if (unclassified.length > 0) {
  console.log(`\n  ${unclassified.length} Tamil departure(s) fit none of the three classes.`);
  console.log('  A new kind of difference is a decision nobody has made yet:\n');
  for (const u of unclassified.slice(0, 10)) {
    console.log(`    ${iastOf(u.units).padEnd(10)} published ${u.published}   engine ${u.engine}   ×${u.n}`);
  }
  console.log('');
  process.exit(1);
}

const body = {
  note: 'Every Tamil syllable the eleven shipped documents spell differently from '
    + 'the engine, with the class it falls in and the decision. `check:transliteration` '
    + 'holds Tamil to the published forms EXCEPT at these rows. Rebuild with '
    + '`node tools/tamil-departures.mjs --write`, which refuses a difference that '
    + 'fits none of the classes.',
  classes: Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, v.why])),
  rows,
};

const text = `${JSON.stringify(body, null, 1)}\n`;
if (process.argv.includes('--write')) {
  writeFileSync(OUT, text);
  const byClass = new Map();
  for (const r of rows) byClass.set(r[3], (byClass.get(r[3]) ?? 0) + r[4]);
  console.log(`\n  ${rows.length} departures written to ${OUT}`);
  for (const [k, n] of byClass) console.log(`    ${k.padEnd(12)} ${n} occurrences`);
  console.log('');
} else {
  const have = readFileSync(OUT, 'utf8');
  if (have !== text) {
    console.log(`\n  ${OUT} is out of date — run: node tools/tamil-departures.mjs --write\n`);
    process.exit(1);
  }
  console.log(`\n  ${rows.length} Tamil departures, all classified.\n`);
}
