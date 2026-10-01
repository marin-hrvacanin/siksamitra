/**
 * A DOCUMENT FROM AN OUTLINE — through the one builder every importer uses.
 *
 * The agent says what the document is: its name, where it is from, its
 * sections, which lines of which source each verse is. It does not build a
 * `ChantDoc`. The outline is written out as the paragraphs of one of HIS
 * single documents — the krimi saṁhāraka and parjanya sūktams are the model:
 *
 *   Heading 2    the text's name                 "krimi saṁhāraka sūktam"
 *   Heading 3    where it is from, its locus      "taittirīya āraṇyaka 4.36-37"
 *   Heading 4    a section's title, when the text has sections
 *   Comment      a section's own source line, under its title
 *   Translit     each line of a verse; Prijevod, its translation
 *
 * — and handed to `buildDocument` in interop, the builder `importDocx` and
 * the PDF reader end in. So a document the agent makes is read exactly as his
 * own files are, and laid out as they are: a Devanāgarī line is the same IAST
 * text and markings as any other, and a svara is a mark, never a character in
 * the text.
 *
 * A SVARA TYPED IN IAST — `a̱gnimī̍ḻe` — is a combining character, and his
 * files carry each one in the `Svara` style. A plain run of them would be read
 * as letters. So each svara character goes into a run of that style here,
 * which is the shape the reader already knows.
 */
import type { ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import {
  SVARA_BY_CHAR, buildDocument, reportFor, wordRun, type WordParagraph, type WordRun,
} from '@siksamitra/interop';

export interface OutlineVerse {
  /** The verse's lines — its pādas or half-verses — as the source has them. */
  readonly lines: readonly string[];
  readonly translation?: string;
}

export interface OutlineSection {
  /** Its own heading — needed when the text has more than one section. */
  readonly title?: string;
  /** Where it is from: "Ṛgveda 10.90", a URL, a book. */
  readonly cite?: string;
  readonly verses: readonly OutlineVerse[];
  /**
   * A source's lines as they come, grouped into verses by the source's own
   * numbering — a daṇḍa and a number end a verse — which is how the builder
   * reads his files. Before `verses`, when both are given.
   */
  readonly flow?: readonly string[];
}

export interface Outline {
  /** The text's name, as his documents write it. */
  readonly title: string;
  /** Where the text is from — "ṛgvedasaṁhitā 5.83". His Heading 3. */
  readonly locus?: string;
  /** What it is, in a line — kept for the website as the document's subtitle. */
  readonly description?: string;
  readonly sections: readonly OutlineSection[];
}

/** A line's runs: the letters plain, and each svara character in `Svara`. */
export function runsOf(line: string): WordRun[] {
  const runs: WordRun[] = [];
  let plain = '';
  for (const ch of line) {
    if (SVARA_BY_CHAR.has(ch)) {
      if (plain !== '') runs.push(wordRun(plain));
      plain = '';
      runs.push(wordRun(ch, 'Svara'));
    } else {
      plain += ch;
    }
  }
  if (plain !== '') runs.push(wordRun(plain));
  return runs;
}

const para = (pStyle: string | null, runs: WordRun[]): WordParagraph => ({ pStyle, runs });

/** The outline as the paragraphs of one of his single documents. */
export function paragraphsOf(o: Outline): WordParagraph[] {
  const out: WordParagraph[] = [para('Heading2', [wordRun(o.title)])];
  if (o.locus !== undefined && o.locus.trim() !== '') out.push(para('Heading3', [wordRun(o.locus.trim())]));
  for (const s of o.sections) {
    if (s.title !== undefined && s.title.trim() !== '') out.push(para('Heading4', [wordRun(s.title.trim())]));
    /* A line wholly in the Comment style is a section's source line (`buildDocument`). */
    if (s.cite !== undefined && s.cite.trim() !== '') out.push(para(null, [wordRun(s.cite.trim(), 'Comment')]));
    const flow = (s.flow ?? []).map((l) => l.trim()).filter((l) => l !== '');
    for (const l of flow) out.push(para('Translit', runsOf(l)));
    if (flow.length > 0) out.push(para(null, []));
    for (const v of s.verses) {
      const lines = v.lines.map((l) => l.trim()).filter((l) => l !== '');
      if (lines.length === 0) continue;
      for (const l of lines) out.push(para('Translit', runsOf(l)));
      if (v.translation !== undefined && v.translation.trim() !== '') {
        for (const t of v.translation.split('\n')) if (t.trim() !== '') out.push(para('Prijevod', [wordRun(t.trim())]));
      }
      /* Anything that is not a mantra line ends the verse: an empty paragraph. */
      out.push(para(null, []));
    }
  }
  return out;
}

/** The document an outline describes, opened. */
export function documentOf(o: Outline): ChantDoc {
  if (o.sections.length > 1 && o.sections.some((s) => s.title === undefined || s.title.trim() === '')) {
    throw new Error('a text with more than one section needs a title for each — or they run together');
  }
  const paragraphs = paragraphsOf(o);
  const built = buildDocument(paragraphs, { fallbackTitle: o.title, title: o.title, report: reportFor('docx', 0, paragraphs) });
  /* What the website shows beside the name; the page draws the name and the locus. */
  const doc = {
    ...built,
    ...(o.description === undefined || o.description.trim() === '' ? {} : { subtitle: o.description.trim() }),
    ...(o.locus === undefined || o.locus.trim() === '' ? {} : { source: o.locus.trim() }),
  };
  return openChantDoc(doc);
}
