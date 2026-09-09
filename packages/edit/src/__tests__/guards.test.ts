/**
 * The guards, one test per way they were got round.
 *
 * Every case here is a defect that was found by an adversarial review rather
 * than by this suite, and every one lost or corrupted data with no refusal and
 * no report. They are collected in one file because they are one kind of
 * failure: a rule that was stated in a docstring and not enforced in the code.
 */
import { describe, expect, it } from 'vitest';
import { toTextAndMarks } from '@siksamitra/format';
import { apply, newState } from '../session.js';
import { emptyHistory, record, restore, snapshot } from '../history.js';
import { flatten } from '../caret.js';
import { sourcesOf } from '../sync.js';
import { attested, doc, section, verse } from './fixture.js';
import type { ChantDoc } from '@siksamitra/format';

const flatOf = (d: ChantDoc, id = 's1') =>
  flatten(sourcesOf(d.sections.find((s) => s.id === id)!));

describe('a verse boundary is a boundary, not a wall', () => {
  /*
   * THIS USED TO BE "a transcribed verse is an atomic barrier".
   *
   * Three gestures — Delete at the end of the verse before, Backspace at the
   * start of the transcribed verse, Backspace at the start of the verse after
   * — each destroyed a verse with `refusals: []`, so the block was written to
   * refuse all three. The refusal was never the point; not losing the verse
   * was. A verse holds its own text and its own markings now, and joining two
   * of them is an ordinary edit that reports what it cost.
   */
  const mixed = (): ChantDoc => doc([section('s1', [
    verse('v-1', ['agnim']),
    attested('v-2', ['mile']),
    verse('v-3', ['hotāraṁ ratnadhātamam']),
  ])]);

  const gestures = [
    ['Delete at the end of the verse before it', 0],
    ['Backspace at the start of the transcribed verse', 1],
    ['Backspace at the start of the verse after it', 2],
  ] as const;

  for (const [name, which] of gestures) {
    it(`takes ${name}, losing no words`, () => {
      const start = newState(mixed());
      const flat = flatOf(start.doc);
      const lines = flat.lineStarts;
      const at = which === 0
        ? { from: lines[0]!.at + lines[0]!.length, to: lines[0]!.at + lines[0]!.length + 1 }
        : which === 1
          ? { from: lines[1]!.at - 1, to: lines[1]!.at }
          : { from: lines[2]!.at - 1, to: lines[2]!.at };

      const { state } = apply(start, emptyHistory(), {
        k: 'replace', sectionId: 's1', from: at.from, to: at.to, insert: '',
      });

      /*
       * THE WORDS SURVIVE, which is what the refusal was protecting. Joining
       * two verses puts one text where there were two; every letter of both is
       * still in the section.
       */
      const before = flatOf(start.doc).text.replace(/\s+/gu, '');
      const after = flatOf(state.doc).text.replace(/\s+/gu, '');
      expect(after.length, name).toBeGreaterThanOrEqual(before.length - 2);
      /* `hotāraṁ` reads `hotāram̐` because the fixture was BUILT by running
         the engine, which writes the anusvāra as `m` plus a candrabindu.
         Freshly typed text keeps the `ṁ` until somebody asks for the rules. */
      for (const word of ['agnim', 'mile', 'hotāram̐']) {
        expect(after, `${name}: ${word}`).toContain(word.replace(/\s+/gu, ''));
      }
    });
  }

  it('and typing at the start of the verse after it still just types', () => {
    const start = newState(mixed());
    const at = flatOf(start.doc).lineStarts[2]!.at;
    const { state } = apply(start, emptyHistory(), {
      k: 'replace', sectionId: 's1', from: at, to: at, insert: 'oṁ ',
    });
    expect(state.refusals).toEqual([]);
    expect(toTextAndMarks(state.doc.sections[0]!.verses[2]!).text)
      .toBe('oṁ hotāram̐ ratnadhātamam');
  });
});

