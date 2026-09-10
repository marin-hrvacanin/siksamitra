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
  source: { kind: 'docx'; bytes: number };
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
