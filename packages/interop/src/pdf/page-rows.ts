/**
 * A MARKED PDF PAGE, AS WORD-STYLE PARAGRAPHS — so a PDF is read by the SAME
 * builder and the SAME run reader as a `.docx`.
 *
 * `tools/chant/pdf_marks.py` reads the page: every letter off the text layer,
 * every green box off the vector layer (thin or thick), the blue of a letter
 * the rules replaced, a superscript by its size and rise, the accents, the red
 * pause bars, the grey margin notes. That is the part only a PDF reader can do,
 * and it stays in Python where PyMuPDF is. What it used to do AFTER that — cut
 * syllables and build tokens, in a second implementation of both — is gone:
 * its rows come here, become the runs a Word paragraph would have had, and
 * `buildDocument` / `tokensFromRuns` do the rest. Its hyphens landed on the
 * wrong syllable and its overlines were dropped; neither can happen twice now.
 *
 * The page's layout says what a row IS (measured on `sri-rudram-iast.pdf`,
 * see `vu_import.py`): the first `title` row is the document's title, a later
 * one a part; a `subtitle` row a section; a run of `shloka` rows one verse, a
 * line each; `small` rows the translation under it; `body` rows the header and
 * the table of contents, which are not content.
 */
import type { ChantDoc } from '@siksamitra/format';
import type { WordParagraph, WordRun } from '../docx-read.js';
import { wordRun } from '../docx-read.js';
import { buildDocument } from '../build-document.js';
import { reportFor, type ImportReport } from '../docx-report.js';

export type PdfEvent =
  | { kind: 'text'; text: string; hold: 'short' | 'long' | null; box?: unknown; change: boolean }
  | { kind: 'svara'; mark: string }
  | { kind: 'sup'; text: string }
  | { kind: 'pause'; len: 'short' | 'long' }
  | { kind: 'candra' }
  | { kind: 'ann'; text: string };

export interface PdfRow {
  page: number;
  baseline: number;
  /** Where the row starts on the page, in points — the margin, or a hanging indent. */
  x0?: number;
  cls: 'title' | 'subtitle' | 'shloka' | 'small' | 'body';
  events: PdfEvent[];
}

/**
 * HOW HIS PAGE SAYS WHAT A ROW IS, besides its face — measured on bhū sūktam
 * v1.1 and sūryopaniṣat v0:
 *
 *   - a row that starts at the paragraph's HANGING INDENT (14.2 pt in) is the
 *     next line of the paragraph above, after a soft break; one at the margin
 *     begins a paragraph. Read as a paragraph each, a verse of his came back
 *     as many paragraphs and its translation the same;
 *   - a small grey row a whole mantra line (24 pt) below the row above is a
 *     COMMENT on a mantra line — "Also in maitrāyaṇī saṁhitā 1.7.1.1", a
 *     source over the verses after it — where a translation's lines follow
 *     their verse 15 pt down and each other 12.7. Read as translation, every
 *     such comment was appended to the verse before it.
 */
const HANGING = 8;
const COMMENT_GAP = 20;
/** Under a heading, a remark in body text stands 21.7 pt down (krimi
 *  saṁhāraka), a comment on a mantra line 29 to 31 (bhū sūktam, sūryopaniṣat). */
const REMARK_GAP = 26;

/** The character style a text event is written in, as his Word files write it. */
function styleOf(e: Extract<PdfEvent, { kind: 'text' }>): string | null {
  if (e.hold === 'short') return e.change ? 'HoldingChange' : 'Holding';
  if (e.hold === 'long') return e.change ? '2HoldingChange' : '2Holding';
  return e.change ? 'Anusvara' : null;
}

/** One row's events as the runs of the Word paragraph it would have been. */
export function runsOf(events: readonly PdfEvent[]): WordRun[] {
  const runs: WordRun[] = [];
  /** The last letter written, to read the candrabindu glyph by what it follows. */
  const lastLetter = (): string => {
    for (let k = runs.length - 1; k >= 0; k -= 1) {
      const t = runs[k]!.text.replace(/[̀-ͯs]/gu, '');
      if (t !== '') return t[t.length - 1]!;
    }
    return '';
  };
  for (const e of events) {
    switch (e.kind) {
      case 'text': runs.push(wordRun(e.text, styleOf(e))); break;
      /* The overline rides in the svara set on the page; in his Word files
         it is its own style, `Long`. */
      case 'svara': runs.push(wordRun(e.mark, e.mark === '̅' ? 'Long' : 'Svara')); break;
      case 'sup': runs.push(wordRun(e.text, 'Anusvara', true)); break;
      case 'pause': runs.push(wordRun(e.len === 'long' ? '||' : '|', 'Pause')); break;
      /*
       * THE CANDRABINDU GLYPH is a font-private code point on the page, and
       * what it stands for depends on what it follows. After an `m` it is the
       * candrabindu on that `m` — the Taittirīya `gm̐`. After a VOWEL it is the
       * whole Ṛgvedic anunāsika `m̐`, a letter the rules put there (blue): his
       * agnimīḻe prints `devām̐ eha` beside "ān + vowel = ām̐ + vowel (ṛgveda
       * prātiśākhya 4.80)". Reading it as a candrabindu on the `ā` lost the `m`.
       */
      case 'candra':
        runs.push(/[aāiīuūṛṝḷḹeo]$/u.test(lastLetter()) ? wordRun('m̐', 'Anusvara') : wordRun('̐'));
        break;
      case 'ann': runs.push(wordRun(e.text, 'Comment')); break;
    }
  }
  return runs;
}

