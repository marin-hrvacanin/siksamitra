/**
 * Turn the column-shaped phoneme table into script MODULES — generated, not
 * retyped.
 *
 * The old table is one row per sound and one COLUMN per script, so every script
 * but IAST is an attribute of IAST rather than its peer. Splitting it by hand
 * would mean transcribing ~50 rows across five scripts, in four writing systems
 * most reviewers cannot proofread by eye. That is precisely the operation that
 * introduces a silent wrong glyph.
 *
 * So it is done mechanically, from the built table, and the transliteration
 * gate (31 762 assertions) proves afterwards that nothing moved.
 *
 *   npx tsc -b && node tools/gen-script-modules.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// FROZEN INPUT, deliberately. Reading the BUILT `tables.js` would mean reading
// this generator's own downstream output, because `tables.ts` is now derived
// from the modules generated here. That actually happened: the second run
// emitted 120 `undefined` glyphs and was caught only by the compiler. The
// legacy column table is captured as data, with its provenance recorded, so a
// re-run is reproducible and cannot feed on itself.
const { PHONEMES, VOWEL_SIGNS, VIRAMA, PRANAVA_FORMS } = JSON.parse(
  readFileSync('tools/legacy-phoneme-table.json', 'utf8'),
);

const OUT = 'packages/engine/src/script';
/** The Unicode ranges each script claims, for detection. Romanisations claim
 *  none: they share the Latin range and are the fallback. */
const BLOCKS = {
  deva: [[0x0900, 0x097f]],
  tel: [[0x0c00, 0x0c7f]],
  tam: [[0x0b80, 0x0bff]],
};

const SCRIPTS = [
  { id: 'iast', name: 'IAST', kind: 'romanisation', reversible: true, verified: true,
    note: 'The International Alphabet of Sanskrit Transliteration. Registered like\n * any other script: the engine works on phonemes, so IAST is a rendering, not\n * the substrate. Its forms coincide with the phoneme identifiers, which is a\n * historical convenience and not a licence to skip the mapping.' },
  { id: 'deva', name: 'Devanāgarī', kind: 'abugida', reversible: true, verified: true,
    note: 'Verified against the shipped corpus: the owner has confirmed these forms.' },
  { id: 'tel', name: 'Telugu', kind: 'abugida', reversible: true, verified: true,
    note: 'Verified against the shipped corpus: the owner has confirmed these forms.' },
  { id: 'tam', name: 'Tamil', kind: 'abugida', reversible: false, verified: false,
    note: 'NOT verified — the owner has confirmed these forms have never been\n * reviewed, so the transliteration gate excludes Tamil and this module is\n * registered `verified: false`.\n *\n * Tamil does not distinguish aspiration or voicing in its native orthography,\n * so `kh`, `g` and `gh` all render as `க`. That is correct Tamil AND it is\n * lossy, which is why `reversible` is false and why `approximations` is a\n * first-class field rather than a special case in shared code.' },
  { id: 'itrans', name: 'ITRANS', kind: 'romanisation', reversible: false, verified: false,
    note: 'ASCII transliteration. Present in v1 tables and unrepresentable in v1\n * documents, because the old format had no field for it.\n *\n * READ-ONLY, and that is measured rather than assumed. Its ambiguity is at the\n * SEQUENCE level, which glyph-collision analysis cannot see: "sh" is both the\n * form of one phoneme and the pair s+h; "aa" is both one vowel and a+a. It was\n * briefly registered reversible, which offered it as an authoring surface that\n * silently corrupts: "sahasra" round-trips to "sahasara", "sha" to a single\n * palatal sibilant.' },
];

/**
 * Emit a JS literal, refusing `undefined`.
 *
 * `JSON.stringify(undefined)` returns `undefined`, which interpolates into a
 * template as the text "undefined" and produces a file that looks plausible and
 * does not compile. Refusing it here turns a stale-input bug into an error that
 * names itself.
 */
const q = (s) => {
  if (s === null) return 'null';
  if (s === undefined) throw new Error('undefined reached the emitter — stale input table');
  return JSON.stringify(s);
};

/** IAST spelling doubles as the phoneme identifier. Named honestly. */
const idOf = (row) => row.iast;

function letterOf(p, id) {
  if (id !== 'iast' && !(id in p)) {
    throw new Error(`the input table has no "${id}" column — is it the legacy table?`);
  }
  if (id === 'iast') return p.iast;
  if (id === 'itrans') return p.itrans;
  if (id === 'tam') return p.tam;
  return p[id] ?? null;
}
const signOf = (s, id) => (id === 'iast' ? s.iast : id === 'itrans' ? s.itrans : s[id] ?? null);

mkdirSync(join(OUT, 'scripts'), { recursive: true });

