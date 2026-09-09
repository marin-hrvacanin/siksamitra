/**
 * BETWEEN THE DOCUMENT AND THE EDITOR — one file, both directions.
 *
 * Lexical holds a tree of nodes; the document is one text and a list of
 * markings. Something has to move between them, and the whole risk of adopting
 * an editor framework is that this seam becomes a second source of truth. So
 * the two directions live together, and a test runs them against each other:
 * a verse that goes in and comes back changed is a bug here, not in Lexical.
 *
 * THE DOCUMENT IS NEVER LEXICAL'S STATE. Storing an editor's internal model as
 * the file format is v1's fatal mistake — a marking became a CSS-classed span
 * inside Quill's `innerHTML`, "is this holding correct?" became a question
 * about a DOM blob, and marks were produced in four places that could not be
 * reconciled. That is why v2 exists. Lexical is the surface; the document is
 * `text` + `marks`, and this is the only place that knows both.
 */
import { $createParagraphNode, type LexicalNode } from 'lexical';
import { toLines, toRuns, type Run, type RunMarks } from '@siksamitra/render';
import { mark, normalise, type Mark } from '@siksamitra/format';
import { $createMarkedTextNode, $isMarkedTextNode, type MarkedTextNode } from './MarkedText.js';

/** A verse, as the editor holds it. */
export interface VerseText {
  text: string;
  marks: Mark[];
}

/**
 * A verse's paragraphs, one per line.
 *
 * A pāda is a line and a line is a paragraph: Lexical's block model already
 * knows how to put a caret at the start of one, select across two and split
 * one with Enter, and expressing a line as anything else would mean
 * reimplementing that.
 */
export function $paragraphsOf({ text, marks }: VerseText): LexicalNode[] {
  const lines = toLines(toRuns(text, marks));
  return lines.map((line) => {
    const p = $createParagraphNode();
    /* An empty line still needs a paragraph, or the verse loses a pāda. */
    for (const run of line) p.append($createMarkedTextNode(run.text, run.marks));
    return p;
  });
}

/**
 * The point markings, which are not runs and cannot be nodes.
 *
 * A pause sits BETWEEN two letters and has no text of its own. Lexical has no
 * place for a thing with no extent, so these are carried alongside the tree
 * and re-attached by offset when the text comes back. They move with an edit
 * the same way every other marking does — see `shiftForEdit`.
 */
export const pointMarks = (marks: readonly Mark[]): Mark[] =>
  marks.filter((m) => m.from === m.to);

/**
 * The editor's paragraphs, back to a verse.
 *
 * `carried` is the point markings from `pointMarks`: they were never in the
 * tree, so they are put back at the offsets they had, which the caller has
 * already moved across whatever edit happened.
 */
export function $verseOf(paragraphs: readonly LexicalNode[], carried: readonly Mark[] = []): VerseText {
  let text = '';
  const marks: Mark[] = [];

  for (const [i, p] of paragraphs.entries()) {
    if (i > 0) text += '\n';
    const children = 'getChildren' in p && typeof p.getChildren === 'function'
      ? (p.getChildren() as LexicalNode[])
      : [];
    for (const child of children) {
      if (!$isMarkedTextNode(child)) {
        /* Anything that is not one of ours still contributes its text, so a
           paste that arrives as a plain text node is not silently dropped. */
        text += child.getTextContent();
        continue;
      }
      const run = child as MarkedTextNode;
      const at = text.length;
      const body = run.getTextContent();
      text += body;
      marks.push(...marksFor(run.getMarks(), at, text.length));
    }
  }
  return { text, marks: normalise([...marks, ...carried]) };
}

/** One run's flattened marks, back into the markings they came from. */
function marksFor(marks: RunMarks, from: number, to: number): Mark[] {
  if (to <= from) return [];
  const out: Mark[] = [];
  if (marks.hold !== undefined) out.push(mark({ k: 'hold', from, to, v: marks.hold }));
  if (marks.svara !== undefined) out.push(mark({ k: 'svara', from, to, v: marks.svara }));
  if (marks.candra === true) out.push(mark({ k: 'candra', from, to }));
  if (marks.was !== undefined) out.push(mark({ k: 'was', from, to, v: marks.was }));
  if (marks.cj !== undefined) out.push(mark({ k: 'cj', from, to, v: marks.cj }));
  if (marks.sup !== undefined) out.push(mark({ k: 'sup', from, to, v: marks.sup }));
  if (marks.slot !== undefined) out.push(mark({ k: 'slot', from, to, v: marks.slot }));
  if (marks.plain !== undefined) {
    out.push(mark({ k: 'plain', from, to, ...(marks.plain === true ? {} : { v: marks.plain }) }));
  }
  return out;
}

/** The run marks a node should carry after a marking is applied to it. */
export const withMark = (
  marks: RunMarks,
  k: keyof RunMarks,
  v: RunMarks[keyof RunMarks],
): RunMarks => {
  const next = { ...marks };
  if (v === undefined) delete next[k];
  else Object.assign(next, { [k]: v });
  return next;
};

/** Everything the runs of a verse would draw, for a test to compare against. */
export const runsOf = ({ text, marks }: VerseText): Run[] => toRuns(text, marks);
