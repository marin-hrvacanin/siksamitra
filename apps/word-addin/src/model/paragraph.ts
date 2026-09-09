/**
 * A WORD PARAGRAPH ⇄ ONE TEXT AND ITS MARKINGS.
 *
 * The whole of what this add-in knows about Word, and it knows it by DELEGATION
 * rather than by having been taught it twice. Both directions are compositions
 * of code that already ships:
 *
 *   out  text+marks → `toTokens` → `documentXml` → `<w:p>` runs
 *   in   `<w:p>` runs → `tokensFromRuns` → `toTextAndMarks` → text+marks
 *
 * `documentXml` and `tokensFromRuns` are `packages/interop/src/docx.ts` — the
 * writer and reader the owner's own file was reverse-engineered into, over the
 * one style table in `word-styles.ts`. Writing a second Word serialiser here
 * would mean a paragraph marked in Word could disagree with the same paragraph
 * exported from the desktop app, with nothing able to say which is right.
 *
 * WHAT A HOLDING IS, IN WORD. `w:rPr/w:bdr` — a character border — carried by
 * the character style `Holding` (0.25 pt) or `2Holding` (1.5 pt). His own
 * `styles.xml` says so, and `packages/tokens/src/word.ts` records the two
 * weights it measured out of it. ECMA-376 §17.3.2.4: two ADJACENT runs whose
 * border attributes are identical are one border group and are drawn inside one
 * set of borders. That is why a box can cross a space, and it is also why
 * `documentXml` emits a held run's svaras AFTER the whole box rather than
 * beside their letters — a `Svara` run in the middle would break the group and
 * draw two boxes.
 *
 * A PARAGRAPH IS A VERSE, and the add-in's unit of work is the paragraph. The
 * exporter writes one `Translit` per verse with a `<w:br/>` between the pādas,
 * because `Translit` carries `w:ind w:left="284" w:hanging="284"` — the first
 * LINE comes out to the margin and every later line sits in, and a paragraph
 * per pāda made every pāda a first line. So a model newline is a `<w:br/>`
 * here, not a paragraph break.
 */
import type { ChantDoc, ChantSyllable } from '@siksamitra/format';
import { toTextAndMarks, toTokens } from '@siksamitra/format';
import type { TextAndMarks, TokenHelp } from '@siksamitra/format';
import type { ChantToken, ChantVerse } from '@siksamitra/format';
import type { ImportReport, WordParagraph, WordRun } from '@siksamitra/interop';
import {
  documentXml, mergeRuns, paraRoleOf, readParagraphs, tokensFromRuns,
} from '@siksamitra/interop';
import { parseLetters } from '@siksamitra/engine';
import { carriable } from './carry.js';

/**
 * Is this paragraph a mantra?
 *
 * Asked of the interop contract rather than of a style id, because the id is
 * `word-styles.ts`'s to choose: it moved once already, when the exporter
 * stopped writing a paragraph per pāda and started writing one per verse with
 * `<w:br/>` between the lines. A filter on the literal `Translit` would have
 * gone quietly empty.
 */
export const isVerseParagraph = (p: WordParagraph): boolean =>
  paraRoleOf(p.pStyle) === 'verse-line';

/**
 * What `toTokens` cannot know, supplied.
 *
 * `spell` returns the IAST in the Devanāgarī slot rather than transliterating,
 * and that is not a shortcut: a `.docx` carries one script, and `documentXml`
 * reads a syllable's `units` and its `iast` and never touches the other
 * spellings. Transliterating here would run the script engine 15 881 times per
 * document to produce strings nothing reads.
 */
export const TOKEN_HELP: TokenHelp = {
  spell: (iast: string) => ({ deva: iast } as Omit<ChantSyllable, 't' | 'units' | 'iast'>),
  /* A letter is not a character: `bh` is one letter written with two, and
     walking the text character by character turns every aspirate into its
     plain consonant. `parseLetters` is the engine's own division. */
  split: parseLetters,
};

/** A one-verse document, which is all `documentXml` needs to write a line. */
function oneVerse(tokens: ChantToken[]): ChantDoc {
  return { title: '', titleForms: {}, sections: [{ id: 's', verses: [{ id: 'v', tokens }] }] };
}

const BODY = /<w:body>([\s\S]*)<\/w:body>/;

/** The markings Word can state. See `carry.ts` for the ones it cannot. */
const writable = (tm: TextAndMarks): TextAndMarks =>
  ({ text: tm.text, marks: carriable(tm.marks) });

/**
 * The `<w:p>` elements for one text and its markings.
 *
 * The body of a `word/document.xml`, ready to go into a flat OPC package. One
 * paragraph per line of the text.
 */
export function paragraphsXml(tm: TextAndMarks): string {
  const doc = oneVerse(toTokens(writable(tm), TOKEN_HELP));
  return BODY.exec(documentXml(doc))?.[1] ?? '';
}

