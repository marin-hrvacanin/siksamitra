/**
 * WHAT A BUTTON DOES — the same whether it is pressed in the pane, on the
 * ribbon tab, or in the right-click menu.
 *
 * Out of the pane's React hook so that the ribbon's function file calls the
 * very code the pane does: a second copy of "press Short" in the function file
 * would be a second answer to what Short means, and the two would drift the
 * first time one of them was fixed. Every function here reads Word through
 * `selection.ts` and `client.ts`, decides with `@siksamitra/edit` and
 * `@siksamitra/engine`, and answers with what to SAY — never with a thrown
 * error for something a person did.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { applyAcross, letterBefore, typeAt, type MarkCommand } from '@siksamitra/edit';
import { notCarried } from '../model/carry.js';
import { writeLines, type LineWrite, type Located } from './selection.js';

/** What to tell the person, in one line and any detail under it. */
export interface Said {
  text: string;
  kind: 'plain' | 'warn';
  lines: string[];
}

const said = (text: string, kind: Said['kind'] = 'plain', lines: string[] = []): Said => ({ text, kind, lines });

/** One text and its markings, in an order that does not depend on how they
 *  were produced — so "did the rules change this line?" has one answer. `by`
 *  is left out: Word cannot store it, and every line read out of Word says
 *  `hand`. */
const canon = (tm: TextAndMarks): string => JSON.stringify([tm.text, tm.marks
  .map(({ by: _by, ...m }) => JSON.stringify(m)).sort()]);
export const sameText = (a: TextAndMarks, b: TextAndMarks): boolean => canon(a) === canon(b);

/**
 * Why this selection may not be written, or `null` if it may. Asked of EVERY
 * line: a press over five lines where one has a picture writes none of them
 * rather than four, so nothing half-happens.
 */
export function refusalOf(here: Located): Said | null {
  const many = here.lines.length > 1;
  const where = (i: number): string => (many ? `line ${i + 1} of the selection` : 'this line');
  const blocked = here.lines.findIndex((l) => l.blocked.length > 0);
  if (blocked >= 0) {
    return said(`Left alone: ${where(blocked)} has ${here.lines[blocked]!.blocked.join(' and ')} on it, `
      + 'and rewriting it would lose that.', 'warn', ['Move it to a line of its own, or remove it, and press again.']);
  }
  const lost = here.lines.flatMap((l, i) => l.unresolved.filter((u) => u.lossy)
    .map((u) => `${many ? `line ${i + 1}: ` : ''}${u.what}: ${u.raw}`));
  if (lost.length > 0) {
    return said(`Refusing to write: ${many ? 'the selection' : 'this line'} carries text the reader cannot place.`,
      'warn', lost);
  }
  return null;
}

/** A marking placed AT a point rather than over letters. */
const isPoint = (c: MarkCommand): boolean => c.k === 'sbhakti' || c.k === 'pause';

/**
 * A marking button pressed over the selection — or, with nothing selected, on
 * the letter just before the caret, which is the one a person has just typed
 * (`letterBefore`). The caret goes back where it was, so typing carries on.
 */
export async function markSelection(here: Located, command: MarkCommand): Promise<Said> {
  const refused = refusalOf(here);
  if (refused !== null) return refused;
  const caret = here.lines.length === 1 && here.from === here.to ? here.lines[0]! : null;
  if (caret !== null && !isPoint(command)) {
    const letter = letterBefore(caret.tm.text, caret.from);
    if (letter === null) {
      return said('Nothing to mark: the caret is not after a letter.', 'warn',
        ['Type the letter first, or select the letters, and press again.']);
    }
    const r = applyAcross([{ ...caret, from: letter[0], to: letter[1] }], command)[0]!;
    const tm = { text: r.text ?? caret.tm.text, marks: r.marks };
    if (!sameText(tm, caret.tm)) {
      await writeLines([{ line: 0, tm, style: caret.style, wordText: caret.wordText }],
        { line: 0, at: caret.from + (tm.text.length - caret.tm.text.length) });
    }
    return said(r.note, notCarried(r.marks).length === 0 ? 'plain' : 'warn', notCarried(r.marks).map((l) => l.why));
  }
  const results = applyAcross(here.lines, command);
  const writes: LineWrite[] = [];
  results.forEach((r, i) => {
    const l = here.lines[i]!;
    const tm = { text: r.text ?? l.tm.text, marks: r.marks };
    if (!sameText(tm, l.tm)) writes.push({ line: i, tm, style: l.style, wordText: l.wordText });
  });
  /* A caret stays where it was; letters selected in one line stay selected,
     grown by whatever the command typed onto them (a candrabindu). */
  const one = here.lines.length === 1 ? here.lines[0]! : null;
  const grew = one === null ? 0 : (results[0]!.text ?? one.tm.text).length - one.tm.text.length;
  await writeLines(writes, caret !== null ? { line: 0, at: caret.from }
    : one !== null ? { line: 0, at: one.from, to: one.to + grew } : undefined);
  const undrawable = results.flatMap((r) => notCarried(r.marks));
  const note = here.lines.length === 1 ? results[0]!.note : `${writes.length} of ${here.lines.length} lines changed`;
  return said(note, undrawable.length === 0 ? 'plain' : 'warn', undrawable.map((l) => l.why));
}

/**
 * A character from the insert palette, typed at the caret or over the
 * selected letters of one line. Through the model and the writer, never
 * Word's own typing — so it takes exactly the style it should and the next
 * letter is not dragged into it (`typeAt`). The caret comes back after it.
 */
export async function typeInSelection(here: Located, ch: string): Promise<Said> {
  if (here.lines.length > 1) {
    return said('Select within one line to type over it — this selection runs over several.', 'warn');
  }
  const refused = refusalOf(here);
  if (refused !== null) return refused;
  const l = here.lines[0]!;
  /* In a Devanāgarī, Telugu or Tamil line the letter goes in as that script's
     — the model is IAST and the line is written back in its own script — and
     a script has no capitals, so a capital is its letter. */
  const inScript = l.script !== 'iast';
  const t = typeAt(l.tm, l.from, l.to, inScript ? ch.toLowerCase() : ch, { abugida: inScript });
  const tm = { text: t.text, marks: t.marks };
  if (sameText(tm, l.tm)) return said(t.note, 'warn');
  await writeLines([{ line: 0, tm, style: l.style, wordText: l.wordText }], { line: 0, at: t.caret });
  return said('');
}
