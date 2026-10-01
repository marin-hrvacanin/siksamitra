/**
 * A LINE OF THE SELECTION, TO BE WRITTEN BACK.
 *
 * Its own module, out of `selection.ts`, because it talks to nothing: that
 * file is where Word is read and written, and a test replaces it whole.
 */
import type { TextAndMarks } from '@siksamitra/format';
import type { ScriptKey } from '@siksamitra/engine';
import type { Line, LineWrite } from './selection.js';

/**
 * The write for line `i` of a selection, now holding `tm`. The ONE place a
 * write is made from a line, so nothing the line carries besides its text —
 * its style, its notes — can be left behind by a command that forgot it.
 */
export const writeOf = (l: Line, i: number, tm: TextAndMarks, script?: ScriptKey): LineWrite => {
  /*
   * A PLAIN LINE MARKED IS A MANTRA LINE. Typed into Word it is in `Normal` —
   * Word's 11 pt, where his mantra lines are his `Translit`, Arial 16 pt — and
   * a whole-document command, which works on mantra lines, did not see it at
   * all: the owner's plain Devanāgarī, marked, could not then be written in
   * IAST ("There are no mantra lines"). Marked, it takes the mantra style.
   */
  const plain = l.style === null || l.style === 'Normal';
  return {
    line: i, tm, style: plain ? 'Translit' : l.style, wordText: l.wordText, notes: l.notes, was: l.style,
    ...(script === undefined ? {} : { script }),
  };
};
