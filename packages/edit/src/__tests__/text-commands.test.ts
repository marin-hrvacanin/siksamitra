/**
 * THE ANUSVĀRA AND VISARGA CHANGES, pressed over any selection.
 *
 * The same `applyCommand` the Word add-in's pane, ribbon and context menu call,
 * and the desktop app's buttons.
 */
import { describe, expect, it } from 'vitest';
import type { TextAndMarks } from '@siksamitra/format';
import { ANU, VIS } from '@siksamitra/engine';
import { applyAcross, applyCommand, selectionAcross, selectionState, typeAt } from '../index.js';

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

describe('a press over several lines is decided once, for the whole selection', () => {
  const boxed = applyCommand(tm('agnim'), 0, 5, { k: 'hold', v: 'short' }).marks;
  const lines = () => [
    { tm: { text: 'agnim', marks: boxed }, from: 0, to: 5 },
    { tm: tm('īḷe'), from: 0, to: 3 },
    { tm: tm('purohitam'), from: 0, to: 4 },
  ];
  const holds = (r: { marks: readonly { k: string }[] }) => r.marks.filter((m) => m.k === 'hold').length;
  it('one line already on: it goes ON everywhere, and that line is left as it was', () => {
    const out = applyAcross(lines(), { k: 'hold', v: 'short' });
    expect(out.map(holds)).toEqual([1, 1, 1]);
    expect(out[0]!.marks).toEqual(boxed);
  });
  it('every line on: it comes OFF everywhere', () => {
    const on = applyAcross(lines(), { k: 'hold', v: 'short' });
    const again = lines().map((l, i) => ({ ...l, tm: { text: l.tm.text, marks: on[i]!.marks } }));
    expect(applyAcross(again, { k: 'hold', v: 'short' }).map(holds)).toEqual([0, 0, 0]);
  });
  it('the buttons say "some" for the mixed selection, "all" after the press', () => {
    expect(selectionAcross(lines())['hold-short']).toBe('some');
    const on = applyAcross(lines(), { k: 'hold', v: 'short' });
    expect(selectionAcross(lines().map((l, i) => ({ ...l, tm: { text: l.tm.text, marks: on[i]!.marks } })))['hold-short'])
      .toBe('all');
  });
  it('a pause goes where the selection starts, and only there', () => {
    const out = applyAcross(lines(), { k: 'pause', v: 'short' });
    expect(out.map((r) => r.marks.filter((m) => m.k === 'pause').length)).toEqual([1, 0, 0]);
  });
  it('a line with nothing of it selected is untouched', () => {
    const out = applyAcross([...lines(), { tm: tm('x'), from: 0, to: 0 }], { k: 'svara', v: 'svarita' });
    expect(out[3]!.marks).toEqual([]);
  });
  it('one line: the same as a single press — the control', () => {
    const [l] = lines();
    expect(applyAcross([l!], { k: 'hold', v: 'short' })[0]).toEqual(applyCommand(l!.tm, 0, 5, { k: 'hold', v: 'short' }));
  });
});

