/**
 * Shared helpers for the session tests.
 *
 * The fixture is DERIVED by the real engine (see `fixture.ts`); these are just
 * the accessors that keep the tests readable — a hand-written token tree would
 * be a second implementation of `emit`.
 */
import { toTextAndMarks } from '@siksamitra/format';
import { flatten } from '../caret.js';
import { emptyHistory } from '../history.js';
import { sourcesOf } from '../sync.js';
import { apply } from '../session.js';
import type { EditState } from '../session.js';
import type { ChantSection } from '@siksamitra/format';

export const section1 = (s: EditState): ChantSection => s.doc.sections[0]!;
export const versesOf = (s: EditState): string[] => section1(s).verses.map((v) => v.id);
/**
 * What a verse SAYS, which is what the caret edits.
 *
 * It used to read `src.lines`, the letters as typed, because that is what an
 * edit changed. The caret edits the text that is shown now, so `src` is no
 * longer written and reading it showed the verse as it was before every
 * keystroke.
 */
export const linesOf = (s: EditState, id: string): string[] =>
  toTextAndMarks(section1(s).verses.find((v) => v.id === id)!).text.split('\n');

export const flatOf = (s: EditState) => flatten(sourcesOf(section1(s)));
export const at = (s: EditState, verseId: string, line: number, column: number): number =>
  flatOf(s).lineStarts.find((l) => l.verseId === verseId && l.line === line)!.at + column;

/** Type text at an offset, as one command with a fresh history. */
export const type = (s: EditState, offset: number, text: string, coalesce?: string) =>
  apply(s, emptyHistory(), {
    k: 'replace', sectionId: 's1', from: offset, to: offset, insert: text,
    ...(coalesce === undefined ? {} : { coalesce }),
  });