// ── the script-neutral inventory ────────────────────────────────────────────
const inventory = PHONEMES.map((p) => {
  const bits = [`id: ${q(idOf(p))}`, `type: ${q(p.type)}`];
  if (p.varga !== undefined) bits.push(`varga: ${q(p.varga)}`);
  if (p.label !== undefined) bits.push(`label: ${q(p.label)}`);
  return `  { ${bits.join(', ')} },`;
}).join('\n');

writeFileSync(join(OUT, 'phonemes.ts'), `/**
 * The phoneme inventory — sounds, with no writing system attached.
 *
 * This is the engine's canonical layer, and the reason every script can be a
 * peer. The siksa rules are PHONOLOGICAL: they ask whether a sound is a
 * sibilant, is voiced, belongs to a varga. A system whose substrate is a script
 * will always privilege that script, so the substrate here is not a script.
 *
 * \`PhonemeId\` is spelled with Latin letters because a human has to be able to
 * read this table. It is an IDENTIFIER, not a rendering: IAST supplies its own
 * mapping in \`scripts/iast.ts\` like every other writing system, and removing
 * IAST from the registry does not stop the engine deriving.
 *
 * GENERATED by tools/gen-script-modules.mjs. Do not edit by hand.
 */

export type PhonemeType = 'vowel' | 'consonant' | 'special';

export type Varga =
  | 'ka' | 'ca' | 'ta-retroflex' | 'ta-dental' | 'pa' | 'misc' | 'sibilant';

/** A phoneme's stable key. An identifier, not a writing system. */
export type PhonemeId = string;

export interface Phoneme {
  readonly id: PhonemeId;
  readonly type: PhonemeType;
  /** For consonants: the varga, which several rules and the keyboard read. */
  readonly varga?: Varga;
  readonly label?: string;
}

export const PHONEME_INVENTORY: readonly Phoneme[] = [
${inventory}
];

/** Phonemes that take a matra when they follow a consonant. */
export const NUCLEUS_IDS: readonly PhonemeId[] = [
${VOWEL_SIGNS.map((s) => `  ${q(s.iast)},`).join('\n')}
];

export const PHONEME_BY_ID: ReadonlyMap<PhonemeId, Phoneme> = new Map(
  PHONEME_INVENTORY.map((p) => [p.id, p]),
);
`);

// ── one module per writing system ───────────────────────────────────────────
for (const s of SCRIPTS) {
  const letters = [], approx = [], gaps = [];
  for (const p of PHONEMES) {
    const id = idOf(p);
    const glyph = letterOf(p, s.id);
    letters.push(`  ${q(id)}: ${q(glyph)},`);
    if (glyph === null) {
      gaps.push(id);
      if (s.id === 'tam' && p.tamApprox !== undefined) approx.push(`  ${q(id)}: ${q(p.tamApprox)},`);
    }
  }
  const signs = VOWEL_SIGNS.map((v) => `  ${q(v.iast)}: ${q(signOf(v, s.id))},`).join('\n');

  writeFileSync(join(OUT, 'scripts', `${s.id}.ts`), `/**
 * ${s.name} — a script module.
 *
 * ${s.note}
 *
 * GENERATED by tools/gen-script-modules.mjs. Do not edit by hand.
 */

import type { ScriptModule } from '../module.js';

export const ${s.id.toUpperCase()}: ScriptModule = {
  id: ${q(s.id)},
  name: ${q(s.name)},
  kind: ${q(s.kind)},
  reversible: ${s.reversible},
  verified: ${s.verified},
  virama: ${q(VIRAMA[s.id] ?? '')},
  pranava: ${q(PRANAVA_FORMS[s.id] ?? null)},${BLOCKS[s.id] === undefined ? '' : `
  blocks: [${BLOCKS[s.id].map((b) => `[0x${b[0].toString(16).padStart(4, '0')}, 0x${b[1].toString(16).padStart(4, '0')}]`).join(', ')}],`}
  letters: {
${letters.join('\n')}
  },
  signs: {
${signs}
  },${approx.length > 0 ? `
  /* Sounds ${s.name} has no character for, and the nearest letter it does have.
     A gap is DATA here, never a named branch in shared code. */
  approximations: {
${approx.join('\n')}
  },` : ''}
};
`);
  console.log(`  ${s.id.padEnd(7)} ${String(PHONEMES.length).padStart(3)} letters, ` +
    `${VOWEL_SIGNS.length} signs, ${gaps.length} gap(s)` +
    `${approx.length > 0 ? `, ${approx.length} approximation(s)` : ''}` +
    `${s.verified ? '' : '  UNVERIFIED'}`);
}

console.log(`\n  ${SCRIPTS.length} script modules + a ${PHONEMES.length}-phoneme inventory\n`);
