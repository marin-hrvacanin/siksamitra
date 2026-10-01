/**
 * PRESSING THE RULES DOES NOT RESPACE HIS LINE.
 *
 * `derive` normalises whitespace, and a re-run used to write that back: his
 * no-break spaces made ordinary, his double spaces single, his pāda indents
 * gone. `carrySpacing` puts them back; these hold it at the one entry point
 * both programs run the rules through.
 */
import { describe, expect, it } from 'vitest';
import { mark, type TextAndMarks } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile } from '../index.js';

const profile = resolveProfile([{ preset: 'taittiriya' }]);
const again = (tm: TextAndMarks) => rerun(tm, { stages: STAGES, mode: 'keep-hand', from: 0, to: tm.text.length, profile });

describe('a re-run keeps', () => {
  it('a no-break space', () => {
    const out = again({ text: 'tat savitur vareṇyam', marks: [] });
    expect(out.text).toContain('tat sa');
  });
  it('the tab that indents a pāda', () => {
    const out = again({ text: 'agnim īḷe\n\tpurohitam', marks: [] });
    expect(out.text).toContain('\n\tpu');
  });
  it('a double space', () => {
    const out = again({ text: 'agnim  īḷe', marks: [] });
    expect(out.text).toContain('  ');
  });
  it('and the markings stay on their letters — the ones after the extra space too', () => {
    const tm: TextAndMarks = { text: 'agnim  īḷe', marks: [mark({ k: 'hold', from: 8, to: 9, v: 'short' })] };
    const out = again(tm);
    const held = out.marks.filter((m) => m.k === 'hold' && m.by === 'hand');
    expect(held.map((m) => out.text.slice(m.from, m.to))).toEqual(['ḷ']);
  });
  it('a second re-run changes nothing — the spacing does not grow', () => {
    const once = again({ text: 'tat savitur  vareṇyam\n\tbhargo', marks: [] });
    const twice = again({ text: once.text, marks: once.marks.map((m) => ({ ...m, by: 'hand' as const })) });
    expect(twice.text).toBe(once.text);
  });
});
