/**
 * Keeping hand-placed marks attached — and, more importantly, refusing to
 * pretend when they cannot be.
 *
 * The failure this file exists to prevent is not an exception. It is a box
 * drawn one letter to the left of where the author put it, in a document
 * nobody will proof again.
 */
import { describe, expect, it } from 'vitest';
import type { ChantOverride } from '@siksamitra/format';
import { canonicalInsert, editLine, rebase, rebaseLines } from '../rebase.js';

const mark = (letter: number, ch?: string): ChantOverride => ({
  at: { verse: 'v-1', line: 0, letter },
  set: { hold: 'short' },
  why: 'owner-hand',
  ...(ch === undefined ? {} : { ch }),
});

describe('canonicalInsert', () => {
  it('folds what it inserts, so the line stays canonical', () => {
    expect(canonicalInsert('agnim', 5, 5, 'ĪḶE')).toBe('īḷe');
    expect(canonicalInsert('agnim', 5, 5, 'ṃ')).toBe('ṁ');
  });

  it('refuses to create a double space', () => {
    expect(canonicalInsert('agnim ', 6, 6, ' ')).toBe('');
    expect(canonicalInsert('agnim īḷe', 5, 5, ' ')).toBe('');
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
    // A space that collapsed to nothing must not move the caret past it.
    const result = editLine('agnim īḷe', 5, 5, ' ');
    expect(result.line).toBe('agnim īḷe');
    expect(result.insert).toBe('');
    expect(result.caret).toBe(5);
  });

  it('produces a canonical line for any input', () => {
    const result = editLine('agnim', 5, 5, '  PUROHITAṃ  ');
    expect(result.line).toBe('agnim purohitaṁ');
  });

  it('clamps a backwards or out-of-range span', () => {
    expect(editLine('agnim', 99, -4, 'x').line).toBe('x');
  });
});

describe('rebase', () => {
  const line = 'agnim īḷe';

  it('leaves a mark before the edit exactly where it was', () => {
    const result = rebase(
      [mark(1, 'g')],
      { verseId: 'v-1', line: 0, from: 6, to: 6, insert: 'x' },
      line,
      'agnim xīḷe',
    );
    expect(result.dropped).toEqual([]);
    expect(result.overrides[0]!.at.letter).toBe(1);
  });

  it('shifts a mark after an insertion', () => {
    const result = rebase(
      [mark(6, 'ī')],
      { verseId: 'v-1', line: 0, from: 0, to: 0, insert: 'xx' },
      line,
      `xx${line}`,
    );
    expect(result.dropped).toEqual([]);
    expect(result.overrides[0]!.at.letter).toBe(8);
  });

  it('drops a mark whose letter was deleted, and says which', () => {
    const result = rebase(
      [mark(6, 'ī')],
      { verseId: 'v-1', line: 0, from: 6, to: 7, insert: '' },
      line,
      'agnim ḷe',
    );
    expect(result.overrides).toEqual([]);
    expect(result.dropped[0]!.why).toContain('was replaced');
  });

  it('CATCHES an edit description that does not match what happened', () => {
    /*
     * The whole reason `ch` exists. For a correctly described single
     * replacement the arithmetic is exact, so the witness is not guarding the
     * arithmetic — it is guarding the CALLER. `sync.ts` recovers the edit by
     * diffing, and if that recovery is ever wrong the offsets it produces are
     * still perfectly in range: the box just moves a letter, in a document
     * nobody will proof again.
     *
     * Here the edit claims two characters went in at the FRONT while they
     * actually went on the end. The delta is right, the offset is in range,
     * and it points at `e`.
     */
    const result = rebase(
      [mark(6, 'ī')],
      { verseId: 'v-1', line: 0, from: 0, to: 0, insert: 'xx' },
      line,
      `${line}xx`,
    );
    expect(result.overrides).toEqual([]);
    expect(result.dropped[0]!.why).toContain('and not the "ī"');
  });

  it('rebases unverified when there is no witness, as older documents have', () => {
    const result = rebase(
      [mark(6)],
      { verseId: 'v-1', line: 0, from: 0, to: 0, insert: 'xx' },
      line,
      `xx${line}`,
    );
    expect(result.dropped).toEqual([]);
    expect(result.overrides[0]!.at.letter).toBe(8);
  });

  it('does not touch another verse or another line', () => {
    const elsewhere: ChantOverride[] = [
      { at: { verse: 'v-2', line: 0, letter: 6 }, set: {}, why: 'editorial' },
      { at: { verse: 'v-1', line: 1, letter: 6 }, set: {}, why: 'editorial' },
    ];
    const result = rebase(
      elsewhere,
      { verseId: 'v-1', line: 0, from: 0, to: 0, insert: 'xx' },
      line,
      `xx${line}`,
    );
    expect(result.overrides).toEqual(elsewhere);
  });
});

describe('rebaseLines', () => {
  it('moves marks on later lines down when a line is inserted', () => {
    const marks: ChantOverride[] = [
      { at: { verse: 'v-1', line: 0, letter: 1 }, set: {}, why: 'editorial' },
      { at: { verse: 'v-1', line: 2, letter: 1 }, set: {}, why: 'editorial' },
      { at: { verse: 'v-2', line: 2, letter: 1 }, set: {}, why: 'editorial' },
    ];
    const out = rebaseLines(marks, 'v-1', 1, 1);
    expect(out.map((o) => `${o.at.verse}:${o.at.line}`))
      .toEqual(['v-1:0', 'v-1:3', 'v-2:2']);
  });

  it('is the identity for no change', () => {
    const marks: ChantOverride[] = [mark(1)];
    expect(rebaseLines(marks, 'v-1', 0, 0)).toEqual(marks);
  });
});
