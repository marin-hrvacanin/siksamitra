/**
 * ONE WORD'S LETTERS -> ITS SYLLABLES, the way the engine writes them.
 *
 * Out of `docx-runs.ts`, which is the Word STYLES — what each run means — while
 * this is the syllabification of what they spelled, and must agree with the
 * engine's own exactly or no imported verse re-derives to itself:
 *
 *   - one nucleus per syllable, the engine's `syllabify`;
 *   - a hyphen is the CODA of the syllable before it (`attachHyphen`, the
 *     engine's own rule): `[ma-][vā]`, as 315 of the corpus's 317 are stored.
 *     The reader used to put it at the head of the next (`[ma][-vā]`), and
 *     91 of the sādhanā's 512 verses re-derived;
 *   - but a hyphen that OPENS the word has no syllable before it in the word —
 *     sri-rudram's `[-bha]`, twice in the corpus — and stays at the head of
 *     the syllable it opens. Joining it across the space to the word before,
 *     or dropping it, lost the letter in the add-in's corpus round trip.
 */
import type { ChantSyllable, ChantUnit } from '@siksamitra/format';
import { attachHyphen, isVowel, syllabify, transliterateSyllable } from '@siksamitra/engine';

/** The syllables of one run of letters with no hyphen inside it. */
function plain(word: readonly ChantUnit[]): ChantSyllable[] {
  const fake = word.map((u) => ({
    kind: 'letter' as const, ch: u.c, src: { line: 0, start: 0, end: 0 },
    word: 0, line: 0, vowel: isVowel(u.c), cons: !isVowel(u.c),
  }));
  const out: ChantSyllable[] = [];
  let at = 0;
  for (const g of syllabify(fake as never)) {
    const units = word.slice(at, at + g.length);
    at += g.length;
    if (units.length === 0) continue;
    const su = units.map((u) => ({ c: u.c, ...(u.candra === true ? { candra: true } : {}) }));
    out.push({
      t: 'syl',
      units,
      iast: units.map((u) => u.c).join(''),
      deva: transliterateSyllable(su, 'deva'),
      tel: transliterateSyllable(su, 'tel'),
      tam: transliterateSyllable(su, 'tam'),
    });
  }
  return out;
}

/** A word's syllables, hyphens placed as the engine places them. */
export function syllablesOf(word: readonly ChantUnit[]): ChantSyllable[] {
  const pieces: ChantUnit[][] = [[]];
  for (const u of word) {
    const here = pieces[pieces.length - 1]!;
    if (u.c === '-' && here.length > 0) pieces.push([]);
    else here.push(u);
  }
  const out: ChantSyllable[] = [];
  pieces.forEach((piece, i) => {
    out.push(...plain(piece));
    const last = out[out.length - 1];
    if (i < pieces.length - 1 && last !== undefined) attachHyphen(last);
  });
  return out;
}
