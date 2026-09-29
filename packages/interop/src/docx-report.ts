/**
 * WHAT AN IMPORT SAW, as it went.
 *
 * Its own module so that `docx-runs.ts` — the transcriber — and `docx.ts` —
 * the zip and the structure — can both name it without importing each other.
 *
 * A `.docx` import is a one-shot conversion somebody has to AUDIT: how many
 * syllables, which styles, what could not be resolved. That is why the reader
 * fills this in as it goes rather than answering with tokens alone. The Word
 * add-in is the exception — it reads and writes the same paragraph twenty
 * times a minute, so it passes a blank one and asks `unresolvedIn` instead.
 */

export interface ImportReport {
  source: { kind: 'docx' | 'pdf'; bytes: number };
  structure: {
    /** Every `<w:p>`, including self-closing empties. */
    paragraphs: number;
    /** Paragraphs with an open/close pair — the convention the reference
     *  counts were taken in. */
    paragraphsWithBody: number;
    runs: number; sections: number; verses: number; syllables: number;
  };
  marks: Record<string, number>;
  byStyle: Record<string, number>;
  byPara: Record<string, number>;
  normalisations: { rule: string; from: string; to: string; count: number }[];
  unresolved: { at: string; what: string; raw: string }[];
}

/**
 * A report for these paragraphs, with the paragraph, run and style counts
 * filled in — one construction for every importer, Word and PDF alike.
 */
export function reportFor(
  kind: ImportReport['source']['kind'],
  bytes: number,
  paragraphs: readonly import('./docx-read.js').WordParagraph[],
): ImportReport {
  const report: ImportReport = {
    source: { kind, bytes },
    structure: {
      paragraphs: paragraphs.length,
      paragraphsWithBody: paragraphs.filter((p) => p.empty !== true).length,
      runs: 0, sections: 0, verses: 0, syllables: 0,
    },
    marks: {},
    byStyle: {},
    byPara: {},
    normalisations: [],
    unresolved: [],
  };
  for (const p of paragraphs) {
    if (p.empty === true) continue; // counted in `paragraphs`, not per style
    const key = p.pStyle ?? 'default';
    report.byPara[key] = (report.byPara[key] ?? 0) + 1;
    for (const r of p.runs) {
      report.structure.runs += 1;
      const sk = r.rStyle ?? 'none';
      report.byStyle[sk] = (report.byStyle[sk] ?? 0) + 1;
    }
  }
  return report;
}
