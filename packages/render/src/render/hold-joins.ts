/**
 * WHERE ONE HOLDING BOX RUNS THROUGH A SYLLABLE BOUNDARY.
 *
 * A box is drawn per syllable, and that is not an implementation detail to be
 * refactored away: an Indic akṣara is one shaped cluster, you cannot box half
 * a conjunct, and the owner's answer to that is not to try (MARKING-RULES
 * §2.4). The consequence was visible the moment anyone marked a phrase by
 * hand — five adjacent letters spanning three syllables drew THREE touching
 * boxes instead of one, which the owner reported as "holdings only include two
 * letters and don't combine when adjacent".
 *
 * So the syllable keeps its box and loses the EDGE where it meets its
 * neighbour. This works out which edges those are, once, for a token stream —
 * both the editor's views and the reader ask the same function, because two
 * answers to "is this box continued" is how the reader and the editor come to
 * draw the same document differently.
 *
 * WHAT COUNTS AS ADJACENT is deliberately narrow: the very next token must be
 * another syllable. A space, a daṇḍa, a bar, a pause or a line break all put
 * air between the letters, and a box drawn across that air would enclose
 * something that is not a letter.
 *
 * `hg` IS NOT COMPARED, and that is not an oversight. Within a syllable it
 * tells two runs of the same weight apart, which is why `renderIastUnits`
 * checks it. Across a boundary it cannot: the id is numbered per syllable and
 * the shipped corpus repeats an id in a later syllable 537 times, so equal ids
 * either side of a boundary mean nothing and unequal ids mean nothing either.
 * The consequence is that two touching boxes of the SAME weight in adjacent
 * syllables cannot be kept apart. The corpus contains no such pair today; if
 * the notation ever needs one, `hg` will have to become verse-wide first.
 */
import type { ChantToken, ChantUnit } from '@siksamitra/format';

export interface HoldJoin {
  /** The first letter continues a box from the previous syllable. */
  joinL: boolean;
  /** The last letter's box continues into the next syllable. */
  joinR: boolean;
}

const held = (u: ChantUnit | undefined): 'short' | 'long' | undefined => u?.hold;

/**
 * For each token index, whether its box is open on the left or the right.
 *
 * Only syllable tokens get an entry. Two syllables join when they are
 * immediately adjacent in the stream and the letters that meet — the last of
 * one, the first of the next — carry the SAME holding weight. A thin box and a
 * thick one that touch stay two boxes: they are two different decisions and
 * merging them would show the reader one weight where the author wrote two.
 */
export function holdJoins(tokens: readonly ChantToken[]): Map<number, HoldJoin> {
  const out = new Map<number, HoldJoin>();
  for (const [i, token] of tokens.entries()) {
    if (token.t !== 'syl') continue;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    const first = token.units[0];
    const last = token.units[token.units.length - 1];

    const joinL = prev !== undefined && prev.t === 'syl'
      && held(first) !== undefined
      && held(first) === held(prev.units[prev.units.length - 1]);
    const joinR = next !== undefined && next.t === 'syl'
      && held(last) !== undefined
      && held(last) === held(next.units[0]);

    if (joinL || joinR) out.set(i, { joinL, joinR });
  }
  return out;
}
