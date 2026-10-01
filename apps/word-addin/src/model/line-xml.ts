/**
 * ONE LINE, AS THE ADD-IN WRITES IT — the `<w:p>` that replaces a paragraph.
 *
 * The steps, in the only order that works: the writer's runs
 * (`paragraphsXml`), the paragraph's own style kept (`restyle`), the caret or
 * selection placed as bookmarks on that plain body (`withCaretAt` — its
 * offsets count the writer's runs and nothing else), and last the notes that
 * end its lines put back (`withLineNotes`), where no offset before them moves.
 *
 * One function, because it used to be written out twice — once for a
 * selection and once for the whole document — and the whole-document copy had
 * no notes at all: re-marking a document deleted every note in it. It is also
 * what `check:word:reference` and `check:word:live` measure, so what they
 * measure is what is written.
 */
import type { TextAndMarks } from '@siksamitra/format';
import type { ScriptKey } from '@siksamitra/engine';
import { inTheWay, lineNotes, withLineNotes, type LineNote, type WordRun } from '@siksamitra/interop';
import { WORD_DEVANAGARI } from '@siksamitra/tokens/word';
import { paragraphsXml } from './paragraph.js';
import { restyle } from './opc.js';
import { SELECTION_END_BOOKMARK, withCaretAt, wordOffsetIn } from './caret.js';

export interface LineOut {
  tm: TextAndMarks;
  /** The paragraph's style, kept. */
  style: string | null;
  script: ScriptKey;
  notes: readonly LineNote[];
  /** Where the caret goes back — a MODEL offset — or, with `to`, the selection. */
  caret?: { at: number; to?: number };
}

/**
 * THE PARAGRAPH STYLE A LINE IS WRITTEN IN, for its script: a Devanāgarī line in
 * his `Devanagari` (Sanskrit 2003, 16 pt, `WORD_DEVANAGARI`), and a line leaving
 * Devanāgarī back in the mantra style. Every other line keeps its own.
 */
export function styleForScript(style: string | null, script: ScriptKey): string | null {
  const deva = WORD_DEVANAGARI.paragraph.style;
  if (script === 'deva') return deva;
  return style === deva ? 'Translit' : style;
}

export function lineXml(l: LineOut): string {
  const plain = restyle(paragraphsXml(l.tm, l.script), styleForScript(l.style, l.script));
  if (l.caret === undefined) return withLineNotes(plain, l.notes);
  const offset = (at: number): number => wordOffsetIn(plain, at, l.script);
  const { at, to } = l.caret;
  const ended = to !== undefined && to > at ? withCaretAt(plain, offset(to), SELECTION_END_BOOKMARK) : plain;
  return withLineNotes(withCaretAt(ended, offset(at)), l.notes);
}

/**
 * WHAT IN A LINE A REWRITE WOULD LOSE, in the person's words — empty when the
 * line may be written. The ONE answer, for a selection and for the whole
 * document; they used to be two, and only one of them looked for a note.
 *
 *   - whatever `inTheWay` finds in its OOXML: a picture, a comment, a field;
 *   - a note in his `Comment` style that does not END a line — one that does
 *     is put back (`lineNotes`), and one inside a line cannot be;
 *   - HIDDEN TEXT in an IAST line. His Devī Māhātmyam hides eleven whole
 *     lines, and the reader reads hidden runs as text: writing one back drew
 *     it on the page. A line in an Indic script carries hidden runs of the
 *     add-in's own (`script-runs.ts`), which the reader reads as what they are.
 */
export function blockedIn(raw: string, runs: readonly WordRun[], script: ScriptKey): string[] {
  const { stray } = lineNotes(runs);
  const hidden = script === 'iast' && runs.some((r) => r.hidden === true && r.text.trim() !== '');
  return [
    ...inTheWay(raw),
    ...(stray ? ['a note in the middle of the line'] : []),
    ...(hidden ? ['hidden text — unhide it first, or leave the line as it is'] : []),
  ];
}
