/**
 * What every test of the run reader builds from — one copy, imported.
 */
import type { ChantToken, ChantUnit } from '@siksamitra/format';
import type { ImportReport } from '../docx.js';
import type { WordRun } from '../docx-read.js';

export const run = (text: string, rStyle: string | null = null, superscript = false): WordRun =>
  ({ text, rStyle, superscript });

/** A report the reader can fill in — every field it writes to. */
export const blank = (): ImportReport => ({
  source: { kind: 'docx', bytes: 0 },
  structure: {
    paragraphs: 0, paragraphsWithBody: 0, runs: 0, sections: 0, verses: 0, syllables: 0,
  },
  marks: {},
  byStyle: {},
  byPara: {},
  normalisations: [],
  unresolved: [],
});

/** The letters of the tokens a run list produces, flattened. */
export const unitsOf = (tokens: readonly ChantToken[]): ChantUnit[] =>
  tokens.flatMap((t) => (t.t === 'syl' ? [...t.units] : []));

/** The tokens as one readable line: `[syl]`, `␣`, `<kind>`. */
export const cells = (tokens: readonly ChantToken[]): string => tokens
  .map((t) => (t.t === 'syl' ? `[${t.iast}]` : t.t === 'sp' ? '␣' : `<${t.t}>`)).join('');
