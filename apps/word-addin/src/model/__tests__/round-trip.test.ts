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
import { corpusVerses } from '../../../../../tests/helpers/corpus.js';

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
  /** Each verse's text before and after, for the checks that count characters. */
  texts: { text: string; back: string }[];
}

function measure(): Tally {
  const same: Record<string, number> = {};
  const total: Record<string, number> = {};
  const hit = (k: string): void => { same[k] = (same[k] ?? 0) + 1; };
  const add = (k: string, n: number): void => { total[k] = (total[k] ?? 0) + n; };
  const verses = corpusVerses();
  const texts: { text: string; back: string }[] = [];
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
    for (const k of ['sup', 'sbhakti', 'cj']) {
      if (count(before.marks, k) === count(after.marks, k)) hit(k);
    }
    for (const k of ['hold', 'svara', 'sup', 'sbhakti', 'was', 'pause', 'slot', 'cj']) {
      add(`in.${k}`, count(before.marks, k));
      add(`out.${k}`, count(after.marks, k));
    }
    add('bars', (before.text.match(/¦/gu) ?? []).length);
    if (count(after.marks, 'was') > count(before.marks, 'was')) hit('was-gained');
    if (count(after.marks, 'was') < count(before.marks, 'was')) hit('was-lost');
    texts.push({ text: before.text, back: after.text });
  }
  return { verses: verses.length, same, total, texts };
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

  it('keeps every reading aid and svarabhakti dot', () => {
    expect(tally.total['in.sup']).toBe(359);
    expect(tally.total['in.sbhakti']).toBe(31);
    for (const k of ['sup', 'sbhakti']) expect(tally.same[k]).toBe(573);
  });

  it('keeps every candrabindu, which is a CHARACTER and not a marking', () => {
    /*
     * It was a marking and is not any more. A run of text is drawn as one
     * element with one text node inside it, and a combining mark laid over a
     * letter has nowhere to live in that — the renderer parity gate
     * photographed all 89 of them simply absent. U+0310 belongs in the text,
     * which is also where an author types it, and `splitsCharacter` already
     * forbids a marking boundary falling between a letter and its combining
     * mark. So the count is of characters now, not of markings.
     */
    const CANDRA = '̐';
    let before = 0;
    let after = 0;
    for (const { text, back } of tally.texts) {
      before += [...text].filter((c) => c === CANDRA).length;
      after += [...back].filter((c) => c === CANDRA).length;
    }
    expect(before).toBe(89);
    expect(after).toBe(before);
  });

  /*
   * The sharpest limit Word imposes, and it is closed. A run carries ONE
   * character style, and `documentXml` used to give a held letter the holding
   * style and nothing else — so a letter that was both boxed and substituted
   * came back boxed and black. One letter in the corpus is both: the `s` from a
   * visarga inside a box, in `viṣṇuvakṣassthalasthitāyai`. `styles.ts` emits a
   * style for the PAIRING — `HoldingChange` and `2HoldingChange` — rather than
   * making the body choose which of the two marks to lose.
   */
  it('keeps a substitution on a letter that is also inside a box', () => {
    /* A ratchet, and it is at zero. `undefined` is what the tally holds when no
       verse lost one at all, which is the state this test now defends. */
    expect(tally.same['was-lost'] ?? 0).toBe(0);
  });

  /*
   * `docx.ts`'s own fault, and it is closed. The importer set `change` on the
   * letter a raised reading aid is attached to, and the exporter never required
   * it — so a letter carrying only a `sup` came back carrying a substitution as
   * well: 104 markings over 79 verses. The `Anusvara` style carries both the
   * letter actually recited and the small letter printed above one, and only
   * the second is raised.
   */
  it('gains no substitution where a raised reading aid sits', () => {
    expect(tally.same['was-gained'] ?? 0).toBe(0);
    expect((tally.total['out.was'] ?? 0) - (tally.total['in.was'] ?? 0)).toBe(0);
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
