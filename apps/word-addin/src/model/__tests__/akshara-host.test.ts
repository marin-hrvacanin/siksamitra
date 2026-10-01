/**
 * A BOX PRESSED ON ONE AKṢARA OF A SCRIPT LINE — on its consonant, as in IAST.
 * The expectation is the holding rule's own answer (`holdingHostOf`), which
 * is also where the add-in's script reader reads a boxed cluster's box.
 */
import { describe, expect, it } from 'vitest';
import { onTheHost } from '../akshara-host.js';

const SHORT = { k: 'hold', v: 'short' } as const;
const TEXT = 'sam̐ samidyuvase viśvāny';

describe('onTheHost', () => {
  it('one akṣara, `sa`, in Devanāgarī: the box on `s`', () => {
    expect(onTheHost(TEXT, 0, 2, 'deva', SHORT)).toEqual([0, 1]);
  });
  it('the same in Telugu and Tamil', () => {
    expect(onTheHost(TEXT, 0, 2, 'tel', SHORT)).toEqual([0, 1]);
    expect(onTheHost(TEXT, 0, 2, 'tam', SHORT)).toEqual([0, 1]);
  });
  it('a conjunct, `śvā`: on the consonant the holding rule chooses', () => {
    const at = TEXT.indexOf('śvā');
    const [from, to] = onTheHost(TEXT, at, at + 'śvā'.length, 'deva', SHORT);
    expect(['ś', 'v']).toContain(TEXT.slice(from, to));
    expect(to - from).toBe(1);
  });
  it('in IAST, what the person selected — they can select the consonant there', () => {
    expect(onTheHost(TEXT, 0, 2, 'iast', SHORT)).toEqual([0, 2]);
  });
  it('more than one akṣara selected is the person’s span, kept', () => {
    expect(onTheHost(TEXT, 5, 9, 'deva', SHORT)).toEqual([5, 9]);
  });
  it('only a box: an accent or a change is placed where it was pressed', () => {
    expect(onTheHost(TEXT, 0, 2, 'deva', { k: 'svara', v: 'svarita' } as never)).toEqual([0, 2]);
  });
  it('an akṣara with no consonant — a vowel alone — is left as it is', () => {
    expect(onTheHost('agnim', 0, 1, 'deva', SHORT)).toEqual([0, 1]);
  });
});
