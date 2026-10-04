/**
 * A HALF-VERSE THE PAGE WRAPPED IS STILL ONE HALF-VERSE.
 *
 * Smārta places a śloka's svaras by position, a half-verse at a time. His
 * Viṣṇu sahasranāma carries nine numbered names to a half-verse, and a line
 * that wide is divided at a word's end, with no daṇḍa there. Read a line at a
 * time, the second half of verse 4 was two "segments" of eight and the whole
 * verse went unmarked (2026-10-04). The expectations below are what the SAME
 * verse gets on one line — produced by the rules, not written down here.
 */
import { describe, expect, it } from 'vitest';
import type { TextAndMarks } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile } from '../index.js';

const smarta = resolveProfile([{ preset: 'smarta' }]);
const mark = (text: string): TextAndMarks => {
  const out = rerun({ text, marks: [] }, { stages: STAGES, mode: 'keep-hand', profile: smarta, from: 0, to: text.length });
  return { text: out.text, marks: out.marks };
};
const svaras = (tm: TextAndMarks): string[] =>
  tm.marks.filter((m) => m.k === 'svara').map((m) => `${tm.text.slice(0, m.from).replace(/\s+/gu, ' ')}|${String(m.v)}`);

const WHOLE = 'sarvaḥ śarvaḥ śivaḥ sthāṇur bhūtādir nidhir avyayaḥ ।\nsambhavo bhāvano bhartā prabhavaḥ prabhur īśvaraḥ ॥';
const WRAPPED = 'sarvaḥ śarvaḥ śivaḥ sthāṇur bhūtādir nidhir avyayaḥ ।\nsambhavo bhāvano bhartā\nprabhavaḥ prabhur īśvaraḥ ॥';

describe('a śloka whose half-verse runs on to a second line', () => {
  it('is marked, as it is on one line', () => {
    const whole = svaras(mark(WHOLE));
    expect(whole.length).toBeGreaterThan(0);
    expect(svaras(mark(WRAPPED))).toEqual(whole);
  });
  it('and so is one whose FIRST half is wrapped', () => {
    const first = 'sarvaḥ śarvaḥ śivaḥ sthāṇur\nbhūtādir nidhir avyayaḥ ।\nsambhavo bhāvano bhartā prabhavaḥ prabhur īśvaraḥ ॥';
    expect(svaras(mark(first))).toEqual(svaras(mark(WHOLE)));
  });
  it('a line is read on only while it is short — a verse that does not scan stays unmarked', () => {
    expect(svaras(mark('sarvaḥ śarvaḥ śivaḥ\nsthāṇur bhūtādir nidhir avyayaḥ prabhur ।\nsambhavo bhāvano bhartā prabhavaḥ prabhur īśvaraḥ ॥'))).toEqual([]);
  });
});
