/**
 * Placing a mark by hand, and taking it back.
 *
 * Two modules with no unit test between them, and both hold something that
 * cost real work:
 *
 *   `marks.ts`   turns "the letters I selected" into overrides — merging with
 *                what is already there rather than stacking a second decision
 *                on the same letter, and recording the letter as a witness.
 *   `history.ts` undo as a REVERSE PATCH: a snapshot of the sections an edit
 *                touched plus the document's overrides. Its one subtlety —
 *                that an empty `overrides` must be OMITTED and not written as
 *                `[]` — is why five of eleven documents were not byte-identical
 *                after an edit and its undo.
 */
import { describe, expect, it } from 'vitest';
import { derive } from '@siksamitra/engine';
import type { ChantDoc, ChantOverride } from '@siksamitra/format';
import { canonicalJson } from '@siksamitra/format';
import { clearMarks, markLetters, overridesFor, sourceAddress } from '../marks.js';
import { emptyHistory, record, restore, snapshot } from '../history.js';

const derived = derive({ lines: ['agnim īḷe purohitaṁ'] }, undefined, {
  verseId: 'v-1', trace: false,
});
const srcMap = derived.srcMap;
const at = (unit: number) => ({ verseId: 'v-1', unit });

describe('addressing a letter', () => {
  it('gives its line, its offset, and the letter itself as a witness', () => {
    const found = sourceAddress('v-1', srcMap, 3)!;
    expect(found.at.verse).toBe('v-1');
    expect(found.at.line).toBe(0);
    expect(found.ch.length).toBeGreaterThan(0);
    // The witness is the text AT that offset, not a guess.
    expect(srcMap.lines[0]!.slice(found.at.letter, found.at.letter + found.ch.length))
      .toBe(found.ch);
  });

  it('is null for a letter that is not there', () => {
    expect(sourceAddress('v-1', srcMap, 9999)).toBeNull();
  });
});

describe('marking letters', () => {
  it('places one override per letter, with the reason', () => {
    const { overrides, placed, missed } = markLetters(
      [], srcMap, [at(1), at(2)], { hold: 'short' }, 'owner-hand',
    );
    expect(placed).toBe(2);
    expect(missed).toBe(0);
    expect(overrides).toHaveLength(2);
    for (const o of overrides) {
      expect(o.why).toBe('owner-hand');
      expect(o.set).toEqual({ hold: 'short' });
      expect(o.ch).toBeTypeOf('string');
    }
  });

  it('MERGES with what is already on that letter, rather than stacking', () => {
    /*
     * Two overrides on one letter would be two decisions about the same thing,
     * and which one won would depend on the order they were stored in.
     */
    const first = markLetters([], srcMap, [at(1)], { hold: 'short' }, 'owner-hand').overrides;
    const second = markLetters(first, srcMap, [at(1)], { svara: 'anudatta' }, 'owner-hand');
    expect(second.overrides).toHaveLength(1);
    expect(second.overrides[0]!.set).toEqual({ hold: 'short', svara: 'anudatta' });
  });

  it('replaces a field rather than keeping both values', () => {
    const first = markLetters([], srcMap, [at(1)], { hold: 'short' }, 'owner-hand').overrides;
    const second = markLetters(first, srcMap, [at(1)], { hold: 'long' }, 'owner-hand');
    expect(second.overrides[0]!.set).toEqual({ hold: 'long' });
  });

  it('counts a letter it could not address, rather than failing silently', () => {
    const { placed, missed } = markLetters(
      [], srcMap, [at(0), at(9999)], { hold: 'short' }, 'owner-hand',
    );
    expect(placed).toBe(1);
    expect(missed).toBe(1);
  });

  it('returns a new array — the old one is what undo holds', () => {
    const before: ChantOverride[] = [];
    const after = markLetters(before, srcMap, [at(1)], { hold: 'short' }, 'owner-hand');
    expect(before).toHaveLength(0);
    expect(after.overrides).not.toBe(before);
  });
});

describe('clearing marks', () => {
  it('removes the named fields and leaves the rest', () => {
    const placed = markLetters(
      [], srcMap, [at(1)], { hold: 'short', svara: 'anudatta' }, 'owner-hand',
    ).overrides;
    const cleared = clearMarks(placed, srcMap, [at(1)], ['hold']);
    expect(cleared[0]!.set).toEqual({ svara: 'anudatta' });
  });

  it('drops an override that has nothing left to say', () => {
    /*
     * An override with an empty `set` is not "no marks here" — it is noise
     * that a reader has to skip and a diff has to carry.
     */
    const placed = markLetters([], srcMap, [at(1)], { hold: 'short' }, 'owner-hand').overrides;
    const cleared = clearMarks(placed, srcMap, [at(1)], ['hold', 'hg']);
    expect(cleared).toEqual([]);
  });

  it('leaves other letters alone', () => {
    const placed = markLetters([], srcMap, [at(1), at(2)], { hold: 'short' }, 'owner-hand').overrides;
    const cleared = clearMarks(placed, srcMap, [at(1)], ['hold']);
    expect(cleared).toHaveLength(1);
  });
});

