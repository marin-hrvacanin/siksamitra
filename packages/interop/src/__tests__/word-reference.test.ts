/**
 * A LITTLE SUPERSCRIPTED COUNTING NUMBER — one marking, one style.
 *
 * THE QUESTION THE OWNER ASKED. His Word template carries two character
 * styles, `Name` and `Nma`, both of them recorded as UNRESOLVED for months.
 * He said what they are: "a style for little superscripted number in texts
 * like LS where we want to have shlokas, but within the shlokas we are
 * counting something... so barely visible little info next to the word", one
 * for the recitation text and one for the same marker in a translation. And
 * then: "it seems a bit ridiculous to have a separate style for every single
 * use case, right?... we can just add our own (more general) style, such as
 * `reference`."
 *
 * HE IS RIGHT, AND THE FORMAT ALREADY AGREED. `sup` is one marking — "a
 * superscript after the range" — and the page has always drawn it as `<sup>`.
 * What was wrong was at both ends of the Word seam:
 *
 *   READING   his two styles were mapped to a role called `name` that "has no
 *             home in the format yet", and the letters were added to the
 *             mantra as ORDINARY TEXT. Those two styles carry two thousand
 *             runs of the lalitā sahasranāma between them, so importing it
 *             spliced its counting numbers into the recitation.
 *   WRITING   a `sup` was written in the `Anusvara` style — the SUBSTITUTION
 *             blue — with the superscript bolted onto the run. The Styles pane
 *             said `Anusvara` for something that is not one.
 *
 * Now: one style of ours, `Reference`, written only when a document has one;
 * his two read as the same marking; and the marker lands on the letter before
 * it, because that is what `sup` means.
 */
import { describe, expect, it } from 'vitest';
import { CHAR_STYLE_BY_ID, roleOf } from '../word-styles.js';
import { tokensFromRuns, type ImportReport } from '../docx.js';
import type { WordRun } from '../docx-read.js';
import type { ChantToken, ChantUnit } from '@siksamitra/format';

describe('the vocabulary', () => {
  it('his two and ours all mean the same thing', () => {
    expect(roleOf('Name')).toBe('reference');
    expect(roleOf('Nma')).toBe('reference');
    expect(roleOf('Reference')).toBe('reference');
  });

  it('and nothing else does — the control', () => {
    /* Without this, a role that swallowed everything would pass above and
       every marked letter in his document would import as a footnote. */
    expect(roleOf('Anusvara')).toBe('change');
    expect(roleOf('Svara')).toBe('svara');
    expect(roleOf('Holding')).toBe('hold-short');
    expect(roleOf('Comment')).toBe('comment');
    expect(roleOf('Long')).toBe('dirgha');
  });

  it('the role is called `reference`, not `name`', () => {
    /*
     * `name` said nothing about what the thing IS, which is why it sat
     * unresolved: a role nobody can describe is a role nobody can implement.
     */
    for (const id of ['Name', 'Nma', 'Reference']) {
      expect(CHAR_STYLE_BY_ID.get(id)?.role, id).toBe('reference');
    }
  });

  it('and his two are still described as his', () => {
    /* The table is the record of what came from where. `Reference` is ours;
       the other two are his and their notes have to keep saying so. */
    expect(CHAR_STYLE_BY_ID.get('Name')?.note).toContain('his');
    expect(CHAR_STYLE_BY_ID.get('Nma')?.note).toContain('translation');
    expect(CHAR_STYLE_BY_ID.get('Reference')?.note).toContain('OURS');
  });
});

/** A run, as the reader hands it over. */
const run = (text: string, rStyle: string | null = null, superscript = false): WordRun =>
  ({ text, rStyle, superscript });

/** A report the reader can fill in — every field it writes to. */
const blank = (): ImportReport => ({
  source: { kind: 'docx', bytes: 0 },
  structure: {
    paragraphs: 0, paragraphsWithBody: 0, runs: 0, sections: 0, verses: 0, syllables: 0,
  },
  marks: {},
  byStyle: {},
  byPara: {},
  normalisations: [],
  unresolved: [],
});

/** The letters of the tokens a run list produces, flattened. */
const unitsOf = (tokens: readonly ChantToken[]): ChantUnit[] =>
  tokens.flatMap((t) => (t.t === 'syl' ? [...t.units] : []));

describe('reading a marker out of a .docx', () => {
  it('lands on the letter BEFORE it, which is what `sup` means', () => {
    const report = blank();
    const tokens = tokensFromRuns(
      [run('rāma'), run('12', 'Name')], report, 'p1',
    );
    const units = unitsOf(tokens);
    /* The last letter of `rāma` carries it; no letter of the mantra changed. */
    expect(units.map((u) => u.c).join('')).toBe('rāma');
    expect(units[units.length - 1]!.sup).toBe('12');
  });

  it('and NOT into the mantra as ordinary text — the fault this fixes', () => {
    /*
     * MEASURED AS THE FAULT: the letters of the marker were added with
     * `addLetters`, so `rāma` followed by a `Name` run of `12` imported as
     * `rāma12` — six letters of recitation where there are four. Two thousand
     * runs of the lalitā sahasranāma go through this path.
     */
    const tokens = tokensFromRuns(
      [run('rāma'), run('12', 'Name')], blank(), 'p1',
    );
    expect(unitsOf(tokens).map((u) => u.c).join('')).not.toContain('1');
  });

  it('his other style does the same, because it is the same marker', () => {
    const tokens = tokensFromRuns(
      [run('devī'), run('3', 'Nma')], blank(), 'p1',
    );
    const units = unitsOf(tokens);
    expect(units[units.length - 1]!.sup).toBe('3');
  });

  it('and so does ours, so a file we wrote reads back the same', () => {
    const tokens = tokensFromRuns(
      [run('devī'), run('3', 'Reference')], blank(), 'p1',
    );
    expect(unitsOf(tokens).at(-1)?.sup).toBe('3');
  });

  it('two marker runs in a row are ONE marker', () => {
    /* Word splits a run wherever it likes — a spell-check boundary is enough —
       so `12` can arrive as `1` then `2`. Replacing rather than appending
       would keep only the second digit. */
    const tokens = tokensFromRuns(
      [run('rāma'), run('1', 'Reference'), run('2', 'Reference')], blank(), 'p1',
    );
    expect(unitsOf(tokens).at(-1)?.sup).toBe('12');
  });

  it('a marker with no letter before it is REPORTED, not guessed at', () => {
    /* `sup` is "a superscript after the range", so a marker at the very start
       of a line has no range to be after. Silently dropping it is how a
       document loses a number nobody notices. */
    const report = blank();
    tokensFromRuns([run('7', 'Reference'), run('rāma')], report, 'p1');
    expect(report.unresolved.length).toBe(1);
    expect(JSON.stringify(report.unresolved)).toContain('no letter before it');
  });

  it('and it is counted, so an import report says how many there were', () => {
    const report = blank();
    tokensFromRuns([run('rāma'), run('12', 'Name')], report, 'p1');
    expect(report.marks['reference']).toBe(1);
  });
});
