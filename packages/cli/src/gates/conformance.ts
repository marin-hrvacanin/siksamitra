/**
 * The conformance gate — does THIS implementation read the interchange format
 * the way the contract says it must?
 *
 * There is no compiler between siksamitra and vedaunion.org, by design (D1).
 * Both implement the format themselves, and nothing catches a disagreement. So
 * the fixtures under `corpus/conformance/` state the required interpretation as
 * plain data, and each side runs them against its own reader.
 *
 * This runner deliberately uses ONLY the format package. It never calls the
 * engine, because the platform has no engine and the interpretation being
 * checked must be reachable without one. If a check here needed `derive`, that
 * would be evidence the construct belongs in the engine and not in the contract.
 *
 *   npm run check:conformance
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeChantDoc, type ChantDoc, type ChantToken } from '@siksamitra/format';

const DIR = 'corpus/conformance';
const CONTRACT = 4;

interface Fixture {
  id: string;
  construct: string;
  contractVersion: number;
  minedFrom: { document: string; section: string; verse: string; tokenIndex: number };
  document: ChantDoc;
  expect: {
    sections: number;
    verses: number;
    tokens: number;
    syllables: number;
    attested: boolean;
    tokenAt: { index: number; token: Record<string, unknown> };
  };
}

if (!existsSync(join(DIR, 'index.json'))) {
  console.error(`no fixtures in ${DIR} — run: node tools/build-conformance.mjs`);
  process.exit(2);
}

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')) as {
  contractVersion: number;
  constructsWithoutFixture: string[];
};

if (index.contractVersion !== CONTRACT) {
  console.error(`fixture set is contract v${index.contractVersion}, this reader is v${CONTRACT}`);
  process.exit(2);
}

const MARKS = ['hold', 'hg', 'svara', 'change', 'cj', 'candra', 'sup', 'sbhakti'] as const;

/** Read one syllable the way the contract says a reader must — no engine. */
function readSyllable(t: ChantToken): Record<string, unknown> {
  const syl = t as unknown as {
    iast: string; deva?: string; tel?: string; tam?: string;
    units?: ReadonlyArray<Record<string, unknown>>;
  };
  return {
    iast: syl.iast, deva: syl.deva, tel: syl.tel, tam: syl.tam,
    units: (syl.units ?? []).map((u) => {
      const out: Record<string, unknown> = { c: u['c'] };
      for (const k of MARKS) if (u[k] !== undefined) out[k] = u[k];
      return out;
    }),
  };
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
let failures = 0;
let checks = 0;

console.log(`\n── ${files.length} fixtures, contract v${CONTRACT}\n`);

for (const file of files) {
  const fx = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as Fixture;
  const problems: string[] = [];

  const check = (what: string, got: unknown, want: unknown): void => {
    checks += 1;
    const a = JSON.stringify(got);
    const b = JSON.stringify(want);
    if (a !== b) problems.push(`${what}: got ${a}, contract says ${b}`);
  };

  // Read it exactly as the application would.
  const doc = normalizeChantDoc(fx.document);
  const section = doc.sections[0];
  const verse = section?.verses[0];

  if (section === undefined || verse === undefined) {
    problems.push('the document did not survive normalisation as one section and one verse');
  } else {
    check('sections', doc.sections.length, fx.expect.sections);
    check('verses', section.verses.length, fx.expect.verses);
    check('tokens', verse.tokens.length, fx.expect.tokens);
    check('syllables', verse.tokens.filter((t) => t.t === 'syl').length, fx.expect.syllables);

    // Rule zero: a verse with no source layer is attested and must not be
    // re-derived. This is the check most likely to be quietly wrong in a
    // reader that "helpfully" fills things in.
    check('attested (rule zero)', verse.src === undefined, fx.expect.attested);

    const token = verse.tokens[fx.expect.tokenAt.index];
    if (token === undefined) {
      problems.push(`no token at index ${fx.expect.tokenAt.index}`);
    } else {
      check('the construct itself',
        token.t === 'syl' ? readSyllable(token) : token,
        fx.expect.tokenAt.token);
    }
  }

  if (problems.length === 0) {
    console.log(`  ok   ${fx.id.padEnd(28)} ${fx.construct}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${fx.id.padEnd(28)} ${fx.construct}`);
    for (const p of problems) console.log(`         ${p}`);
  }
}

console.log(`\n     ${checks} assertions across ${files.length} fixtures`);

if (index.constructsWithoutFixture.length > 0) {
  // Not a failure — an honest report. A construct the corpus never exercises is
  // one neither implementation is being held to, and that is worth saying out
  // loud every run rather than discovering after a divergence.
  console.log(`\n     UNEXERCISED — modelled by the format, absent from the corpus:`);
  for (const c of index.constructsWithoutFixture) console.log(`       ${c}`);
  console.log(`     These are the constructs most likely to drift unnoticed.`);
}

if (failures > 0) {
  console.log(`\n${failures} fixture(s) FAILED — this reader disagrees with the contract\n`);
  process.exit(1);
}
console.log('\nCONFORMANCE PASSES\n');