describe('a command may only touch the section it names', () => {
  const two = (): ChantDoc => doc([
    section('s1', [verse('a-1', ['agnim'])]),
    section('s2', [verse('v-2', ['mile'])]),
  ]);

  it('recompute refuses a verse from another section', () => {
    /*
     * In `replace` mode this DELETES the hold overrides for the ids it is
     * given. Unchecked, naming another section's verse deleted an `owner-hand`
     * decision there — while that section's tokens, not being re-derived, went
     * on drawing a box no override justified.
     */
    const start = newState(two());
    const { state } = apply(start, emptyHistory(), {
      k: 'recompute',
      stages: ['holdings'], sectionId: 's1', verseIds: ['v-2'], mode: 'replace',
    });
    /* A verse that is not in the section has no number IN it, so the refusal
       falls back to "This verse" rather than inventing a position. */
    expect(state.refusals[0]).toContain('This verse was not in');
    expect(state.refusals[0]).toContain('may only touch');
    expect(state.doc).toEqual(start.doc);
  });

  it('a new verse never takes an id another section is using', () => {
    /*
     * An override is addressed `{verse, line, letter}` and applied
     * document-wide, so a minted id that collided with another section's verse
     * made the new verse inherit that verse's hand-placed holding — a box on
     * text the author never marked.
     */
    const start = newState(two());
    const flat = flatOf(start.doc);
    const { state } = apply(start, emptyHistory(), {
      k: 'replace',
      sectionId: 's1',
      from: flat.text.length,
      to: flat.text.length,
      insert: '\n\nmile',
    });
    const ids = state.doc.sections.flatMap((s) => s.verses.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('v-2');
    expect(ids.filter((i) => i === 'v-2')).toHaveLength(1);
  });
});

describe('undo', () => {
  it('does not coalesce two sections into one step', () => {
    /*
     * A merged step keeps the FIRST command's `before`, and that snapshot holds
     * only the sections that command touched. Coalescing across sections
     * therefore produced an undo that restored one and left the other's edit
     * applied — permanently, with no way back. Reachable, because the coalesce
     * key is a kind plus a timestamp and says nothing about where the caret
     * was.
     */
    const start = newState(doc([
      section('s1', [verse('v-1', ['agnim'])]),
      section('s2', [verse('v-2', ['mile'])]),
    ]));
    const first = apply(start, emptyHistory(), {
      k: 'replace', sectionId: 's1', from: 0, to: 0, insert: 'x', coalesce: 'type',
    });
    const second = apply(first.state, first.history, {
      k: 'replace', sectionId: 's2', from: 0, to: 0, insert: 'y', coalesce: 'type',
    });
    expect(second.history.past).toHaveLength(2);
  });

  it('coalesces two edits in the SAME section, as it should', () => {
    const start = newState(doc([section('s1', [verse('v-1', ['agnim'])])]));
    const first = apply(start, emptyHistory(), {
      k: 'replace', sectionId: 's1', from: 0, to: 0, insert: 'x', coalesce: 'type',
    });
    const second = apply(first.state, first.history, {
      k: 'replace', sectionId: 's1', from: 1, to: 1, insert: 'y', coalesce: 'type',
    });
    expect(second.history.past).toHaveLength(1);
  });

  it('restores a document that had no `overrides` key without adding one', () => {
    const original = doc([section('s1', [verse('v-1', ['agnim'])])]);
    expect(original.overrides).toBeUndefined();
    const snap = snapshot(original, ['s1'], null);
    expect(restore({ ...original, overrides: [] }, snap).overrides).toBeUndefined();
  });

  it('keeps a non-empty `overrides` on restore', () => {
    const original: ChantDoc = {
      ...doc([section('s1', [verse('v-1', ['agnim'])])]),
      overrides: [{ at: { verse: 'v-1', line: 0, letter: 0 }, set: {}, why: 'editorial' }],
    };
    const snap = snapshot(original, ['s1'], null);
    expect(restore(original, snap).overrides).toHaveLength(1);
  });

  it('record keeps the steps it cannot merge', () => {
    const original = doc([section('s1', [verse('v-1', ['agnim'])])]);
    const a = snapshot(original, ['s1'], null);
    const b = snapshot(original, ['s2'], null);
    const history = record(emptyHistory(), { before: a, after: a, coalesce: 'k' });
    expect(record(history, { before: b, after: b, coalesce: 'k' }).past).toHaveLength(2);
  });
});
