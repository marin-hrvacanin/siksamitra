/**
 * WHERE A HOLDING BOX RUNS THROUGH A SYLLABLE BOUNDARY.
 *
 * The owner marked five adjacent letters and got three boxes: "holdings only
 * include two letters and don't combine when adjacent, which is not good."
 * They were three boxes because a box is drawn per syllable and cannot be
 * otherwise — an Indic akṣara is one shaped cluster and half a conjunct cannot
 * be boxed (MARKING-RULES §2.4). The answer is not to move the boundary but to
 * stop drawing the edge where two boxes meet.
 *
 * These check the DECISION — which edges are open — against the token stream,
 * which `holdJoins` does not itself produce. Whether the clip then removes the
 * right pixels is a question about a picture, and `tools/shot-marking.mjs`
 * takes it so it can be looked at.
 */
import { describe, expect, it } from 'vitest';
import { holdJoins } from '@siksamitra/render';
import type { ChantToken, ChantUnit } from '@siksamitra/format';

/** A syllable of letters, with a holding on the ones named. */
const syl = (
  letters: string,
  holds: Record<number, 'short' | 'long'> = {},
): ChantToken => ({
  t: 'syl',
  iast: letters,
  deva: letters,
  units: [...letters].map((c, i): ChantUnit => (
    holds[i] === undefined ? { c } : { c, hold: holds[i]!, hg: 1 }
  )),
});

describe('a box continued by its neighbour', () => {
  it('opens both sides of the syllable in the middle of a run', () => {
    /* `su` `na` `v`, all long — the exact shape the owner's five letters made. */
    const tokens = [
      syl('su', { 0: 'long', 1: 'long' }),
      syl('na', { 0: 'long', 1: 'long' }),
      syl('v', { 0: 'long' }),
    ];
    const joins = holdJoins(tokens);
    expect(joins.get(0)).toEqual({ joinL: false, joinR: true });
    expect(joins.get(1)).toEqual({ joinL: true, joinR: true });
    expect(joins.get(2)).toEqual({ joinL: true, joinR: false });
  });

  it('a lone box keeps all four of its sides', () => {
    const tokens = [syl('a'), syl('gni', { 0: 'short' }), syl('m')];
    expect(holdJoins(tokens).size).toBe(0);
  });

  it('a space between the letters keeps them apart', () => {
    /* A box drawn across the space would enclose something that is not a
       letter, which is why adjacency is the NEXT token and not the next
       syllable. */
    const tokens = [
      syl('ta', { 1: 'long' }),
      { t: 'sp' } as ChantToken,
      syl('va', { 0: 'long' }),
    ];
    expect(holdJoins(tokens).size).toBe(0);
  });

  it('a daṇḍa between them keeps them apart too', () => {
    const tokens = [
      syl('ta', { 1: 'long' }),
      { t: 'danda', s: '।' } as ChantToken,
      syl('va', { 0: 'long' }),
    ];
    expect(holdJoins(tokens).size).toBe(0);
  });

  it('two different weights that touch stay two boxes', () => {
    /*
     * A thin box and a thick one are two different decisions. Merging them
     * would show the reader one weight where the author wrote two, which is a
     * worse fault than the gap this whole mechanism exists to close.
     */
    const tokens = [syl('ta', { 1: 'short' }), syl('va', { 0: 'long' })];
    expect(holdJoins(tokens).size).toBe(0);
  });

  it('an unheld letter at the boundary is not a join', () => {
    const tokens = [syl('ta', { 1: 'long' }), syl('va', { 1: 'long' })];
    /* `va`'s FIRST letter carries nothing, so the two boxes do not meet. */
    expect(holdJoins(tokens).size).toBe(0);
  });
});
