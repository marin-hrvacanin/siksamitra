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
import { toTextAndMarks } from '@siksamitra/format';
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

    /*
     * NOT IN `overrides`. A marking used to be stored as an override — an
     * address into the verse's source plus the value the rules should be
     * overruled with — and it reached the page only when the verse was next
     * derived. It is a range over the verse's text now, so the document's
     * override list stays empty and the token carries the box directly.
     */
    expect(state.doc.overrides ?? []).toEqual([]);
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
    const holdAt = (s: typeof marked.state): number[] =>
      toTextAndMarks(section1(s).verses[0]!).marks
        .filter((m) => m.k === 'hold').map((m) => m.from);
    const before = holdAt(marked.state);
    expect(before.length).toBeGreaterThan(0);

    const moved = apply(marked.state, marked.history, {
      k: 'replace', sectionId: 's1', from: at(marked.state, 'v-1', 0, 0), to: at(marked.state, 'v-1', 0, 0), insert: 'oṁ ',
    });

    expect(moved.state.lostMarks).toEqual([]);
    // Every box three characters further along, and none lost.
    expect(holdAt(moved.state)).toEqual(before.map((n) => n + 3));
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
    /* The letters the marking was on are gone, so the marking is too — and it
       is REPORTED rather than dropped in silence. */
    expect(killed.state.refusals.some((r) => r.includes('marking'))).toBe(true);
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
    /* The holding placed by hand is gone. `unmark` withdraws the marking; it
       does NOT ask the rules what they would have put there, which is what
       `recompute` is for. */
    const held = toTextAndMarks(section1(cleared.state).verses[0]!).marks
      .filter((m) => m.k === 'hold' && m.from === 0);
    expect(held).toEqual([]);
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

  it('recompute in keep-hand mode leaves the hand-placed box alone', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark', sectionId: 's1', targets: [{ verseId: 'v-1', unit: 0 }], patch: { hold: 'long' }, why: 'owner-hand',
    });
    const auto = apply(marked.state, marked.history, {
      k: 'recompute', sectionId: 's1', verseIds: ['v-1'], stages: ['holdings'], mode: 'keep-hand',
    });
    const first = section1(auto.state).verses[0]!.tokens.find((t) => t.t === 'syl');
    expect(first!.t === 'syl' && first.units[0]!.hold).toBe('long');
  });

  it('recompute in replace-all mode hands the boxes back to the rules', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark', sectionId: 's1', targets: [{ verseId: 'v-1', unit: 0 }], patch: { hold: 'long' }, why: 'owner-hand',
    });
    const held = (s: typeof start): (string | undefined)[] =>
      toTextAndMarks(section1(s).verses[0]!).marks
        .filter((m) => m.k === 'hold' && m.from === 0).map((m) => m.v);
    expect(held(marked.state)).toEqual(['long']);

    const auto = apply(marked.state, marked.history, {
      k: 'recompute', sectionId: 's1', verseIds: ['v-1'], stages: ['holdings'], mode: 'replace-all',
    });
    /* The hand box is gone: `replace-all` says the rules decide. Whether they
       put one back on that letter is theirs to say, and it is not `long`. */
    expect(held(auto.state)).not.toEqual(['long']);
  });

  it('recompute in keep-hand mode never touches a svara the author placed', () => {
    const start = newState(sample());
    const marked = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 0 }],
      patch: { svara: 'anudatta', hold: 'long' },
      why: 'owner-hand',
    });
    const auto = apply(marked.state, marked.history, {
      k: 'recompute', sectionId: 's1', verseIds: ['v-1'], stages: ['holdings'], mode: 'replace-all',
    });
    /* The svara was not among the stages asked for, so it stands whatever the
       mode says about the holdings. */
    const svara = toTextAndMarks(section1(auto.state).verses[0]!).marks
      .find((m) => m.k === 'svara' && m.from === 0);
    expect(svara?.v).toBe('anudatta');
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
    /* NO REPORTS: a paste is a text edit and derives nothing. The two new
       verses have their letters and their syllables; what they do NOT have is
       markings nobody asked for. */
    expect(state.reports).toEqual([]);
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