describe('typing from the palette is never sticky', () => {
  const boxed = { text: 'agne', marks: applyCommand(tm('agne'), 1, 2, { k: 'hold', v: 'short' }).marks };
  it('a letter typed right after a box is outside it', () => {
    const t = typeAt(boxed, 2, 2, 'ṅ');
    expect(t.text).toBe('agṅne');
    expect(t.marks.filter((m) => m.k === 'hold')).toEqual([expect.objectContaining({ from: 1, to: 2 })]);
    expect(t.caret).toBe(3);
  });
  it('a letter typed inside a box is inside it — bold\'s rule', () => {
    const t = typeAt({ text: 'agne', marks: applyCommand(tm('agne'), 1, 3, { k: 'hold', v: 'short' }).marks }, 2, 2, 'x');
    expect(t.marks.filter((m) => m.k === 'hold')).toEqual([expect.objectContaining({ from: 1, to: 4 })]);
  });
  it('an accent is a svara on the letter before the caret, not a character', () => {
    const t = typeAt(tm('agne'), 4, 4, '̍');
    expect(t.text).toBe('agne');
    expect(t.marks).toEqual([expect.objectContaining({ k: 'svara', v: 'svarita', from: 3, to: 4 })]);
    expect(t.caret).toBe(4);
  });
  it('and the letter typed after the accent carries none', () => {
    const accented = typeAt(tm('agne'), 4, 4, '̍');
    const next = typeAt(accented, 4, 4, 'ḥ');
    expect(next.text).toBe('agneḥ');
    expect(next.marks.filter((m) => m.k === 'svara')).toEqual([expect.objectContaining({ from: 3, to: 4 })]);
  });
  it('an accent after a letter that already rides a mark lands on that letter', () => {
    const t = typeAt(tm('ma̅'), 3, 3, '̱');
    expect(t.marks).toEqual([expect.objectContaining({ k: 'svara', v: 'anudatta', from: 1, to: 3 })]);
  });
  it('the candrabindu goes into the text on the letter before', () => {
    const t = typeAt(tm('sam'), 3, 3, '̐');
    expect(t.text).toBe('sam̐');
    expect(t.caret).toBe(4);
  });
  it('an accent at the start of a line has nowhere to go, and says so', () => {
    const t = typeAt(tm('agne'), 0, 0, '̍');
    expect(t.marks).toEqual([]);
    expect(t.note).toContain('no letter before the caret');
  });
  it('an accent after a space has nowhere to go either', () => {
    expect(typeAt(tm('a b'), 2, 2, '̍').marks).toEqual([]);
  });
  it('the overline is text, riding on its vowel — a box ending there takes it in', () => {
    const t = typeAt(boxed, 2, 2, '̅');
    expect(t.text).toBe('ag̅ne');
    expect(t.marks.filter((m) => m.k === 'hold')).toEqual([expect.objectContaining({ from: 1, to: 3 })]);
  });
  it('typing over a selection replaces it', () => {
    const t = typeAt(tm('agne'), 1, 3, 'ṅ');
    expect(t.text).toBe('aṅe');
    expect(t.caret).toBe(2);
  });
});

describe('typing into a line written in an abugida', () => {
  const abugida = { abugida: true } as const;
  it('a vowel after a consonant takes the place of its a — क then ā is का', () => {
    const t = typeAt(tm('ka'), 2, 2, 'ā', abugida);
    expect(t.text).toBe('kā');
    expect(t.caret).toBe(2);
  });
  it('so does a vocalic ṛ, and after an aspirate', () => {
    expect(typeAt(tm('kha'), 3, 3, 'ṛ', abugida).text).toBe('khṛ');
  });
  it('an a typed there is an a of its own — कअ', () => {
    expect(typeAt(tm('ka'), 2, 2, 'a', abugida).text).toBe('kaa');
  });
  it('a consonant goes after the a, as it is written', () => {
    expect(typeAt(tm('ka'), 2, 2, 'ś', abugida).text).toBe('kaś');
  });
  it('a vowel after a vowel, or at a word’s start, stands alone', () => {
    expect(typeAt(tm('kai'), 3, 3, 'ā', abugida).text).toBe('kaiā');
    expect(typeAt(tm('ka '), 3, 3, 'ā', abugida).text).toBe('ka ā');
  });
  it('and in IAST nothing of the kind happens', () => {
    expect(typeAt(tm('ka'), 2, 2, 'ā').text).toBe('kaā');
  });
  it('a mark on the replaced a stays on the vowel that took its place', () => {
    const accented = { text: 'ka', marks: applyCommand(tm('ka'), 1, 2, { k: 'svara', v: 'svarita' }).marks };
    const t = typeAt(accented, 2, 2, 'ā', abugida);
    expect(t.text).toBe('kā');
    expect(t.marks.filter((m) => m.k === 'svara')).toEqual([expect.objectContaining({ from: 1, to: 2 })]);
  });
});
