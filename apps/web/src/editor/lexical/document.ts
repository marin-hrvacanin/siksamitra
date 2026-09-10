/**
 * A WHOLE DOCUMENT, BETWEEN THE FILE AND THE EDITOR.
 *
 * `bridge.ts` does one verse and `section.ts` does one section's verses. This
 * does everything else a document holds — the part headings, the section
 * headings, the instructions, the translations, the source lines and the
 * pictures — so that the editor's tree is the DOCUMENT rather than the parts
 * of it that happen to be text.
 *
 * WHY THAT IS NECESSARY AND NOT AMBITIOUS. `DocumentBlocks` already learned
 * this lesson once: it drew headings and verses and nothing else, and a page
 * of Durgā Sūktam dropped all eighteen translations on the floor while a page
 * of the pūjā manual dropped 212 instructions and 54 part headings. An editor
 * whose tree holds only the verses would put the caret at the end of a verse
 * and have nowhere for the next heading to be — so Enter there either invents
 * a verse or does nothing, and both are wrong.
 *
 * THE ORDER IS THE DOCUMENT'S, AND IT IS NOT RESTATED HERE. `itemsOf` gives a
 * section's contents in the format's canonical order and `blockId` names them;
 * both come from `views/blocks.ts`, which the page map, the navigation outline
 * and the exporter already read. The tree's order therefore IS the drawn
 * order, by construction rather than by agreement, and the block ids in the
 * tree are the ids the page map knows.
 *
 * THE DOCUMENT IS NEVER LEXICAL'S STATE. Storing an editor's internal model as
 * the file format is v1's fatal mistake. Lexical is the surface; the document
 * is `text` + `marks` and its own fields; this, `bridge.ts` and `section.ts`
 * are the only places that know both.
 */
import { $getRoot, $isDecoratorNode, type LexicalNode } from 'lexical';
import {
  figureItem, figureLibrary, toTextAndMarks,
  type ChantDoc, type ChantItem, type ChantSection, type Mark,
} from '@siksamitra/format';
import { blockId, headingOf, itemsOf, sourceOf } from '../../views/blocks.js';
import { $paragraphsOf, $verseOf, pointMarks } from './bridge.js';
import { $createPadaNode, $createVerseNode, $isVerseNode, type VerseNode } from './blocks.js';
import { $createDrawnBlockNode, type Drawn } from './DrawnBlock.jsx';

/** One verse as the editor holds it, with the id the document gave it. */
export interface VerseIn {
  readonly id: string;
  readonly text: string;
  readonly marks: readonly Mark[];
}

/**
 * A document, flattened into what the editor puts in its tree.
 *
 * Verses and drawn blocks in ONE list, because their ORDER is the thing that
 * matters and two lists cannot express it. A verse's own trailing matter — its
 * translation, its instructions, its source, its pictures — stays attached to
 * the verse, because on the page it is drawn INSIDE `.verse` and the page map
 * measures the two together.
 */
export type DocBlock =
  | { readonly t: 'verse'; readonly verse: VerseIn; readonly trailing: readonly Drawn[] }
  | { readonly t: 'drawn'; readonly drawn: Drawn };

/** The words of an instruction, or nothing when it has none. */
const instructionText = (item: Extract<ChantItem, { t: 'instruction' }>): string =>
  item.instruction.text.en ?? '';

/** What a verse carries UNDER its lines, in the order the renderer draws it. */
function trailingOf(
  verse: Extract<ChantItem, { t: 'verse' }>,
  section: ChantSection,
): Drawn[] {
  const out: Drawn[] = [];
  const id = blockId.verse(section.id, verse.id);
  (verse.instructions ?? []).forEach((ins, k) => {
    out.push({ kind: 'instruction', blockId: `${id}:i${k}`, text: ins.text.en ?? '' });
  });
  if (verse.translation !== undefined) {
    out.push({ kind: 'translation', blockId: `${id}:t`, text: verse.translation.en ?? '' });
  }
  if (verse.source !== undefined && verse.source !== '') {
    out.push({ kind: 'source', blockId: `${id}:c`, text: verse.source });
  }
  (verse.figures ?? []).forEach((figure, k) => {
    out.push({ kind: 'figure', blockId: `${id}:f${k}`, figure });
  });
  return out;
}

/**
 * Everything a document holds, in one flat list, in the drawn order.
 *
 * A PART HEADING IS DRAWN WHERE THE PART CHANGES — it names a run of steps,
 * not a step, so repeating it above each one would be noise. That rule lives
 * in `DocumentBlocks` and in `blockRefs`, and it has to be the same rule here
 * or the editor's tree and the page's blocks disagree about how many there
 * are.
 */
