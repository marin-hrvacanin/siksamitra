/**
 * Build the conformance fixtures.
 *
 * These are the ONLY mechanism that detects drift between this program and
 * vedaunion.org's independent reader of the same format, so what they assert
 * matters more than how many of them there are.
 *
 * WHAT WENT WRONG THE FIRST TIME, because the shape of the fix follows from it.
 * The first version copied a verse's tokens into the fixture and then asserted
 * facts computed FROM THOSE SAME TOKENS — the token count, the syllable count,
 * the token at index n. Every assertion was an identity. A reader consisting of
 * `JSON.parse` and re-emit passed all ninety, and `CONFORMANCE PASSES` said so
 * every run. The suite that existed to catch drift could not catch anything.
 *
 * The rule that replaces it: **an expectation must be something a reader
 * PRODUCES, never something the document CONTAINS.** So each fixture now
 * asserts:
 *
 *   - `recitation` — the chanted text per script. Catches a reader that drops
 *     slot contents, leaks a placeholder, or recites the verse numbers.
 *   - `holdings` — box spans as letter ranges. Catches a reader that draws one
 *     box per `hold` instead of one per `hg`.
 *   - `provenance` — the resolved citation and where it was inherited from.
 *     Catches a reader that only looks at the verse.
 *   - `attested` — rule zero, from the shared predicate.
 *
 * Fixtures are also PRUNED from the real document rather than rebuilt from a
 * whitelist. Rebuilding dropped `items`, `words`, `recording`, the document's
 * own `source` and every other v3 field — which silently changed the very
 * provenance the fixture now asserts.
 *
 *   node tools/build-conformance.mjs           # write
 *   node tools/build-conformance.mjs --check   # fail if stale
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  holdingSpans, isAttested, recitationText, resolveSource, syllableCount,
} from '../packages/format/src/text.ts';
import { normalizeChantDoc } from '../packages/format/src/chant-select.ts';

const CORPUS = 'corpus/chants';
const OUT = 'corpus/conformance';
const CONTRACT_VERSION = 4;
const SCRIPTS = ['iast', 'deva', 'tel', 'tam'];

/** Walk a token list, descending into slots. */
function* walk(tokens) {
  for (const t of tokens ?? []) {
    yield t;
    if (t.t === 'slot') yield* walk(t.tokens);
  }
}
const anyUnit = (t, p) => t.t === 'syl' && (t.units ?? []).some(p);

const CONSTRUCTS = [
  { id: 'syllable-four-scripts', what: 'a syllable carrying all four script forms',
    find: (t) => t.t === 'syl' && t.deva && t.tel && t.tam },
  { id: 'unit-hold-short', what: 'a short holding on a letter',
    find: (t) => anyUnit(t, (u) => u.hold === 'short') },
  { id: 'unit-hold-long', what: 'a long holding on a letter',
    find: (t) => anyUnit(t, (u) => u.hold === 'long') },
  { id: 'unit-hold-group', what: 'a holding GROUP spanning several letters',
    // The point of `hg` is a box across a RUN, so the fixture must be a run.
    // The first version mined a single-letter group and asserted nothing about
    // spanning, which is the one thing the construct exists for.
    find: (t) => t.t === 'syl' && (() => {
      const groups = new Map();
      for (const u of t.units ?? []) {
        if (u.hg === undefined) continue;
        groups.set(u.hg, (groups.get(u.hg) ?? 0) + 1);
      }
      return [...groups.values()].some((n) => n > 1);
    })() },
  { id: 'unit-svara-anudatta', what: 'an anudātta accent',
    find: (t) => anyUnit(t, (u) => u.svara === 'anudatta') },
  { id: 'unit-svara-svarita', what: 'a svarita accent',
    find: (t) => anyUnit(t, (u) => u.svara === 'svarita') },
  { id: 'unit-svara-dirgha-svarita', what: 'a dīrgha-svarita accent',
    find: (t) => anyUnit(t, (u) => u.svara === 'dirgha-svarita') },
  { id: 'unit-change', what: 'a change-style letter (an anusvāra rewritten by rule)',
    find: (t) => anyUnit(t, (u) => u.change !== undefined) },
  { id: 'unit-candra', what: 'the Vedic candrabindu on a letter',
    find: (t) => anyUnit(t, (u) => u.candra) },
  { id: 'unit-sup-aid', what: 'a superscript reading aid',
    find: (t) => anyUnit(t, (u) => u.sup !== undefined) },
  { id: 'unit-sbhakti', what: 'an epenthetic svarabhakti vowel',
    find: (t) => anyUnit(t, (u) => u.sbhakti !== undefined) },
  { id: 'token-danda', what: 'a daṇḍa as structure rather than as text',
    find: (t) => t.t === 'danda' },
  { id: 'token-pause', what: 'a recitation pause',
    find: (t) => t.t === 'pause' },
  { id: 'token-break', what: 'a line break inside a verse',
    find: (t) => t.t === 'br' },
  { id: 'token-space', what: 'a word space',
    find: (t) => t.t === 'sp' },
  { id: 'token-text', what: 'literal text that is not recited as marked syllables',
    find: (t) => t.t === 'text' },
  { id: 'token-num', what: 'a verse number — structure, never recited',
    find: (t) => t.t === 'num' },
  { id: 'token-bar', what: 'a structural rule',
    find: (t) => t.t === 'bar' },
  { id: 'token-slot', what: 'a variable slot, whose tokens are recited through it',
    find: (t) => t.t === 'slot' },
];

