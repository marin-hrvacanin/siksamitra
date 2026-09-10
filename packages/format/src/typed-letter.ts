/**
 * WHAT A LETTER WAS TYPED AS, and what a non-syllable token spells.
 *
 * Split out of `migrate.ts` at the 400-line module gate, and it is a clean
 * seam: that file is the two DIRECTIONS of `tokens ⇄ text + markings` and they
 * belong together — a conversion nobody can invert is a conversion nobody can
 * check. This is neither direction. It is the vocabulary both of them read.
 */
import type { ChantToken, ChantUnit } from './chant-tokens.js';

/**
 * The guess table the old inverter used, and the only reason it is still here.
 *
 * A unit with `change: true` records that a rule replaced a letter and NOT what
 * it replaced — that is the gap the new model closes. For legacy data there is
 * nothing else to go on: a changed nasal was an anusvāra, a changed sibilant a
 * visarga. It runs ONCE, during migration, and its output is written down as a
 * `was` marking so that nothing ever has to guess again.
 */
const NASALS = new Set(['ṅ', 'ñ', 'ṇ', 'n', 'm', 'ṁ']);
const SIBILANTS = new Set(['ś', 'ṣ', 's', 'r', ':']);
const ANUSVARA = 'ṁ';
/** U+0310, the combining candrabindu — a character in the text, not a mark. */
export const CANDRA = '̐';
const VISARGA = 'ḥ';

export const typedAs = (u: ChantUnit): string => {
  if (u.change !== true) return u.c;
  if (u.c === ANUSVARA || u.c === VISARGA) return u.c;
  if (NASALS.has(u.c)) return ANUSVARA;
  if (SIBILANTS.has(u.c)) return VISARGA;
  return u.c;
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