export function docBlocksOf(doc: ChantDoc): DocBlock[] {
  const library = figureLibrary(doc);
  const out: DocBlock[] = [];
  let part: string | undefined;

  for (const section of doc.sections) {
    if (section.part === undefined) part = undefined;
    else if (section.part !== part) {
      out.push({
        t: 'drawn',
        drawn: { kind: 'part', blockId: blockId.part(section.id), text: section.part },
      });
      part = section.part;
    }
    const heading = headingOf(section);
    if (heading !== undefined) {
      out.push({
        t: 'drawn',
        drawn: { kind: 'heading', blockId: blockId.heading(section.id), text: heading },
      });
    }

    itemsOf(section).forEach((item, at) => {
      if (item.t === 'verse') {
        const { text, marks } = toTextAndMarks(item);
        out.push({
          t: 'verse',
          verse: { id: item.id, text, marks },
          trailing: trailingOf(item, section),
        });
        return;
      }
      if (item.t === 'instruction') {
        out.push({
          t: 'drawn',
          drawn: {
            kind: 'instruction',
            blockId: blockId.instruction(section.id, at),
            text: instructionText(item),
          },
        });
        return;
      }
      if (item.t === 'figure') {
        const read = figureItem(item, library);
        out.push({
          t: 'drawn',
          drawn: {
            kind: 'figure',
            blockId: blockId.figure(section.id, at),
            ...(read.figure === undefined
              ? { missingRef: read.missingRef }
              : { figure: read.figure }),
          },
        });
      }
      /* An `embed` is declared in the format and carried through the file
         untouched; nothing draws one yet, so nothing here holds a place for
         one either. Named rather than silently skipped — see
         `DocumentBlocks`. */
    });

    const source = sourceOf(section);
    if (source !== undefined) {
      out.push({
        t: 'drawn',
        drawn: { kind: 'source', blockId: blockId.source(section.id), text: source },
      });
    }
  }
  return out;
}

/**
 * Fill the editor's root with a document.
 *
 * Called inside `editor.update`. Every verse becomes a `VerseNode` of
 * `PadaNode`s of runs, with its trailing matter as isolated decorators INSIDE
 * it — which is where `DocumentBlocks` draws them and how the page map
 * measures them.
 */
export function $writeDocument(blocks: readonly DocBlock[]): void {
  const root = $getRoot();
  root.clear();
  for (const block of blocks) {
    if (block.t === 'drawn') {
      root.append($createDrawnBlockNode(block.drawn));
      continue;
    }
    const node = $createVerseNode(block.verse.id);
    for (const paragraph of $paragraphsOf({
      text: block.verse.text, marks: [...block.verse.marks],
    })) {
      const pada = $createPadaNode();
      for (const child of (paragraph as { getChildren?: () => LexicalNode[] })
        .getChildren?.() ?? []) {
        pada.append(child);
      }
      node.append(pada);
    }
    /* A verse with no text at all still needs a line to put a caret on. */
    if (node.getChildrenSize() === 0) node.append($createPadaNode());
    for (const drawn of block.trailing) node.append($createDrawnBlockNode(drawn));
    root.append(node);
  }
}

/**
 * The editor's tree, back to what went in.
 *
 * WHAT COMES BACK AND WHAT DOES NOT. The verses come back as text and
 * markings, because that is what a keystroke changes. A drawn block comes back
 * as the block it was: nothing in the tree can change one — they are isolated
 * decorators — so reading them is only a way of proving the ORDER survived,
 * which is the thing an editor is most likely to get wrong.
 *
 * A PARAGRAPH THAT IS NOT IN A VERSE is text somebody typed past the end of
 * the last one. `VerseNode.insertNewAfter` deliberately makes a plain
 * paragraph rather than minting a verse id, because deciding identity is the
 * DOCUMENT's business. It comes back as a verse with no id and the caller
 * gives it one.
 */
export function $readDocument(
  carried: Readonly<Record<string, readonly Mark[]>> = {},
): DocBlock[] {
  const out: DocBlock[] = [];
  for (const child of $getRoot().getChildren()) {
    if ($isVerseNode(child)) {
      const verse = child as VerseNode;
      const id = verse.getVerseId();
      /* The pādas are the lines; a decorator among them is the verse's own
         trailing matter and contributes NO text — without this the translation
         would be read back as another line of the mantra. */
      const kids = verse.getChildren();
      const lines = kids.filter((k) => !$isDecoratorNode(k));
      const trailing = kids
        .filter((k): k is LexicalNode => $isDecoratorNode(k))
        .map((k) => (k as unknown as { getBlock: () => Drawn }).getBlock());
      const read = $verseOf(lines, carried[id] ?? []);
      out.push({ t: 'verse', verse: { id, text: read.text, marks: read.marks }, trailing });
      continue;
    }
    if ($isDecoratorNode(child)) {
      out.push({ t: 'drawn', drawn: (child as unknown as { getBlock: () => Drawn }).getBlock() });
      continue;
    }
    /* A stray block: one paragraph, one verse, no id yet. */
    const read = $verseOf([child], []);
    if (read.text !== '') {
      out.push({ t: 'verse', verse: { id: '', text: read.text, marks: read.marks }, trailing: [] });
    }
  }
  return out;
}

/** The point markings of every verse, by id — what `$readDocument` needs back. */
export function pointMarksIn(blocks: readonly DocBlock[]): Record<string, readonly Mark[]> {
  const out: Record<string, readonly Mark[]> = {};
  for (const block of blocks) {
    if (block.t === 'verse') out[block.verse.id] = pointMarks(block.verse.marks);
  }
  return out;
}
