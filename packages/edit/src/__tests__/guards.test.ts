/**
 * The guards, one test per way they were got round.
 *
 * Every case here is a defect that was found by an adversarial review rather
 * than by this suite, and every one lost or corrupted data with no refusal and
 * no report. They are collected in one file because they are one kind of
 * failure: a rule that was stated in a docstring and not enforced in the code.
 */
import { describe, expect, it } from 'vitest';
import { apply, newState } from '../session.js';
import { emptyHistory, record, restore, snapshot } from '../history.js';
import { flatten } from '../caret.js';
import { sourcesOf } from '../sync.js';
import { attested, doc, section, verse } from './fixture.js';
import type { ChantDoc } from '@siksamitra/format';

const flatOf = (d: ChantDoc, id = 's1') =>
  flatten(sourcesOf(d.sections.find((s) => s.id === id)!));

describe('a transcribed verse is an atomic barrier', () => {
  /*
   * Three gestures that each destroyed a transcribed verse with `refusals: []`.
   * All three are exactly what Backspace and Delete produce at those
   * positions, so all three were one keystroke away.
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
    it(`refuses ${name}`, () => {
      const start = newState(mixed());
      const flat = flatOf(start.doc);
      const lines = flat.lineStarts;
      // The three deletions, in flat coordinates: one character out of the
      // separator on each side, and one at the transcribed verse's own start.
      const at = which === 0
        ? { from: lines[0]!.at + lines[0]!.length, to: lines[0]!.at + lines[0]!.length + 1 }
        : which === 1
          ? { from: lines[1]!.at - 1, to: lines[1]!.at }
          : { from: lines[2]!.at - 1, to: lines[2]!.at };

      const { state } = apply(start, emptyHistory(), {
        k: 'replace', sectionId: 's1', from: at.from, to: at.to, insert: '',
      });
      expect(state.refusals[0], name).toContain('Verse 2');
      expect(state.doc, name).toEqual(start.doc);
    });
  }

  it('still allows typing at the start of the verse after it', () => {
    // An INSERTION at that point prepends to the following verse and touches
    // the transcription not at all. Refusing it would make the barrier a wall.
    const start = newState(mixed());
    const at = flatOf(start.doc).lineStarts[2]!.at;
    const { state } = apply(start, emptyHistory(), {
      k: 'replace', sectionId: 's1', from: at, to: at, insert: 'oṁ ',
    });
    expect(state.refusals).toEqual([]);
    expect(state.doc.sections[0]!.verses[2]!.src!.lines[0]).toBe('oṁ hotāraṁ ratnadhātamam');
  });
});

describe('a command may only touch the section it names', () => {
  const two = (): ChantDoc => doc([
    section('s1', [verse('a-1', ['agnim'])]),
    section('s2', [verse('v-2', ['mile'])]),
  ]);

  it('auto-holdings refuses a verse from another section', () => {
    /*
     * In `replace` mode this DELETES the hold overrides for the ids it is
     * given. Unchecked, naming another section's verse deleted an `owner-hand`
     * decision there — while that section's tokens, not being re-derived, went
     * on drawing a box no override justified.
     */
    const start = newState(two());
    const { state } = apply(start, emptyHistory(), {
      k: 'auto-holdings', sectionId: 's1', verseIds: ['v-2'], mode: 'replace',
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
