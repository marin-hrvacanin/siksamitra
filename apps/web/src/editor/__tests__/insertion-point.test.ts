/**
 * WHERE A NEW PICTURE LANDS.
 *
 * The owner's report: "the picture doesn't get inserted where my cursor is,
 * but below that shloka." It always went below — the verse's index plus one,
 * whatever the caret was doing inside it.
 *
 * A picture is a section ITEM, so it cannot go inside a verse; the nearest
 * legal places are immediately above that verse and immediately below it, and
 * the answer is whichever the caret is nearer to.
 *
 * THE EXPECTED INDICES ARE COUNTED BY HAND off the item list in each fixture,
 * never read back out of the function.
 */
import { describe, expect, it } from 'vitest';
import { hydrateVerse } from '@siksamitra/engine';
import type { ChantSection } from '@siksamitra/format';
import { insertionPoint } from '../useFigures.js';

const verse = (id: string, text: string) =>
  hydrateVerse({ id, tokens: [], text, marks: [] } as never);

/** One instruction, then two verses: items 0, 1, 2. */
const section = (): ChantSection => {
  const one = verse('v-1', 'agním īḷe puróhitaṁ\nyajñasya devam ṛtvijam');
  const two = verse('v-2', 'hotāraṁ ratnadhātamam');
  return {
    id: 's-1',
    verses: [one, two],
    items: [
      { t: 'instruction', instruction: { text: { en: 'Light the lamp.' } } },
      { t: 'verse', ...one },
      { t: 'verse', ...two },
    ],
  } as unknown as ChantSection;
};

describe('a picture goes to the nearer side of the verse the caret is in', () => {
  it('above it, when the caret is in the first half', () => {
    /* `v-1` is item 1, so above it is index 1. */
    expect(insertionPoint(section(), { verseId: 'v-1', line: 0, column: 0 })).toBe(1);
    expect(insertionPoint(section(), { verseId: 'v-1', line: 0, column: 5 })).toBe(1);
  });

  it('below it, when the caret is in the second half', () => {
    /* Below `v-1` is index 2 — where it always went, and now only sometimes. */
    expect(insertionPoint(section(), { verseId: 'v-1', line: 1, column: 20 })).toBe(2);
  });

  it('and the two halves really are different answers', () => {
    /* The control: without it, both cases above could be the same number and
       the test would pass on the behaviour it exists to change. */
    const top = insertionPoint(section(), { verseId: 'v-1', line: 0, column: 0 });
    const bottom = insertionPoint(section(), { verseId: 'v-1', line: 1, column: 20 });
    expect(top).not.toBe(bottom);
  });

  it('the second verse gets its own two sides', () => {
    expect(insertionPoint(section(), { verseId: 'v-2', line: 0, column: 0 })).toBe(2);
    expect(insertionPoint(section(), { verseId: 'v-2', line: 0, column: 21 })).toBe(3);
  });

  it('a single-line verse still answers by the column', () => {
    const only = verse('v-1', 'agním īḷe');
    const one = {
      id: 's-1', verses: [only], items: [{ t: 'verse', ...only }],
    } as unknown as ChantSection;
    expect(insertionPoint(one, { verseId: 'v-1', line: 0, column: 0 })).toBe(0);
    expect(insertionPoint(one, { verseId: 'v-1', line: 0, column: 9 })).toBe(1);
  });
});

describe('when there is no caret to be near', () => {
  it('with no caret at all it goes at the end', () => {
    expect(insertionPoint(section(), undefined)).toBe(3);
  });

  it('a caret in a verse this section does not have goes at the end', () => {
    expect(insertionPoint(section(), { verseId: 'v-99', line: 0, column: 0 })).toBe(3);
  });

  it('and an empty verse goes below itself rather than dividing by zero', () => {
    const empty = verse('v-1', '');
    const one = {
      id: 's-1', verses: [empty], items: [{ t: 'verse', ...empty }],
    } as unknown as ChantSection;
    const at = insertionPoint(one, { verseId: 'v-1', line: 0, column: 0 });
    expect(Number.isFinite(at)).toBe(true);
    expect(at).toBe(1);
  });

  it('no section is the end of nothing', () => {
    expect(insertionPoint(undefined, { verseId: 'v-1', line: 0, column: 0 })).toBe(0);
  });
});
