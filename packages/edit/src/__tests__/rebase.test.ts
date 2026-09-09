/**
 * Keeping hand-placed marks attached — and, more importantly, refusing to
 * pretend when they cannot be.
 *
 * The failure this file exists to prevent is not an exception. It is a box
 * drawn one letter to the left of where the author put it, in a document
 * nobody will proof again.
 *
 * The rebase works in FLAT coordinates over a whole section, so these tests
 * are written that way too: a section's verses, one range replacement, and the
 * question of where each mark ended up.
 */
import { describe, expect, it } from 'vitest';
import type { ChantOverride } from '@siksamitra/format';
import { flatten, type VerseSource } from '../caret.js';
import { canonicalInsert, editLine, rebaseFlat } from '../rebase.js';
import { replaceRange } from '../range.js';

const mark = (
  verse: string,
  line: number,
  letter: number,
  ch?: string,
): ChantOverride => ({
  at: { verse, line, letter },
  set: { hold: 'short' },
  why: 'owner-hand',
  ...(ch === undefined ? {} : { ch }),
});

/** Apply an edit the way the session does, and rebase across it. */
function move(
  verses: VerseSource[],
  overrides: ChantOverride[],
  edit: { from: number; to: number; insert: string },
) {
  const before = flatten(verses);
  const result = replaceRange(verses, edit);
  const after = flatten(result.verses);
  return {
    ...rebaseFlat(overrides, before, after, { from: edit.from, to: edit.to }),
    verses: result.verses,
    /** The two characters at an override's address, for checking placement. */
    place: (ov: ChantOverride): string => {
      const verse = result.verses.find((v) => v.id === ov.at.verse);
      return (verse?.lines[ov.at.line] ?? '').slice(ov.at.letter, ov.at.letter + 2);
    },
  };
}

describe('canonicalInsert', () => {
  it('folds what it inserts, so the line stays canonical', () => {
    expect(canonicalInsert('agnim', 5, 5, 'ĪḶE')).toBe('īḷe');
    expect(canonicalInsert('agnim', 5, 5, 'ṃ')).toBe('ṁ');
  });

  it('inserts a second space in the middle, because two spaces are two', () => {
    /*
     * IT USED TO REFUSE. `normLoose` collapsed every run of whitespace, so a
     * space typed beside a space was swallowed — and worse, it rewrote text
     * nobody had touched: a verse reading `oṁ  prātara`, which is a space, a
     * pause and a space, came back a character shorter on every keystroke
     * anywhere in the section, moving every marking after it.
     */
    expect(canonicalInsert('agnim īḷe', 5, 5, ' ')).toBe(' ');
    /* At the END it still inserts nothing, because a stored line is trimmed —
       that is `norm`, and it is the next test. */
    expect(canonicalInsert('agnim ', 6, 6, ' ')).toBe('');
  });

  it('refuses a space at either end, which a trim would remove anyway', () => {
    expect(canonicalInsert('agnim', 0, 0, ' ')).toBe('');
    expect(canonicalInsert('agnim', 5, 5, ' ')).toBe('');
  });

  it('keeps an ordinary interior space', () => {
    expect(canonicalInsert('agnimīḷe', 5, 5, ' ')).toBe(' ');
  });
});

describe('editLine', () => {
  it('reports where the caret lands, which is where the text landed', () => {
    /* A space beside a space is a second space now, so the caret moves over
       it. What this is really checking is that the two agree. */
    const result = editLine('agnim īḷe', 5, 5, ' ');
    expect(result.line).toBe('agnim  īḷe');
    expect(result.insert).toBe(' ');
    expect(result.caret).toBe(6);

    /* And where something IS still removed — a space at the end, which a
       stored line is trimmed of — the caret does not move past it. */
    const end = editLine('agnim', 5, 5, ' ');
    expect(end.insert).toBe('');
    expect(end.caret).toBe(5);
  });

  it('produces a canonical line for any input', () => {
    /* Case, the ṃ/ṁ spelling and the ends are still folded; the run of
       spaces between the words is not, because it is text. */
    expect(editLine('agnim', 5, 5, '  PUROHITAṃ  ').line).toBe('agnim  purohitaṁ');
  });

  it('clamps a backwards or out-of-range span', () => {
    expect(editLine('agnim', 99, -4, 'x').line).toBe('x');
  });
});

