/**
 * WHAT A LETTER WAS TYPED AS, and what a non-syllable token spells.
 *
 * Split out of `migrate.ts` at the 400-line module gate, and it is a clean
 * seam: that file is the two DIRECTIONS of `tokens ⇄ text + markings` and they
 * belong together — a conversion nobody can invert is a conversion nobody can
 * check. This is neither direction. It is the vocabulary both of them read.
 */
import type { ChantToken, ChantUnit } from './chant-tokens.js';

/** U+0310, the combining candrabindu — a character in the text, not a mark. */
export const CANDRA = '̐';

/**
 * WHAT A LETTER THE RULES REPLACED WAS TYPED AS — told by what it became.
 *
 * By the sandhi rules an anusvāra only ever becomes a nasal, and a visarga
 * only ever a sibilant, an `r`, or itself: the two never meet. Measured over
 * every one of the corpus's 971 substitutions, with no exception —
 *
 *   ṁ → m 169 · ñ 139 · n 104 · ṁ 100 · m̐ 85 · ṅ 60
 *   ḥ → ś 112 · s 96 · ḥ 69 · r 29 · : 3
 *
 * — and so ONE function answers it, for everything that needs to know: the
 * inverter, the importer deciding that a blue nasal closes its syllable, the
 * styles that tell an anusvāra change from a visarga change, and the migration
 * of the old token shape. There used to be two tables, this one's and the
 * engine's, and they disagreed about `m̐` and `gṁ`. `@siksamitra/engine`
 * re-exports this one as `typedAs`.
 *
 * `undefined` for a letter no rule of ours produces from either.
 */
const FROM_ANUSVARA = /^(?:g{0,2}ṁ|ṁ|m̐?|n|ñ|ṅ|ṇ)$/u;
const FROM_VISARGA = /^(?:ś|ṣ|s|r|ḥ|:)$/u;

export function typedLetter(shown: string): 'ṁ' | 'ḥ' | undefined {
  const bare = shown.normalize('NFC');
  if (FROM_ANUSVARA.test(bare)) return 'ṁ';
  if (FROM_VISARGA.test(bare)) return 'ḥ';
  return undefined;
}

/** What a unit was typed as: its own record when it has one, else the table. */
export const typedAs = (u: ChantUnit): string => {
  if (u.change !== true) return u.c;
  return u.was ?? typedLetter(u.c) ?? u.c;
};

/** The characters a non-syllable token contributes to the text. */
export function structuralText(t: ChantToken): string | null {
  switch (t.t) {
    case 'sp': return ' ';
    case 'br': return '\n';
    case 'danda': return t.s;
    case 'num': return t.s;
    case 'bar': return '¦';
    case 'text': return t.placeholder === true ? '' : t.s;
    default: return null;
  }
}
