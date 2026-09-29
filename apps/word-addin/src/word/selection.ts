/**
 * THE SELECTION — every line it touches, read and written back as one.
 *
 * A selection is not one paragraph. A person selects three mantra lines and
 * presses Short, or selects a whole section and runs the rules over it, and
 * both have to mean what they would in Word: bold over three lines bolds three
 * lines. So the selection is read as a list of LINES, each with the part of it
 * that is selected, and written back in one batch.
 *
 * LARGE SELECTIONS. The reads and the writes are queued in chunks and synced
 * once per chunk, not once per line — Office.js round trips are what make an
 * add-in feel broken — and not all at once either, because Word on the web
 * refuses a request over a few megabytes. `CHUNK` lines per sync.
 *
 * Split from `client.ts` at the 400-line module gate; the document-wide read
 * and write stay there.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { inTheWay, mergeRuns, paragraphXml, readParagraphs } from '@siksamitra/interop';
import { styleSheetFor } from '../model/sheet.js';
import { documentPartOf, restyle } from '../model/opc.js';
import { decodeRuns, isVerseParagraph, paragraphsXml, unresolvedIn } from '../model/paragraph.js';
import type { Unaccounted } from '../model/paragraph.js';
import { offsetMap, modelRange, type OffsetMap } from '../model/offsets.js';
import { learn, packageOf } from './client.js';
import { CARET_BOOKMARK, withCaretAt, wordOffsetIn } from '../model/caret.js';

/** Lines queued per `context.sync()`. */
const CHUNK = 40;

/** One line the selection touches, as the model sees it. */
export interface Line {
  tm: TextAndMarks;
  map: OffsetMap;
  /** The selected part of this line, in model offsets. Equal for a caret. */
  from: number;
  to: number;
  /** The paragraph's own style, kept when it is written back. */
  style: string | null;
  /** Is this a mantra line, or something the add-in is about to make one? */
  isVerse: boolean;
  /** What the reader could not account for. A `lossy` one refuses a write. */
  unresolved: Unaccounted[];
  /** What a rewrite would lose — a picture, a comment. Any refuses a write. */
  blocked: string[];
  /** The paragraph's text as Word reported it, to check the write against. */
  wordText: string;
}

/** The selection: the first line's fields, for everything that shows one, and
 *  every line in `lines`, the first included. */
export interface Located extends Line {
  lines: Line[];
}

/**
 * THE LINE CHANGED UNDERNEATH US. Word on the web is co-authored, so between
 * the read a command was computed on and the write, somebody may have typed
 * into the line; writing then would undo their typing.
 */
export class LineChanged extends Error {
  constructor() {
    super('this line changed while it was being marked — nothing was written. Press again.');
  }
}

/**
 * Where the selection is, and what each line it touches says.
 *
 * `expandTo` from a paragraph's start to the selection's start (or end)
 * measures the characters before it, which is the only way Word will say how
 * far in a selection begins. Those are WORD characters; `offsetMap` turns them
 * into model offsets, and the difference is one per accent.
 */
export async function locate(): Promise<Located> {
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    const paragraphs = selection.paragraphs;
    paragraphs.load('items/style,items/text');
    await context.sync();
    const items = paragraphs.items;
    if (items.length === 0) throw new Error('Word returned a selection with no paragraph');
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const before = first.getRange('Start').expandTo(selection.getRange('Start'));
    const upto = last.getRange('Start').expandTo(selection.getRange('End'));
    before.load('text');
    upto.load('text');

    const lines: Line[] = [];
    for (let at = 0; at < items.length; at += CHUNK) {
      const chunk = items.slice(at, at + CHUNK);
      const xml = chunk.map((p) => p.getOoxml());
      await context.sync();
      chunk.forEach((p, i) => {
        const n = at + i;
        const ooxml = xml[i]!.value;
        learn(ooxml);
        const part = documentPartOf(ooxml);
        const [read] = readParagraphs(part, ooxml);
        if (read === undefined) throw new Error('Word returned a paragraph with no content');
        const runs = mergeRuns(read.runs);
        const map = offsetMap(runs);
        const start = n === 0 ? before.text.length : 0;
        const end = n === items.length - 1 ? upto.text.length : p.text.length;
        const [from, to] = modelRange(map, start, Math.max(start, end));
        lines.push({
          tm: decodeRuns(runs),
          map,
          from,
          to,
          style: read.pStyle,
          isVerse: isVerseParagraph(read),
          unresolved: unresolvedIn([read]),
          blocked: inTheWay(paragraphXml(part).join('')),
          wordText: p.text,
        });
      });
    }
    return { ...lines[0]!, lines };
  });
}

/** A line to put back: which line of the selection, and what it now holds. */
export interface LineWrite {
  /** Its index in `Located.lines`. */
  line: number;
  tm: TextAndMarks;
  style: string | null;
  wordText: string;
}

/**
 * Put lines of the selection back.
 *
 * The whole paragraph's CONTENT, replaced — never the paragraph: replacing the
 * mark too made Word coalesce it with an empty paragraph after it, and a
 * document lost a line (measured in `tools/word-live.mjs`, 872 paragraphs
 * became 871). A narrower write is not available: a marking can change where
 * the runs are cut anywhere in the line.
 *
 * EVERY LINE IS CHECKED BEFORE ANY IS WRITTEN. If one has changed since it was
 * read, nothing is written — half a press is worse than none. After a write
 * over several lines they are selected again, so a second press lands on the
 * same lines.
 *
 * `styleSheetFor(body)` and never the plain sheet: the sheet has to define
 * every style the body NAMES, or Word drops it — which once spliced every
 * raised reading aid into the recitation. See `model/sheet.ts`.
 */
export async function writeLines(
  writes: readonly LineWrite[],
  /** Put the caret back here — a line of the selection, and a MODEL offset. */
  caret?: { line: number; at: number },
): Promise<number> {
  if (writes.length === 0) return 0;
  /* A caret needs `getBookmarkRangeOrNullObject`, WordApi 1.4; without it the
     caret stays where Word leaves it, at the end of the line. */
  const canPlace = caret !== undefined && Office.context.requirements.isSetSupported('WordApi', '1.4');
  await Word.run(async (context) => {
    const paragraphs = context.document.getSelection().paragraphs;
    paragraphs.load('items/text');
    await context.sync();
    const items = paragraphs.items;
    for (const w of writes) {
      if (items[w.line]?.text !== w.wordText) throw new LineChanged();
    }
    for (let at = 0; at < writes.length; at += CHUNK) {
      for (const w of writes.slice(at, at + CHUNK)) {
        const plain = restyle(paragraphsXml(w.tm), w.style);
        const body = canPlace && caret!.line === w.line ? withCaretAt(plain, wordOffsetIn(plain, caret!.at)) : plain;
        items[w.line]!.getRange(Word.RangeLocation.content)
          .insertOoxml(packageOf(body, styleSheetFor(body)), Word.InsertLocation.replace);
      }
      await context.sync();
    }
    if (canPlace) {
      const mark = context.document.getBookmarkRangeOrNullObject(CARET_BOOKMARK);
      mark.load('isNullObject');
      await context.sync();
      if (!mark.isNullObject) {
        mark.select();
        context.document.deleteBookmark(CARET_BOOKMARK);
        await context.sync();
      }
    } else if (items.length > 1) {
      items[0]!.getRange('Start').expandTo(items[items.length - 1]!.getRange('End')).select();
      await context.sync();
    }
  });
  return writes.length;
}
