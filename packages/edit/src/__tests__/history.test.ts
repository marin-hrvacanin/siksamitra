/**
 * UNDO — the feature a person trusts most and inspects least.
 *
 * `history.ts` says so in its own header, and it had no test of its own: the
 * only coverage was whatever the session tests happened to walk through. Two
 * faults were found by measuring it, and both are the kind nobody reports as a
 * bug because neither looks like one.
 *
 *   A COMMAND THAT CHANGED NOTHING RECORDED A STEP. Four of five degenerate
 *   commands did: a `replace` of nothing over nothing, a `replace` of a range
 *   with the text it already had, a `mark` with no targets, an `unmark` with
 *   no targets, a `recompute` of no verses. From the outside: press a marking
 *   button with nothing selected, then Ctrl+Z, and nothing appears to happen —
 *   it restored an identical document — so you press it again, and again, each
 *   press spending a no-op, until you finally reach the edit you wanted back.
 *   "Undo does nothing" is the report and the history is the reason.
 *
 *   THE HISTORY HAD NO LIMIT. A step holds a snapshot of the section BEFORE
 *   and AFTER, and the largest section of Śrī Rudram is 182 kB: 200 separate
 *   edits — a few minutes of typing with pauses — measured 24 MB, and an
 *   afternoon's work would have been hundreds. A tab that gets slower all day
 *   and then stops.
 *
 * Everything here is measured against the DOCUMENT's bytes (`canonicalJson`),
 * not against the history's own bookkeeping: "undo worked" means the document
 * came back, byte for byte.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '@siksamitra/format';
import {
  HISTORY_DEPTH, canRedo, canUndo, emptyHistory, record, restore, snapshot,
} from '../history.js';
import { apply, newState, redo, undo } from '../session.js';
import { doc, sample, section, verse } from './fixture.js';
import { at, section1 } from './helpers.js';
import type { History, Step } from '../history.js';

/** A step that says it touched these sections, so `record`'s rules apply. */
const step = (ids: readonly string[], coalesce?: string): Step => {
  const made = doc([...ids].map((id) => section(id, [verse(`${id}-v`, ['agnim'])])));
  const snap = snapshot(made, ids, null);
  return { before: snap, after: snap, ...(coalesce === undefined ? {} : { coalesce }) };
};

describe('a command that changed nothing is not an undo step', () => {
  const start = () => newState(sample());
  const id = 's1';

  const degenerate = [
    {
      what: 'a replace of nothing over nothing',
      command: { k: 'replace' as const, sectionId: id, from: 3, to: 3, insert: '' },
    },
    {
      what: 'a replace of a range with the text it already had',
      command: { k: 'replace' as const, sectionId: id, from: 0, to: 1, insert: 'a' },
    },
    {
      what: 'a mark with no targets',
      command: {
        k: 'mark' as const, sectionId: id, targets: [], patch: { hold: 'long' }, why: 'hand' as const,
      },
    },
    {
      what: 'an unmark with no targets',
      command: { k: 'unmark' as const, sectionId: id, targets: [], fields: ['hold' as const] },
    },
    {
      what: 'a recompute of no verses',
      command: {
        k: 'recompute' as const, sectionId: id, verseIds: [],
        stages: ['holdings' as const], mode: 'keep' as const,
      },
    },
  ];

  for (const { what, command } of degenerate) {
    it(`${what} records none`, () => {
      const state = start();
      const before = canonicalJson(state.doc);
      const done = apply(state, emptyHistory(), command);
      /* The premise: this really did change nothing. Without it the check
         below would be asserting that a REAL edit is not recorded. */
      expect(canonicalJson(done.state.doc), `${what} changed the document`).toBe(before);
      expect(done.history.past, what).toHaveLength(0);
      expect(canUndo(done.history), what).toBe(false);
    });
  }

  it('and a real edit IS recorded — the control', () => {
    /*
     * Without this, refusing every step would pass all five cases above and
     * undo would be gone entirely.
     */
    const state = start();
    const done = apply(state, emptyHistory(), {
      k: 'replace', sectionId: id, from: at(state, 'v-2', 0, 0), to: 0, insert: 'oṁ ',
    });
    expect(canonicalJson(done.state.doc)).not.toBe(canonicalJson(state.doc));
    expect(done.history.past).toHaveLength(1);
  });

  it('and the document comes back byte for byte when it is undone', () => {
    /* An empty `overrides` and an absent `profile` are the two things
       `restore` takes care over: absent and empty differ to `canonicalJson`,
       so a careless undo changes a document's bytes and its `docHash`. */
    const state = start();
    const before = canonicalJson(state.doc);
    const edited = apply(state, emptyHistory(), {
      k: 'replace', sectionId: id, from: at(state, 'v-1', 0, 0), to: 0, insert: 'X',
    });
    const back = undo(edited.state, edited.history);
    expect(canonicalJson(back.state.doc)).toBe(before);
    /* And redo puts exactly the edit back. */
    const again = redo(back.state, back.history);
    expect(canonicalJson(again.state.doc)).toBe(canonicalJson(edited.state.doc));
  });

  it('undo at the bottom of the stack is a no-op, not a crash', () => {
    const state = start();
    const before = canonicalJson(state.doc);
    const nothing = undo(state, emptyHistory());
    expect(canonicalJson(nothing.state.doc)).toBe(before);
    expect(canRedo(nothing.history)).toBe(false);
  });
});

