/**
 * QUALIFIERS — the marks a script writes after a whole akṣara.
 *
 * Tamil Sanskrit marks the stop series with superscript digits: `க` ka, `க²`
 * kha, `க³` ga, `க⁴` gha. The digit is printed at the END of the cluster —
 * `கீ³தா`, the way Bhagavadgītā is set, not `க³ீதா`; `வத்³`, not `வத³்`.
 *
 * The composer builds a syllable left to right and takes the digit from the
 * letter's own form, so it lands straight after the consonant — which is
 * BETWEEN the consonant and its vowel sign, and that breaks the cluster: the
 * shaper then treats the consonant as standalone and the vowel sign as an
 * orphan, and `de` draws as two pieces instead of one letter.
 *
 * So the composer moves them out, and the reader moves them back. A dependent
 * sign is a combining mark — Tamil's vowel signs are `Mc`, its virāma `Mn` —
 * so the two directions are one character class and each other's exact
 * inverse. Which script has qualifiers is `ScriptModule.qualifiers`, not a
 * branch on an id: that branch is the privilege the module system exists to
 * remove.
 */

/** A run of dependent signs: Tamil's vowel signs are `Mc`, its virāma `Mn`. */
const SIGNS = '(?:\\p{Mn}|\\p{Mc})+';

/**
 * The qualifier set as a character class, by code point.
 *
 * Escaped numerically rather than by listing the characters, so a qualifier
 * that happened to be a regular-expression metacharacter could not turn the
 * class into something else.
 */
const classOf = (qualifiers: string): string =>
  [...qualifiers].map((c) => `\\u${c.codePointAt(0)!.toString(16).padStart(4, '0')}`).join('');

/** `த³ே` → `தே³` — the qualifier hops right, over the signs. */
export const qualifiersOut = (text: string, qualifiers: string): string =>
  text.replace(new RegExp(`([${classOf(qualifiers)}])(${SIGNS})`, 'gu'), '$2$1');

/** `தே³` → `த³ே` — and back, before the letters are matched. */
export const qualifiersIn = (text: string, qualifiers: string): string =>
  text.replace(new RegExp(`(${SIGNS})([${classOf(qualifiers)}])`, 'gu'), '$2$1');