/**
 * The same thing as runs, which is what a test and the offset map read.
 *
 * Parsed back out of the XML rather than produced beside it, so there is one
 * writer and this cannot drift from what actually reaches Word.
 */
export function paragraphRuns(tm: TextAndMarks): WordRun[][] {
  const doc = oneVerse(toTokens(writable(tm), TOKEN_HELP));
  return readParagraphs(documentXml(doc))
    .filter(isVerseParagraph)
    .map((p) => mergeRuns(p.runs));
}

/**
 * A report `tokensFromRuns` can fill in and nobody reads.
 *
 * The importer records what it saw as it goes — how many syllables, which
 * styles, what it could not resolve — because a `.docx` import is a one-shot
 * conversion somebody has to audit. Marking a paragraph is not: the same
 * paragraph is read and written twenty times a minute, and the counts would be
 * of nothing. `unresolvedIn` below is how a caller asks what was not understood.
 */
export function blankReport(): ImportReport {
  return {
    source: { kind: 'docx', bytes: 0 },
    structure: {
      paragraphs: 0, paragraphsWithBody: 0, runs: 0, sections: 0, verses: 0, syllables: 0,
    },
    marks: {}, byStyle: {}, byPara: {}, normalisations: [], unresolved: [],
  } as unknown as ImportReport;
}

/**
 * Consecutive Word paragraphs as one text and one list of markings.
 *
 * Each paragraph is decoded on its own and joined with a `br` token, which is
 * what puts a real `\n` in the text. Feeding the paragraphs to the importer as
 * one run list instead would lose every line break: a `\n` in a plain run is
 * whitespace to `tokensFromRuns` and becomes a space.
 */
export function decodeParagraphs(paras: readonly WordParagraph[]): TextAndMarks {
  const report = blankReport();
  const tokens: ChantToken[] = [];
  for (const [i, p] of paras.entries()) {
    if (i > 0) tokens.push({ t: 'br' });
    tokens.push(...tokensFromRuns(p.runs, report, `p-${i + 1}`));
  }
  return toTextAndMarks({ id: 'v', tokens } as ChantVerse);
}

/**
 * One paragraph's runs as text and markings.
 *
 * A `<w:br/>` inside the paragraph is a LINE, and `readParagraphs` gives it to
 * us as a newline in a run's text. It has to be handled here rather than left to
 * the importer: `tokensFromRuns` reads any run of whitespace as a space, so a
 * verse of four pādas would come back as one long line. `importDocx` has the
 * same gap and loses every line break inside a verse.
 */
export function decodeRuns(runs: readonly WordRun[]): TextAndMarks {
  const report = blankReport();
  const tokens: ChantToken[] = [];
  let line: WordRun[] = [];
  const flush = (): void => {
    tokens.push(...tokensFromRuns(line, report, `l-${tokens.length}`));
    line = [];
  };
  for (const r of runs) {
    if (!r.text.includes('\n')) { line.push(r); continue; }
    const pieces = r.text.split('\n');
    for (const [i, piece] of pieces.entries()) {
      if (i > 0) { flush(); tokens.push({ t: 'br' }); }
      if (piece !== '') line.push({ ...r, text: piece });
    }
  }
  flush();
  return toTextAndMarks({ id: 'v', tokens } as ChantVerse);
}

/** Something in the paragraph the reader could not place. */
export interface Unaccounted {
  what: string;
  /** The letters it was about. */
  raw: string;
  /**
   * Its letters are NOT in the decoded text, so writing the paragraph back
   * would delete them.
   *
   * Decided by looking rather than by reading the message, because the three
   * things the importer reports are not equally serious and only one of them
   * costs anything. An inline `Comment` run leaves the token stream entirely —
   * that is a deletion, and the add-in refuses. The `Long` and `Name` styles
   * have no home in the format yet but their letters stay, so the style is
   * lost and the text is not. A holding box over more than one letter is
   * reported so that somebody can narrow it, and loses nothing at all — 387 of
   * the corpus's 4 788 boxes cover two letters, so treating that as a refusal
   * would have locked the add-in out of most of Śrī Rudram.
   */
  lossy: boolean;
}

/** What the importer could not account for in these paragraphs. */
export function unresolvedIn(paras: readonly WordParagraph[]): Unaccounted[] {
  const report = blankReport();
  const decoded = paras
    .map((p, i) => tokensFromRuns(p.runs, report, `p-${i + 1}`))
    .map((tokens) => toTextAndMarks({ id: 'v', tokens } as ChantVerse).text)
    .join(' ');
  return report.unresolved.map((u) => ({
    what: u.what,
    raw: u.raw,
    lossy: u.raw.trim() !== '' && !decoded.includes(u.raw.trim()),
  }));
}
