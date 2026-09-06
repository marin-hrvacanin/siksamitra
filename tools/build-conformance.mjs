/**
 * Build the conformance fixtures by MINING the real corpus.
 *
 * Hand-authored fixtures drift from reality: someone writes what they believe
 * a holding looks like, and the belief is what gets frozen. These are cut from
 * documents that are already verified — the same eleven the engine ratchet
 * measures against — so a fixture is a real construct as it actually occurs,
 * reduced to the smallest document that still contains it.
 *
 * Each fixture states, in plain data, what a CORRECT READER must conclude. It
 * names no function and imports nothing, because vedaunion.org has to be able
 * to run this suite against its own independent implementation. That is the
 * whole point: the fixtures are the arbiter precisely because they are not code
 * either side owns.
 *
 *   node tools/build-conformance.mjs          # write corpus/conformance/
 *   node tools/build-conformance.mjs --check  # fail if it would change
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CORPUS = 'corpus/chants';
const OUT = 'corpus/conformance';
const CONTRACT_VERSION = 4;

/** Every construct the contract defines, and how to spot one in the wild. */
const CONSTRUCTS = [
  { id: 'syllable-four-scripts', what: 'a syllable carrying all four script forms',
    find: (t) => t.t === 'syl' && t.deva && t.tel && t.tam },
  { id: 'unit-hold-short', what: 'a short holding on a letter',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.hold === 'short') },
  { id: 'unit-hold-long', what: 'a long holding on a letter',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.hold === 'long') },
  { id: 'unit-hold-group', what: 'a holding GROUP id, joining a box across letters',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.hg !== undefined) },
  { id: 'unit-svara-anudatta', what: 'an anudātta accent',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.svara === 'anudatta') },
  { id: 'unit-svara-svarita', what: 'a svarita accent',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.svara === 'svarita') },
  { id: 'unit-svara-dirgha-svarita', what: 'a dīrgha-svarita accent',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.svara === 'dirgha-svarita') },
  { id: 'unit-change', what: 'a change-style letter (an anusvāra rewritten by rule)',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.change !== undefined) },
  { id: 'unit-candra', what: 'the Vedic candrabindu on a letter',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.candra) },
  { id: 'unit-sup-aid', what: 'a superscript reading aid',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.sup !== undefined) },
  { id: 'unit-sbhakti', what: 'an epenthetic svarabhakti vowel',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.sbhakti !== undefined) },
  { id: 'unit-conjunct-control', what: 'an explicit conjunct split or join',
    find: (t) => t.t === 'syl' && t.units?.some((u) => u.cj !== undefined) },
  { id: 'token-danda', what: 'a daṇḍa as structure rather than as text',
    find: (t) => t.t === 'danda' },
  { id: 'token-pause', what: 'a recitation pause',
    find: (t) => t.t === 'pause' },
  { id: 'token-break', what: 'a line break inside a verse',
    find: (t) => t.t === 'br' },
  { id: 'token-text', what: 'literal text that is not recited',
    find: (t) => t.t === 'text' },
];

const docs = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort()
  .map((f) => ({ slug: f.replace(/\.json$/, ''), doc: JSON.parse(readFileSync(join(CORPUS, f), 'utf8')) }));

/** What a reader must be able to say about one syllable, without any engine. */
const readSyllable = (t) => ({
  iast: t.iast, deva: t.deva, tel: t.tel, tam: t.tam,
  units: (t.units ?? []).map((u) => {
    const marks = {};
    for (const k of ['hold', 'hg', 'svara', 'change', 'cj', 'candra', 'sup', 'sbhakti']) {
      if (u[k] !== undefined) marks[k] = u[k];
    }
    return { c: u.c, ...marks };
  }),
});

const fixtures = [];
const missing = [];

for (const { id, what, find } of CONSTRUCTS) {
  let hit = null;
  outer:
  for (const { slug, doc } of docs) {
    for (const section of doc.sections ?? []) {
      for (const verse of section.verses ?? []) {
        const at = (verse.tokens ?? []).findIndex(find);
        if (at === -1) continue;
        // The smallest document that still contains the construct: the verse it
        // occurs in, and enough of its ancestry to be a legal document.
        hit = {
          id,
          construct: what,
          contractVersion: CONTRACT_VERSION,
          minedFrom: { document: slug, section: section.id, verse: verse.id, tokenIndex: at },
          document: {
            format: doc.format ?? 'vu-chant',
            version: doc.version ?? CONTRACT_VERSION,
            id: `conformance-${id}`,
            title: `conformance: ${what}`,
            ...(doc.primaryScript ? { primaryScript: doc.primaryScript } : {}),
            ...(doc.scripts ? { scripts: doc.scripts } : {}),
            sections: [{
              id: section.id,
              ...(section.label ? { label: section.label } : {}),
              ...(section.source ? { source: section.source } : {}),
              verses: [{
                id: verse.id,
                ...(verse.n !== undefined ? { n: verse.n } : {}),
                ...(verse.src ? { src: verse.src } : {}),
                tokens: verse.tokens,
                ...(verse.translation ? { translation: verse.translation } : {}),
              }],
            }],
          },
          expect: {
            /* A correct reader concludes all of the following WITHOUT deriving
               anything. Every one of these is observable from the document. */
            sections: 1,
            verses: 1,
            tokens: verse.tokens.length,
            syllables: verse.tokens.filter((t) => t.t === 'syl').length,
            /* Marks are attested unless the verse carries a source layer.
               A reader that regenerates here is violating rule zero. */
            attested: verse.src === undefined,
            /* The token that carries the construct, read out in full. */
            tokenAt: { index: at, token: verse.tokens[at].t === 'syl'
              ? readSyllable(verse.tokens[at])
              : verse.tokens[at] },
          },
        };
        break outer;
      }
    }
  }
  if (hit === null) missing.push(id);
  else fixtures.push(hit);
}

const index = {
  contractVersion: CONTRACT_VERSION,
  generated: 'tools/build-conformance.mjs',
  note: 'Mined from corpus/chants. See docs/INTERCHANGE.md §8. Any reader of the '
      + 'format may run these; they import nothing.',
  fixtures: fixtures.map((f) => ({ id: f.id, construct: f.construct, file: `${f.id}.json` })),
  constructsWithoutFixture: missing,
};

const files = [['index.json', index], ...fixtures.map((f) => [`${f.id}.json`, f])];

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const [name, body] of files) {
    const path = join(OUT, name);
    const want = JSON.stringify(body, null, 2) + '\n';
    const got = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (got !== want) { console.error(`  stale: ${name}`); bad += 1; }
  }
  if (bad > 0) {
    console.error(`\n${bad} fixture(s) stale — run: node tools/build-conformance.mjs\n`);
    process.exit(1);
  }
  console.log(`conformance fixtures current (${fixtures.length} constructs)`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
for (const [name, body] of files) {
  writeFileSync(join(OUT, name), JSON.stringify(body, null, 2) + '\n');
}
console.log(`\n  ${fixtures.length} fixtures written to ${OUT}`);
for (const f of fixtures) console.log(`    ${f.id.padEnd(26)} ${f.minedFrom.document}`);
if (missing.length > 0) {
  console.log(`\n  ${missing.length} construct(s) with NO example in the corpus:`);
  for (const m of missing) console.log(`    ${m}`);
  console.log('  These are unexercised by the fixtures and will drift silently.');
}
console.log('');
