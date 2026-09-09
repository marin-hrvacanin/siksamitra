/**
 * WHAT THE BUTTONS DO, READ OFF THE RUNS WORD WOULD RECEIVE.
 *
 * NOT TAUTOLOGICAL: nothing here asserts on the mark list `applyCommand`
 * returns. Every assertion is made on the STYLED RUNS that list encodes to —
 * produced by `documentXml`, which is the desktop app's Word exporter and knows
 * nothing about this add-in. A command that produced a plausible mark list and
 * an unmarkable paragraph would fail.
 *
 * The last case is a limit of Word rather than of the command, and it is here
 * because it is the one thing a person will notice.
 */
import { describe, expect, it } from 'vitest';
import type { Mark, TextAndMarks } from '@siksamitra/format';
import { mark } from '@siksamitra/format';
import { applyCommand, selectionState } from '../command.js';
import { paragraphRuns } from '../paragraph.js';

const TEXT = 'agne tvam';

/** The paragraph as `style:"letters"`, which is what Word is handed. */
function shape(marks: Mark[], text = TEXT): string {
  const [runs] = paragraphRuns({ text, marks });
  return (runs ?? []).map((r) => `${r.rStyle ?? '-'}:${r.text}`).join(' ');
}

const start: TextAndMarks = { text: TEXT, marks: [] };
const after = (tm: TextAndMarks, from: number, to: number, v: 'short' | 'long'): TextAndMarks =>
  ({ text: tm.text, marks: applyCommand(tm, from, to, { k: 'hold', v }).marks });

describe('Short and Long', () => {
  it('box one letter in the weight asked for', () => {
    expect(shape(after(start, 0, 1, 'short').marks)).toBe('Holding:a -:gne tvam');
    expect(shape(after(start, 0, 1, 'long').marks)).toBe('2Holding:a -:gne tvam');
  });

  it('box a whole selection as ONE run, which Word draws as one box', () => {
    expect(shape(after(start, 0, 4, 'short').marks)).toBe('Holding:agne -: tvam');
  });

  it('remove the box when pressed again on the same range', () => {
    const on = after(start, 0, 4, 'short');
    expect(shape(after(on, 0, 4, 'short').marks)).toBe(`-:${TEXT}`);
  });

  it('turn a mixed selection fully on rather than toggling each part', () => {
    const half = after(start, 0, 2, 'short');
    expect(selectionState(half, 0, 4)['hold-short']).toBe('some');
    expect(shape(after(half, 0, 4, 'short').marks)).toBe('Holding:agne -: tvam');
  });

  it('remove only the subset when pressed on part of a box', () => {
    const whole = after(start, 0, 4, 'short');
    expect(selectionState(whole, 1, 2)['hold-short']).toBe('all');
    expect(shape(after(whole, 1, 2, 'short').marks)).toBe('Holding:a -:g Holding:ne -: tvam');
  });

  it('replace a short box with a long one rather than stacking them', () => {
    const short = after(start, 0, 4, 'short');
    expect(shape(after(short, 0, 4, 'long').marks)).toBe('2Holding:agne -: tvam');
  });
});

describe('a removal that undoes the rules', () => {
  /*
   * Deleting a box the rules placed has to leave a record, or the next
   * keep-hand re-run puts it straight back. The record is a `hold: none`
   * placed by hand — and Word has no style for the absence of a box, so it
   * must not reach the runs. A thin `Holding` drawn where somebody said "no
   * holding" is the worst of both.
   */
  const ruled: TextAndMarks = {
    text: TEXT,
    marks: [mark({ k: 'hold', from: 0, to: 4, v: 'short', by: 'rule' })],
  };
  const off = applyCommand(ruled, 0, 4, { k: 'hold', v: 'short' });

  it('records the suppression', () => {
    expect(off.marks).toEqual([
      expect.objectContaining({ k: 'hold', from: 0, to: 4, v: 'none', by: 'hand' }),
    ]);
  });

  it('draws nothing for it', () => {
    expect(shape(off.marks)).toBe(`-:${TEXT}`);
  });
});

describe('the other markings', () => {
  it('write a svara as its combining character, in the Svara style', () => {
    const { marks } = applyCommand(start, 0, 1, { k: 'svara', v: 'anudatta' });
    expect(shape(marks)).toBe('-:a Svara:̱ -:gne tvam');
  });

  it('write a pause as a pipe, and a second press takes it away', () => {
    const on = applyCommand(start, 5, 5, { k: 'pause', v: 'long' });
    expect(shape(on.marks)).toBe('-:agne  Pause:|| -:tvam');
    const off = applyCommand({ text: TEXT, marks: on.marks }, 5, 5, { k: 'pause', v: 'long' });
    expect(shape(off.marks)).toBe(`-:${TEXT}`);
  });

  it('write a svarabhakti dot before its letter, in the Svara style', () => {
    const { marks } = applyCommand(start, 1, 1, { k: 'sbhakti' });
    expect(shape(marks)).toBe('-:a Svara:· -:gne tvam');
  });

  it('withdraw everything in the range on clear', () => {
    const held = after(start, 0, 4, 'short');
    const both = applyCommand(held, 0, 1, { k: 'svara', v: 'svarita' });
    const cleared = applyCommand({ text: TEXT, marks: both.marks }, 0, 4, { k: 'clear' });
    expect(shape(cleared.marks)).toBe(`-:${TEXT}`);
  });
});

describe('a box that crosses a space', () => {
  /*
   * ONE RECTANGLE, NOT TWO. ECMA-376 §17.3.2.4 merges ADJACENT runs whose
   * border attributes agree, and `documentXml` used to write a space as an
   * unstyled run — which broke the pair, so a box spanning two words drew as
   * two boxes with a gap between them. The space now takes the group's own
   * style when the letters on both sides of it are in the SAME NUMBERED group,
   * and only then: comparing the holding kind alone matched two adjacent boxes
   * that had no group id at all.
   *
   * No holding in the corpus crosses a space today — 4 400 of the 4 788 cover
   * one letter, 387 cover two, one covers three — but the model allows it and
   * the design promises it, so it is drawn correctly rather than left as a
   * limit nobody has hit yet.
   */
  it('draws as one run, with the space inside the box', () => {
    expect(shape(after(start, 3, 6, 'long').marks)).toBe('-:agn 2Holding:e t -:vam');
  });
});
