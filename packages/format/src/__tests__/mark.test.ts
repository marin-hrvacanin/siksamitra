/**
 * THE ARITHMETIC OF A LIST OF MARKINGS.
 *
 * These are the foundation the whole editor stands on: if `toggleMark` is
 * wrong, every holding the owner draws is wrong, and it is wrong in a way that
 * looks like a rendering bug. So the properties are asserted over RANDOM ranges
 * as well as chosen ones — a hand-picked case tests the case its author thought
 * of, and the faults in span arithmetic live at the edges nobody pictures: a
 * range that ends exactly where the next begins, a subset touching one end, a
 * removal that empties a marking entirely.
 *
 * Every property is a statement about the RESULT, not about the steps: the
 * invariants hold, toggling twice returns the original, coverage agrees with a
 * naive per-character scan computed a different way.
 */
import { describe, expect, it } from 'vitest';
import { assertMarks, compareMarks, mark, markFaults, type Mark } from '../mark.js';
import {
  applyMark, coverage, marksIn, normalise, removeMark, shiftForEdit, toggleMark,
} from '../mark-ops.js';

const TEXT = 'agnim īḷe purohitaṁ yajñasya devam';

const hold = (from: number, to: number, v = 'long', by: Mark['by'] = 'hand'): Mark =>
  mark({ k: 'hold', from, to, v, by });

/**
 * Coverage, computed the slow obvious way.
 *
 * The oracle for `coverage`, and deliberately a different algorithm: a
 * character-by-character scan against a set, where the real one walks sorted
 * ranges. Two implementations of the same idea disagreeing is the only way a
 * test of arithmetic is worth anything.
 */
function coverageByScan(marks: readonly Mark[], k: string, from: number, to: number): string {
  if (to <= from) return 'none';
  let covered = 0;
  for (let i = from; i < to; i += 1) {
    if (marks.some((m) => m.k === k && m.from <= i && m.to > i)) covered += 1;
  }
  if (covered === 0) return 'none';
  return covered === to - from ? 'all' : 'some';
}

