/**
 * The session — typing, rule zero, and undo, without a browser.
 *
 * Where two of the guarantees the owner asked for are checked: a transcribed
 * verse is never re-derived, and undo puts back exactly what was there. The
 * mark commands, the structural edits and the odd-input sweep are in
 * `session-marks.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { holdingProblems } from '../holdings.js';
import { emptyHistory, canRedo, canUndo } from '../history.js';
import { apply, newState, redo, undo } from '../session.js';
import { attested, doc, sample, section, verse } from './fixture.js';
import { at, linesOf, section1, type } from './helpers.js';

describe('typing', () => {
  it('re-derives the verse it changed, and only that verse', () => {
    const start = newState(sample());
    const before = section1(start).verses.map((v) => v.tokens);
    const { state } = type(start, at(start, 'v-2', 0, 0), 'oṁ ');

    expect(linesOf(state, 'v-2')).toEqual(['oṁ yajñasya devam ṛtvijam']);
    expect(state.reports.map((r) => r.verseId)).toEqual(['v-2']);
    // The neighbours are byte-identical: a keystroke costs one derivation.
    expect(section1(state).verses[0]!.tokens).toEqual(before[0]);
    expect(section1(state).verses[2]!.tokens).toEqual(before[2]);
  });

  it('produces tokens the renderer can draw — the marks are real', () => {
    const start = newState(doc([section('s1', [verse('v-1', ['tan no'])])]));
    const { state } = type(start, at(start, 'v-1', 0, 0), 'oṁ ');
    const tokens = section1(state).verses[0]!.tokens;
    expect(tokens.filter((t) => t.t === 'syl').length).toBeGreaterThan(2);
    expect(holdingProblems(tokens)).toEqual([]);
  });

  it('keeps the holding invariants after every keystroke of a word', () => {
    let state = newState(sample());
    let history = emptyHistory();
    for (const ch of 'namaste ') {
      const result = apply(state, history, {
        k: 'replace',
        sectionId: 's1',
        from: at(state, 'v-1', 0, 0),
        to: at(state, 'v-1', 0, 0),
        insert: ch,
        coalesce: 'type',
      });
      state = result.state;
      history = result.history;
      for (const v of section1(state).verses) {
        expect(holdingProblems(v.tokens), `after "${ch}"`).toEqual([]);
      }
    }
    // Typed backwards one character at a time, so the line reads in reverse.
    expect(linesOf(state, 'v-1')[0]).toBe('etsamanagnim īḷe purohitaṁ');
    expect(history.past).toHaveLength(1);
  });
});

describe('rule zero', () => {
  const mixed = () => doc([section('s1', [
    verse('v-1', ['agnim īḷe']),
    attested('v-2', ['yajñasya devam']),
    verse('v-3', ['hotāraṁ']),
  ])]);

  it('refuses a keystroke inside a transcribed verse, and names it', () => {
    const start = newState(mixed());
    const { state } = type(start, at(start, 'v-2', 0, 3), 'x');
    /* "Verse 2" — its number on the page, not its internal id. The reader
       has never seen `v-2` and cannot find it; the number is beside the line. */
    expect(state.refusals[0]).toContain('Verse 2');
    expect(state.refusals[0]).toContain('copied from a marked source');
    /* And in words: none of the program's own vocabulary. */
    for (const jargon of ['evidence rather than output', 'source layer', 'attested']) {
      expect(state.refusals[0]).not.toContain(jargon);
    }
    // Nothing changed.
    expect(state.doc).toEqual(start.doc);
  });

  it('refuses a keystroke at column 0 of a transcribed verse', () => {
    const start = newState(mixed());
    const { state } = type(start, at(start, 'v-2', 0, 0), 'x');
    expect(state.refusals).toHaveLength(1);
  });

  it('refuses a selection that merely REACHES a transcribed verse', () => {
    const start = newState(mixed());
    const { state } = apply(start, emptyHistory(), {
      k: 'replace',
      sectionId: 's1',
      from: at(start, 'v-1', 0, 2),
      to: at(start, 'v-3', 0, 2),
      insert: '',
    });
    expect(state.refusals[0]).toContain('Verse 2');
    expect(state.doc).toEqual(start.doc);
  });

  it('allows an edit that stays clear of it', () => {
    const start = newState(mixed());
    const { state } = type(start, at(start, 'v-3', 0, 0), 'oṁ ');
    expect(state.refusals).toEqual([]);
    expect(linesOf(state, 'v-3')).toEqual(['oṁ hotāraṁ']);
  });

  it('refuses to place a mark on a transcribed verse rather than doing nothing', () => {
    const start = newState(mixed());
    const { state } = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-2', unit: 0 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    expect(state.refusals[0]).toContain('Verse 2');
    expect(state.refusals[0]).toContain('nowhere to put a new one');
  });

  it('never invents a source layer for a transcribed verse', () => {
    const start = newState(mixed());
    const { state } = type(start, at(start, 'v-1', 0, 0), 'oṁ ');
    expect(section1(state).verses[1]!.src).toBeUndefined();
    expect(section1(state).verses[1]!.tokens).toEqual(section1(start).verses[1]!.tokens);
  });
});

