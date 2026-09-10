/**
 * A SECTION, BETWEEN THE DOCUMENT AND THE EDITOR — one file, both directions.
 *
 * `bridge.ts` does one verse. This does the unit the caret is bounded by: a
 * section is the caret's own extent (`packages/edit/src/caret.ts`), so it is
 * the natural extent of one editor.
 *
 * WHY NOT THE WHOLE DOCUMENT, and why not one editor per verse. One editor per
 * verse cannot let Enter at a verse's end make the next verse, and cannot hold
 * a selection across two — so the coordination it removes from Lexical comes
 * straight back as our own. The whole document in one editor is where this is
 * going, and the section is the step that does not also require the headings,
 * the instructions and the pictures to become nodes on the same day.
 *
 * THE DOCUMENT IS NEVER LEXICAL'S STATE. Storing an editor's internal model as
 * the file format is v1's fatal mistake — a marking became a CSS-classed span
 * inside Quill's `innerHTML`, and marks were produced in four places that
 * could not be reconciled. Lexical is the surface; the document is `text` +
 * `marks`; this and `bridge.ts` are the only places that know both.
 */
import { $getRoot, type LexicalNode } from 'lexical';
import { toTextAndMarks, type ChantSection, type Mark } from '@siksamitra/format';
import { $paragraphsOf, $verseOf, pointMarks, type VerseText } from './bridge.js';
import { $createPadaNode, $createVerseNode, $isVerseNode, type VerseNode } from './blocks.js';

/** A verse as it goes in, and what has to come back out with it. */
export interface SectionText {
  /** In order. The order is the document's — `items` decides it, not `verses`. */
  readonly verses: readonly { id: string; text: string; marks: readonly Mark[] }[];
}

/** A section's verses, as the editor takes them. */
export function sectionTextOf(section: ChantSection): SectionText {
  return {
    verses: section.verses.map((v) => {
      const { text, marks } = toTextAndMarks(v);
      return { id: v.id, text, marks };
    }),
  };
}

/**
 * Fill the editor's root with a section.
 *
 * Called inside `editor.update`. The paragraphs `bridge.ts` builds are wrapped
 * in a `PadaNode` each and those in a `VerseNode` — so the tree carries the
 * verse ids, which is what a recording, a translation and an audio segment are
 * keyed on and what the caret reports in the status bar.
 */
export function $writeSection(section: SectionText): void {
  const root = $getRoot();
  root.clear();
  for (const verse of section.verses) {
    const node = $createVerseNode(verse.id);
    for (const paragraph of $paragraphsOf({ text: verse.text, marks: [...verse.marks] })) {
      const pada = $createPadaNode();
      /* `$paragraphsOf` returns a paragraph per line; its children are the
         runs, and the pāda is what actually holds them. */
      for (const child of (paragraph as { getChildren?: () => LexicalNode[] })
        .getChildren?.() ?? []) {
        pada.append(child);
      }
      node.append(pada);
    }
    /* A verse with no text at all still needs a line to put a caret on. */
    if (node.getChildrenSize() === 0) node.append($createPadaNode());
    root.append(node);
  }
}

/**
 * The editor's tree, back to a section's verses.
 *
 * `carried` is the point markings per verse — a pause sits BETWEEN two letters
 * and has no extent, so Lexical has no place for it and it travels alongside.
 * See `pointMarks`.
 *
 * A PARAGRAPH THAT IS NOT IN A VERSE is text somebody typed past the end of
 * the last one — `VerseNode.insertNewAfter` deliberately makes a plain
 * paragraph rather than minting a verse id, because deciding identity is the
 * DOCUMENT's business (`replaceRange` decides it from the edit's range, and a
 * recording is keyed on it). It comes back as an extra verse with no id, and
 * the caller gives it one.
 */
export function $readSection(
  carried: Readonly<Record<string, readonly Mark[]>> = {},
): { verses: { id: string | null; text: string; marks: Mark[] }[] } {
  const out: { id: string | null; text: string; marks: Mark[] }[] = [];
  for (const child of $getRoot().getChildren()) {
    if ($isVerseNode(child)) {
      const verse = child as VerseNode;
      const id = verse.getVerseId();
      const read = $verseOf(verse.getChildren(), carried[id] ?? []);
      out.push({ id, text: read.text, marks: read.marks });
      continue;
    }
    /* A stray block: one paragraph, one verse, no id yet. */
    const read = $verseOf([child], []);
    if (read.text !== '') out.push({ id: null, text: read.text, marks: read.marks });
  }
  return { verses: out };
}

/** The point markings of a section, by verse — what `$readSection` needs back. */
export function pointMarksOf(section: SectionText): Record<string, readonly Mark[]> {
  const out: Record<string, readonly Mark[]> = {};
  for (const verse of section.verses) out[verse.id] = pointMarks(verse.marks);
  return out;
}

/** One verse, as `bridge.ts` takes it. Kept so a test can go straight there. */
export const verseTextOf = (
  verse: { text: string; marks: readonly Mark[] },
): VerseText => ({ text: verse.text, marks: [...verse.marks] });
