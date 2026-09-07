/**
 * Text surgery: one range replacement, distributed back into verses.
 *
 * The two properties that matter more than any single case:
 *
 *   - a verse that SURVIVED an edit keeps its id, because a recording, a word
 *     analysis and an audio segment are all keyed to it;
 *   - a verse that did not survive is REPORTED, so nothing is orphaned
 *     silently.
 */
import { describe, expect, it } from 'vitest';
import { VERSE_GAP, flatten, type VerseSource } from '../caret.js';
import { isEmpty, pruneEmpty, replaceRange, splitLine, splitVerse } from '../range.js';

const verses = (): VerseSource[] => [
  { id: 'v-1', lines: ['agnim īḷe', 'purohitaṁ'] },
  { id: 'v-2', lines: ['yajñasya devam'] },
  { id: 'v-3', lines: ['hotāraṁ'] },
];

const at = (vs: VerseSource[], verseId: string, line: number, column: number): number =>
  flatten(vs).lineStarts.find((l) => l.verseId === verseId && l.line === line)!.at + column;

describe('typing', () => {
  it('inserts a letter and leaves every id alone', () => {
    const vs = verses();
    const result = replaceRange(vs, { from: at(vs, 'v-2', 0, 0), to: at(vs, 'v-2', 0, 0), insert: 'x' });
    expect(result.verses.map((v) => v.id)).toEqual(['v-1', 'v-2', 'v-3']);
    expect(result.verses[1]!.lines).toEqual(['xyajñasya devam']);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('normalises what it inserts', () => {
    const vs = verses();
    const result = replaceRange(vs, { from: 0, to: 0, insert: 'OṂ  ' });
    expect(result.verses[0]!.lines[0]).toBe('oṁ agnim īḷe');
  });

  it('puts the caret after what was actually inserted', () => {
    const vs = verses();
    const start = at(vs, 'v-1', 0, 5);
    // A space typed next to a space inserts nothing, so the caret must not move.
    const result = replaceRange(vs, { from: start, to: start, insert: ' ' });
    expect(result.caret).toBe(start);
    expect(result.verses[0]!.lines[0]).toBe('agnim īḷe');
  });
});

describe('deleting', () => {
  it('joins two lines when the newline between them is deleted', () => {
    const vs = verses();
    const end = at(vs, 'v-1', 0, 'agnim īḷe'.length);
    const result = replaceRange(vs, { from: end, to: end + 1, insert: '' });
    expect(result.verses[0]!.lines).toEqual(['agnim īḷepurohitaṁ']);
    expect(result.verses.map((v) => v.id)).toEqual(['v-1', 'v-2', 'v-3']);
  });

  it('joins two verses when the blank line between them is deleted', () => {
    const vs = verses();
    const end = at(vs, 'v-1', 1, 'purohitaṁ'.length);
    const result = replaceRange(vs, { from: end, to: end + 2, insert: '' });
    expect(result.verses).toHaveLength(2);
    expect(result.verses[0]!.lines).toEqual(['agnim īḷe', 'purohitaṁyajñasya devam']);
    // v-2's text was absorbed, so v-2 is gone and says so.
    expect(result.removed).toEqual(['v-2']);
  });

  it('deleting the FIRST verse does not rename the others', () => {
    /*
     * The reason identity is matched by text from both ends rather than by
     * position. Positional matching slides v-2's text under v-1's id, and four
     * recordings quietly point at the wrong verse.
     */
    const vs = verses();
    const result = replaceRange(vs, { from: 0, to: at(vs, 'v-2', 0, 0), insert: '' });
    expect(result.verses.map((v) => v.id)).toEqual(['v-2', 'v-3']);
    expect(result.verses[0]!.lines).toEqual(['yajñasya devam']);
    expect(result.removed).toEqual(['v-1']);
  });

  it('select-all and delete leaves one empty verse, and orphans all three', () => {
    /*
     * Not zero verses: an editor with nowhere to put the caret is a document
     * you cannot start again. But the surviving verse is NEW, and all three old
     * ids are reported gone — the edit consumed every one of them entirely, so
     * three recordings really are orphaned, and keeping one id would attach
     * that recording to whatever gets typed next.
     */
    const vs = verses();
    const result = replaceRange(vs, { from: 0, to: flatten(vs).text.length, insert: '' });
    expect(result.verses).toHaveLength(1);
    expect(result.verses[0]!.lines).toEqual(['']);
    expect(['v-1', 'v-2', 'v-3']).not.toContain(result.verses[0]!.id);
    expect(result.removed).toEqual(['v-1', 'v-2', 'v-3']);
    expect(result.caret).toBe(0);
  });

  it('deleting the middle of three identical verses orphans the MIDDLE one', () => {
    /*
     * The case a text comparison cannot get right, and got wrong: three verses
     * all reading `same`, delete the second. Every survivor looks like every
     * other, so only the edit's range says which id went — and the audio keyed
     * to verse 2 is the one that has to be reported, not verse 3's.
     */
    const same: VerseSource[] = [
      { id: 'v-1', lines: ['same'] },
      { id: 'v-2', lines: ['same'] },
      { id: 'v-3', lines: ['same'] },
    ];
    const start = at(same, 'v-2', 0, 0);
    const result = replaceRange(same, { from: start - 2, to: start + 4, insert: '' });
    expect(result.verses.map((v) => v.id)).toEqual(['v-1', 'v-3']);
    expect(result.removed).toEqual(['v-2']);
  });

  it('replacing a whole section keeps no id, and reports all of them', () => {
    // The over-claim text similarity produced: three new verses inheriting
    // three recordings, with `removed` empty.
    const vs = verses();
    const result = replaceRange(vs, {
      from: 0,
      to: flatten(vs).text.length,
      insert: ['alpha', 'beta', 'gamma'].join(VERSE_GAP),
    });
    expect(result.verses.map((v) => v.lines[0])).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.removed).toEqual(['v-1', 'v-2', 'v-3']);
    expect(result.added).toHaveLength(3);
  });

  it('a selection across three verses collapses them into one', () => {
    const vs = verses();
    const result = replaceRange(vs, {
      from: at(vs, 'v-1', 0, 3),
      to: at(vs, 'v-3', 0, 3),
      insert: '',
    });
    expect(result.verses).toHaveLength(1);
    expect(result.verses[0]!.id).toBe('v-1');
    expect(result.verses[0]!.lines).toEqual(['agnāraṁ']);
  });
});

describe('pasting', () => {
  it('distributes several verses, taking the ids it was given', () => {
    const vs = verses();
    const end = flatten(vs).text.length;
    const result = replaceRange(vs, {
      from: end,
      to: end,
      insert: '\n\nratnadhātamam\n\nagniḥ pūrvebhiḥ',
      newIds: ['v-4', 'v-5'],
    });
    expect(result.verses.map((v) => v.id)).toEqual(['v-1', 'v-2', 'v-3', 'v-4', 'v-5']);
    expect(result.added).toEqual(['v-4', 'v-5']);
  });

  it('invents ids that do not collide when it was given none', () => {
    const vs = verses();
    const end = flatten(vs).text.length;
    const result = replaceRange(vs, { from: end, to: end, insert: '\n\nratnadhātamam' });
    expect(result.added).toHaveLength(1);
    expect(['v-1', 'v-2', 'v-3']).not.toContain(result.added[0]);
  });

  it('refuses to accept an id that is already taken', () => {
    const vs = verses();
    const end = flatten(vs).text.length;
    const result = replaceRange(vs, {
      from: end, to: end, insert: '\n\nratnadhātamam', newIds: ['v-2'],
    });
    expect(result.added[0]).not.toBe('v-2');
    expect(new Set(result.verses.map((v) => v.id)).size).toBe(4);
  });

  it('pasting in the middle inserts the verse in the middle', () => {
    const vs = verses();
    const end = at(vs, 'v-1', 1, 'purohitaṁ'.length);
    const result = replaceRange(vs, {
      from: end, to: end, insert: '\n\nnew line here', newIds: ['v-new'],
    });
    expect(result.verses.map((v) => v.id)).toEqual(['v-1', 'v-new', 'v-2', 'v-3']);
  });

  it('repeated Enter creates the empty verses the author asked for', () => {
    // Not junk to be filtered: pressing Enter at the end of a section is how
    // you make somewhere to type. `pruneEmpty` is the save path's business.
    const vs = verses();
    const end = flatten(vs).text.length;
    const result = replaceRange(vs, { from: end, to: end, insert: '\n\n\n\n' });
    expect(result.verses).toHaveLength(5);
    expect(result.verses.slice(3).every((v) => isEmpty(v))).toBe(true);
    expect(pruneEmpty(result.verses)).toHaveLength(3);
  });
});

describe('splitting', () => {
  it('Enter at the end of a verse starts a new one', () => {
    const vs = verses();
    const result = splitVerse(vs, at(vs, 'v-1', 1, 'purohitaṁ'.length), 'v-1b');
    expect(result.verses.map((v) => v.id)).toEqual(['v-1', 'v-1b', 'v-2', 'v-3']);
    expect(result.verses[1]!.lines).toEqual(['']);
  });

  it('Enter in the middle of a verse divides it', () => {
    const vs = verses();
    const result = splitVerse(vs, at(vs, 'v-1', 0, 5), 'v-1b');
    expect(result.verses[0]!.lines).toEqual(['agnim']);
    expect(result.verses[1]!.lines).toEqual(['īḷe', 'purohitaṁ']);
  });

  it('a line break is a breath, not a new verse', () => {
    const vs = verses();
    const result = splitLine(vs, at(vs, 'v-2', 0, 8));
    expect(result.verses).toHaveLength(3);
    expect(result.verses[1]!.lines).toEqual(['yajñasya', 'devam']);
  });
});

describe('robustness', () => {
  it('a backwards range is the same as the forwards one', () => {
    const vs = verses();
    const a = replaceRange(vs, { from: 12, to: 3, insert: 'x' });
    const b = replaceRange(vs, { from: 3, to: 12, insert: 'x' });
    expect(a).toEqual(b);
  });

  it('an out-of-range span is clamped, not thrown', () => {
    const vs = verses();
    expect(() => replaceRange(vs, { from: -50, to: 99_999, insert: 'oṁ' })).not.toThrow();
  });

  it('an empty section accepts a paste', () => {
    const result = replaceRange([], { from: 0, to: 0, insert: 'oṁ', newIds: ['v-1'] });
    expect(result.verses).toEqual([{ id: 'v-1', lines: ['oṁ'] }]);
  });

  it('carriage returns and tabs do not become letters', () => {
    const vs = verses();
    const result = replaceRange(vs, { from: 0, to: 0, insert: 'oṁ\t\r' });
    expect(result.verses[0]!.lines[0]).toBe('oṁ agnim īḷe');
  });
});