describe('undo', () => {
  it('puts back the text, the marks and the caret', () => {
    const start = newState(sample());
    const typed = type(start, at(start, 'v-2', 0, 0), 'oṁ ');
    expect(canUndo(typed.history)).toBe(true);

    const back = undo(typed.state, typed.history);
    /*
     * BYTE-IDENTICAL, keys included. `apply` omits an empty `overrides` and
     * `restore` used not to — so an edit and its undo left a document that
     * hashed differently, on 5 of the 11 shipped files.
     */
    expect(back.state.doc).toEqual(start.doc);
    expect(back.state.doc.overrides).toBeUndefined();
    expect(canUndo(back.history)).toBe(false);
    expect(canRedo(back.history)).toBe(true);

    const again = redo(back.state, back.history);
    expect(again.state.doc.sections).toEqual(typed.state.doc.sections);
  });

  it('undoes a burst of typing in one step, and the next burst separately', () => {
    let state = newState(sample());
    let history = emptyHistory();
    for (const ch of 'abc') {
      const r = apply(state, history, {
        k: 'replace', sectionId: 's1', from: 0, to: 0, insert: ch, coalesce: 'type-1',
      });
      state = r.state;
      history = r.history;
    }
    const r2 = apply(state, history, {
      k: 'replace', sectionId: 's1', from: 0, to: 0, insert: 'z', coalesce: 'type-2',
    });
    expect(r2.history.past).toHaveLength(2);

    const once = undo(r2.state, r2.history);
    expect(linesOf(once.state, 'v-1')[0]).toBe('cbaagnim īḷe purohitaṁ');
    const twice = undo(once.state, once.history);
    expect(linesOf(twice.state, 'v-1')[0]).toBe('agnim īḷe purohitaṁ');
  });

  it('undoes a mark, restoring the derived tokens too', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark', sectionId: 's1', targets: [{ verseId: 'v-1', unit: 0 }], patch: { hold: 'long' }, why: 'owner-hand',
    });
    const back = undo(marked.state, marked.history);
    expect(back.state.doc.overrides).toBeUndefined();
    expect(section1(back.state).verses[0]!.tokens)
      .toEqual(section1(start).verses[0]!.tokens);
  });

  it('is harmless at the ends of the stack', () => {
    const start = newState(sample());
    const h = emptyHistory();
    expect(undo(start, h).state).toBe(start);
    expect(redo(start, h).state).toBe(start);
  });

  it('a refused command records no undo step', () => {
    const start = newState(doc([section('s1', [attested('v-1', ['agnim īḷe'])])]));
    const { history } = apply(start, emptyHistory(), {
      k: 'replace', sectionId: 's1', from: 0, to: 0, insert: 'x',
    });
    expect(history.past).toEqual([]);
  });
});
