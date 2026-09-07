/**
 * The caret's addressing, and the property that matters: it is a BIJECTION on
 * every offset in the flat text. If `addressAt` and `offsetOf` are not exact
 * inverses, a click lands one letter off from where the keyboard thinks it is,
 * and every subsequent edit is placed wrong.
 */
import { describe, expect, it } from 'vitest';
import {
  addressAt, flatten, isCollapsed, lineEdge, moveChar, moveLine, moveWord,
  offsetOf, selectAll, selectionRange, versesInSelection,
} from '../caret.js';
import type { VerseSource } from '../caret.js';

const verses: VerseSource[] = [
  { id: 'v-1', lines: ['agnim īḷe', 'purohitaṁ'] },
  { id: 'v-2', lines: ['yajñasya devam'] },
  { id: 'v-3', lines: ['hotāraṁ', 'ratnadhātamam'] },
];

describe('flatten', () => {
  it('separates verses with a blank line and lines with one newline', () => {
    const flat = flatten(verses);
    expect(flat.text).toBe(
      'agnim īḷe\npurohitaṁ\n\nyajñasya devam\n\nhotāraṁ\nratnadhātamam',
    );
  });

  it('records one line start per line, in document order', () => {
    const flat = flatten(verses);
    expect(flat.lineStarts.map((l) => `${l.verseId}:${l.line}`)).toEqual([
      'v-1:0', 'v-1:1', 'v-2:0', 'v-3:0', 'v-3:1',
    ]);
    for (const start of flat.lineStarts) {
      expect(flat.text.slice(start.at, start.at + start.length)).not.toContain('\n');
    }
  });

  it('is empty and harmless for a section with no verses', () => {
    const flat = flatten([]);
    expect(flat.text).toBe('');
    expect(addressAt(flat, 0)).toBeNull();
    expect(selectAll(flat)).toBeNull();
  });
});

describe('addressAt / offsetOf', () => {
  /*
   * THE round trip. Every offset that is not inside a separator must come back
   * to itself — the separators are the only positions with no address, because
   * they are structure rather than text.
   */
  it('round-trips every offset that names a position in a line', () => {
    const flat = flatten(verses);
    const separators = new Set<number>();
    for (let i = 0; i < flat.text.length; i += 1) {
      if (flat.text[i] === '\n') separators.add(i);
    }
    let checked = 0;
    for (let i = 0; i <= flat.text.length; i += 1) {
      if (separators.has(i)) continue;
      const at = addressAt(flat, i);
      expect(at).not.toBeNull();
      expect(offsetOf(flat, at!)).toBe(i);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('clamps out of range rather than throwing', () => {
    const flat = flatten(verses);
    expect(addressAt(flat, -100)).toEqual({ verseId: 'v-1', line: 0, column: 0 });
    expect(addressAt(flat, 10_000)).toEqual({
      verseId: 'v-3', line: 1, column: 'ratnadhātamam'.length,
    });
  });
});

describe('moving', () => {
  it('crosses a verse boundary going down — the whole point of the design', () => {
    const flat = flatten(verses);
    const at = { verseId: 'v-1', line: 1, column: 3 };
    expect(moveLine(flat, at, 1)).toEqual({ verseId: 'v-2', line: 0, column: 3 });
  });

  it('clamps the column to the target line, and keeps the goal column', () => {
    const flat = flatten([
      { id: 'a', lines: ['aaaaaaaaaa'] },
      { id: 'b', lines: ['bb'] },
      { id: 'c', lines: ['cccccccccc'] },
    ]);
    const start = { verseId: 'a', line: 0, column: 8 };
    const middle = moveLine(flat, start, 1, 8);
    expect(middle).toEqual({ verseId: 'b', line: 0, column: 2 });
    // Down again with the goal carried: back out to column 8, as in Word.
    expect(moveLine(flat, middle, 1, 8)).toEqual({ verseId: 'c', line: 0, column: 8 });
    // And without it: the column is permanently lost, which is the bug.
    expect(moveLine(flat, middle, 1)).toEqual({ verseId: 'c', line: 0, column: 2 });
  });

  it('stops at the ends instead of wrapping', () => {
    const flat = flatten(verses);
    const top = { verseId: 'v-1', line: 0, column: 2 };
    expect(moveLine(flat, top, -1)).toEqual(top);
    const bottom = { verseId: 'v-3', line: 1, column: 2 };
    expect(moveLine(flat, bottom, 1)).toEqual(bottom);
  });

  it('steps one character across a line boundary', () => {
    const flat = flatten(verses);
    const endOfLine = { verseId: 'v-1', line: 0, column: 'agnim īḷe'.length };
    expect(moveChar(flat, endOfLine, 1)).toEqual({ verseId: 'v-1', line: 1, column: 0 });
  });

  it('moves by pada, not by letter', () => {
    const flat = flatten(verses);
    const at = { verseId: 'v-2', line: 0, column: 0 };
    expect(moveWord(flat, at, 1)).toEqual({ verseId: 'v-2', line: 0, column: 9 });
    expect(moveWord(flat, { verseId: 'v-2', line: 0, column: 9 }, -1)).toEqual(at);
  });

  it('Home and End', () => {
    const flat = flatten(verses);
    const at = { verseId: 'v-2', line: 0, column: 5 };
    expect(lineEdge(flat, at, 'start').column).toBe(0);
    expect(lineEdge(flat, at, 'end').column).toBe('yajñasya devam'.length);
  });
});

describe('selection', () => {
  it('select-all covers the section, and only the section', () => {
    const flat = flatten(verses);
    const all = selectAll(flat)!;
    expect(all.anchor).toEqual({ verseId: 'v-1', line: 0, column: 0 });
    expect(all.head.verseId).toBe('v-3');
    expect(isCollapsed(all)).toBe(false);
    expect(versesInSelection(flat, all)).toEqual(['v-1', 'v-2', 'v-3']);
  });

  it('reports its range low-first however it was dragged', () => {
    const flat = flatten(verses);
    const a = { verseId: 'v-3', line: 0, column: 2 };
    const b = { verseId: 'v-1', line: 0, column: 4 };
    expect(selectionRange(flat, { anchor: a, head: b }))
      .toEqual(selectionRange(flat, { anchor: b, head: a }));
  });

  it('names every verse a multi-verse selection touches', () => {
    const flat = flatten(verses);
    const s = {
      anchor: { verseId: 'v-1', line: 1, column: 2 },
      head: { verseId: 'v-2', line: 0, column: 3 },
    };
    expect(versesInSelection(flat, s)).toEqual(['v-1', 'v-2']);
  });
});
