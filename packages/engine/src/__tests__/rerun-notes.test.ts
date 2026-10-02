/**
 * A NOTE ON A LINE SURVIVES THE RULES — in the window and in Word, which run
 * the same `rerun`.
 *
 * Running the rules over sūryopaniṣat 4 deleted its `p.b. sūryā̍d (with
 * svarita)`: the note's words were derived as letters and the derivation
 * dropped them, and all the run said was that a hand marking could not be
 * carried. The rules now run around a note, and it goes back after the same
 * letters, in either mode.
 */
import { describe, expect, it } from 'vitest';
import type { Mark, TextAndMarks } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile, type ReRunMode } from '../index.js';

const NOTE = 'p.b. sūryā̍d (with svarita)';
const lineWith = (note: string): TextAndMarks => {
  const head = 'sūrya̍ ā̱tmā jaga̍tas ta̱sthuṣa̍ś ca ।\nsūryā̎d ya̱jñaḥ parjanyo̎’nnamā̱tmā ॥ ';
  const text = `${head}${note}`;
  const mark: Mark = { k: 'plain', from: head.length, to: text.length, v: 'note', stage: 'aids', by: 'hand' };
  return { text, marks: [mark] };
};
const run = (tm: TextAndMarks, mode: ReRunMode, from = 0, to = tm.text.length) => {
  const profile = resolveProfile([{ preset: 'taittiriya' } as never]);
  return rerun(tm, { stages: STAGES, mode, profile, from, to });
};
const noteOf = (tm: TextAndMarks): string[] =>
  tm.marks.filter((m) => m.k === 'plain' && m.v === 'note').map((m) => tm.text.slice(m.from, m.to));

describe('a note at the end of a line, through a re-run of the rules', () => {
  for (const mode of ['keep-hand', 'replace-all'] as const) {
    it(`keeps its words and its marking — ${mode}`, () => {
      const out = run(lineWith(NOTE), mode);
      expect(noteOf(out)).toEqual([NOTE]);
      expect(out.text.endsWith(` ${NOTE}`)).toBe(true);
      expect(out.lost).toEqual([]);
    });
  }

  it('is not marked: no holding, svara or change falls inside it', () => {
    const out = run(lineWith(NOTE), 'replace-all');
    const at = out.text.indexOf(NOTE);
    const inside = out.marks.filter((m) => m.k !== 'plain' && m.from >= at && m.to <= at + NOTE.length && m.k !== 'syl');
    expect(inside).toEqual([]);
  });

  it('the mantra before it is marked as it would be without it', () => {
    const bare = lineWith('');
    const plain = run({ text: bare.text.trimEnd(), marks: [] }, 'replace-all');
    const noted = run(lineWith(NOTE), 'replace-all');
    expect(noted.text.slice(0, plain.text.length)).toBe(plain.text);
  });

  it('a run over the first line alone leaves the second line’s note where it is', () => {
    const tm = lineWith(NOTE);
    const out = run(tm, 'keep-hand', 0, tm.text.indexOf('\n'));
    expect(noteOf(out)).toEqual([NOTE]);
  });

  it('a second run changes nothing', () => {
    const once = run(lineWith(NOTE), 'keep-hand');
    const twice = run(once, 'keep-hand');
    expect(twice.text).toBe(once.text);
    expect(noteOf(twice)).toEqual([NOTE]);
  });
});