describe('the overrides of one verse', () => {
  it('are only that verse s', () => {
    const mine = markLetters([], srcMap, [at(1)], { hold: 'short' }, 'owner-hand').overrides;
    const theirs: ChantOverride = {
      at: { verse: 'v-2', line: 0, letter: 0 }, set: { hold: 'long' }, why: 'owner-hand',
    };
    expect(overridesFor([...mine, theirs], 'v-1')).toHaveLength(1);
    expect(overridesFor([...mine, theirs], 'v-2')).toHaveLength(1);
    expect(overridesFor([...mine, theirs], 'v-3')).toHaveLength(0);
  });
});

describe('undo', () => {
  const doc = (over: Partial<ChantDoc> = {}): ChantDoc => ({
    title: 't',
    titleForms: { iast: 't' },
    sections: [
      { id: 's1', verses: [{ id: 'v-1', tokens: [], src: { lines: ['a'] } }] },
      { id: 's2', verses: [{ id: 'v-2', tokens: [], src: { lines: ['b'] } }] },
    ],
    ...over,
  });

  it('restores a section by ID, not by position', () => {
    /* An undo that assumed positions would corrupt a document whose sections
       a command had reordered. */
    const before = doc();
    const snap = snapshot(before, ['s2'], null);
    const moved: ChantDoc = { ...before, sections: [before.sections[1]!, before.sections[0]!] };
    const edited: ChantDoc = {
      ...moved,
      sections: moved.sections.map((s) => (
        s.id === 's2'
          ? { ...s, verses: [{ id: 'v-2', tokens: [], src: { lines: ['CHANGED'] } }] }
          : s
      )),
    };
    const back = restore(edited, snap);
    expect(back.sections.find((s) => s.id === 's2')!.verses[0]!.src!.lines).toEqual(['b']);
    // The section that was not in the snapshot is untouched.
    expect(back.sections.find((s) => s.id === 's1')!.verses[0]!.src!.lines).toEqual(['a']);
  });

  it('leaves a document byte-identical when it had no overrides', () => {
    /*
     * THE BUG. Absent and empty mean the same thing to a reader and different
     * things to `canonicalJson`, so writing `"overrides": []` back onto a
     * document that never had the key changes its bytes and its hash. Five of
     * the eleven shipped documents were not byte-identical after an edit and
     * its undo, and the test that claimed otherwise had hard-coded one of the
     * six that were.
     */
    const before = doc();
    const bytes = canonicalJson(before);
    const snap = snapshot(before, ['s1'], null);
    const edited: ChantDoc = {
      ...before,
      overrides: [{ at: { verse: 'v-1', line: 0, letter: 0 }, set: { hold: 'short' }, why: 'owner-hand' }],
    };
    expect(canonicalJson(restore(edited, snap))).toBe(bytes);
    expect(restore(edited, snap).overrides).toBeUndefined();
  });

  it('restores the overrides a document did have', () => {
    const overrides: ChantOverride[] = [
      { at: { verse: 'v-1', line: 0, letter: 2 }, set: { hold: 'long' }, why: 'owner-hand' },
    ];
    const before = doc({ overrides });
    const snap = snapshot(before, ['s1'], null);
    const back = restore({ ...before, overrides: [] }, snap);
    expect(back.overrides).toEqual(overrides);
  });
});

describe('the history stack', () => {
  /**
   * A step, with the caller-supplied coalesce key.
   *
   * The key is what says "this is more of the same gesture" — typing supplies
   * one, a marking command does not. A step with no key never merges, which is
   * why every one of these passes it explicitly.
   */
  const step = (coalesce: string | undefined, ids: string[]) => ({
    coalesce,
    before: {
      sections: ids.map((id) => ({ id, verses: [] })),
      overrides: [],
      selection: null,
    },
    after: {
      sections: ids.map((id) => ({ id, verses: [] })),
      overrides: [],
      selection: null,
    },
  });

  it('starts empty', () => {
    const h = emptyHistory();
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
  });

  it('coalesces consecutive steps of the same kind on the same sections', () => {
    /* Typing is one undo, not one per keystroke. */
    let h = emptyHistory();
    h = record(h, step('type:s1', ['s1']) as never);
    h = record(h, step('type:s1', ['s1']) as never);
    h = record(h, step('type:s1', ['s1']) as never);
    expect(h.past).toHaveLength(1);
  });

  it('does NOT coalesce across different sections', () => {
    /*
     * Two edits of the same KIND in different sections are two edits: merging
     * them would restore a snapshot that never described the second one.
     */
    let h = emptyHistory();
    h = record(h, step('type', ['s1']) as never);
    h = record(h, step('type', ['s2']) as never);
    expect(h.past).toHaveLength(2);
  });

  it('does not coalesce different kinds', () => {
    let h = emptyHistory();
    h = record(h, step('type:s1', ['s1']) as never);
    h = record(h, step('mark:s1', ['s1']) as never);
    expect(h.past).toHaveLength(2);
  });

  it('never coalesces a step that supplies no key', () => {
    /* A command that does not claim to continue a gesture gets its own undo. */
    let h = emptyHistory();
    h = record(h, step(undefined, ['s1']) as never);
    h = record(h, step(undefined, ['s1']) as never);
    expect(h.past).toHaveLength(2);
  });

  it('drops the redo stack when a new edit is recorded', () => {
    const h = record(
      { past: [], future: [step('type:s1', ['s1']) as never] },
      step('mark:s1', ['s1']) as never,
    );
    expect(h.future).toEqual([]);
  });
});
