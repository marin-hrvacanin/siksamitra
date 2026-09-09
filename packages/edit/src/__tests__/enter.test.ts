/**
 * PRESSING ENTER.
 *
 * The owner's report was "Enter doesn't work and behaves strangely", and both
 * halves were true for a reason nothing here could see: NOTHING IN THIS
 * REPOSITORY HAD EVER PRESSED ENTER. `range.test.ts` has a case called "Enter
 * at the end of a verse starts a new one" — it calls `splitVerse`, which the
 * application never invokes, so it was green throughout while the Enter key
 * changed not one byte of the document.
 *
 * The two defects, both fixed here:
 *
 *   DOESN'T WORK    the editor inserted a bare `'\n'`. A blank line IS the
 *                   verse separator, and `split` prunes an empty line at a
 *                   block's ends as the residue of its own separator — so a
 *                   lone newline at either EDGE of a line was normalised
 *                   straight back out. Enter at the start of a verse, at the
 *                   end of a verse, and at the end of a section did nothing
 *                   at all. `lineBreakAt` is the rule, in one place, and
 *                   `splitLine` and the editor now both read it.
 *
 *   BEHAVES STRANGELY  where Enter DID divide a line, the caret came back one
 *                   short, because it was measured through the same `split`
 *                   that prunes the trailing blank — so it was drawn at the
 *                   end of the line ABOVE the break and the next letter typed
 *                   went back onto it.
 *
 * THE CARET IS ASSERTED AS A SLICE OF THE RESULTING TEXT, not as a number
 * copied out of a run: `text.slice(0, caret)` and `text.slice(caret)` say in
 * words which side of the break it is on, and would still read correctly if
 * every offset in the file changed.
 */
import { describe, expect, it } from 'vitest';
import { VERSE_GAP, flatten, lineBreakAt } from '../caret.js';
import { replaceRange, splitLine } from '../range.js';
import type { VerseSource } from '../caret.js';

/** Two verses, two lines each. `flatten` gives them one flat string. */
const verses = (): VerseSource[] => [
  { id: 'v-1', lines: ['agnim īḷe purohitaṁ', 'yajñasya devam ṛtvijam'] },
  { id: 'v-2', lines: ['hotāraṁ ratnadhātamam'] },
];

const flat = () => flatten(verses());
const text = (out: { verses: VerseSource[] }): string => flatten(out.verses).text;
/** Where the caret sits, as the two sides of the text it divides. */
const around = (out: { verses: VerseSource[]; caret: number }): [string, string] => {
  const whole = text(out);
  return [whole.slice(Math.max(0, out.caret - 4), out.caret), whole.slice(out.caret, out.caret + 4)];
};

describe('what Enter inserts', () => {
  it('divides the line between two syllables', () => {
    expect(lineBreakAt(flat(), 14)).toBe('\n');
  });

  it('starts a new verse at the end of a line', () => {
    /* `agnim īḷe purohitaṁ` is 19 characters. */
    expect(lineBreakAt(flat(), 19)).toBe(VERSE_GAP);
  });

  it('and at the start of one', () => {
    expect(lineBreakAt(flat(), 0)).toBe(VERSE_GAP);
    expect(lineBreakAt(flat(), 20)).toBe(VERSE_GAP);
  });

  it('and at the very end of the section', () => {
    expect(lineBreakAt(flat(), flat().text.length)).toBe(VERSE_GAP);
  });

  it('is the same rule `splitLine` uses — there is only one', () => {
    /* Two copies of "where does a verse begin" are two answers to it. */
    for (const at of [0, 5, 14, 19, 20, 42, flat().text.length]) {
      const viaSplit = splitLine(verses(), at);
      const viaRule = replaceRange(verses(), { from: at, to: at, insert: lineBreakAt(flat(), at) });
      expect(text(viaSplit), `offset ${at}`).toBe(text(viaRule));
      expect(viaSplit.caret, `offset ${at}`).toBe(viaRule.caret);
    }
  });
});

describe('Enter changes the document', () => {
  /*
   * Each of these returned the document UNCHANGED. The assertion is simply
   * that the text is different from what went in — the weakest possible
   * statement, and the one that was false.
   */
  const before = flatten(verses()).text;

  it('in the middle of a pāda', () => {
    expect(text(splitLine(verses(), 14))).not.toBe(before);
  });

  it('at the very end of a verse', () => {
    expect(text(splitLine(verses(), 42))).not.toBe(before);
  });

  it('at the very start of a verse', () => {
    expect(text(splitLine(verses(), 0))).not.toBe(before);
  });

  it('at the very end of the whole section', () => {
    expect(text(splitLine(verses(), before.length))).not.toBe(before);
  });

  it('at the end of a line that is not the end of a verse', () => {
    expect(text(splitLine(verses(), 19))).not.toBe(before);
  });
});

