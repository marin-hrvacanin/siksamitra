/**
 * THE YATI'S PAUSE — the bar his pages draw at each yati of a classical metre.
 *
 * His sragdharā dhyānas, in the Lalitā sahasranāma and the Rudram (and so his
 * sādhanā), draw a short pause after the 7th and the 14th syllable of every
 * pāda — `dhyā̱ye̱t padmā-sana sthāṁu | vikasita vadanāṁm | pa̱dma…` — and his
 * śārdūlavikrīḍita ones after the 12th — `si̱ndū̱rā-ruṇa vigrahān trinayanāṁm |
 * mā̱ṇikya̱ mauli̍ sphura̱t |`. Two pādas set on one line take one at the end of
 * the first as well. His notes say the same: "(sragdharā chandaḥ, 21
 * syllables per pāda, yatiḥ at 7th, 14th, and 21th)".
 *
 * A yati falls where a word ends; one inside a word (an editor's word broken
 * across it) is not drawn — his pages break no word for it. Only metres his
 * files show are here: a metre is added when one of his files is read for it.
 */
import type { MeterKey, Profile } from './profile.js';
import type { Elem } from './lex.js';

/** Each metre's pāda length and the syllables a yati follows within it. */
export const YATI: Readonly<Partial<Record<MeterKey, { readonly pada: number; readonly after: readonly number[] }>>> = {
  sragdhara: { pada: 21, after: [7, 14] },
  sardulavikridita: { pada: 19, after: [12] },
  /* His Lalitā's pṛthvī: `sa̱kuṅkuma vilepanām | alika cumbi ka̱stū̍rikā̱ṁ |`. */
  prthvi: { pada: 17, after: [8] },
  /* Mandākrāntā's yatis, after the 4th and the 10th, as it is sung. */
  mandakranta: { pada: 17, after: [4, 10] },
};


/** The elements with a pause at each yati of the profile's metre — or as they are. */
export function withYati(elems: Elem[], profile: Profile): Elem[] {
  const meter = profile.svara.meter;
  if (profile.pauses.yati === false || meter == null) return elems;
  const plan = YATI[meter];
  if (plan === undefined) return elems;
  const out: Elem[] = [];
  let count = 0;
  let firstWord: number | null = null;
  for (let k = 0; k < elems.length; k += 1) {
    const e = elems[k]!;
    out.push(e);
    /* A daṇḍa ends a metrical segment and the count starts again. A line
       break does not: a pāda set a line each, or a half-verse the page
       wrapped, counts on — its pāda boundaries are the metre's, not the line's. */
    if (e.kind === 'pause') { count = 0; firstWord = null; continue; }
    if (e.kind !== 'letter') continue;
    if (firstWord === null) firstWord = e.word;
    if (!e.vowel) continue;
    /* A leading oṁ stands outside the metre (as `svara.ts` counts it). */
    if (count === 0 && e.word === firstWord && e.ch === 'o' && elems[k + 1]?.ch === 'ṁ') continue;
    count += 1;
    const inPada = ((count - 1) % plan.pada) + 1;
    const atPadaEnd = inPada === plan.pada;
    if (!plan.after.includes(inPada) && !atPadaEnd) continue;
    /* The syllable's coda: the consonants after its vowel in its own word. */
    let j = k + 1;
    while (j < elems.length && elems[j]!.kind === 'letter' && !elems[j]!.vowel && elems[j]!.word === e.word) j += 1;
    let next = elems[j];
    /* A line the page divided at this yati keeps its bar, at the line's end —
       as his pages show one where Word wraps (`…patrāyatākṣīṁ |`). A pāda that
       simply ends its line has none: the line's end is its pause. */
    if (next?.kind === 'br' && !atPadaEnd && elems[j + 1]?.kind === 'letter') next = elems[j + 1];
    /* A word must begin right there — not a pause already, not the verse's end,
       not the same word going on. */
    if (next === undefined || next.kind !== 'letter' || next.word === e.word) continue;
    for (let i = k + 1; i < j; i += 1) out.push(elems[i]!);
    out.push({
      kind: 'vpause', ch: '', text: 'short',
      src: { line: next.src.line, start: next.src.start, end: next.src.start },
      word: -1, line: next.line, vowel: false, cons: false,
    });
    k = j - 1;
  }
  return out;
}