const plain = (events: readonly PdfEvent[]): string =>
  events.map((e) => ('text' in e ? e.text : '')).join('').trim();

/** The page's rows as the paragraphs `buildDocument` reads. */
export function paragraphsOfRows(rows: readonly PdfRow[]): WordParagraph[] {
  const out: WordParagraph[] = [];
  let titled = false;
  const lefts = rows.filter((r) => (r.cls === 'shloka' || r.cls === 'small') && r.x0 !== undefined).map((r) => r.x0!);
  const margin = lefts.length === 0 ? undefined : Math.min(...lefts);
  const hangs = (r: PdfRow): boolean => margin !== undefined && r.x0 !== undefined && r.x0 >= margin + HANGING;
  /** The last paragraph, when it is the kind this row would continue. */
  let open: { pStyle: string; para: WordParagraph } | null = null;
  let prev: PdfRow | undefined;
  for (const row of rows) {
    const text = plain(row.events);
    const gap = prev !== undefined && prev.page === row.page ? row.baseline - prev.baseline : undefined;
    const last = prev;
    prev = row;
    if (row.cls === 'shloka' && open?.pStyle === 'Translit' && hangs(row)) {
      open.para.runs.push(wordRun('\n'), ...runsOf(row.events));
      continue;
    }
    if (row.cls === 'small') {
      if (open?.pStyle === 'Prijevod' && hangs(row) && (gap === undefined || gap < COMMENT_GAP)) {
        open.para.runs.push(wordRun(`\n${text}`));
        continue;
      }
      if (last !== undefined && (last.cls === 'title' || last.cls === 'subtitle') && gap !== undefined && gap < REMARK_GAP) {
        out.push({ pStyle: null, runs: [wordRun(text, 'Comment')] });
        open = null;
        continue;
      }
      const comment = gap === undefined ? last?.cls !== 'shloka' && open?.pStyle !== 'Prijevod' : gap >= COMMENT_GAP;
      if (comment) {
        out.push({ pStyle: 'Translit', runs: [wordRun(text, 'Comment')] });
        open = null;
        continue;
      }
    }
    switch (row.cls) {
      case 'title':
        out.push({ pStyle: titled ? 'Heading2' : 'Title', runs: [wordRun(text)] });
        titled = true;
        break;
      case 'subtitle': out.push({ pStyle: 'Heading3', runs: [wordRun(text)] }); break;
      case 'shloka': out.push({ pStyle: 'Translit', runs: runsOf(row.events) }); break;
      case 'small': out.push({ pStyle: 'Prijevod', runs: [wordRun(text)] }); break;
      case 'body':
        /* The header and the table of contents' dot leaders: not content. */
        if (text.includes('..') || text.toLowerCase().startsWith('file:')) break;
        out.push({ pStyle: null, runs: [wordRun(text)] });
        break;
    }
    const made = out[out.length - 1];
    open = made !== undefined && (row.cls === 'shloka' || row.cls === 'small') ? { pStyle: made.pStyle ?? '', para: made } : null;
  }
  return out;
}

/** A marked PDF, read: its rows (from `pdf_marks.py`) into a document. */
export function importPdfRows(
  rows: readonly PdfRow[],
  opts: { title?: string; fallbackTitle: string; bytes: number },
): { doc: ChantDoc; report: ImportReport; paragraphs: WordParagraph[] } {
  const paragraphs = paragraphsOfRows(rows);
  const report = reportFor('pdf', opts.bytes, paragraphs);
  const doc = buildDocument(paragraphs, {
    ...(opts.title === undefined ? {} : { title: opts.title }),
    fallbackTitle: opts.fallbackTitle,
    report,
  });
  return { doc, report, paragraphs };
}
