/**
 * Keeping the three layers of a verse in step — and refusing when it cannot.
 *
 * A verse holds the same text three times over: the source lines the author
 * types, the marks addressed into them, and the tokens the renderer draws. An
 * edit that updates one and not the others is exactly the class of defect that
 * made v1 untraceable. `sync.ts` is the one module allowed to reconcile them,
 * and it had no unit test — while three of its behaviours were each a bug that
 * lost someone's work:
 *
 *   - a stand-in source that was not canonical, so a NO-OP edit shortened the
 *     flat text by 11 characters and 23 marks correctly refused to follow;
 *   - text merged into an attested verse being dropped on the floor with no
 *     refusal and no mention;
 *   - a transcribed accent staying behind when the letter it was on was
 *     replaced.
 */
import { describe, expect, it } from 'vitest';
import { toTextAndMarks } from '@siksamitra/format';
import { derive, norm } from '@siksamitra/engine';
import type { ChantSection, ChantVerse } from '@siksamitra/format';
import { changedVerses, linesFromTokens, sourcesOf, writeSources } from '../sync.js';

function verse(id: string, lines: string[], attested = false): ChantVerse {
  const d = derive({ lines }, undefined, { verseId: id, trace: false });
  return {
    id,
    tokens: d.tokens,
    ...(attested ? {} : { src: { lines: [...d.srcMap.lines] } }),
  };
}

const section = (verses: ChantVerse[]): ChantSection => ({ id: 's1', verses });

describe('the stand-in source of an attested verse', () => {
  /*
   * An attested verse has no source and must never be re-derived, but it still
   * has to occupy space in the flat text — or the caret would skip it and a
   * selection across it would silently exclude it.
   */
  it('is its own recited text', () => {
    const v = verse('v-1', ['agnim īḷe purohitaṁ'], true);
    expect(linesFromTokens(v).join(' ')).toContain('agnim');
  });

  it('is CANONICAL, like every other line in the flat source', () => {
    /*
     * THE BUG. An attested verse's tokens produce `… ॥॥ ` with a trailing
     * space and a double space, which `replaceRange` then trims — so a no-op
     * edit shortened the section's flat text by 11 characters, every offset
     * after that verse moved, and the witness on 23 hand-placed marks
     * correctly refused to follow. The stand-in has to be as canonical as a
     * real source line, or it is a moving reference point.
     */
    for (const lines of [
      ['agnim īḷe .'],
      ['purohitaṁ ..3..'],
      ['yajñasya devam', 'ṛtvijam .'],
    ]) {
      for (const line of linesFromTokens(verse('v-1', lines, true))) {
        expect(line, JSON.stringify(line)).toBe(norm(line));
      }
    }
  });

  it('has one line per line of the verse', () => {
    expect(linesFromTokens(verse('v-1', ['a b', 'c d'], true))).toHaveLength(2);
  });
});

describe('which verses an edit touched', () => {
  it('is the ones whose source changed, and only those', () => {
    const before = sourcesOf(section([verse('v-1', ['a b']), verse('v-2', ['c d'])]));
    const after = before.map((v) => (v.id === 'v-2' ? { ...v, lines: ['c e'] } : v));
    expect([...changedVerses(before, after)]).toEqual(['v-2']);
  });

  it('is empty when nothing changed', () => {
    const s = sourcesOf(section([verse('v-1', ['a b'])]));
    expect([...changedVerses(s, s)]).toEqual([]);
  });

  it('notices a verse that appeared', () => {
    const before = sourcesOf(section([verse('v-1', ['a'])]));
    const after = [...before, { id: 'v-2', lines: ['b'] }];
    expect([...changedVerses(before, after)]).toEqual(['v-2']);
  });
});

