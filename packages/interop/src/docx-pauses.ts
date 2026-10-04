/**
 * A PAUSE IN A WORD RUN — how one is recognised, and what it is.
 *
 * Out of `docx-runs.ts` at the module gate, and shared with the script reader
 * (`word/script-reader.ts`) so the two readers cannot disagree about what a
 * bar in a run means.
 *
 * THE COLOUR IS THE LENGTH, as his files have it: a short pause is ONE bar in
 * the substitution blue (`Anusvara` — 815 of them in his Devī Māhātmyam), a
 * long pause ONE bar in his red `Pause` (119 there). It was read as who placed
 * it — blue the rules, red a person — and the length from the number of bars,
 * so his every long pause came in as a short one; the twelve `||` in his two
 * sādhanās are long pauses too. The owner, 2026-10-01: "short is blue line and
 * long is red. Both single."
 */
import type { ChantToken } from '@siksamitra/format';
import { BAR_GLYPH, roleOf } from './word-styles.js';
import type { WordRun } from './docx-read.js';

/** A run of bars alone, spaces either side allowed. */
const LONE = /^\s*\|{1,2}\s*$/;

/** Is this run a pause his files write: a lone bar in the blue style? */
export const isBluePause = (run: WordRun): boolean =>
  roleOf(run.rStyle) === 'change' && LONE.test(run.text);

/**
 * A BLUE RUN WITH A BAR AMONG ITS LETTERS IS TWO THINGS, split apart.
 *
 * A short pause and a letter the rules replaced share the blue style, so Word
 * — and `mergeRuns` — make them ONE run: `m|` where the rules turned `laṁ |`
 * into `lam |`, `|फ्म्ँश्` in a Devanāgarī line. Read whole, the bar became a
 * changed LETTER, and the next run of the rules turned it into a daṇḍa. No
 * letter is a bar, so every bar in a blue run is a pause, and it is read as
 * one on its own.
 */
export function splitPauseBars(run: WordRun): WordRun[] {
  if (roleOf(run.rStyle) !== 'change' || !run.text.includes('|') || LONE.test(run.text)) return [run];
  return run.text.split(/(\s*\|{1,2}\s*)/).filter((piece) => piece !== '').map((text) => ({ ...run, text }));
}

/** What a pause run holds: its own spaces, the pause or bars, and letters after. */
export interface PauseRead {
  /** The spaces before the bar — its own, and no others. */
  readonly lead: string;
  readonly tokens: ChantToken[];
  /** Spaces after the bar, and the letters a person typed after it in its style. */
  readonly tailSpace: string;
  readonly tail: string;
}

/**
 * A run read as a pause (or a bar).
 *
 * A BAR AND A SHORT PAUSE ARE DIFFERENT TOKENS and were written with the same
 * pipe in the same style, so every one of the corpus's 59 bars came back from
 * a round trip as a pause. `BAR_GLYPH` is what the exporter writes now; his
 * own files contain no bar, so nothing of his changes.
 */
export function readPause(run: WordRun): PauseRead {
  const bars = run.text.split(BAR_GLYPH).length - 1;
  const pipes = (run.text.match(/\|/g) ?? []).length;
  const tokens: ChantToken[] = [];
  /* The run's own spaces, and no others: a space invented before the pause
     put one into `…ˎ|`, which he wrote without. */
  const lead = bars > 0 || pipes > 0 ? /^\s*/.exec(run.text)![0] : '';
  if (bars > 0) for (let k = 0; k < bars; k += 1) tokens.push({ t: 'bar' });
  else if (pipes > 0) {
    tokens.push({ t: 'pause', len: roleOf(run.rStyle) === 'change' && pipes < 2 ? 'short' : 'long' });
  }
  /* Letters typed after a pause take the pause's style in Word, and they are
     the person's text: read them, never drop them. */
  const after = run.text.trimStart().replace(/^[|¦]+/, '');
  /* `| ` — a bar and ONE space inside its own run, nothing before it — is how
     the exporter spaces `oṁ | asya` (`body.ts`): the page's, not a word gap.
     His files write the bar and the space after it as two runs, and a run of
     his with spaces both sides (` | `) keeps them. */
  const tailSpace = lead === '' && after === ' ' && (bars > 0 || pipes > 0) ? '' : /^\s*/.exec(after)![0];
  return { lead, tokens, tailSpace, tail: after.trimStart() };
}
