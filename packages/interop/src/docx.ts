/**
 * Word `.docx` — reading and writing the owner's own marked files.
 *
 * Pure TypeScript, so it runs in the browser and in Node alike: a `.docx` is a
 * zip of XML, and `fflate` plus a small reader is the whole dependency. No
 * Python, no native module, no service.
 *
 * RULE ZERO GOVERNS THE IMPORTER. Marks are TRANSCRIBED from the styles he
 * applied, never re-derived. His files contain hand-placed marks the algorithm
 * does not produce, and an importer that "fixed" one would be destroying a
 * decision. The engine may be run afterwards as a COMPARISON, and its
 * disagreements go in the report for a human to rule on.
 *
 * TWO TRAPS, both of which have cost a defect elsewhere and are closed here:
 *   - never sort runs by position. `pdf_import` sorts by x and turns `śuklā̍m`
 *     into `śuklām̍`; document order is correct.
 *   - fold `ꣳ`/`ँ` → `ṁ` at the boundary, or a pre-formed candrabindu slips
 *     past the gum rule and ships with no reading aid.
 *
 * See specs/chant-editor/03-INTEROP.md §2.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { ChantDoc } from '@siksamitra/format';
import { REFERENCE_COUNTS } from './word-styles.js';
import { buildDocument } from './build-document.js';
import {
  columnEmuOf, figureFromDrawing, relationshipTargets,
} from './docx-figures.js';
import { readParagraphs, type WordParagraph } from './docx-read.js';

/* The OOXML reader is `docx-read.ts`. Re-exported because it is part of this
   module's published surface — the add-in and two gates read paragraphs. */
export { mergeRuns, paragraphXml, readParagraphs } from './docx-read.js';
/* The transcriber is `docx-runs.ts` and the report is `docx-report.ts`,
   split out when this file passed 700 lines. Re-exported because they are
   part of this module's published surface. */
export { tokensFromRuns } from './docx-runs.js';
export type { ImportReport } from './docx-report.js';
import { reportFor, type ImportReport } from './docx-report.js';
import { recordedRegisterIn } from './word/rule-parts.js';
export type { WordParagraph, WordRun } from './docx-read.js';

/* ==========================================================================
   Import
   ========================================================================== */


/**
 * Build a verse's tokens from one `Translit` paragraph's runs.
 *
 * Letters come from the text; marks come from the STYLES. No rule is run.
 * Consecutive holding runs of the same style form one `hg` group, and a group
 * covering more than one letter is kept but reported: narrowing it needs the
 * same-point test (02A H26), and guessing a host is how boxes end up off by a
 * letter.
 */

export interface DocxImport {
  doc: ChantDoc;
  report: ImportReport;
  /** The raw paragraphs, so a caller can re-classify without re-unzipping. */
  paragraphs: WordParagraph[];
}

/** Read a `.docx` into a chant document plus a report of everything it did. */
export function importDocx(bytes: Uint8Array, title?: string, fallbackTitle = 'Imported'): DocxImport {
  /*
   * THE PICTURES COME OUT OF THE ZIP TOO. A `.docx` keeps them in
   * `word/media/`, named from `word/_rels/document.xml.rels`, and reading only
   * `document.xml` is how every picture in an imported manual used to become
   * nothing at all — silently, because a `<w:drawing>` carries no text and a
   * paragraph with no text is a paragraph this reader skips.
   */
  const zip = unzipSync(bytes, {
    filter: (f) => f.name === 'word/document.xml'
      || f.name === 'word/styles.xml'
      || f.name === 'word/_rels/document.xml.rels'
      || f.name.startsWith('word/media/')
      /* The add-in's settings: the register of the lines outside every part. */
      || /^word\/webextensions\/webextension\d*\.xml$/.test(f.name),
  });
  const xml = zip['word/document.xml'];
  if (xml === undefined) throw new Error('not a .docx — word/document.xml is missing');

  const documentText = strFromU8(xml);
  const styles = zip['word/styles.xml'];
  const paragraphs = readParagraphs(documentText, styles === undefined ? undefined : strFromU8(styles));
  const rels = zip['word/_rels/document.xml.rels'] === undefined
    ? new Map<string, string>()
    : relationshipTargets(strFromU8(zip['word/_rels/document.xml.rels']));
  const columnEmu = columnEmuOf(documentText);
  let figureN = 0;

  const report = reportFor('docx', bytes.length, paragraphs);
  const register = Object.entries(zip)
    .filter(([name]) => name.startsWith('word/webextensions/'))
    .map(([, part]) => recordedRegisterIn(strFromU8(part)))
    .find((r) => r !== null) ?? null;

  const doc = buildDocument(paragraphs, {
    ...(title === undefined ? {} : { title }),
    ...(register === null ? {} : { register }),
    fallbackTitle,
    report,
    figure: (drawing, at) => {
      const target = rels.get(drawing.relId);
      const part = target === undefined ? undefined : `word/${target.replace(/^\.?\//u, '')}`;
      const media = part === undefined ? undefined : zip[part];
      if (part === undefined || media === undefined) {
        report.unresolved.push({ at, what: 'a picture whose bytes are not in the file', raw: drawing.relId });
        return null;
      }
      figureN += 1;
      const figure = figureFromDrawing(drawing, part, media, `fig-${figureN}`, columnEmu);
      if (figure === null) {
        figureN -= 1;
        report.unresolved.push({
          at,
          what: 'a picture in a format a document may not carry (.emf and .wmf are the two Word writes)',
          raw: part,
        });
      }
      return figure;
    },
  });
  return { doc, report, paragraphs };
}

export { REFERENCE_COUNTS };