describe('how far back it goes', () => {
  it('a hundred steps, and the OLDEST is the one dropped', () => {
    /*
     * The oldest, because refusing to record once full would make the most
     * recent edit the one you cannot take back — the wrong end to lose.
     */
    let history: History = emptyHistory();
    for (let i = 0; i < HISTORY_DEPTH + 25; i += 1) {
      history = record(history, { ...step(['s1']), coalesce: `k${i}` });
    }
    expect(history.past).toHaveLength(HISTORY_DEPTH);
    /* The 25 that fell off are the first 25: what remains starts at `k25`. */
    expect(history.past[0]?.coalesce).toBe('k25');
    expect(history.past[HISTORY_DEPTH - 1]?.coalesce).toBe(`k${HISTORY_DEPTH + 24}`);
  });

  it('and it is not a limit anybody hits by typing', () => {
    /* A burst of typing coalesces into ONE step, so a hundred steps is a
       hundred distinct acts. This is what makes the cap safe to have. */
    let history: History = emptyHistory();
    for (let i = 0; i < 200; i += 1) {
      history = record(history, { ...step(['s1']), coalesce: 'one-burst' });
    }
    expect(history.past).toHaveLength(1);
  });

  it('the size that made the cap necessary, stated', () => {
    /* MEASURED on Śrī Rudram: the largest section is 182 kB and a step holds
       it twice, so 200 uncoalesced edits came to 24 MB. The cap halved that.
       The number is here so a change to `HISTORY_DEPTH` is a decision about
       megabytes rather than about a round number. */
    expect(HISTORY_DEPTH).toBe(100);
  });
});

describe('coalescing', () => {
  it('the same key extends the last step rather than adding one', () => {
    const history = record(record(emptyHistory(), step(['s1'], 'type')), step(['s1'], 'type'));
    expect(history.past).toHaveLength(1);
  });

  it('a different key does not', () => {
    const history = record(record(emptyHistory(), step(['s1'], 'type')), step(['s1'], 'delete'));
    expect(history.past).toHaveLength(2);
  });

  it('and NEITHER does the same key in a different section', () => {
    /*
     * A merged step keeps the FIRST command's `before`, and that snapshot only
     * holds the sections that command touched — so coalescing a step in
     * section A with one in section B produced an undo that restored A and
     * left B's edit applied, permanently, with no way back. The coalesce key
     * is a kind plus a timestamp and says nothing about where the caret was,
     * so it is reachable from the surface.
     */
    const history = record(record(emptyHistory(), step(['s1'], 'type')), step(['s2'], 'type'));
    expect(history.past).toHaveLength(2);
  });

  it('and no key at all never coalesces', () => {
    const history = record(record(emptyHistory(), step(['s1'])), step(['s1']));
    expect(history.past).toHaveLength(2);
  });

  it('recording anything throws the redo stack away', () => {
    /* A new edit after an undo is a new branch, and the old future is not
       reachable from it. */
    const one = record(emptyHistory(), step(['s1'], 'a'));
    const undone = { past: [], future: one.past };
    expect(canRedo(undone)).toBe(true);
    expect(record(undone, step(['s1'], 'b')).future).toHaveLength(0);
  });
});

describe('what a snapshot puts back', () => {
  it('an absent `overrides` stays absent, not empty', () => {
    /*
     * Absent and empty mean the same thing to a reader and different things to
     * `canonicalJson`, so writing `"overrides": []` onto a document that never
     * had the key changes its bytes and its `docHash`. Measured once: 5 of the
     * 11 shipped documents were NOT byte-identical after an edit and its undo.
     */
    const made = sample();
    expect('overrides' in made).toBe(false);
    const put = restore(made, snapshot(made, ['s1'], null));
    expect('overrides' in put).toBe(false);
    expect(canonicalJson(put)).toBe(canonicalJson(made));
  });

  it('and a section is matched by ID, not by position', () => {
    /*
     * An undo that assumed positions would corrupt a document if a command
     * had reordered anything.
     */
    const made = doc([
      section('a', [verse('a-v', ['agnim'])]),
      section('b', [verse('b-v', ['īḷe'])]),
    ]);
    const snap = snapshot(made, ['b'], null);
    const swapped = { ...made, sections: [made.sections[1]!, made.sections[0]!] };
    const put = restore(swapped, snap);
    expect(put.sections.map((s) => s.id)).toEqual(['b', 'a']);
    expect(put.sections.find((s) => s.id === 'b')).toEqual(made.sections[1]);
  });

  it('a snapshot of one section leaves the others alone', () => {
    const made = doc([
      section('a', [verse('a-v', ['agnim'])]),
      section('b', [verse('b-v', ['īḷe'])]),
    ]);
    const state = newState(made);
    const edited = apply(state, emptyHistory(), {
      k: 'replace', sectionId: 'a', from: 0, to: 0, insert: 'X',
    });
    const back = undo(edited.state, edited.history);
    expect(canonicalJson(back.state.doc)).toBe(canonicalJson(made));
    expect(section1(back.state)).toEqual(made.sections[0]);
  });
});
