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
 * WHAT TESTS THIS. There is no headless Word and `office-addin-mock` does not
 * mock collections — `paragraphs` is one — so none of these functions can be
 * unit-tested. `npm run check:word:live` measures them against a REAL Word
 * over COM instead: `Range.InsertXML` and `Range.WordOpenXML` are the same two
 * operations as `insertOoxml` and `getOoxml`, over the same flat OPC package,
 * so what Word does there is what Word does here. Three things it established
 * that the documentation does not say:
 *
 *   - `getOoxml` DOES return `/word/styles.xml`, which is how `documentStyles`
 *     below can tell a prepared document from a fresh one.
 *   - a style definition that arrives with an insertion SURVIVES the inserted
 *     text being deleted again. That is what lets `addStyles` put the whole
 *     vocabulary in and leave no visible trace.
 *   - a fresh document declares none of the seventeen.
 *
 * Everything above this file is pure and tested in the fast tier.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { styleSheet, styleSheetFor } from '../model/sheet.js';
import { missingStyles, specimenBody, styleIds } from '../model/setup.js';
import { specimenMarks } from '../model/specimen-text.js';
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
 *
 * THE RANGE IS THE PARAGRAPH'S CONTENT, NOT THE PARAGRAPH.
 * `Paragraph.getRange('Content')` ends BEFORE the paragraph mark;
 * `paragraph.insertOoxml(…, replace)` replaces the mark as well, and when the
 * NEXT paragraph was empty Word coalesced the two and the document lost a
 * paragraph. Measured against his own file in `tools/word-live.mjs`: writing
 * twelve mantra lines took 872 paragraphs to 871, and from that write onwards
 * every index was off by one — so `writeDocument` below, which addresses
 * paragraphs BY INDEX, was writing mantras into the wrong lines. Replacing the
 * content alone holds all twelve writes at 872, byte for byte. `WordApi 1.3`,
 * which the manifest already requires.
 */
export async function writeParagraph(tm: TextAndMarks, style: string | null): Promise<void> {
  const body = restyle(paragraphsXml(tm), style);
  /* `styleSheetFor(body)` and never `styleSheet()`: the sheet has to define
     every style the body NAMES. Sending the plain one omitted `Reference` and
     Word silently dropped the style, which spliced every raised reading aid
     into the recitation. See `model/sheet.ts`. */
  const pkg = flatPackage(body, styleSheetFor(body));
  await Word.run(async (context) => {
    const paragraph = context.document.getSelection().paragraphs.getFirst();
    paragraph.getRange(Word.RangeLocation.content).insertOoxml(pkg, Word.InsertLocation.replace);
    await context.sync();
  });
}

/** One paragraph of the document, addressed by index — for a whole-document run. */
export interface DocParagraph {
  index: number;
  tm: TextAndMarks;
  style: string | null;
}

/** What one read of the whole document saw. */
export interface DocumentRead {
  /** The mantra paragraphs, addressed by their index among ALL paragraphs. */
  readonly lines: readonly DocParagraph[];
  /**
   * How many paragraphs there are ALTOGETHER, so the write can check.
   *
   * The indices above come from this read and are used against a DIFFERENT
   * one, and the two readers are not the same code: ours is a regex over
   * OOXML, Word's is Word. They disagreed by 26 on the owner's own file —
   * `<w:p w14:paraId="…"/>`, an empty self-closing paragraph, was swallowed
   * together with the paragraph after it — and 27 of his 872 paragraphs are
   * that shape. Every index from the first one onwards was wrong.
   */
  readonly total: number;
}

/**
 * Every mantra paragraph in the document.
 *
 * Read in ONE `getOoxml` over the body rather than one per paragraph. A
 * document of 434 mantra lines is 434 round trips otherwise, and Office.js
 * round trips are what make an add-in feel broken — the reports of `sync`
 * taking tens of seconds are all of this shape.
 */
