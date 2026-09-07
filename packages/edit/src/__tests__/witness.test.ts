/**
 * The accented witness, carried across an edit.
 *
 * A verse whose svaras are a transcription keeps them in `src.accented`: the
 * same letters, with the accents written in as combining marks. Typing one
 * character used to change the letters and leave the witness behind, so the
 * engine refused the whole line — correctly, since the two no longer matched —
 * and every accent on it disappeared from the document.
 *
 * These tests are about what SURVIVES. The accents outside the edit must be
 * exactly where they were; the accents on letters that are gone must be
 * counted, not quietly forgotten.
 */
import { describe, expect, it } from 'vitest';
import { accentsIn, carryWitness, editWitness } from '../witness.js';

/** `bha̱draṁ` — anudātta on the `a` of `bha`. */
const LINE = 'oṁ bhadraṁ karṇebhiḥ';
const WITNESS = 'oṁ bha̱draṁ karṇe̍bhiḥ';

describe('accentsIn', () => {
  it('counts the marks and nothing else', () => {
    expect(accentsIn(WITNESS)).toBe(2);
    expect(accentsIn(LINE)).toBe(0);
    expect(accentsIn('')).toBe(0);
  });
});

describe('editWitness', () => {
  it('an insertion before every accent moves them all along', () => {
    const after = `oṁ ${LINE.slice(3)}`.replace('oṁ ', 'oṁ oṁ ');
    const result = editWitness(WITNESS, LINE, after, 'oṁ ');
    expect(result.lost).toBe(0);
    expect(accentsIn(result.witness)).toBe(2);
    // The witness is still the same letters as the line, plus its marks.
    expect(result.witness.replace(/[̱̍̎]/g, '')).toBe(after);
  });

  it('an insertion at the end leaves them untouched', () => {
    const after = `${LINE} devāḥ`;
    const result = editWitness(WITNESS, LINE, after, ' devāḥ');
    expect(result.lost).toBe(0);
    expect(result.witness.replace(/[̱̍̎]/g, '')).toBe(after);
    expect(result.witness.startsWith('oṁ bha̱draṁ')).toBe(true);
  });

  it('deleting an accented letter takes its accent, and says so', () => {
    // Remove `bhadraṁ ` — one of the two accents was on its `a`.
    const after = LINE.replace('bhadraṁ ', '');
    const result = editWitness(WITNESS, LINE, after, '');
    expect(result.lost).toBe(1);
    expect(accentsIn(result.witness)).toBe(1);
    expect(result.witness.replace(/[̱̍̎]/g, '')).toBe(after);
  });

  it('deleting an unaccented letter costs nothing', () => {
    const after = LINE.replace('oṁ ', '');
    const result = editWitness(WITNESS, LINE, after, '');
    expect(result.lost).toBe(0);
    expect(accentsIn(result.witness)).toBe(2);
    expect(result.witness.replace(/[̱̍̎]/g, '')).toBe(after);
  });

  it('deleting the letter AFTER an accented one leaves the accent alone', () => {
    // The regression the property test found: the `d` of `bha̱draṁ` is not the
    // letter the anudātta is on, and taking it must not take the mark.
    const after = LINE.replace('bhadraṁ', 'bharaṁ');
    const result = editWitness(WITNESS, LINE, after, '');
    expect(result.lost).toBe(0);
    expect(result.witness).toBe(WITNESS.replace('bha̱draṁ', 'bha̱raṁ'));
  });

  it('is the identity when nothing changed', () => {
    expect(editWitness(WITNESS, LINE, LINE, '')).toEqual({ witness: WITNESS, lost: 0 });
  });

  /**
   * THE PROPERTY, over every single-character deletion of the line.
   *
   * After any of them the witness must still be the new line plus its marks —
   * that is the invariant the engine checks when it reads the witness, and the
   * one whose violation cost 5 accents in the walkthrough.
   */
  it('keeps the witness and the line in step, for every deletion', () => {
    let totalLost = 0;
    for (let i = 0; i < LINE.length; i += 1) {
      const after = LINE.slice(0, i) + LINE.slice(i + 1);
      const result = editWitness(WITNESS, LINE, after, '');
      expect(result.witness.replace(/[̱̍̎]/g, ''), `deleting index ${i}`).toBe(after);
      expect(accentsIn(result.witness) + result.lost).toBe(2);
      totalLost += result.lost;
    }
    // Two of the deletions remove an accented letter.
    expect(totalLost).toBe(2);
  });
});

describe('carryWitness', () => {
  const src = {
    lines: [LINE, 'śṛṇuyāma devāḥ'],
    accented: [WITNESS, 'śṛṇu̱yāma devāḥ'],
  };

  it('carries every line, and reports what an edit cost', () => {
    const result = carryWitness(src, [LINE.replace('bhadraṁ ', ''), src.lines[1]!]);
    expect(result.lost).toBe(1);
    expect(result.unmatched).toBe(0);
    expect(result.accented).toHaveLength(2);
    expect(result.accented![1]).toBe(src.accented[1]);
  });

  it('a verse with no witness carries nothing and loses nothing', () => {
    expect(carryWitness({ lines: [LINE] }, ['x'])).toEqual({
      accented: undefined, lost: 0, unmatched: 0,
    });
  });

  it('a line the witness never had stands in as plain text', () => {
    const result = carryWitness(src, [...src.lines, 'new line']);
    expect(result.unmatched).toBe(1);
    expect(result.accented).toHaveLength(3);
    expect(result.accented![2]).toBe('new line');
  });

  it('a removed line takes its accents, counted', () => {
    const result = carryWitness(src, [LINE]);
    expect(result.accented).toHaveLength(1);
    expect(result.lost).toBe(1);
  });
});
