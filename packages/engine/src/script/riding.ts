/**
 * A MARK THAT RIDES ON A LETTER — the Ṛgvedic overline, U+0305 — has no letter
 * of its own in an Indic script. The transliterator spells the syllable with
 * its letters bare and carries the marks after it, so every caller gets the
 * same form (the `.docx` reader and the emitter used to disagree: `न्a̅`
 * against `न̅`) and a round trip keeps the mark.
 */
import { bareLetter } from '../alphabet.js';

/** The units with their riding marks taken off, and the marks, or null if none. */
export function splitRiding<U extends { c: string }>(units: readonly U[]):
  { bare: U[]; riding: string } | null {
  const riding = units.map((u) => u.c.slice(bareLetter(u.c).length)).join('');
  if (riding === '') return null;
  return { bare: units.map((u) => ({ ...u, c: bareLetter(u.c) })), riding };
}
