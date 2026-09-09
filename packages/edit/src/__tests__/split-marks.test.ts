/**
 * A VERSE SPLIT IN TWO KEEPS ITS MARKINGS.
 *
 * Pressing Enter at the end of a line divides a verse: the head keeps the id,
 * the tail becomes a new verse. "New" used to mean new in every sense —
 * `writeSources` handed a created verse `marks: []` — so every holding, svara
 * and substitution after the caret was destroyed. On Puruṣa Sūktam's first
 * verse that is 124 markings down to 30, and the only trace was a line in the
 * status bar.
 *
 * The fix rests on two things being separately true, and both are asserted
 * here because either alone would be wrong:
 *
 *   WHICH verse the tail came from is the EDIT'S RANGE's answer (`origins`
 *   from `replaceRange`), never text similarity — deciding identity by
 *   comparing text is what gave three pasted verses three unrelated
 *   recordings, and the header of `range.ts` says so.
 *
 *   BY HOW MUCH the markings shift is VERIFIED, not computed: the tail's text
 *   must actually BE a suffix of the old verse's. Offsets could be taken from
 *   the edit instead, and would be off by one wherever `normLoose` collapsed a
 *   space — which puts a holding on the wrong letter, silently. That is worse
 *   than losing it, so when the suffix does not hold, nothing is carried.
 */
import { describe, expect, it } from 'vitest';
import { toTextAndMarks, type ChantSection, type ChantVerse } from '@siksamitra/format';
import { hydrateVerse } from '@siksamitra/engine';
import { replaceRange } from '../range.js';
import { sourcesOf, writeSources } from '../sync.js';

/**
 * A verse of known text with markings put on it by hand.
 *
 * The markings are written in the STORED form — `[kind, from, span, value]` —
 * because that is what a document on disk holds and what `hydrateVerse` reads.
 * See `mark-codec.ts`: a span, not an end offset.
 */
function verse(id: string, text: string, marks: readonly unknown[] = []): ChantVerse {
  return hydrateVerse({ id, tokens: [], text, marks } as never);
}

const section = (verses: ChantVerse[]): ChantSection => ({
  id: 's-1',
  verses,
  items: verses.map((v) => ({ t: 'verse' as const, ...v })),
}) as ChantSection;

/** Split at `at`, the way the editor does, and write the result back. */
function splitAt(sec: ChantSection, at: number): ChantSection {
  const result = replaceRange(sourcesOf(sec), { from: at, to: at, insert: '\n\n' });
  return writeSources(sec, result.verses, result.origins).section;
}

const marksOf = (v: ChantVerse | undefined): ReturnType<typeof toTextAndMarks>['marks'] =>
  (v === undefined ? [] : toTextAndMarks(v).marks);

describe('splitting a verse', () => {
  /*
   * `agním` holds a svara; a hold covers `īḷe`; a second hold is in the tail.
   * The offsets are counted by hand from the text below.
   *
   *   0         1         2
   *   0123456789012345678901
   *   agním īḷe puróhitaṁ
   */
  const text = 'agním īḷe puróhitaṁ\nyajñasya devam ṛtvijam';
  const withMarks = () => section([verse('v-1', text, [
    ['hold', 6, 3, 'long'],
    ['hold', 30, 5, 'short'],
  ])]);

  /**
   * THE LETTERS A MARKING COVERS — which is what a marking IS.
   *
   * Asserted instead of the offsets, and it is the stronger statement: the
   * offsets are bound to change in a split and a hand-computed pair only says
   * the arithmetic agrees with itself. "The holding is still on `devam`" is
   * what a person would check, and it survives the text being re-counted.
   */
  const covered = (v: ChantVerse | undefined, kind: string): string[] => {
    if (v === undefined) return [];
    const { text: t, marks } = toTextAndMarks(v);
    return marks.filter((m) => m.k === kind).map((m) => t.slice(m.from, m.to));
  };

  it('carries the tail\'s markings into the verse it created', () => {
    const was = covered(withMarks().verses[0], 'hold');
    const out = splitAt(withMarks(), 19);
    expect(out.verses).toHaveLength(2);
    /* The same two holdings, on the same letters, one in each half. */
    expect([...covered(out.verses[0], 'hold'), ...covered(out.verses[1], 'hold')]).toEqual(was);
    expect(covered(out.verses[1], 'hold')).toHaveLength(1);
  });

  it('and leaves the head\'s markings where they were', () => {
    const out = splitAt(withMarks(), 19);
    const head = marksOf(out.verses[0]).filter((m) => m.k === 'hold');
    expect(head).toHaveLength(1);
    expect(head[0]).toMatchObject({ from: 6, to: 9 });
  });

  it('so no marking is lost in the split', () => {
    const before = marksOf(withMarks().verses[0]).length;
    const out = splitAt(withMarks(), 19);
    const after = out.verses.reduce((n, v) => n + marksOf(v).length, 0);
    expect(after).toBe(before);
  });

  it('and every marking it carried is legal in its new verse', () => {
    const out = splitAt(withMarks(), 19);
    for (const v of out.verses) {
      const { text: t, marks } = toTextAndMarks(v);
      for (const m of marks) {
        expect(m.from, `${v.id} ${m.k}`).toBeGreaterThanOrEqual(0);
        expect(m.to, `${v.id} ${m.k}`).toBeLessThanOrEqual(t.length);
        expect(m.to, `${v.id} ${m.k}`).toBeGreaterThanOrEqual(m.from);
      }
    }
  });
});

