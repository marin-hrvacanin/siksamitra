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
 * inverter reading a marked verse back to what was typed, the importer
 * deciding that a blue nasal closes its syllable (an anusvāra-derived letter
 * is a coda, `rājan̎·tam`), and the styles that tell an anusvāra change from a
 * visarga change. It used to be a guess inside the inverter alone.
 *
 * `undefined` for a letter no rule of ours produces from either.
 */
import { ANU, VIS } from './alphabet.js';

const FROM_ANUSVARA = /^(?:g{0,2}ṁ|ṁ|m̐?|n|ñ|ṅ|ṇ)$/u;
const FROM_VISARGA = /^(?:ś|ṣ|s|r|ḥ|:)$/u;

export function typedAs(shown: string): typeof ANU | typeof VIS | undefined {
  const bare = shown.normalize('NFC');
  if (FROM_ANUSVARA.test(bare)) return ANU;
  if (FROM_VISARGA.test(bare)) return VIS;
  return undefined;
}
