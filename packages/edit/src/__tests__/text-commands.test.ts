/**
 * THE ANUSVĀRA AND VISARGA CHANGES, pressed over any selection.
 *
 * The same `applyCommand` the Word add-in's pane, ribbon and context menu call,
 * and the desktop app's buttons.
 */
import { describe, expect, it } from 'vitest';
import type { TextAndMarks } from '@siksamitra/format';
import { ANU, VIS } from '@siksamitra/engine';
import { applyCommand, selectionState } from '../index.js';

const tm = (text: string): TextAndMarks => ({ text, marks: [] });
const TEXT = 'taṅ kavim';

describe('an anusvāra change over the replaced nasal', () => {
  const done = applyCommand(tm(TEXT), 2, 3, { k: 'was', v: ANU });
  it('is a "was" marking recording what was typed', () => {
    expect(done.marks).toEqual([expect.objectContaining({ k: 'was', from: 2, to: 3, v: ANU, by: 'hand' })]);
  });
  it('says so, with no warning', () => expect(done.note).toBe('anusvāra change placed over 1 character(s)'));
  it('lights its own button and not the visarga one', () => {
    const st = selectionState({ text: TEXT, marks: done.marks }, 2, 3);
    expect(st['change-anusvara']).toBe('all');
    expect(st['change-visarga']).toBe('none');
  });
  it('pressed again, comes off — bold\'s rule', () => {
    expect(applyCommand({ text: TEXT, marks: done.marks }, 2, 3, { k: 'was', v: ANU }).marks).toEqual([]);
  });
  it('the visarga change pressed over it replaces it', () => {
    const v = applyCommand({ text: TEXT, marks: done.marks }, 2, 3, { k: 'was', v: VIS });
    expect(v.marks.filter((m) => m.k === 'was').map((m) => m.v)).toEqual([VIS]);
  });
});

describe('any text may be marked, but a likely slip is said', () => {
  it('a visarga change over an ś: no warning', () => {
    expect(applyCommand(tm('namaś śivāya'), 4, 5, { k: 'was', v: VIS }).note).not.toContain('not a letter');
  });
  it('an accent on the letter does not count against it', () => {
    expect(applyCommand(tm('ṅ̍'), 0, 2, { k: 'was', v: ANU }).note).not.toContain('not a letter');
  });
  it('a whole word selected: placed, and warned', () => {
    const d = applyCommand(tm(TEXT), 0, 3, { k: 'was', v: ANU });
    expect(d.marks).toHaveLength(1);
    expect(d.note).toContain('"taṅ" is not a letter a ṁ becomes');
  });
  it('a nasal marked as a visarga change: warned', () => {
    expect(applyCommand(tm(TEXT), 2, 3, { k: 'was', v: VIS }).note).toContain('not a letter');
  });
  it('nothing selected: nothing happens', () => {
    expect(applyCommand(tm(TEXT), 2, 2, { k: 'was', v: ANU }).marks).toEqual([]);
  });
});
