/**
 * DRAWING A RUN — the marked text, from text and markings rather than tokens.
 *
 * The counterpart of `marks.tsx`, which draws a token stream. That one takes a
 * syllable with a mark on each letter and emits a span per letter; this one
 * takes a stretch of text over which every marking is constant and emits ONE
 * element. Both draw the same notation and they are meant to look identical —
 * `tools/run-parity.mjs` photographs a verse each way and compares.
 *
 * WHY A SECOND DRAWING FUNCTION EXISTS AT ALL, when the rule in this repository
 * is one implementation of each thing: it is a MIGRATION, not a fork. The
 * document is moving from `src` + `tokens` to one text and a list of markings
 * (`openspec/changes/text-and-marks`), and the two shapes cannot be drawn by
 * one function while both exist. The old one goes when the corpus has moved,
 * and the parity gate is what makes that switch safe rather than hopeful.
 *
 * WHAT A RUN BUYS. A holding over eleven letters is one element, so the box is
 * one rectangle that crosses a space — instead of a box per syllable with CSS
 * clipping the edges where they meet, which is what `hold-join.css` exists to
 * undo. It is also the only shape an editing surface can map a click through:
 * the Lexical spike measured a per-letter markup reporting offset 1 for a click
 * on the sixth letter.
 */
import { Fragment, type ReactNode } from 'react';
import type { Run } from '../runs.js';
import { holdBoxVars } from '../holdBox.js';
import type { ScriptKey } from './marks.js';

export interface RunRenderOptions {
  /** Draw the recitation marks. Off = the clean letters. */
  showMarks: boolean;
  /** The resolved font list the holding box is measured against. */
  fontStack: string;
  /** Which script the letters are written in. */
  script: ScriptKey;
  /**
   * The editor is drawing, so every run carries where it starts in the verse's
   * text. A click can then be turned into an offset without measuring anything.
   */
  addressable?: boolean;
}

/** The classes a run wears. The one place that decides, for page and editor. */
export function runClassName(run: Run, showMarks: boolean): string {
  const out = ['run'];
  if (!showMarks) return out.join(' ');
  const { marks } = run;
  if (marks.hold !== undefined) out.push('hold', `hold-${marks.hold}`);
  if (marks.svara !== undefined) out.push(`sv-${marks.svara}`);
  if (marks.candra === true) out.push('is-candra');
  /* A letter the rules replaced is coloured, which is how a reader tells a
     visarga's `s` from a typed one without opening anything. */
  if (marks.was !== undefined) out.push('is-change');
  if (marks.plain !== undefined) out.push(marks.plain === 'fill' ? 'fill' : 'plain');
  return out.join(' ');
}

/** A pause or a svarabhakti dot, drawn between runs. */
function pointMark(kind: string, value: string | undefined, key: string): ReactNode {
  if (kind === 'sbhakti') return <span className="sbhakti" aria-hidden key={key} />;
  if (kind !== 'pause') return null;
  return (
    <span className={`pause pause--${value ?? 'short'}`} key={key}>
      {value === 'long' ? '||' : '|'}
    </span>
  );
}

/**
 * One run.
 *
 * The text goes in as ONE text node. That is not an implementation detail: it
 * is what lets a browser shape a Devanāgarī conjunct across the whole run, and
 * what lets an editing surface map a DOM position to an offset. Wrapping each
 * letter would break both, measured.
 */
export function renderRun(run: Run, o: RunRenderOptions, key: number): ReactNode {
  const before = run.before.map((m, i) => pointMark(m.k, m.v, `b${key}-${i}`));
  const after = run.after.map((m, i) => pointMark(m.k, m.v, `a${key}-${i}`));

  const held = o.showMarks && run.marks.hold !== undefined;
  const body = (
    <span
      className={runClassName(run, o.showMarks)}
      {...(held ? { style: holdBoxVars(run.text, o.fontStack) } : {})}
      {...(o.addressable === true ? { 'data-at': run.from } : {})}
      {...(o.showMarks && run.marks.was !== undefined ? { 'data-was': run.marks.was } : {})}
    >
      {run.text}
    </span>
  );

  /* A superscript follows the letters it belongs to and sits OUTSIDE the box,
     the way the token renderer puts it outside the tight frame. */
  const sup = o.showMarks && run.marks.sup !== undefined
    ? <sup className="u__sup" key={`s${key}`}>{run.marks.sup}</sup>
    : null;

  return (
    <Fragment key={key}>
      {before}
      {body}
      {sup}
      {after}
    </Fragment>
  );
}

/** A line of runs. */
export const renderRunLine = (runs: readonly Run[], o: RunRenderOptions): ReactNode[] =>
  runs.map((run, i) => renderRun(run, o, i));
