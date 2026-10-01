/**
 * A CANDRABINDU A PERSON TYPED SURVIVES THE RULES.
 *
 * The rules' own candrabindu is the Taittirīya gum — `ṁ` before a sibilant,
 * with the change that records the `ṁ` it was — and a re-run undoes it back to
 * that `ṁ` before deriving again. A candrabindu with no change behind it was
 * typed (the Candrabindu button, or `sam̐` as written), and the inverter treated
 * it as the rules' too: Auto-mark turned `sam̐` into `sam`, deleting a letter.
 * Found drawing the panel's Candrabindu tile, 2026-10-01.
 */
import { describe, expect, it } from 'vitest';
import { CHANT_PROFILE_KEYS } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile } from '../index.js';

const once = (text: string, preset: string) => {
  const profile = resolveProfile([{ preset } as never]);
  return rerun({ text, marks: [] }, { stages: STAGES, mode: 'keep-hand', profile, previous: profile, from: 0, to: text.length });
};

describe('a typed candrabindu', () => {
  for (const preset of CHANT_PROFILE_KEYS) {
    it(`is kept by Auto-mark, and by a second run, in ${preset}`, () => {
      for (const text of ['sam̐', 'yām̐ tvā', 'a̐']) {
        const first = once(text, preset);
        expect(first.text).toContain('̐');
        const profile = resolveProfile([{ preset } as never]);
        const again = rerun(first, { stages: STAGES, mode: 'keep-hand', profile, previous: profile, from: 0, to: first.text.length });
        expect(again.text).toBe(first.text);
      }
    });
  }

  it('while the gum the rules make still goes back to its ṁ and comes out again', () => {
    expect(once('saṁsthitā', 'taittiriya').text).toBe('sam̐sthitā');
    expect(once(once('saṁsthitā', 'taittiriya').text, 'taittiriya').text).toBe('sam̐sthitā');
  });
});
