/**
 * WHICH MARKS THE RULES MADE, TOLD AGAIN — every mark out of Word is a
 * person's until the rules the line is marked in claim it back.
 */
import { describe, expect, it } from 'vitest';
import { STAGES, rerun, resolveProfile } from '@siksamitra/engine';
import type { Mark, TextAndMarks } from '@siksamitra/format';
import { asMarkedBy } from '../provenance.js';

const TAI = resolveProfile([{ preset: 'taittiriya' }]);
const SMA = resolveProfile([{ preset: 'smarta' }]);
const TEXT = 'saṁ samidyuvase vṛṣann agne viśvāny arya ā';
const marked = rerun({ text: TEXT, marks: [] }, { stages: STAGES, mode: 'keep-hand', from: 0, to: TEXT.length, profile: TAI });
/** As Word gives it back: every mark a person's. */
const fromWord = (tm: TextAndMarks): TextAndMarks => ({ text: tm.text, marks: tm.marks.map((m) => ({ ...m, by: 'hand' as const })) });
const by = (tm: TextAndMarks) => tm.marks.filter((m) => m.k !== 'syl').map((m) => `${m.k}${m.from}:${m.by}`);

describe('asMarkedBy', () => {
  it('every mark the rules make of the line is theirs again', () => {
    const got = asMarkedBy(fromWord(marked), TAI);
    expect(by(got).every((x) => x.endsWith(':rule'))).toBe(true);
    expect(by(got).length).toBeGreaterThan(5);
  });
  it('a person’s box, where the rules put none, stays a person’s', () => {
    const tm = fromWord(marked);
    const got = asMarkedBy({ ...tm, marks: [...tm.marks, { ...tm.marks.find((m) => m.k === 'hold')!, from: 0, to: 1, v: 'short', by: 'hand' } as Mark] }, TAI);
    expect(by(got)).toContain('hold0:hand');
  });
  it('asked of OTHER rules, what those rules would not make stays a person’s', () => {
    const got = asMarkedBy(fromWord(marked), SMA);
    expect(by(got).filter((x) => x.startsWith('sup')).every((x) => x.endsWith(':hand'))).toBe(true);
  });
  it('a line whose letters are not the rules’ — offsets no longer theirs — has nothing reclaimed', () => {
    /* The typed `saṁ`, which the rules write `sam̐`, under marks placed for the rules' letters. */
    const edited = { text: TEXT, marks: fromWord(marked).marks.filter((m) => m.to <= TEXT.length) };
    expect(asMarkedBy(edited, TAI)).toBe(edited);
  });
  it('and a line with no marks is itself', () => {
    const plain = { text: TEXT, marks: [] };
    expect(asMarkedBy(plain, TAI).marks).toEqual([]);
  });
});