const docs = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort()
  .map((f) => ({
    slug: f.replace(/\.json$/, ''),
    /* NORMALISED: `verses` is rebuilt from `items`, which is where a composed
       section stores them — a raw read would see empty sections. */
    doc: normalizeChantDoc(JSON.parse(readFileSync(join(CORPUS, f), 'utf8'))),
  }));

/**
 * Keep the document, delete the siblings.
 *
 * Every ancestor field — the document's `source`, the section's, `items`,
 * `features`, `titleForms` — survives by construction, so a fixture is a real
 * document with one verse rather than a reconstruction that quietly differs.
 */
function pruneTo(doc, sectionId, verseId) {
  const section = doc.sections.find((s) => s.id === sectionId);
  const verse = section.verses.find((v) => v.id === verseId);
  const pruned = {
    ...doc,
    sections: [{
      ...section,
      verses: [verse],
      // `items` is the canonical ordering when present; keep only the entries
      // pointing at the surviving verse rather than dropping the field, which
      // would change which shape the reader is being asked to handle.
      ...(section.items === undefined ? {} : {
        items: section.items.filter((i) => i.ref === verseId || i.id === verseId),
      }),
    }],
  };
  return { pruned, section, verse };
}

const fixtures = [];
const missing = [];

for (const { id, what, find } of CONSTRUCTS) {
  let hit = null;
  outer:
  for (const { slug, doc } of docs) {
    for (const section of doc.sections ?? []) {
      for (const verse of section.verses ?? []) {
        // Search THROUGH slots, so a construct that only ever appears inside
        // one is reachable. The first version searched the top level only.
        if (![...walk(verse.tokens)].some(find)) continue;
        const { pruned, verse: v } = pruneTo(doc, section.id, verse.id);
        const prunedSection = pruned.sections[0];
        hit = {
          id,
          construct: what,
          contractVersion: CONTRACT_VERSION,
          minedFrom: { document: slug, section: section.id, verse: verse.id },
          document: pruned,
          /*
           * DERIVED facts. Not one of these can be satisfied by echoing the
           * document back, which is the property the first version lacked.
           */
          expect: {
            attested: isAttested(v),
            syllables: syllableCount(v.tokens),
            recitation: Object.fromEntries(
              SCRIPTS.map((s) => [s, recitationText(v.tokens, s)]),
            ),
            holdings: holdingSpans(v.tokens),
            provenance: resolveSource(pruned, prunedSection, v),
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
  note: 'Every expectation is DERIVED — the recitation text, the holding spans, '
      + 'the resolved provenance. A reader that echoes the document fails all of '
      + 'them. See docs/INTERCHANGE.md §8.',
  scriptsVerified: ['deva', 'tel'],
  scriptsUnverified: ['tam', 'itrans'],
  scriptCaveat: 'The `tam` forms asserted here are UNREVIEWED output, carried so '
      + 'both implementations agree, not evidence that they are correct Tamil.',
  fixtures: fixtures.map((f) => ({ id: f.id, construct: f.construct, file: `${f.id}.json` })),
  constructsWithoutFixture: missing,
};

const files = [['index.json', index], ...fixtures.map((f) => [`${f.id}.json`, f])];

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const [name, body] of files) {
    const path = join(OUT, name);
    const want = JSON.stringify(body, null, 2) + '\n';
    if (!existsSync(path) || readFileSync(path, 'utf8') !== want) {
      console.error(`  stale: ${name}`); bad += 1;
    }
  }
  if (bad > 0) {
    console.error(`\n${bad} fixture(s) stale — run: npm run gen:conformance\n`);
    process.exit(1);
  }
  console.log(`conformance fixtures current (${fixtures.length} constructs)`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
for (const [name, body] of files) {
  writeFileSync(join(OUT, name), JSON.stringify(body, null, 2) + '\n');
}
console.log(`\n  ${fixtures.length} fixtures -> ${OUT}\n`);
for (const f of fixtures) {
  console.log(`    ${f.id.padEnd(28)} ${f.minedFrom.document}/${f.minedFrom.verse}`
    + `  ${f.expect.holdings.length} box(es)`);
}
if (missing.length > 0) {
  console.log(`\n  ${missing.length} construct(s) with NO example in the corpus:`);
  for (const m of missing) console.log(`    ${m}`);
  console.log('  Unexercised: neither implementation is held to these.');
}
console.log('');