describe('what Enter produces', () => {
  it('in the middle of a pāda: one line becomes two, in the same verse', () => {
    const out = splitLine(verses(), 14);
    expect(out.verses).toHaveLength(2);
    expect(out.verses[0]?.lines).toEqual(['agnim īḷe puro', 'hitaṁ', 'yajñasya devam ṛtvijam']);
    expect(out.added).toEqual([]);
  });

  it('at the end of a verse: a new, empty verse to type into', () => {
    const out = splitLine(verses(), 42);
    expect(out.verses).toHaveLength(3);
    expect(out.verses[1]?.lines).toEqual(['']);
    expect(out.added).toHaveLength(1);
  });

  it('at the end of the section: an empty verse at the end', () => {
    const out = splitLine(verses(), flat().text.length);
    expect(out.verses).toHaveLength(3);
    expect(out.verses[2]?.lines).toEqual(['']);
  });

  it('at the start of the section: an empty verse before everything', () => {
    const out = splitLine(verses(), 0);
    expect(out.verses).toHaveLength(3);
    expect(out.verses[0]?.lines).toEqual(['']);
    /* The verse that was first keeps its id — it was not consumed. */
    expect(out.verses.map((v) => v.id)).toContain('v-1');
  });

  it('twice in the middle makes two breaks, not one', () => {
    const once = splitLine(verses(), 14);
    const twice = splitLine(once.verses, once.caret);
    expect(text(twice).split('\n').length).toBeGreaterThan(text(once).split('\n').length);
  });
});

describe('where the caret lands', () => {
  it('AFTER the break, not before it', () => {
    const out = splitLine(verses(), 14);
    const [left, right] = around(out);
    expect(left).toBe('uro\n');
    expect(right).toBe('hita');
  });

  it('so the next letter typed goes on the NEW line', () => {
    /*
     * The whole point. With the caret one short, this landed on the line
     * above the break — which is what "behaves strangely" was.
     */
    const out = splitLine(verses(), 14);
    /* Lower case: canonical text is lower-cased by `normLoose`, so an 'X'
       arrives as an 'x' and the assertion would be about the wrong thing. */
    const typed = replaceRange(out.verses, { from: out.caret, to: out.caret, insert: 'x' });
    expect(text(typed)).toContain('\nxhitaṁ');
    expect(text(typed)).not.toContain('purox');
  });

  it('lands in the new verse when Enter made one', () => {
    const out = splitLine(verses(), 42);
    const typed = replaceRange(out.verses, { from: out.caret, to: out.caret, insert: 'x' });
    /* The letter is its own verse's whole text, between the two already there. */
    expect(typed.verses.map((v) => v.lines.join('|')))
      .toEqual(['agnim īḷe purohitaṁ|yajñasya devam ṛtvijam', 'x', 'hotāraṁ ratnadhātamam']);
  });

  it('is never past the end of the text', () => {
    for (const at of [0, 1, 14, 19, 20, 42, flat().text.length]) {
      const out = splitLine(verses(), at);
      expect(out.caret, `offset ${at}`).toBeLessThanOrEqual(text(out).length);
      expect(out.caret, `offset ${at}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('and typing at it never rewrites the text before it', () => {
    /* A caret that is right is one you can type at without disturbing what
       came before. Checked at every offset in the document. */
    const whole = flat().text;
    for (let at = 0; at <= whole.length; at += 1) {
      const out = splitLine(verses(), at);
      const typed = replaceRange(out.verses, { from: out.caret, to: out.caret, insert: 'x' });
      const before = text(out).slice(0, out.caret);
      expect(text(typed).slice(0, out.caret), `offset ${at}`).toBe(before);
    }
  });
});

describe('Ctrl+Enter still means "a new verse here"', () => {
  it('even in the middle of a line, where Enter would only divide it', () => {
    const out = replaceRange(verses(), { from: 14, to: 14, insert: VERSE_GAP });
    expect(out.verses).toHaveLength(3);
    expect(out.verses[0]?.lines).toEqual(['agnim īḷe puro']);
    expect(out.verses[1]?.lines).toEqual(['hitaṁ', 'yajñasya devam ṛtvijam']);
  });
});