describe('rebasing across one edit', () => {
  const four = (): VerseSource[] => [
    { id: 'v-1', lines: ['agnim', 'bharga', 'coda', 'deva'] },
  ];
  const marks = (): ChantOverride[] => [
    mark('v-1', 0, 0, 'a'),
    mark('v-1', 1, 0, 'bh'),
    mark('v-1', 2, 0, 'c'),
    mark('v-1', 3, 0, 'd'),
  ];

  /*
   * THE REGRESSION TEST FOR THE WORST DEFECT THIS CODE HAS HAD.
   *
   * Pasting one line above four marked lines used to move every mark onto the
   * LAST line: the per-line rebase walked upwards and re-shifted the marks it
   * had just shifted, so four owner-hand boxes became one, four overrides
   * landed on the same address, and nothing was reported. `ch` did not catch
   * it, because that check only ran on lines whose text had changed.
   */
  it('a line pasted above four marked lines moves each mark down exactly one', () => {
    const result = move(four(), marks(), { from: 0, to: 0, insert: 'raṁ\n' });
    expect(result.dropped).toEqual([]);
    expect(result.overrides.map((o) => `${o.at.line}:${o.at.letter}`))
      .toEqual(['1:0', '2:0', '3:0', '4:0']);
    // And each one is still on the letter it was placed on.
    expect(result.overrides.map(result.place)).toEqual(['ag', 'bh', 'co', 'de']);
    expect(new Set(result.overrides.map((o) => JSON.stringify(o.at))).size).toBe(4);
  });

  it('a line pasted below them moves nothing', () => {
    const flat = flatten(four());
    const result = move(four(), marks(), {
      from: flat.text.length, to: flat.text.length, insert: '\nraṁ',
    });
    expect(result.dropped).toEqual([]);
    expect(result.overrides.map((o) => `${o.at.line}:${o.at.letter}`))
      .toEqual(['0:0', '1:0', '2:0', '3:0']);
  });

  it('a mark shifts within its line when text is inserted before it', () => {
    const verses: VerseSource[] = [{ id: 'v-1', lines: ['agnim īḷe'] }];
    const result = move(verses, [mark('v-1', 0, 6, 'ī')], { from: 0, to: 0, insert: 'oṁ ' });
    expect(result.dropped).toEqual([]);
    expect(result.overrides[0]!.at.letter).toBe(9);
    expect(result.place(result.overrides[0]!)).toBe('īḷ');
  });

  it('drops a mark whose letter was deleted, and says which', () => {
    const verses: VerseSource[] = [{ id: 'v-1', lines: ['agnim īḷe'] }];
    const result = move(verses, [mark('v-1', 0, 6, 'ī')], { from: 6, to: 7, insert: '' });
    expect(result.overrides).toEqual([]);
    expect(result.dropped[0]!.why).toContain('was replaced');
  });

  it('follows a mark across a verse boundary when two verses join', () => {
    const verses: VerseSource[] = [
      { id: 'v-1', lines: ['agnim'] },
      { id: 'v-2', lines: ['bharga'] },
    ];
    const flat = flatten(verses);
    const result = move(verses, [mark('v-2', 0, 0, 'bh')], {
      from: 5, to: flat.lineStarts[1]!.at, insert: '',
    });
    expect(result.dropped).toEqual([]);
    // The mark now belongs to v-1, because its letter does.
    expect(result.overrides[0]!.at.verse).toBe('v-1');
    expect(result.place(result.overrides[0]!)).toBe('bh');
  });

  it("leaves another section's marks alone", () => {
    const elsewhere: ChantOverride[] = [mark('other-1', 0, 3, 'x')];
    const result = move(four(), elsewhere, { from: 0, to: 0, insert: 'raṁ\n' });
    expect(result.overrides).toEqual(elsewhere);
    expect(result.dropped).toEqual([]);
  });

  it('CATCHES a rebase that would land on the wrong letter', () => {
    /*
     * The whole reason `ch` exists. The edit claims the first character was
     * replaced; what actually changed is the letter the mark is ON. The offset
     * stays perfectly valid — same length, same position — and points at a
     * different letter. Nothing but the witness can tell.
     *
     * This is what a defect in the CALLER looks like, which is what the witness
     * guards: the arithmetic here is exact for any correctly described edit.
     */
    const before = flatten([{ id: 'v-1', lines: ['agnim īḷe'] }]);
    const after = flatten([{ id: 'v-1', lines: ['agnim aḷe'] }]);
    const result = rebaseFlat([mark('v-1', 0, 6, 'ī')], before, after, { from: 0, to: 1 });
    expect(result.overrides).toEqual([]);
    expect(result.dropped[0]!.why).toContain('and not the "ī"');
  });

  it('rebases unverified when there is no witness, as older documents have', () => {
    const result = move(four(), [mark('v-1', 3, 0)], { from: 0, to: 0, insert: 'raṁ\n' });
    expect(result.dropped).toEqual([]);
    expect(result.overrides[0]!.at.line).toBe(4);
  });

  it('drops a mark addressed to a line that is not there, rather than moving it', () => {
    const result = move(four(), [mark('v-1', 9, 0, 'z')], { from: 0, to: 0, insert: 'x' });
    expect(result.overrides).toEqual([]);
    expect(result.dropped[0]!.why).toContain('not in this section');
  });
});