describe('what is NOT carried, deliberately', () => {
  it('nothing can straddle the break, because a line break already ends a box', () => {
    /*
     * A holding WRITTEN across a line break is not one marking when it is read
     * back — it is two, because a `br` ends a box (`holdings.ts`: the syllable,
     * not the verse, is the bound). Stored as `["hold",15,10]` over
     * `puróhitaṁ\nyajñasya`, it returns as 15..19 and 20..25.
     *
     * So "half a holding crossing the split" is a case that cannot arise, and
     * the half that lies in the tail is carried whole. Asserted here rather
     * than assumed, because the fix would need a different shape if it could.
     */
    const sec = section([verse('v-1', 'agním īḷe puróhitaṁ\nyajñasya', [
      ['hold', 15, 10, 'long'],
    ])]);
    const whole = marksOf(sec.verses[0]).filter((m) => m.k === 'hold');
    expect(whole).toHaveLength(2);
    expect(whole.map((m) => [m.from, m.to])).toEqual([[15, 19], [20, 25]]);

    const out = splitAt(sec, 19);
    const tail = marksOf(out.verses[1]).filter((m) => m.k === 'hold');
    expect(tail).toHaveLength(1);
    /* The tail begins at 20, so 20..25 becomes 0..5 — the whole of it. */
    expect(tail[0]).toMatchObject({ from: 0, to: 5 });
  });

  it('nothing is carried when the tail is not a suffix of the original', () => {
    /*
     * The guard that keeps a marking off a letter nobody put it on. Here the
     * edit REPLACES a range as well as splitting, so the tail's text is not
     * the old text's suffix and the offset cannot be trusted.
     */
    const sec = section([verse('v-1', 'agním īḷe puróhitaṁ\nyajñasya', [
      ['hold', 21, 5, 'short'],
    ])]);
    const result = replaceRange(sourcesOf(sec), { from: 5, to: 24, insert: '\n\nrudra' });
    const out = writeSources(sec, result.verses, result.origins).section;
    for (const v of out.verses.slice(1)) {
      expect(marksOf(v).filter((m) => m.k === 'hold')).toHaveLength(0);
    }
  });

  it('a verse with no origin gets nothing, as before', () => {
    const sec = section([verse('v-1', 'agním īḷe', [['hold', 0, 5, 'long']])]);
    const result = replaceRange(sourcesOf(sec), { from: 9, to: 9, insert: '\n\n' });
    /* No origins passed at all — the old behaviour, and it must still work. */
    const out = writeSources(sec, result.verses).section;
    expect(marksOf(out.verses[1]).filter((m) => m.k === 'hold')).toHaveLength(0);
  });
});

describe('what the person is told', () => {
  it('a split that lost nothing reports nothing lost', () => {
    /*
     * `retext` reports the tail's markings as dropped from the verse that kept
     * the head — true from where it stands, and false about the edit. Saying
     * it anyway put "94 marking(s) … went with them" in the status bar of an
     * edit that lost none, and a warning that cries wolf is the one a person
     * learns to ignore.
     */
    const sec = section([verse('v-1', 'agním īḷe puróhitaṁ\nyajñasya devam', [
      ['hold', 30, 5, 'short'],
    ])]);
    const result = replaceRange(sourcesOf(sec), { from: 19, to: 19, insert: '\n\n' });
    const written = writeSources(sec, result.verses, result.origins);
    expect(written.accentsLost).toEqual([]);
  });

  it('but an edit that really destroys one still says so', () => {
    /*
     * THE CONTROL. Without it, the check above is only measuring that the
     * message was deleted.
     *
     * The marked letters are replaced with unrelated text, wholly: a smaller
     * edit that swaps `īḷe` for `x` in place does NOT lose the marking —
     * `shiftForEdit` carries it onto the replacement — which is right, and is
     * why the destructive case has to be written destructively.
     */
    const sec = section([verse('v-1', 'agním īḷe puróhitaṁ', [
      ['hold', 6, 3, 'long'],
    ])]);
    /* PART of the verse survives, so `retext` runs and can report. Replacing
       the WHOLE verse is a different path — the verse is `removed` and the
       loss is reported as an orphan, not as a marking that could not follow. */
    const result = replaceRange(sourcesOf(sec), { from: 5, to: 10, insert: '' });
    const written = writeSources(sec, result.verses, result.origins);
    expect(written.accentsLost.length).toBeGreaterThan(0);
  });
});

describe('the origin comes from the range, not from the text', () => {
  it('an edit reaching one verse names it as the origin', () => {
    const sec = section([verse('v-1', 'agním īḷe'), verse('v-2', 'yajñasya devam')]);
    const result = replaceRange(sourcesOf(sec), { from: 9, to: 9, insert: '\n\n' });
    expect(result.added).toHaveLength(1);
    expect(result.origins[result.added[0]!]).toBe('v-1');
  });

  it('an edit reaching several claims no origin at all', () => {
    /*
     * Better none than a guess. With two verses in the range there is no
     * single answer to "which one did this text come from", and a wrong
     * origin would move somebody's holdings onto another verse's letters.
     */
    const sec = section([verse('v-1', 'agním īḷe'), verse('v-2', 'yajñasya devam')]);
    const result = replaceRange(sourcesOf(sec), { from: 5, to: 15, insert: 'x\n\ny\n\nz' });
    for (const id of result.added) expect(result.origins[id]).toBeUndefined();
  });
});