export async function readDocument(): Promise<DocumentRead> {
  return Word.run(async (context) => {
    const ooxml = context.document.body.getOoxml();
    await context.sync();
    const all = readParagraphs(documentPartOf(ooxml.value));
    const lines: DocParagraph[] = [];
    all.forEach((p, index) => {
      if (!isVerseParagraph(p)) return;
      lines.push({ index, tm: decodeRuns(mergeRuns(p.runs)), style: p.pStyle });
    });
    return { lines, total: all.length };
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
export async function writeDocument(
  changed: readonly DocParagraph[], total: number,
): Promise<number> {
  if (changed.length === 0) return 0;
  return Word.run(async (context) => {
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load('items');
    await context.sync();
    /*
     * THE TWO READS MUST AGREE, and this refuses rather than guesses.
     *
     * `changed` carries indices from a `getOoxml` read; the paragraphs here
     * are Word's own list. If the counts differ, one index is wrong and so is
     * every index after it — which means writing a mantra into somebody's
     * heading. That happened: our reader answered 846 where Word answered 872,
     * because it swallowed each empty self-closing paragraph together with the
     * one after it. Fixed in `docx-read.ts`, and checked here because a
     * silent mismatch costs a document and a message costs nothing.
     */
    if (paragraphs.items.length !== total) {
      throw new Error(`the document changed while it was being read — `
        + `${total} paragraphs became ${paragraphs.items.length}. `
        + 'Nothing was written. Try again.');
    }
    for (const one of changed) {
      const target = paragraphs.items[one.index];
      if (target === undefined) continue;
      const body = restyle(paragraphsXml(one.tm), one.style);
      /* Per body, for the reason in `model/sheet.ts` — and cached on the set
         of styles a body names, so 434 paragraphs build a handful of sheets. */
      target.getRange(Word.RangeLocation.content)
        .insertOoxml(flatPackage(body, styleSheetFor(body)), Word.InsertLocation.replace);
    }
    await context.sync();
    return changed.length;
  });
}

/* ── preparing a document ─────────────────────────────────────────────────
 *
 * A marking IS a style in Word, and a blank document has none of ours. Every
 * insertion carries the style sheet, so the buttons work in a fresh document
 * anyway — but the person cannot APPLY a holding themselves, cannot restyle
 * one, and cannot see what the vocabulary is. See `model/setup.ts`.
 */

/** What the open document has of the add-in's vocabulary. */
export interface DocStyles {
  /** Style ids the document has not got. Empty means it is ready. */
  readonly missing: readonly string[];
  /** How many the add-in knows about, `Normal` included. */
  readonly total: number;
}

/**
 * Which of our styles this document is missing.
 *
 * `Body.getOoxml()` returns the whole flat package, `/word/styles.xml`
 * included — which is the document's own style table, not a copy of ours. So
 * this is a real answer and not a guess: a document prepared once reports
 * nothing missing forever, and one the add-in has never touched reports all
 * of them.
 */
export async function documentStyles(): Promise<DocStyles> {
  const sheet = styleSheet();
  return Word.run(async (context) => {
    const ooxml = context.document.body.getOoxml();
    await context.sync();
    return {
      missing: missingStyles(ooxml.value, sheet),
      total: styleIds(sheet).filter((x) => x.id !== 'Normal').length,
    };
  });
}

/**
 * Put the vocabulary into the document.
 *
 * `keep` leaves the specimen where a person can read it; without it the block
 * is inserted and then deleted again, and the styles stay behind. That the
 * styles stay is not an assumption — it is measured against a real Word in
 * `tools/word-live.mjs`, because Word is documented to merge the styles an
 * insertion USES and says nothing about what happens when the use goes away.
 *
 * WHY THE PARAGRAPHS ARE COUNTED RATHER THAN THE RANGE KEPT. `insertOoxml`
 * answers with a range, and a range over content that has just been rewritten
 * by the host is not something to hand back to the host and ask it to delete.
 * The count before and after is unambiguous.
 */
export async function addStyles(keep: boolean): Promise<void> {
  /* THE SPECIMEN CARRIES THE PLAIN SHEET, deliberately: what it demonstrates
     is the vocabulary a person can apply BY HAND, which is his seventeen and
     not the three that are ours. `styleSheetFor` would add `Reference` the
     moment the marked line in the specimen grew a raised aid, and put a style
     in their Styles pane named after nothing on their page. */
  const sheet = styleSheet();
  const body = specimenBody(sheet, paragraphsXml(specimenMarks()));
  const pkg = flatPackage(body, sheet);
  await Word.run(async (context) => {
    const before = context.document.body.paragraphs;
    before.load('items');
    await context.sync();
    const had = before.items.length;

    context.document.body.insertOoxml(pkg, Word.InsertLocation.end);
    await context.sync();
    if (keep) return;

    const after = context.document.body.paragraphs;
    after.load('items');
    await context.sync();
    for (const paragraph of after.items.slice(had)) paragraph.delete();
    await context.sync();
  });
}