describe('writing sources back', () => {
  it('keeps every field that is not derived', () => {
    const v: ChantVerse = {
      ...verse('v-1', ['agnim īḷe']),
      n: '7',
      translation: { en: 'to Agni' },
      audioId: 'a1',
    };
    const written = writeSources(section([v]), [{ id: 'v-1', lines: ['agnim īḷe hotā'] }]);
    const out = written.section.verses[0]!;
    expect(out.n).toBe('7');
    expect(out.translation).toEqual({ en: 'to Agni' });
    expect(out.audioId).toBe('a1');
    /* The TEXT, not `src.lines`: the caret edits what is shown, and `src` is
       the accented witness underneath rather than the thing being written. */
    expect(toTextAndMarks(out).text).toBe('agnim īḷe hotā');
  });

  it('takes the ORDER from the sources, not from the old section', () => {
    /* A paste that added a verse in the middle must not append it at the end. */
    const s = section([verse('v-1', ['a']), verse('v-2', ['b'])]);
    const written = writeSources(s, [
      { id: 'v-1', lines: ['a'] },
      { id: 'v-new', lines: ['middle'] },
      { id: 'v-2', lines: ['b'] },
    ]);
    expect(written.section.verses.map((v) => v.id)).toEqual(['v-1', 'v-new', 'v-2']);
  });

  it('never writes an attested verse s source', () => {
    const s = section([verse('v-1', ['agnim īḷe'], true)]);
    const written = writeSources(s, [{ id: 'v-1', lines: ['agnim īḷe'] }]);
    expect(written.section.verses[0]!.src).toBeUndefined();
    expect(written.refused).toEqual([]);
  });

  it('takes text merged into a verse that has no source layer', () => {
    /*
     * THIS USED TO ASSERT A REFUSAL. A single Backspace at the start of the
     * verse after a transcribed one merged the two, and the merged text — a
     * whole verse of words — vanished with no refusal and no mention; the fix
     * at the time was to decline the edit and say so. A verse holds its own
     * text now, so the merge is an ordinary write and nothing is declined.
     */
    const s2 = section([verse('v-1', ['agnim īḷe'], true)]);
    const written = writeSources(s2, [{ id: 'v-1', lines: ['agnim īḷe purohitaṁ yajñasya'] }]);
    expect(written.refused).toEqual([]);
    expect(toTextAndMarks(written.section.verses[0]!).text).toContain('yajñasya');
    // And it still invents no source layer.
    expect(written.section.verses[0]!.src).toBeUndefined();
  });


  it('does not refuse an edit elsewhere in the section', () => {
    /*
     * The stand-in is compared NORMALISED. Un-normalised, it reported a
     * refusal for every transcribed verse on every keystroke anywhere in the
     * section — five warnings for a perfectly legal edit.
     */
    const s = section([verse('v-1', ['agnim īḷe .'], true), verse('v-2', ['purohitaṁ'])]);
    const sources = sourcesOf(s).map((v) => (v.id === 'v-2' ? { ...v, lines: ['purohitaṁ x'] } : v));
    expect(writeSources(s, sources).refused).toEqual([]);
  });

  it('carries the markings across an edit, and counts what it cost', () => {
    /*
     * THIS USED TO BE ABOUT `src.accented`, the accented witness, which an
     * edit left behind — so the engine refused the line and 156 svaras became
     * 151. Nothing derives from the witness now; what has to survive an edit
     * is the verse’s own markings, and what has to be reported is the ones it
     * could not carry.
     */
    const marked = verse('v-1', ['oṁ bhadraṁ karṇebhiḥ']);
    /* The markings that address LETTERS. A syllable boundary is division, and
       adding a letter legitimately adds one, so counting those would measure
       the syllabifier rather than what survived. */
    const held = (v: typeof marked): number =>
      toTextAndMarks(v).marks.filter((m) => m.k !== 'syl').length;
    const before = held(marked);
    expect(before).toBeGreaterThan(0);
    const s2 = section([marked]);

    // An edit at the very end moves nothing and costs nothing.
    const text = toTextAndMarks(marked).text;
    const kept = writeSources(s2, [{ id: 'v-1', lines: [`${text}x`] }]);
    expect(kept.accentsLost).toEqual([]);
    expect(held(kept.section.verses[0]!)).toBe(before);

    // An edit that deletes the letters a marking is on says what it cost.
    const lost = writeSources(s2, [{ id: 'v-1', lines: [text.slice(12)] }]);
    expect(lost.accentsLost.length).toBeGreaterThan(0);
    expect(lost.accentsLost[0]!.verseId).toBe('v-1');
  });
});
