/**
 * The session — marks by hand, structural edits, and the odd-input sweep.
 *
 * The other half of `session.test.ts`. Split because the file passed 400 lines
 * and the module gate is right about that.
 */
import { describe, expect, it } from 'vitest';
import { holdingProblems } from '../holdings.js';
import { emptyHistory } from '../history.js';
import { apply, newState, srcMapFor, undo } from '../session.js';
import { attested, doc, sample, section, verse } from './fixture.js';
import { at, flatOf, linesOf, section1, type, versesOf } from './helpers.js';

describe('marks by hand', () => {
  it('places a holding, and the token carries it', () => {
    const start = newState(sample());
    const map = srcMapFor(start.doc, 's1', 'v-1')!;
    expect(map.units.length).toBeGreaterThan(3);

    const { state } = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 0 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
      note: 'the owner said so',
    });

    expect(state.doc.overrides).toHaveLength(1);
    expect(state.doc.overrides![0]!.ch).toBe('a');
    const first = section1(state).verses[0]!.tokens.find((t) => t.t === 'syl');
    expect(first!.t === 'syl' && first.units[0]!.hold).toBe('long');
    expect(holdingProblems(section1(state).verses[0]!.tokens)).toEqual([]);
  });

  it('a hand mark survives a text edit elsewhere in the line', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 6 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    const letter = marked.state.doc.overrides![0]!.ch;
    const moved = apply(marked.state, marked.history, {
      k: 'replace', sectionId: 's1', from: at(marked.state, 'v-1', 0, 0), to: at(marked.state, 'v-1', 0, 0), insert: 'oṁ ',
    });

    expect(moved.state.lostMarks).toEqual([]);
    // Still on the same letter, three characters further along.
    expect(moved.state.doc.overrides![0]!.ch).toBe(letter);
    expect(moved.state.doc.overrides![0]!.at.letter).toBe(marked.state.doc.overrides![0]!.at.letter + 3);
  });

  it('reports a hand mark whose letter was deleted', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 6 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    const killed = apply(marked.state, marked.history, {
      k: 'replace',
      sectionId: 's1',
      from: at(marked.state, 'v-1', 0, 0),
      to: at(marked.state, 'v-1', 0, 9),
      insert: '',
    });
    expect(killed.state.lostMarks).toHaveLength(1);
    expect(killed.state.doc.overrides).toBeUndefined();
  });

  it('unmark withdraws the opinion and the engine decides again', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 0 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    const cleared = apply(marked.state, marked.history, {
      k: 'unmark', sectionId: 's1', targets: [{ verseId: 'v-1', unit: 0 }], fields: ['hold'],
    });
    // Absent, not empty: writing `"overrides": []` onto a document that had no
    // such key changes its canonical bytes and therefore its `docHash`.
    expect(cleared.state.doc.overrides).toBeUndefined();
    expect(section1(cleared.state).verses[0]!.tokens)
      .toEqual(section1(start).verses[0]!.tokens);
  });

  it('a suppression is not the same as no opinion', () => {
    const start = newState(sample());
    // Find a letter the rules DID mark, and suppress it.
    const tokens = section1(start).verses[0]!.tokens;
    let unit = -1;
    let seen = 0;
    for (const t of tokens) {
      if (t.t !== 'syl') continue;
      for (const u of t.units) {
        if (u.hold !== undefined && unit === -1) unit = seen;
        seen += 1;
      }
    }
    expect(unit).toBeGreaterThanOrEqual(0);

    const { state } = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit }],
      patch: { hold: null },
      why: 'owner-hand',
    });
    const after = section1(state).verses[0]!.tokens;
    const holds = (ts: typeof after): number =>
      ts.reduce((n, t) => n + (t.t === 'syl' ? t.units.filter((u) => u.hold !== undefined).length : 0), 0);
    expect(holds(after)).toBe(holds(tokens) - 1);
    expect(holdingProblems(after)).toEqual([]);
  });

  it('auto-holdings in keep mode leaves the hand-placed box alone', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark', sectionId: 's1', targets: [{ verseId: 'v-1', unit: 0 }], patch: { hold: 'long' }, why: 'owner-hand',
    });
    const auto = apply(marked.state, marked.history, {
      k: 'auto-holdings', sectionId: 's1', verseIds: ['v-1'], mode: 'keep',
    });
    expect(auto.state.doc.overrides).toHaveLength(1);
    const first = section1(auto.state).verses[0]!.tokens.find((t) => t.t === 'syl');
    expect(first!.t === 'syl' && first.units[0]!.hold).toBe('long');
  });

  it('auto-holdings in replace mode hands the boxes back to the rules', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark', sectionId: 's1', targets: [{ verseId: 'v-1', unit: 0 }], patch: { hold: 'long' }, why: 'owner-hand',
    });
    const auto = apply(marked.state, marked.history, {
      k: 'auto-holdings', sectionId: 's1', verseIds: ['v-1'], mode: 'replace',
    });
    expect(auto.state.doc.overrides).toBeUndefined();
    expect(section1(auto.state).verses[0]!.tokens)
      .toEqual(section1(start).verses[0]!.tokens);
  });

  it('auto-holdings never touches a svara the author placed', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 0 }],
      patch: { svara: 'anudatta', hold: 'long' },
      why: 'owner-hand',
    });
    const auto = apply(marked.state, marked.history, {
      k: 'auto-holdings', sectionId: 's1', verseIds: ['v-1'], mode: 'replace',
    });
    expect(auto.state.doc.overrides).toHaveLength(1);
    expect(auto.state.doc.overrides![0]!.set).toEqual({ svara: 'anudatta' });
  });
});

