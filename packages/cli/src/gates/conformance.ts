/**
 * The conformance gate — does this implementation read the format the way the
 * contract says it must?
 *
 * There is no compiler between siksamitra and vedaunion.org (design D1). Both
 * implement the format themselves and nothing catches a disagreement, so the
 * fixtures state the required interpretation as data and each side runs them
 * against its own reader.
 *
 * WHAT THIS GATE IS NOT ALLOWED TO DO, learned the hard way: it must not
 * recompute an expectation from the same bytes the fixture carries. The first
 * version did — it re-derived the token count and the token at index n from the
 * fixture's own token array — and a reader consisting of `JSON.parse` and
 * re-emit passed all ninety assertions while printing CONFORMANCE PASSES.
 *
 * So every assertion here is a DERIVED fact, produced by `@siksamitra/format`'s
 * own reader functions and compared against a value frozen in the fixture:
 *
 *   recitation  the chanted text per script — catches dropped slot contents,
 *               leaked placeholders, recited verse numbers
 *   holdings    box spans — catches a box drawn per `hold` instead of per run
 *   provenance  the resolved citation — catches a reader that ignores inheritance
 *   attested    rule zero
 *
 * It uses only `@siksamitra/format`. It must not reach for the engine: the
 * platform has no engine, and an interpretation that needed one would not
 * belong in the contract.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  holdingSpans, isAttested, recitationText, resolveSource, syllableCount,
  type ChantDoc, type ChantScriptKey, type HoldingSpan,
} from '@siksamitra/format';

const DIR = 'corpus/conformance';
const CONTRACT = 4;

interface Fixture {
  id: string;
  construct: string;
  contractVersion: number;
  minedFrom: { document: string; section: string; verse: string };
  document: ChantDoc;
  expect: {
    attested: boolean;
    syllables: number;
    recitation: Record<string, string>;
    holdings: HoldingSpan[];
    provenance: { source: string | null; from: string };
  };
}

if (!existsSync(join(DIR, 'index.json'))) {
  console.error(`no fixtures in ${DIR} — run: npm run gen:conformance`);
  process.exit(2);
}

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')) as {
  contractVersion: number;
  constructsWithoutFixture: string[];
  scriptsUnverified?: string[];
};

if (index.contractVersion !== CONTRACT) {
  console.error(`fixtures are contract v${index.contractVersion}, this reader is v${CONTRACT}`);
  process.exit(2);
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
    if (a !== b) problems.push(`${what}\n           got  ${a}\n           want ${b}`);
  };

  // Read the document exactly as an application would — through the reader,
  // not by looking at the JSON.
  const doc = fx.document;
  const section = doc.sections[0];
  const verse = section?.verses[0];

  if (section === undefined || verse === undefined) {
    problems.push('the fixture document has no first section/verse');
  } else {
    check('attested (rule zero)', isAttested(verse), fx.expect.attested);
    check('syllables (through slots)', syllableCount(verse.tokens), fx.expect.syllables);

    for (const [script, want] of Object.entries(fx.expect.recitation)) {
      check(`recitation[${script}]`,
        recitationText(verse.tokens, script as ChantScriptKey), want);
    }

    check('holding spans', holdingSpans(verse.tokens), fx.expect.holdings);
    check('provenance', resolveSource(doc, section, verse), fx.expect.provenance);
  }

  if (problems.length === 0) {
    console.log(`  ok   ${fx.id.padEnd(28)} ${fx.construct}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${fx.id.padEnd(28)} ${fx.construct}`);
    for (const p of problems) console.log(`         ${p}`);
  }
}

console.log(`\n     ${checks} derived assertions across ${files.length} fixtures`);

if (index.constructsWithoutFixture.length > 0) {
  console.log(`\n     UNEXERCISED — no example in the corpus, so neither`);
  console.log(`     implementation is held to them:`);
  for (const c of index.constructsWithoutFixture) console.log(`       ${c}`);
}
if (index.scriptsUnverified !== undefined && index.scriptsUnverified.length > 0) {
  console.log(`\n     UNVERIFIED SCRIPTS: ${index.scriptsUnverified.join(', ')} — the forms`);
  console.log(`     asserted for these are unreviewed output, carried so both`);
  console.log(`     implementations agree, not evidence that they are correct.`);
}

if (failures > 0) {
  console.log(`\n${failures} fixture(s) FAILED — this reader disagrees with the contract\n`);
  process.exit(1);
}
console.log('\nCONFORMANCE PASSES\n');
