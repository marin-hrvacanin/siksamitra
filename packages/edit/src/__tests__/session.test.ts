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
  it('changes the verse it touched, and DERIVES NOTHING', () => {
    const start = newState(sample());
    const before = section1(start).verses.map((v) => v.tokens);
    const { state } = type(start, at(start, 'v-2', 0, 0), 'oṁ ');

    expect(linesOf(state, 'v-2')).toEqual(['oṁ yajñasya devam ṛtvijam']);
    /*
     * NO REPORTS, because nothing was derived. This used to expect `['v-2']`
     * — one derivation per keystroke — which is the whole defect: a
     * derivation is the marking rules, so typing placed holdings nobody asked
     * for. `tests/integration/recompute.test.ts` is where that is measured
     * against the corpus.
     */
    expect(state.reports).toEqual([]);
    // The neighbours are byte-identical: a keystroke touches one verse.
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
    /*
     * Typed backwards one character at a time, so the line reads in reverse —
     * and the LAST character typed is a space, at column 0, so the line begins
     * with one. It used to be trimmed away, which is the owner's "I can't type
     * space": a space is a character, and typing one puts one there.
     */
    expect(linesOf(state, 'v-1')[0]).toBe(' etsamanagnim īḷe purohitaṁ');
    expect(history.past).toHaveLength(1);
  });
});

describe('there are no layers: every verse takes an edit', () => {
  /*
   * THIS BLOCK USED TO BE CALLED "rule zero" AND ASSERTED THE OPPOSITE.
   *
   * A verse was either derived, and editable, or transcribed, and frozen —
   * the second kind had no source layer, so an edit to it had nowhere to go
   * and was declined by name. The owner's reply to that arrangement was "what
   * are these layers you are talking about?", and the answer is that there are
   * none any more: a verse is one text and a list of markings, and the caret
   * edits the text that is shown.
   *
   * `attested()` still builds a verse with no `src`, because documents in the
   * wild have them. It is no longer a different KIND of verse.
   */
  const mixed = () => doc([section('s1', [
    verse('v-1', ['agnim īḷe']),
    attested('v-2', ['yajñasya devam']),
    verse('v-3', ['hotāraṁ']),
  ])]);

  it('takes a keystroke inside a verse that has no source layer', () => {
    const start = newState(mixed());
    const { state } = type(start, at(start, 'v-2', 0, 3), 'x');
    expect(state.refusals).toEqual([]);
    expect(linesOf(state, 'v-2')[0]).toContain('x');
  });

  it('takes one at column 0 of it, too', () => {
    const start = newState(mixed());
    const { state } = type(start, at(start, 'v-2', 0, 0), 'x');
    expect(state.refusals).toEqual([]);
    expect(linesOf(state, 'v-2')[0]!.startsWith('x')).toBe(true);
  });

  it('takes a selection that runs across it', () => {
    const start = newState(mixed());
    const { state } = apply(start, emptyHistory(), {
      k: 'replace',
      sectionId: 's1',
      from: at(start, 'v-1', 0, 2),
      to: at(start, 'v-3', 0, 2),
      insert: '',
    });
    expect(state.doc).not.toEqual(start.doc);
  });

  it('says which markings an edit ran over, rather than refusing the edit', () => {
    /* A marking on letters the edit replaced cannot follow them. That is a
       cost, and it is reported by name — it is not a reason to decline the
       keystroke. */
    const start = newState(mixed());
    const { state } = apply(start, emptyHistory(), {
      k: 'replace',
      sectionId: 's1',
      from: at(start, 'v-1', 0, 0),
      to: at(start, 'v-1', 0, 5),
      insert: '',
    });
    for (const r of state.refusals) expect(r).toContain('marking');
  });

  it('MARKS a verse with no source layer', () => {
    /*
     * This is the button the owner reported three times as broken: select
     * letters, press Long, read a paragraph about evidence, see nothing
     * happen. A marking is a range over the text now, so every verse takes
     * one.
     */
    const start = newState(mixed());
    const { state } = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-2', unit: 0 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    expect(state.refusals).toEqual([]);
    const marked = section1(state).verses[1]!.tokens.find((t) => t.t === 'syl');
    expect(marked!.t === 'syl' && marked.units[0]!.hold).toBe('long');
  });

  it('still never invents a source layer', () => {
    const start = newState(mixed());
    const { state } = type(start, at(start, 'v-1', 0, 0), 'oṁ ');
    expect(section1(state).verses[1]!.src).toBeUndefined();
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
    /*
     * A text edit is never refused now, so the refusal this checks has to be
     * one that still exists: naming a verse from another section. It used to
     * be a keystroke in a transcribed verse.
     */
    const start = newState(doc([
      section('s1', [verse('v-1', ['agnim īḷe'])]),
      section('s2', [verse('v-2', ['hotāraṁ'])]),
    ]));
    const { state, history } = apply(start, emptyHistory(), {
      k: 'recompute',
      sectionId: 's1',
      verseIds: ['v-2'],
      stages: ['holdings'],
      mode: 'keep-hand',
    });
    expect(state.refusals.length).toBeGreaterThan(0);
    expect(history.past).toEqual([]);
  });
});
