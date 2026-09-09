/**
 * THE ONLY FILE THAT TALKS TO WORD.
 *
 * Everything above it is pure and tested; everything Office.js can be wrong
 * about is here, in four functions, so what cannot be checked without a copy of
 * Word running is as small as it can be made.
 *
 * THE UNIT OF WORK IS A PARAGRAPH, and the transaction is read-modify-replace:
 *
 *   `Paragraph.getOoxml()`  →  the runs  →  text and markings
 *   the command             →  new markings
 *   text and markings       →  the runs  →  `Paragraph.insertOoxml(…, replace)`
 *
 * WHY NOT SET THE STYLE ON THE SELECTION. `Range.style = 'Holding'` is one line
 * and it is what a person does by hand, and it is not enough: a svara is a
 * combining character written in a run of its own, a raised reading aid is a
 * superscript run after the letter, and a holding that grew or shrank has to
 * re-cut the runs around it. One writer for all of them, and it is
 * `documentXml`.
 *
 * WHY NOT THE BORDER API. `Word.Font.borders` would draw the box directly, and
 * it is `WordApiDesktop 1.3` — Windows 2507, Mac 16.99.2, and nothing on the
 * web or on iPad. `getOoxml`/`insertOoxml` are `WordApi 1.1`, which is every
 * platform Word runs on. See `../model/opc.ts`.
 *
 * REQUIREMENT SET: `WordApi 1.3`, for `Range.expandTo` and `Range.getRange`,
 * which is what measures where the selection starts. That is Word 2019 on the
 * desktop, Word on the web, and Word for Mac 15.32.
 *
 * NONE OF THIS IS TESTED. There is no headless Word, and `office-addin-mock`
 * does not mock collections — `paragraphs` is one. Every function here is a
 * thin call sequence over logic that IS tested; if one of them is wrong it is
 * wrong in the call, not in the marking.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { stylesXml } from '@siksamitra/interop';
import type { ExportStyle } from '@siksamitra/tokens/export-styles';
import { documentThemeOf, exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';
import { documentPartOf, flatPackage, restyle } from '../model/opc.js';
import { decodeRuns, isVerseParagraph, paragraphsXml, unresolvedIn } from '../model/paragraph.js';
import type { Unaccounted } from '../model/paragraph.js';
import { offsetMap, modelRange, type OffsetMap } from '../model/offsets.js';
import { mergeRuns, readParagraphs } from '@siksamitra/interop';

/** The paragraph the caret is in, as the model sees it. */
export interface Located {
  tm: TextAndMarks;
  map: OffsetMap;
  /** The selection, in model offsets. Equal when the caret is a caret. */
  from: number;
  to: number;
  /** The paragraph's own style, kept when it is written back. */
  style: string | null;
  /** Is this a mantra line, or something the add-in is about to make one? */
  isVerse: boolean;
  /** What the reader could not account for. A `lossy` one refuses a write. */
  unresolved: Unaccounted[];
}

/**
 * The style sheet every insertion carries.
 *
 * `veda-union` is his own document, and `stylesXml` is the `.docx` exporter's
 * own generator — so a box drawn by the add-in is the box the exporter prints
 * and the page shows, to the eighth of a point. Built once: it is 8 kB of XML
 * and it does not depend on the paragraph.
 */
let sheet: string | null = null;
export function styleSheet(style: ExportStyle = exportStyle('veda-union')): string {
  if (sheet === null) {
    const stacks = styleStacks(style);
    sheet = stylesXml({
      theme: documentThemeOf(style),
      mode: style.mode,
      textStack: stacks.text,
      uiStack: stacks.ui,
    });
  }
  return sheet;
}

/**
 * Where the selection is, and what the paragraph around it says.
 *
 * `expandTo` from the paragraph's start to the selection's start measures the
 * characters before it, which is the only way Word will say how far in a
 * selection begins. Those are WORD characters; `offsetMap` turns them into
 * model offsets, and the difference is one per accent.
 */
export async function locate(): Promise<Located> {
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    const paragraph = selection.paragraphs.getFirst();
    const before = paragraph.getRange('Start').expandTo(selection.getRange('Start'));
    before.load('text');
    selection.load('text');
    paragraph.load('style');
    const ooxml = paragraph.getOoxml();
    await context.sync();

    const [read] = readParagraphs(documentPartOf(ooxml.value));
    if (read === undefined) throw new Error('Word returned a paragraph with no content');
    const runs = mergeRuns(read.runs);
    const tm = decodeRuns(runs);
    const map = offsetMap(runs);
    const start = before.text.length;
    const [from, to] = modelRange(map, start, start + selection.text.length);
    return {
      tm,
      map,
      from,
      to,
      style: read.pStyle,
      isVerse: isVerseParagraph(read),
      unresolved: unresolvedIn([read]),
    };
  });
}

/**
 * Put a paragraph back.
 *
 * The whole paragraph, replaced. A narrower write is not available: a marking
 * can change where the runs are cut anywhere in the line — a holding that now
 * covers two letters instead of one, a substitution that turned a letter blue —
 * and `insertOoxml` over a partial range is documented for a range, not for a
 * splice into the middle of a paragraph.
 *
 * WHAT THIS COSTS. A comment, a bookmark or a tracked change inside the
 * paragraph does not survive the replacement, and the caret lands at the end of
 * it. Both are worth saying in the pane rather than discovering.
 */
export async function writeParagraph(tm: TextAndMarks, style: string | null): Promise<void> {
  const body = restyle(paragraphsXml(tm), style);
  await Word.run(async (context) => {
    const paragraph = context.document.getSelection().paragraphs.getFirst();
    paragraph.insertOoxml(flatPackage(body, styleSheet()), Word.InsertLocation.replace);
    await context.sync();
  });
}

/** One paragraph of the document, addressed by index — for a whole-document run. */
export interface DocParagraph {
  index: number;
  tm: TextAndMarks;
  style: string | null;
}

/**
 * Every mantra paragraph in the document.
 *
 * Read in ONE `getOoxml` over the body rather than one per paragraph. A
 * document of 434 mantra lines is 434 round trips otherwise, and Office.js
 * round trips are what make an add-in feel broken — the reports of `sync`
 * taking tens of seconds are all of this shape.
 */
export async function readDocument(): Promise<DocParagraph[]> {
  return Word.run(async (context) => {
    const ooxml = context.document.body.getOoxml();
    await context.sync();
    const out: DocParagraph[] = [];
    readParagraphs(documentPartOf(ooxml.value)).forEach((p, index) => {
      if (!isVerseParagraph(p)) return;
      out.push({ index, tm: decodeRuns(mergeRuns(p.runs)), style: p.pStyle });
    });
    return out;
  });
}

/**
 * Write a run of paragraphs back, by index.
 *
 * `Body.paragraphs` is loaded once and indexed, so the mapping from the OOXML
 * read above to the live paragraphs holds only while the document is not edited
 * underneath us — which is the same assumption every Office add-in makes
 * between two syncs.
 */
export async function writeDocument(changed: readonly DocParagraph[]): Promise<number> {
  if (changed.length === 0) return 0;
  const sheetXml = styleSheet();
  return Word.run(async (context) => {
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load('items');
    await context.sync();
    for (const one of changed) {
      const target = paragraphs.items[one.index];
      if (target === undefined) continue;
      const body = restyle(paragraphsXml(one.tm), one.style);
      target.insertOoxml(flatPackage(body, sheetXml), Word.InsertLocation.replace);
    }
    await context.sync();
    return changed.length;
  });
}
