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
import { specimenBody, styleIds } from '../model/setup.js';
import { specimenMarks } from '../model/specimen-text.js';
import { documentPartOf } from '../model/opc.js';
import { packageFor, stylesPartOf } from '../model/package.js';
import { blockedIn, lineXml } from '../model/line-xml.js';
import { bodyShape, nextToHidden, wordIndexOf, type BodyShape } from '../model/paragraph-index.js';
import { lineTargets } from './line-target.js';
import { restyleTo } from '../model/restyle.js';
import { decodeRuns, isVerseParagraph, paragraphsXml } from '../model/paragraph.js';
import {
  VOCABULARY, builtInStyleIds, hisStylesAsClean, inVocabulary, legacyStylesIn, lineNotes, mergeRuns, paragraphXml, partOf, readParagraphs, scriptOfLine,
} from '@siksamitra/interop';
import type { ScriptKey } from '@siksamitra/engine';
import type { LineNote, PartRules } from '@siksamitra/interop';

/*
 * WHAT THIS DOCUMENT'S OWN STYLES LOOK LIKE, under the clean names.
 *
 * Every write is in the clean vocabulary (`model/package.ts`). What is learnt
 * from each package Word hands back is his definitions: a document of his
 * keeps its look because the clean styles written into it take them. Learnt
 * once per style — the first definition seen is the document's own.
 */
const his = new Map<string, string>();
export function learn(xml: string): void {
  for (const [id, style] of hisStylesAsClean(stylesPartOf(xml) || xml)) if (!his.has(id)) his.set(id, style);
}
/** The package to insert: the clean vocabulary, in this document's look. */
export const packageOf = (body: string, sheet: string): string => packageFor(body, sheet, his);

/** One paragraph of the document, addressed by index — for a whole-document run. */
export interface DocParagraph {
  index: number;
  tm: TextAndMarks;
  style: string | null;
  /** What a rewrite would lose. A whole-document run skips and lists it. */
  blocked: string[];
  /** The part it belongs to, whose rules mark it; `null` outside every part. */
  part: PartRules | null;
  /** The script it is written in, and is written back in. */
  script: ScriptKey;
  /** The notes that end its lines, put back when it is written. */
  notes: readonly LineNote[];
}