describe('structure', () => {
  it('a paste of two verses adds two, in place', () => {
    const start = newState(sample());
    const end = flatOf(start).text.length;
    const { state } = apply(start, emptyHistory(), {
      k: 'replace',
      sectionId: 's1',
      from: end,
      to: end,
      insert: '\n\nagniḥ pūrvebhiḥ\n\nṛṣibhir īḍyo nūtanair uta',
      newIds: ['v-4', 'v-5'],
    });
    expect(versesOf(state)).toEqual(['v-1', 'v-2', 'v-3', 'v-4', 'v-5']);
    expect(state.reports.map((r) => r.verseId).sort()).toEqual(['v-4', 'v-5']);
    for (const v of section1(state).verses) {
      expect(v.tokens.length, v.id).toBeGreaterThan(0);
      expect(holdingProblems(v.tokens), v.id).toEqual([]);
    }
  });

  it('deleting a verse reports the recording it orphaned', () => {
    const start = newState(sample());
    const { state } = apply(start, emptyHistory(), {
      k: 'replace',
      sectionId: 's1',
      from: at(start, 'v-1', 0, 0),
      to: at(start, 'v-2', 0, 0),
      insert: '',
    });
    expect(state.orphaned).toEqual(['v-1']);
    expect(versesOf(state)).toEqual(['v-2', 'v-3']);
  });

  it('refuses a command for a section that is not there', () => {
    const start = newState(sample());
    const { state } = apply(start, emptyHistory(), {
      k: 'replace', sectionId: 'nope', from: 0, to: 0, insert: 'x',
    });
    expect(state.refusals[0]).toContain('nope');
  });
});

describe('unexpected input', () => {
  const odd = [
    ['a stray combining mark', 'á'],
    ['a right-to-left mark', 'a‏'],
    ['an emoji', '🙏'],
    ['a lone surrogate half', '\ud83d'],
    ['Devanāgarī pasted into an IAST line', 'अग्निम्'],
    ['a NUL', 'a b'],
    ['a very long run', 'a'.repeat(2000)],
    ['nothing at all', ''],
  ] as const;

  for (const [what, text] of odd) {
    it(`survives ${what}`, () => {
      const start = newState(sample());
      const { state } = type(start, at(start, 'v-1', 0, 0), text);
      // The bar is not that the text is meaningful — it is that the program
      // stays consistent and says what it did.
      for (const v of section1(state).verses) {
        expect(holdingProblems(v.tokens), v.id).toEqual([]);
      }
      expect(state.selection).not.toBeUndefined();
    });
  }
});
