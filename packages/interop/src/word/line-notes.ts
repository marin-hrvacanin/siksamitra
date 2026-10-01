/**
 * A NOTE AT THE END OF A MANTRA LINE — kept exactly as it was, and put back.
 *
 * His lines carry notes in his `Comment` style after the recitation:
 * `…varaḥ । bramha`, `…aravāvahai । saha is with anudātta!`,
 * `…ṛṣiḥ । svarabhakti`. Measured over the six reference documents: 665 of
 * them, every one at the END of a line — 623 ending the paragraph and 42
 * ending a pāda just before a `<w:br/>` — and none anywhere else. A note is
 * not recited, so the reader leaves it out of the token stream.
 *
 * WHICH MADE EVERY SUCH LINE UNTOUCHABLE. A line is written back whole, and a
 * whole line written without its note deletes the note, so the add-in refused
 * all 665 lines — "carries text the reader cannot place" — on the documents
 * the add-in exists for. Now the note is taken out before the line is decoded
 * and spliced back, run for run, into what the writer produces: the writer
 * never has to know what a note is, and cannot get one wrong.
 *
 * A `Comment` run that is NOT at the end of a line is not a note, and stays a
 * refusal: there is nowhere to put it back that is sure to be the same place.
 */
import { styledRun } from './body-parts.js';
import type { WordRun } from '../docx-read.js';

/** The note that ends one line of a paragraph. */
export interface LineNote {
  /** Which line of the paragraph — `<w:br/>`-separated, from 0. */
  line: number;
  /** The whitespace between the recitation and the note, as it was. */
  lead: string;
  /** The note's runs, in order — its whitespace included. */
  runs: WordRun[];
}

const isNote = (r: WordRun): boolean => r.rStyle === 'Comment';
const blank = (r: WordRun): boolean => r.text.trim() === '' && !r.text.includes('\n');

/**
 * The notes that end the lines of these runs.
 *
 * `stray` is true when a `Comment` run sits anywhere else — inside a line —
 * which this cannot put back, so the caller keeps refusing that line.
 */
export function lineNotes(runs: readonly WordRun[]): { notes: LineNote[]; stray: boolean } {
  const notes: LineNote[] = [];
  let stray = false;
  let line = 0;
  let before = '';
  for (let i = 0; i < runs.length; i += 1) {
    const r = runs[i]!;
    if (!isNote(r)) {
      const nl = r.text.lastIndexOf('\n');
      if (nl >= 0) { line += r.text.split('\n').length - 1; before = r.text.slice(nl + 1); }
      else before += r.text;
      continue;
    }
    /* A note runs to the end of its line: `Comment` runs and the blanks
       between them, up to a newline or the end of the paragraph. */
    let j = i;
    while (j < runs.length && (isNote(runs[j]!) || blank(runs[j]!))) j += 1;
    const next = runs[j];
    if (next !== undefined && !/^\s*\n/.test(next.text)) {
      stray = true;
      i = j - 1;
      continue;
    }
    let end = j;
    while (end > i && blank(runs[end - 1]!)) end -= 1;
    notes.push({ line, lead: /\s*$/.exec(before)![0], runs: runs.slice(i, end) });
    before = '';
    i = j - 1;
  }
  return { notes, stray };
}

const BR = '<w:r><w:br/></w:r>';

/**
 * A paragraph as the writer produced it, with its notes back at the ends of
 * their lines.
 *
 * `xml` is one `<w:p>`; its lines are separated by the writer's own
 * `<w:r><w:br/></w:r>`. A note whose line no longer exists — the text lost a
 * line — goes at the end, so it is moved rather than lost.
 */
export function withLineNotes(xml: string, notes: readonly LineNote[]): string {
  if (notes.length === 0) return xml;
  const close = xml.lastIndexOf('</w:p>');
  if (close < 0) return xml;
  const lines = xml.slice(0, close).split(BR);
  const note = (n: LineNote): string =>
    (n.lead === '' ? '' : styledRun(n.lead, null))
    + n.runs.map((r) => styledRun(r.text, r.rStyle, r.superscript, r.hidden === true)).join('');
  for (const n of notes) {
    const at = Math.min(n.line, lines.length - 1);
    lines[at] += note(n);
  }
  return lines.join(BR) + xml.slice(close);
}
