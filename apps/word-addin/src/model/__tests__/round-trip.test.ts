/**
 * WHAT SURVIVES A TRIP THROUGH WORD — measured over the whole corpus.
 *
 * The add-in writes a paragraph as styled runs and reads it back the same way,
 * so a document marked in Word must open in śikṣāmitra carrying what it was
 * marked with. This is that claim, per marking, over 573 verses.
 *
 * NOT TAUTOLOGICAL: the input is the corpus on disk — 4 788 holdings and 6 086
 * svaras somebody placed by hand in Word years ago — and each is compared by
 * the LETTERS it covers, which is a fact about the document rather than about
 * the offsets either side computes. A holding that came back on the right
 * letters at the wrong offsets would still fail this.
 *
 * The numbers below that are not 573 are Word's limits and the importer's
 * habits, and each is asserted at its measured value so that a change to either
 * shows up here rather than in a printed PDF.
 */
import { describe, expect, it } from 'vitest';
import type { Mark } from '@siksamitra/format';
import { toTextAndMarks } from '@siksamitra/format';
import { decodeRuns, paragraphRuns } from '../paragraph.js';
import { corpusVerses } from './corpus.js';

/** A verse's markings of one kind, as `value:letters` — offsets excluded. */
const byLetters = (marks: readonly Mark[], k: string, text: string): string =>
  marks.filter((m) => m.k === k).map((m) => `${m.v ?? ''}:${text.slice(m.from, m.to)}`).join('|');

const count = (marks: readonly Mark[], k: string): number =>
  marks.filter((m) => m.k === k).length;

/** A verse through Word and back: paragraphs out, paragraphs in, rejoined. */
function through(text: string, marks: Mark[]): { text: string; marks: Mark[] } {
  const back = paragraphRuns({ text, marks }).map((p) => decodeRuns(p));
  const out: Mark[] = [];
  let at = 0;
  for (const b of back) {
    for (const m of b.marks) out.push({ ...m, from: m.from + at, to: m.to + at });
    at += b.text.length + 1;
  }
  return { text: back.map((b) => b.text).join('\n'), marks: out };
}

interface Tally {
  verses: number;
  same: Record<string, number>;
  total: Record<string, number>;
}

function measure(): Tally {
  const same: Record<string, number> = {};
  const total: Record<string, number> = {};
  const hit = (k: string): void => { same[k] = (same[k] ?? 0) + 1; };
  const add = (k: string, n: number): void => { total[k] = (total[k] ?? 0) + n; };
  const verses = corpusVerses();
  for (const { verse } of verses) {
    const before = toTextAndMarks(verse);
    const after = through(before.text, before.marks);
    /*
     * The bar is dropped from the letter comparison because `documentXml`
     * writes it as a `Pause` run and the importer reads every pipe as a pause —
     * the bar and the short pause are one style in his file. Whitespace is
     * dropped because the importer puts a space either side of a daṇḍa. Both
     * are `docx.ts` behaviours, both are counted below, and neither touches a
     * letter.
     */
    const bare = (t: string): string => t.replace(/[\s¦]+/gu, '');
    if (bare(before.text) === bare(after.text)) hit('letters');
    for (const k of ['hold', 'svara']) {
      if (byLetters(before.marks, k, before.text) === byLetters(after.marks, k, after.text)) {
        hit(k);
      }
    }
    for (const k of ['sup', 'candra', 'sbhakti', 'cj']) {
      if (count(before.marks, k) === count(after.marks, k)) hit(k);
    }
    for (const k of ['hold', 'svara', 'sup', 'candra', 'sbhakti', 'was', 'pause', 'slot', 'cj']) {
      add(`in.${k}`, count(before.marks, k));
      add(`out.${k}`, count(after.marks, k));
    }
    add('bars', (before.text.match(/¦/gu) ?? []).length);
    if (count(after.marks, 'was') > count(before.marks, 'was')) hit('was-gained');
    if (count(after.marks, 'was') < count(before.marks, 'was')) hit('was-lost');
  }
  return { verses: verses.length, same, total };
}

const tally = measure();

describe('a verse through Word and back', () => {
  it('is the 573 verses of the corpus', () => {
    expect(tally.verses).toBe(573);
  });

  it('keeps every letter', () => {
    expect(tally.same['letters']).toBe(573);
  });

  it('keeps all 4 788 holdings, on the same letters, at the same weight', () => {
    expect(tally.total['in.hold']).toBe(4788);
    expect(tally.same['hold']).toBe(573);
  });

  it('keeps all 6 086 svaras, on the same letters, of the same kind', () => {
    expect(tally.total['in.svara']).toBe(6086);
    expect(tally.same['svara']).toBe(573);
  });

  it('keeps every reading aid, candrabindu and svarabhakti dot', () => {
    expect(tally.total['in.sup']).toBe(359);
    expect(tally.total['in.candra']).toBe(89);
    expect(tally.total['in.sbhakti']).toBe(31);
    for (const k of ['sup', 'candra', 'sbhakti']) expect(tally.same[k]).toBe(573);
  });

  /*
   * Word's own limit, and the sharpest one. A run carries ONE character style,
   * and `documentXml` gives a held letter the holding style — so a letter that
   * is both boxed and substituted comes back boxed and not substituted. One
   * letter in the corpus is both: the `s` from a visarga inside a box, in
   * `viṣṇuvakṣassthalasthitāyai`.
   */
  it('loses a substitution on a letter that is also inside a box — once', () => {
    /* A ratchet. One verse today; a `docx.ts` that learned to write a boxed
       substitution would make it zero, and an improvement upstream must not
       fail a test down here. Only a REGRESSION does. */
    expect(tally.same['was-lost']).toBeLessThanOrEqual(1);
  });

  /*
   * `docx.ts`, not Word: the importer sets `change` on the letter a raised
   * reading aid is attached to, and the exporter does not require it. So a
   * letter carrying only a `sup` comes back carrying a substitution as well.
   * 104 markings over 79 verses, and no letter changes.
   */
  it('gains a substitution wherever a raised reading aid sits — 79 verses', () => {
    expect(tally.same['was-gained']).toBeLessThanOrEqual(79);
    expect((tally.total['out.was'] ?? 0) - (tally.total['in.was'] ?? 0)).toBeLessThanOrEqual(104);
  });

  it('turns each of the 59 bars into a pause, and adds nothing else', () => {
    /* The corpus fact is exact — 59 bars. What becomes of them is `docx.ts`'s:
       the bar and the short pause share one character style, so every bar reads
       back as a pause. A ratchet, for the same reason as above. */
    expect(tally.total['bars']).toBe(59);
    const gained = (tally.total['out.pause'] ?? 0) - (tally.total['in.pause'] ?? 0);
    expect(gained).toBeLessThanOrEqual(59);
  });

  it('cannot carry a variable slot, and the corpus has three', () => {
    expect(tally.total['in.slot']).toBe(3);
    expect(tally.total['out.slot']).toBe(0);
  });

  it('has no conjunct choice to lose in this corpus', () => {
    expect(tally.total['in.cj']).toBe(0);
    expect(tally.same['cj']).toBe(573);
  });
});
