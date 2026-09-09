/**
 * A MINIMAL OOXML READER — `word/document.xml` into paragraphs of runs.
 *
 * Split out of `docx.ts` when that file crossed the 400-line limit
 * `check:modules` holds new code to. The division is the honest one and it was
 * always there in the comments: reading XML into paragraphs is one job and
 * turning paragraphs into a chant is another. Only the first is regular
 * enough to be done with regular expressions.
 *
 * WHY REGULAR EXPRESSIONS AT ALL, in a file format with a schema. Because the
 * subset needed is tiny — paragraphs, runs, their two style attributes, tabs,
 * breaks and drawings — and pulling in an XML parser to read six element names
 * would put a dependency between the owner's documents and this program that
 * nothing here can hold to account. Every pattern that follows is anchored on
 * an element name and a quoted attribute; none of them are trying to be a
 * parser.
 */
import { xmlText } from './xml.js';
import { readDrawings, type DocxDrawing } from './docx-figures.js';


/** One `<w:r>`: its text, its character style, and whether it is raised. */
export interface WordRun {
  text: string;
  rStyle: string | null;
  superscript: boolean;
}

export interface WordParagraph {
  pStyle: string | null;
  runs: WordRun[];
  /** The pictures in this paragraph. Absent when there are none, so every
   *  existing reader of a paragraph sees exactly what it saw before. */
  drawings?: DocxDrawing[];
  /** A self-closing `<w:p/>` — a real, empty paragraph. OOXML allows it, and
   *  the regex the reference counts were first taken with could not see it,
   *  which is the whole of the 845-vs-846 difference. */
  empty?: boolean;
}

const RE_PARA = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g;
const RE_RUN = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
const RE_TEXT = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const RE_PSTYLE = /<w:pStyle\s+w:val="([^"]*)"/;
const RE_RSTYLE = /<w:rStyle\s+w:val="([^"]*)"/;
const RE_TAB = /<w:tab\b[^>]*\/?>/;
const RE_BR = /<w:br\b[^>]*\/?>/;

/** Read `word/document.xml` into paragraphs of runs, in DOCUMENT ORDER. */
export function readParagraphs(documentXml: string): WordParagraph[] {
  const out: WordParagraph[] = [];
  RE_PARA.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_PARA.exec(documentXml)) !== null) {
    const body = m[1] ?? '';
    const selfClosing = m[1] === undefined;
    const pStyle = RE_PSTYLE.exec(body)?.[1] ?? null;
    const runs: WordRun[] = [];
    RE_RUN.lastIndex = 0;
    let r: RegExpExecArray | null;
    while ((r = RE_RUN.exec(body)) !== null) {
      const rb = r[1] ?? '';
      let text = '';
      RE_TEXT.lastIndex = 0;
      let t: RegExpExecArray | null;
      while ((t = RE_TEXT.exec(rb)) !== null) text += xmlText(t[1] ?? '');
      if (RE_TAB.test(rb)) text += ' ';
      if (RE_BR.test(rb)) text += '\n';
      runs.push({
        text,
        rStyle: RE_RSTYLE.exec(rb)?.[1] ?? null,
        superscript: /vertAlign\s+w:val="superscript"/.test(rb),
      });
    }
    const drawings = readDrawings(body);
    out.push({
      pStyle,
      runs,
      ...(drawings.length === 0 ? {} : { drawings }),
      ...(selfClosing ? { empty: true } : {}),
    });
  }
  return out;
}

/**
 * Merge consecutive runs with the same signature.
 *
 * Word splits a run on revision ids and spell-check state for no semantic
 * reason, so a single styled letter can arrive as four runs. Merging first is
 * what makes the inverse (§ export) stable.
 */
export function mergeRuns(runs: WordRun[]): WordRun[] {
  const out: WordRun[] = [];
  for (const r of runs) {
    if (r.text === '') continue; // an empty run carries nothing to merge
    const last = out[out.length - 1];
    if (last !== undefined && last.rStyle === r.rStyle && last.superscript === r.superscript) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

