/**
 * Changing which register's rules govern a document.
 *
 * The engine has had five registers since the beginning and the editor named
 * none of them, which is what "different rules depending on the source — I
 * don't see anywhere" was. These are the guarantees the command has to keep
 * for that choice to be safe to offer: the marks actually change, a
 * transcribed verse never does, hand-placed marks survive, and one Ctrl+Z
 * puts back both the register and the marks it moved.
 */
import { describe, expect, it } from 'vitest';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES } from '@siksamitra/format';
import { emptyHistory } from '../history.js';
import { apply, newState, undo } from '../session.js';
import { registerOf } from '../set-profile.js';
import { attested, doc, section, verse } from './fixture.js';
import { section1 } from './helpers.js';

/* `saṁhitāyāṁ` before a sibilant is exactly where the registers disagree:
   Taittirīya writes the g-form, the Ṛgveda does not. */
const gummable = () => doc([
  section('s1', [
    verse('v-1', ['tāmagniṁ varṇāṁ tapasā']),
    verse('v-2', ['devīṁ śaraṇamahaṁ prapadye']),
  ]),
]);

const svaras = (state: ReturnType<typeof newState>): string =>
  JSON.stringify(section1(state).verses.map((v) => v.tokens));

describe('the register', () => {
  it('every key the document vocabulary offers has something to say for itself', () => {
    for (const key of CHANT_PROFILE_KEYS) {
      const note = CHANT_PROFILE_NOTES[key];
      expect(note.name.length, key).toBeGreaterThan(0);
      expect(note.where.length, key).toBeGreaterThan(0);
      expect(note.what.length, key).toBeGreaterThan(0);
      /* Said plainly: nothing in here should need the program explained first. */
      for (const jargon of ['profile', 'preset', 'override', 'derive']) {
        expect(note.what.toLowerCase(), `${key}: ${note.what}`).not.toContain(jargon);
      }
    }
  });

  it('is read from the section first, then the document, then nothing', () => {
    expect(registerOf({ profile: undefined })).toBeNull();
    expect(registerOf({ profile: { preset: 'rigveda' } })).toBe('rigveda');
    expect(registerOf(
      { profile: { preset: 'rigveda' } },
      { profile: { preset: 'prose' } },
    )).toBe('prose');
  });

  it('changes the marks on the page, not just the label', () => {
    const start = newState(gummable());
    const was = svaras(start);
    const { state } = apply(start, emptyHistory(), {
      k: 'profile', scope: 'document', preset: 'prose',
    });
    expect(state.doc.profile?.preset).toBe('prose');
    expect(svaras(state)).not.toBe(was);
    expect(state.reports).toHaveLength(2);
  });

  it('never re-derives a verse copied from a marked source', () => {
    const start = newState(doc([section('s1', [
      verse('v-1', ['tāmagniṁ varṇāṁ']),
      attested('v-2', ['devīṁ śaraṇamaham']),
    ])]));
    const frozen = JSON.stringify(section1(start).verses[1]!.tokens);
    const { state } = apply(start, emptyHistory(), {
      k: 'profile', scope: 'document', preset: 'prose',
    });
    expect(JSON.stringify(section1(state).verses[1]!.tokens)).toBe(frozen);
    expect(state.reports.map((r) => r.verseId)).toEqual(['v-1']);
  });

  it('keeps a hand-placed mark across the change', () => {
    let { state, history } = apply(newState(gummable()), emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 1 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    expect(state.doc.overrides).toHaveLength(1);
    const hand = JSON.stringify(state.doc.overrides);

    ({ state } = apply(state, history, { k: 'profile', scope: 'document', preset: 'prose' }));
    /* The override addresses a letter in the SOURCE, and the source did not
       change — so it is still there, and still applied. */
    expect(JSON.stringify(state.doc.overrides)).toBe(hand);
  });

  it('one Ctrl+Z puts back the register and the marks together', () => {
    const start = newState(gummable());
    const before = JSON.stringify(start.doc);
    const { state, history } = apply(start, emptyHistory(), {
      k: 'profile', scope: 'document', preset: 'prose',
    });
    const back = undo(state, history);
    expect(back.state.doc.profile).toBeUndefined();
    expect(JSON.stringify(back.state.doc)).toBe(before);
  });

  it('a section can disagree with its document', () => {
    const start = newState(doc([
      section('s1', [verse('v-1', ['tāmagniṁ varṇāṁ'])]),
      section('s2', [verse('v-2', ['devīṁ śaraṇamaham'])]),
    ]));
    const { state } = apply(start, emptyHistory(), {
      k: 'profile', scope: 'section', sectionId: 's2', preset: 'prose',
    });
    expect(state.doc.profile).toBeUndefined();
    expect(state.doc.sections[0]!.profile).toBeUndefined();
    expect(state.doc.sections[1]!.profile?.preset).toBe('prose');
    /* Only the section it named was re-derived. */
    expect(state.reports.map((r) => r.verseId)).toEqual(['v-2']);
  });

  it('refuses a section it cannot find rather than changing the document', () => {
    const start = newState(gummable());
    const { state } = apply(start, emptyHistory(), {
      k: 'profile', scope: 'section', sectionId: 'nope', preset: 'prose',
    });
    expect(state.refusals).toHaveLength(1);
    expect(state.doc).toEqual(start.doc);
  });

  it('naming no register at all is a legal choice, and leaves no key behind', () => {
    const { state, history } = apply(newState(gummable()), emptyHistory(), {
      k: 'profile', scope: 'document', preset: 'rigveda',
    });
    const { state: cleared } = apply(state, history, {
      k: 'profile', scope: 'document', preset: null,
    });
    /* Absent and present-but-undefined are different bytes — see `restore`. */
    expect('profile' in cleared.doc).toBe(false);
  });

  it('says what it did, in a sentence, including what it left alone', () => {
    const start = newState(doc([section('s1', [
      verse('v-1', ['tāmagniṁ varṇāṁ']),
      attested('v-2', ['devīṁ śaraṇamaham']),
    ])]));
    const { state } = apply(start, emptyHistory(), {
      k: 'profile', scope: 'document', preset: 'prose',
    });
    expect(state.refusals).toEqual([]);
    void state;
  });
});
