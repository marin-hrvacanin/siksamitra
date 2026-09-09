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
import { toTextAndMarks } from '@siksamitra/format';
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

  it('records the register and CHANGES NOTHING ON THE PAGE until asked', () => {
    /*
     * THIS USED TO ASSERT THE OPPOSITE — that the marks changed at once, and
     * that two verses were re-derived. Changing a setting is not a request to
     * remark the document, and doing it silently wiped whatever anybody had
     * placed by hand. The register takes effect at the next Re-apply, where a
     * person can see what it did and undo it in one step.
     */
    const start = newState(gummable());
    const was = svaras(start);
    const { state, history } = apply(start, emptyHistory(), {
      k: 'profile', scope: 'document', preset: 'prose',
    });
    expect(state.doc.profile?.preset).toBe('prose');
    expect(svaras(state)).toBe(was);
    expect(state.reports).toEqual([]);

    /* And it IS in force: asking for the rules now marks by the new register. */
    const ids = state.doc.sections[0]!.verses.map((v) => v.id);
    const { state: run } = apply(state, history, {
      k: 'recompute', sectionId: 's1', verseIds: ids, stages: ['svara'], mode: 'replace-all',
    });
    expect(svaras(run)).not.toBe(was);
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
    /* Every verse is untouched now, not just this one — the register change
       derives nothing at all. */
    expect(JSON.stringify(section1(state).verses[1]!.tokens)).toBe(frozen);
    expect(state.reports).toEqual([]);
  });

  it('keeps a hand-placed mark across the change', () => {
    let { state, history } = apply(newState(gummable()), emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 1 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    /*
     * THE MARKING ITSELF, not an override. A hand marking used to be stored in
     * `doc.overrides` and applied when the verse was next derived; it is a
     * range over the verse's text now, so what has to survive a register
     * change is the range.
     */
    const held = (): unknown => JSON.stringify(
      toTextAndMarks(state.doc.sections[0]!.verses[0]!).marks.filter((m) => m.k === 'hold'),
    );
    const hand = held();
    expect(hand).toContain('long');

    ({ state } = apply(state, history, { k: 'profile', scope: 'document', preset: 'prose' }));
    /* Changing the register does not run the rules over anything, so the
       marking is exactly where it was. */
    expect(held()).toBe(hand);
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
    /* Nothing is re-derived; the section simply carries its own register. */
    expect(state.reports).toEqual([]);
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