/** What one read of the whole document saw. */
export interface DocumentRead {
  /** The mantra paragraphs, addressed by their index among ALL paragraphs. */
  readonly lines: readonly DocParagraph[];
  /**
   * How many paragraphs there are ALTOGETHER, so the write can check — and
   * which of them Word may leave out of its own count: those whose MARK is
   * hidden, and `getOoxml`'s own empty last one (`model/paragraph-index.ts`).
   *
   * The indices above come from this read and are used against a DIFFERENT
   * one, and the two readers are not the same code: ours is a regex over
   * OOXML, Word's is Word. They disagreed by 26 on the owner's own file —
   * `<w:p w14:paraId="…"/>`, an empty self-closing paragraph, was swallowed
   * together with the paragraph after it — and 27 of his 872 paragraphs are
   * that shape. Every index from the first one onwards was wrong.
   */
  readonly shape: BodyShape;
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
    learn(ooxml.value);
    const part = documentPartOf(ooxml.value);
    const all = readParagraphs(part, ooxml.value);
    const raw = paragraphXml(part);
    const lines: DocParagraph[] = [];
    const shape = bodyShape(raw);
    const { hidden } = shape;
    all.forEach((p, index) => {
      if (!isVerseParagraph(p)) return;
      const runs = mergeRuns(p.runs);
      const script = scriptOfLine(runs.filter((r) => r.hidden !== true).map((r) => r.text).join(''));
      /* A `Comment` run that does not end a line cannot be put back, and a
         write without it deletes it. It used to be written anyway: a
         whole-document run went through `blocked` alone, which never looked
         for one — so every note in the document was deleted by it. */
      const { notes } = lineNotes(runs);
      lines.push({
        index, tm: decodeRuns(runs, script), style: p.pStyle,
        blocked: [
          ...blockedIn(raw[index] ?? '', runs, script),
          ...(nextToHidden(index, hidden) ? ['hidden text right before it, which Word joins to it'] : []),
        ],
        part: partOf(p.sdt), script, notes,
      });
    });
    return { lines, shape };
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
export async function writeDocument(changed: readonly DocParagraph[], shape: BodyShape): Promise<number> {
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
    /* Word's count may leave out the paragraphs whose mark is hidden; any other
       difference is the document changing under the read. */
    const at = wordIndexOf(shape, paragraphs.items.length);
    if (at === undefined) {
      throw new Error(`the document changed while it was being read — `
        + `${shape.total} paragraphs became ${paragraphs.items.length}. `
        + 'Nothing was written. Try again.');
    }
    let written = 0;
    const going = changed.flatMap((one) => {
      const index = one.blocked.length > 0 ? null : at(one.index);
      const p = index === null ? undefined : paragraphs.items[index];
      return p === undefined ? [] : [{ one, p }];
    });
    /* Into the part's own content where the line IS the part (`line-target.ts`). */
    const targets = await lineTargets(going.map((g) => g.p));
    for (const [k, { one }] of going.entries()) {
      const target = targets[k]!;
      written += 1;
      const body = lineXml({ tm: one.tm, style: one.style, script: one.script, notes: one.notes });
      /* Per body, for the reason in `model/sheet.ts` — and cached on the set
         of styles a body names, so 434 paragraphs build a handful of sheets. */
      target.insertOoxml(packageOf(body, styleSheetFor(body)), Word.InsertLocation.replace);
      /* By name, where the line is now in another style (`model/restyle.ts`). */
      const to = restyleTo(body, one.style);
      const paragraph = going[k]!.p;
      if (to !== null) paragraph.style = to;
    }
    await context.sync();
    return written;
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
  /** OUR styles the document has not got, by their clean names. Empty: ready. */
  readonly missing: readonly string[];
  /** How many of ours there are — Word's own built-ins are not counted. */
  readonly total: number;
  /** His older style ids the document still uses: a document to convert. */
  readonly older: readonly string[];
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
  /* OURS ONLY, IN THE CLEAN NAMES. Word's own built-ins — Normal, the
     headings, Header, Caption — are Word's and always there to be used; they
     are not ours to count, and his older ids are not a vocabulary to offer. */
  const ours = styleIds(inVocabulary(styleSheet(), 'clean')).filter((s) => s.custom);
  return Word.run(async (context) => {
    const ooxml = context.document.body.getOoxml();
    await context.sync();
    learn(ooxml.value);
    /* By NAME as well as id: Word makes an inserted style's id from its name,
       dropping what is not ASCII — our `Virāma` is `Virma` in every document,
       `Vedic Anusvāra` is `VedicAnusvra` — and counted by id they were
       "missing" for ever, however often they were imported. Measured in Word. */
    const sheet = stylesPartOf(ooxml.value);
    const table = builtInStyleIds(sheet);
    const have = new Set(styleIds(sheet).map((s) => table.get(s.id) ?? s.id));
    return {
      missing: ours.filter((s) => !have.has(s.id)).map((s) => cleanName(s.id)),
      total: ours.length,
      older: legacyStylesIn(ooxml.value),
    };
  });
}

/** A clean style id as a person reads it: `HoldingShort` is "Holding · Short". */
const cleanName = (id: string): string => VOCABULARY.find((e) => e.clean === id)?.name ?? id;

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
  const specimen = specimenBody(sheet, paragraphsXml(specimenMarks()));
  await Word.run(async (context) => {
    const body = context.document.body;
    /* HIS LOOK FIRST. Word keeps a style the document already has, so the
       clean styles that go in now are the ones every later write gets: in one
       of his documents they must be HIS definitions, or `Mantra` arrives in
       ours and his lines, converted, change face. Any range's OOXML carries
       the whole styles part, so one paragraph's is read, not the body's. */
    const first = body.paragraphs.getFirst().getRange().getOoxml();
    await context.sync();
    learn(first.value);
    const pkg = packageOf(specimen, sheet);
    const count = async (): Promise<number> => {
      const ps = body.paragraphs;
      ps.load('items');
      await context.sync();
      return ps.items.length;
    };
    const had = await count();

    /*
     * INTO A PARAGRAPH OF ITS OWN — and, to be taken out again, AT THE START.
     *
     * THE FAULT. This inserted at the body's end and deleted the paragraphs
     * past the old COUNT. But a document ending in an empty paragraph — a new
     * one, and most — has the insertion's first paragraph MERGED into that
     * empty one, so the count was one short and the specimen's title stayed:
     * every press of Add styles left "śikṣāmitra styles" in the person's
     * document, seen after two presses as two headings.
     *
     * Deleting "everything after their last paragraph" instead is worse: it
     * removes THEIR last paragraph mark, and a merged paragraph takes the
     * formatting of the mark that survives — the specimen's. So the specimen
     * goes into a fresh paragraph BEFORE their first: nothing of theirs can
     * merge with it, none of it is the document's final paragraph, and what
     * is deleted afterwards is exactly the paragraphs it added, counted.
     */
    const room = body.insertParagraph('', keep ? Word.InsertLocation.end : Word.InsertLocation.start);
    room.insertOoxml(pkg, Word.InsertLocation.replace);
    await context.sync();
    if (keep) return;

    const added = (await count()) - had;
    const ps = body.paragraphs;
    ps.load('items');
    await context.sync();
    for (const p of ps.items.slice(0, added)) p.delete();
    await context.sync();
  });
}