/** A deterministic pseudo-random sequence, so a failure is reproducible. */
function rng(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

describe('the invariants', () => {
  it('accepts a sound list', () => {
    expect(markFaults([hold(2, 5), hold(7, 9, 'short')], TEXT)).toEqual([]);
  });

  it('catches a marking that runs past the text', () => {
    const faults = markFaults([hold(30, 999)], TEXT);
    expect(faults.map((f) => f.code)).toContain('out-of-range');
  });

  it('catches two markings of one kind over the same letter', () => {
    const faults = markFaults(normalise([hold(2, 6), hold(4, 8, 'short')]), TEXT);
    expect(faults.map((f) => f.code)).toContain('overlap');
  });

  it('catches two identical markings left unmerged', () => {
    const faults = markFaults([hold(2, 4), hold(4, 6)], TEXT);
    expect(faults.map((f) => f.code)).toContain('unmerged');
  });

  it('catches an offset inside a combining mark', () => {
    /* `a` + U+0304 is one letter to a reader; a marking may not start between
       them, or the box would enclose a macron on its own. */
    const text = 'āgnim';
    const faults = markFaults([hold(1, 3)], text);
    expect(faults.map((f) => f.code)).toContain('split-character');
  });

  it('catches an offset inside a surrogate pair', () => {
    const text = `x${String.fromCodePoint(0x1d160)}y`;
    expect(markFaults([hold(2, 3)], text).map((f) => f.code)).toContain('split-character');
  });

  it('allows a point marking to cover nothing, and nothing else to', () => {
    expect(markFaults([mark({ k: 'pause', from: 5, to: 5, v: 'short' })], TEXT)).toEqual([]);
    expect(markFaults([hold(5, 5)], TEXT).length).toBeGreaterThan(0);
  });
});

describe('coverage', () => {
  it('agrees with a character-by-character scan, over random ranges', () => {
    const random = rng(7);
    const marks = normalise([hold(2, 6), hold(9, 14), hold(20, 22)]);
    let checked = 0;
    for (let n = 0; n < 400; n += 1) {
      const a = Math.floor(random() * TEXT.length);
      const b = Math.floor(random() * TEXT.length);
      const [from, to] = a <= b ? [a, b] : [b, a];
      if (to === from) continue;
      expect(coverage(marks, 'hold', from, to), `${from}..${to}`)
        .toBe(coverageByScan(marks, 'hold', from, to));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('a gap in the middle is `some`, not `all`', () => {
    const marks = normalise([hold(2, 5), hold(7, 10)]);
    expect(coverage(marks, 'hold', 2, 10)).toBe('some');
  });

  it('distinguishes values, so long over short reads as uncovered', () => {
    const marks = [hold(2, 6, 'short')];
    expect(coverage(marks, 'hold', 2, 6, 'long')).toBe('none');
    expect(coverage(marks, 'hold', 2, 6, 'short')).toBe('all');
  });
});

describe('toggling, which is what a marking button does', () => {
  it('a mixed selection turns fully on', () => {
    const before = normalise([hold(2, 5)]);
    const after = toggleMark(before, hold(2, 10));
    expect(coverage(after, 'hold', 2, 10, 'long')).toBe('all');
    assertMarks(after, TEXT);
  });

  it('pressing again turns it fully off', () => {
    const on = toggleMark(normalise([hold(2, 5)]), hold(2, 10));
    const off = toggleMark(on, hold(2, 10));
    expect(coverage(off, 'hold', 2, 10, 'long')).toBe('none');
    assertMarks(off, TEXT);
  });

  it('a subset turns off on its own and splits the run in two', () => {
    const before = normalise([hold(2, 12)]);
    const after = toggleMark(before, hold(5, 8));
    expect(after.filter((m) => m.k === 'hold').map((m) => [m.from, m.to]))
      .toEqual([[2, 5], [8, 12]]);
    assertMarks(after, TEXT);
  });

  it('applying long over a short DESTROYS the short, and off does not restore it', () => {
    /*
     * Found by the property below, which asserted an identity that is not
     * true. A letter carries one holding, so covering a short run with a long
     * one overwrites it — there is nowhere for the short to survive. Toggling
     * off then leaves nothing, because the second press removes what the first
     * press put there and the first press had already consumed the short.
     *
     * That is the right behaviour and undo is what takes it back. It is
     * written down here so the next person to read `toggleMark` does not
     * mistake it for a fault.
     */
    const start = normalise([hold(14, 18, 'short')]);
    const on = toggleMark(start, hold(12, 22, 'long'));
    expect(coverage(on, 'hold', 12, 22, 'long')).toBe('all');
    const off = toggleMark(on, hold(12, 22, 'long'));
    expect(off.filter((m) => m.k === 'hold')).toEqual([]);
    assertMarks(off, TEXT);
  });

  it('a partly-marked range ends CLEARED after two presses, as in Word', () => {
    /*
     * Select text that is partly bold in Word, press Bold, press Bold again:
     * everything is plain, including the part that was bold to begin with. The
     * first press means "make it all on", the second "make it all off", and
     * neither remembers what was there before. Undo does.
     *
     * The random property below therefore holds only where the range started
     * wholly on or wholly off, which is what it now asserts.
     */
    const start = normalise([hold(14, 18)]);
    const once = toggleMark(start, hold(12, 22));
    expect(coverage(once, 'hold', 12, 22, 'long')).toBe('all');
    const twice = toggleMark(once, hold(12, 22));
    expect(coverage(twice, 'hold', 12, 22, 'long')).toBe('none');
  });

  it('toggling twice is the identity when the range started wholly on or off', () => {
    const random = rng(11);
    const start = normalise([hold(3, 9), hold(14, 18)]);
    let onCases = 0;
    let offCases = 0;
    for (let n = 0; n < 600; n += 1) {
      const a = Math.floor(random() * TEXT.length);
      const b = Math.floor(random() * TEXT.length);
      const [from, to] = a <= b ? [a, b] : [b, a];
      if (to === from) continue;
      const was = coverage(start, 'hold', from, to, 'long');
      if (was === 'some') continue;
      if (was === 'all') onCases += 1; else offCases += 1;

      const once = toggleMark(start, hold(from, to));
      const twice = toggleMark(once, hold(from, to));
      assertMarks(once, TEXT);
      assertMarks(twice, TEXT);
      /* Not "looks the same" — the same list, in the same order. A range that
         was covered by one marking must come back as ONE marking, which is
         what `normalise` fusing the pieces is for. */
      expect(twice, `${from}..${to} was ${was}`).toEqual(start);
    }
    /* Both branches were actually taken, or this proves nothing. */
    expect(onCases).toBeGreaterThan(5);
    expect(offCases).toBeGreaterThan(50);
  });

  it('the invariants hold after every random operation', () => {
    const random = rng(23);
    let marks: Mark[] = [];
    for (let n = 0; n < 500; n += 1) {
      const a = Math.floor(random() * TEXT.length);
      const b = Math.floor(random() * TEXT.length);
      const [from, to] = a <= b ? [a, b] : [b, a];
      if (to === from) continue;
      const value = random() < 0.5 ? 'long' : 'short';
      marks = random() < 0.7
        ? toggleMark(marks, hold(from, to, value))
        : removeMark(marks, 'hold', from, to);
      assertMarks(marks, TEXT, `step ${n}`);
    }
  });
});

describe('applying and removing', () => {
  it('applying over an existing marking leaves exactly one', () => {
    const after = applyMark(normalise([hold(2, 6)]), hold(2, 6));
    expect(after.filter((m) => m.k === 'hold')).toHaveLength(1);
  });

  it('applying a different value replaces rather than overlaps', () => {
    const after = applyMark(normalise([hold(2, 8, 'short')]), hold(4, 6, 'long'));
    expect(after.filter((m) => m.k === 'hold').map((m) => [m.from, m.to, m.v]))
      .toEqual([[2, 4, 'short'], [4, 6, 'long'], [6, 8, 'short']]);
    assertMarks(after, TEXT);
  });

  it('kinds do not interfere with each other', () => {
    const marks = applyMark(
      normalise([mark({ k: 'svara', from: 2, to: 8, v: 'anudatta' })]),
      hold(4, 6),
    );
    expect(coverage(marks, 'svara', 2, 8, 'anudatta')).toBe('all');
    expect(coverage(marks, 'hold', 4, 6, 'long')).toBe('all');
  });

  it('removing what a person placed can be spared', () => {
    const marks = normalise([hold(2, 6, 'long', 'hand'), hold(8, 12, 'long', 'rule')]);
    const after = removeMark(marks, 'hold', 0, TEXT.length, (m) => m.by === 'hand');
    expect(after.map((m) => [m.from, m.to, m.by])).toEqual([[2, 6, 'hand']]);
  });

  it('adjacent equal markings are fused, and unequal ones are not', () => {
    expect(normalise([hold(2, 4), hold(4, 6)]).map((m) => [m.from, m.to]))
      .toEqual([[2, 6]]);
    expect(normalise([hold(2, 4, 'long'), hold(4, 6, 'short')])).toHaveLength(2);
  });
});

describe('markings move with the text', () => {
  const marks = normalise([hold(10, 20)]);

  it('an edit before a marking shifts it by the difference', () => {
    const { marks: after } = shiftForEdit(marks, { from: 0, to: 0, inserted: 3 });
    expect(after.map((m) => [m.from, m.to])).toEqual([[13, 23]]);
  });

  it('an edit after a marking leaves it alone', () => {
    const { marks: after } = shiftForEdit(marks, { from: 25, to: 25, inserted: 4 });
    expect(after.map((m) => [m.from, m.to])).toEqual([[10, 20]]);
  });

  it('typing inside a marking grows it, so a held word stays held', () => {
    const { marks: after } = shiftForEdit(marks, { from: 15, to: 15, inserted: 2 });
    expect(after.map((m) => [m.from, m.to])).toEqual([[10, 22]]);
  });

  it('deleting every letter a marking covers drops it, and says so', () => {
    const { marks: after, dropped } = shiftForEdit(marks, { from: 8, to: 24, inserted: 0 });
    expect(after).toEqual([]);
    expect(dropped).toHaveLength(1);
  });

  it('an edit over one edge clips the marking to it', () => {
    const { marks: after } = shiftForEdit(marks, { from: 5, to: 15, inserted: 0 });
    expect(after.map((m) => [m.from, m.to])).toEqual([[5, 10]]);
  });

  it('a point marking inside a deleted range is dropped, not moved', () => {
    const pause = [mark({ k: 'pause', from: 12, to: 12, v: 'short' })];
    const { marks: after, dropped } = shiftForEdit(pause, { from: 10, to: 15, inserted: 0 });
    expect(after).toEqual([]);
    expect(dropped).toHaveLength(1);
  });

  it('the result is always sound, over random edits', () => {
    const random = rng(31);
    let list = normalise([hold(4, 9), hold(12, 18, 'short')]);
    let text = TEXT;
    for (let n = 0; n < 200; n += 1) {
      const a = Math.floor(random() * text.length);
      const b = Math.min(text.length, a + Math.floor(random() * 5));
      const insert = 'xyz'.slice(0, Math.floor(random() * 4));
      const { marks: next } = shiftForEdit(list, { from: a, to: b, inserted: insert.length });
      text = text.slice(0, a) + insert + text.slice(b);
      list = next;
      assertMarks(list, text, `edit ${n}`);
    }
  });
});

describe('order is total, so the bytes are stable', () => {
  it('sorting is deterministic for markings that start together', () => {
    const a = mark({ k: 'hold', from: 4, to: 8, v: 'long' });
    const b = mark({ k: 'svara', from: 4, to: 8, v: 'anudatta' });
    expect([...[a, b]].sort(compareMarks)).toEqual([...[b, a]].sort(compareMarks));
  });

  it('marksIn finds what touches a range and nothing else', () => {
    const list = normalise([hold(2, 6), hold(10, 14)]);
    expect(marksIn(list, 6, 10)).toEqual([]);
    expect(marksIn(list, 5, 11)).toHaveLength(2);
  });
});
