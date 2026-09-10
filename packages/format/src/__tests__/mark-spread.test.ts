/**
 * WHAT A MARKING DOES WHEN SOMETHING IS TYPED AT ITS EDGE.
 *
 * The owner's report: "behaviour when typing left of the character with a
 * svara is buggy as well — when I type, that new character also carries a
 * svara."
 *
 * He is describing `shiftForEdit`. Its `move` leaves an offset alone AT the
 * insertion point and pushes everything after it, so a marking whose START is
 * the insertion point keeps its start and gains its end: it GROWS over the new
 * letters.
 *
 * FOR A HOLDING THAT IS RIGHT. A holding is a box drawn over a stretch, and
 * typing at its edge belongs inside it — that is bold's behaviour, and without
 * it typing in the middle of a held word would leave a hole in its box.
 *
 * FOR AN ACCENT IT IS WRONG. A svara is a property OF a letter: the letter is
 * `a` and it is `anudātta`. The letter beside it is a different letter and has
 * no accent until somebody gives it one. The same goes for `was` (this letter
 * was a `ṁ`), `sup` (a superscript after this letter) and `cj` (this letter's
 * conjunct choice).
 *
 * `LETTER_KINDS` is that distinction, and it is the one place it is stated —
 * `MarkedTextNode.canInsertTextBefore` answers Lexical's version of the same
 * question by reading the same set.
 *
 * EVERY EXPECTATION HERE IS THE RANGE WRITTEN OUT, worked from the offsets in
 * the comment above each case, never read back out of `shiftForEdit`.
 */
import { describe, expect, it } from 'vitest';
import { LETTER_KINDS, mark, type MarkKind } from '../mark.js';
import { shiftForEdit } from '../mark-ops.js';

/** An insertion of `n` characters at `at`, in `TextEdit`'s shape. */
const insertAt = (at: number, n: number) => ({ from: at, to: at, inserted: n });

const one = (k: MarkKind, from: number, to: number) =>
  [mark({ k, from, to, ...(k === 'hold' ? { v: 'long' } : { v: 'anudatta' }) })];

const rangeOf = (r: { marks: { from: number; to: number }[] }): [number, number][] =>
  r.marks.map((m) => [m.from, m.to]);

describe('a letter typed at the START of a marking', () => {
  /*
   * The marking covers 10..12. Two characters go in at 10 — exactly its start.
   *
   *   before:  ....……....[ab]....      10..12
   *   typed:   ....……....xx[ab]....
   */
  it('a svara moves along with its own letter, and does not take the new one', () => {
    expect(rangeOf(shiftForEdit(one('svara', 10, 12), insertAt(10, 2))))
      .toEqual([[12, 14]]);
  });

  it('and so does a `was`, a `sup` and a `cj` — each is about one letter', () => {
    for (const k of ['was', 'sup', 'cj'] as const) {
      expect(rangeOf(shiftForEdit(one(k, 10, 12), insertAt(10, 2))), k)
        .toEqual([[12, 14]]);
    }
  });

  it('but a HOLDING grows, because a holding is a span', () => {
    /* Its box takes in what was typed at its edge — bold's behaviour, and the
       reason typing inside a held word does not leave a hole. */
    expect(rangeOf(shiftForEdit(one('hold', 10, 12), insertAt(10, 2))))
      .toEqual([[10, 14]]);
  });

  it('and the two really do differ — the control', () => {
    /*
     * Without this the pair of cases above could both be right or both be
     * wrong together, which is what they were before: everything grew.
     */
    const accent = rangeOf(shiftForEdit(one('svara', 10, 12), insertAt(10, 2)));
    const box = rangeOf(shiftForEdit(one('hold', 10, 12), insertAt(10, 2)));
    expect(accent).not.toEqual(box);
  });
});

describe('a letter typed AFTER a marking', () => {
  /* Two characters at 12 — just past the marking's end. Nothing may grow. */
  it('leaves an accent exactly where it was', () => {
    expect(rangeOf(shiftForEdit(one('svara', 10, 12), insertAt(12, 2))))
      .toEqual([[10, 12]]);
  });

  it('and leaves a holding where it was too', () => {
    /*
     * `move` pushes an offset only when it is PAST the edit, and a marking's
     * end at exactly the insertion point is not past it. So neither kind grows
     * to the right, and that is the same for both — which is why the fix is
     * about the START and only the start.
     */
    expect(rangeOf(shiftForEdit(one('hold', 10, 12), insertAt(12, 2))))
      .toEqual([[10, 12]]);
  });
});

describe('a letter typed BEFORE a marking', () => {
  /* Two characters at 5, well clear of a marking at 10..12. */
  it('moves every kind along by the same amount', () => {
    for (const k of ['svara', 'hold', 'was', 'sup', 'cj'] as const) {
      expect(rangeOf(shiftForEdit(one(k, 10, 12), insertAt(5, 2))), k)
        .toEqual([[12, 14]]);
    }
  });
});

describe('what is not an insertion is unchanged by any of this', () => {
  it('a deletion before a marking moves it back, whatever its kind', () => {
    for (const k of ['svara', 'hold'] as const) {
      expect(rangeOf(shiftForEdit(one(k, 10, 12), { from: 4, to: 6, inserted: 0 })), k)
        .toEqual([[8, 10]]);
    }
  });

  it('a replacement that starts where a marking does treats both alike', () => {
    /*
     * The middle branch of `move` answers here and it answers the same for a
     * letter kind and a span kind. Asserted so the fix is known to be about
     * pure insertions and nothing else — a change that also altered deletions
     * would show up here.
     */
    const edit = { from: 10, to: 12, inserted: 3 };
    expect(rangeOf(shiftForEdit(one('svara', 10, 14), edit)))
      .toEqual(rangeOf(shiftForEdit(one('hold', 10, 14), edit)));
  });

  it('and a marking the edit swallowed whole is still dropped, not moved', () => {
    const out = shiftForEdit(one('svara', 10, 12), { from: 8, to: 14, inserted: 0 });
    expect(out.marks).toEqual([]);
    expect(out.dropped).toHaveLength(1);
  });
});

describe('the set itself', () => {
  it('names the kinds that belong to their own letters, and no others', () => {
    /* Written out, so adding a kind to the set is a deliberate act with a
       test to change rather than a silent widening. */
    expect([...LETTER_KINDS].sort()).toEqual(['cj', 'sup', 'svara', 'was']);
  });

  it('and a holding, a slot and prose are NOT in it — they are spans', () => {
    for (const k of ['hold', 'slot', 'plain'] as const) {
      expect(LETTER_KINDS.has(k), k).toBe(false);
    }
  });
});
