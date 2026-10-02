/**
 * ONE LETTER AND ITS MARKS — the form a line in any script is compared in.
 *
 * Out of `script-runs.ts` at the module gate. The IAST side of a line is read
 * into these by `lettersOfIast`, and written back from them by
 * `iastRunsOfLetters`, its inverse; the script side is read into them by
 * `script-reader.ts`. Two lines are the same line exactly when their letters
 * are `same`.
 */
import type { ChantSvara } from '@siksamitra/format';
import { kampaOf, parseLetters } from '@siksamitra/engine';
import { mergeRuns, type WordRun } from '../docx-read.js';
import { SVARA_BY_CHAR, SVARA_CHAR, changeStyle, holdingStyle, roleOf } from '../word-styles.js';

export interface Letter {
  t: string;
  hold: 'short' | 'long' | null;
  changed: boolean;
  svara: ChantSvara[];
  aid: string[];
  dot: boolean;
  tick: boolean;
  colon: boolean;
}

export const holdOf = (rStyle: string | null): Letter['hold'] => {
  const role = roleOf(rStyle);
  return role === 'hold-short' || role === 'hold-short-change' ? 'short'
    : role === 'hold-long' || role === 'hold-long-change' ? 'long' : null;
};
export const changedOf = (rStyle: string | null): boolean => {
  const role = roleOf(rStyle);
  return role === 'change' || role === 'hold-short-change' || role === 'hold-long-change';
};
export const bareLetter = (t: string, rStyle: string | null = null): Letter =>
  ({ t, hold: holdOf(rStyle), changed: changedOf(rStyle), svara: [], aid: [], dot: false, tick: false, colon: false });

/** IAST runs as letters, each carrying what is around it. */
export function lettersOfIast(runs: readonly WordRun[]): Letter[] {
  const out: Letter[] = [];
  let dot = false;
  const last = (): Letter | undefined => out[out.length - 1];
  const push = (l: Letter): void => { l.dot = dot; dot = false; out.push(l); };
  for (const r of mergeRuns([...runs])) {
    const role = roleOf(r.rStyle);
    if (role === 'svara') {
      /* A kampa, `3̱̍`, is ONE svara of the letter before it, read whole. */
      const kampa = kampaOf(r.text.trim());
      if (kampa !== undefined) { last()?.svara.push(kampa); continue; }
      for (const ch of r.text) {
        const svara = SVARA_BY_CHAR.get(ch);
        if (svara !== undefined) last()?.svara.push(svara);
        else if (ch === '·') dot = true;
        else push(bareLetter(ch));
      }
      continue;
    }
    if (role === 'virama') { const l = last(); if (l !== undefined) l.tick = true; continue; }
    if (role === 'reference') { last()?.aid.push(r.text); continue; }
    for (const piece of parseLetters(r.text)) {
      const l = last();
      if (piece === ':' && l !== undefined && l.t.endsWith('ḥ')) { l.colon = true; continue; }
      push(bareLetter(piece, r.rStyle));
    }
  }
  return out;
}

const styleOf = (l: Letter): string | null =>
  (l.hold !== null ? holdingStyle(l.hold, l.changed) : l.changed ? changeStyle(l.t) : null);

/**
 * Letters back to the IAST runs the reader reads — the inverse of
 * `lettersOfIast`. Runs among them (a pause, a comment) pass through. With
 * `sizes`, each item's number of characters is pushed to it, in order, which
 * is how a Word offset in a script line is followed into the IAST.
 */
export function iastRunsOfLetters(items: readonly (Letter | WordRun)[], sizes?: number[]): WordRun[] {
  const out: WordRun[] = [];
  let written = 0;
  const add = (text: string, rStyle: string | null): void => {
    out.push({ text, rStyle, superscript: false });
    written += text.length;
  };
  for (const x of items) {
    const before = written;
    if (!('t' in x)) { out.push(x); written += x.text.length; sizes?.push(written - before); continue; }
    if (x.dot) add('·', 'Svara');
    add(x.t + (x.colon ? ':' : ''), styleOf(x));
    for (const s of x.svara) add(SVARA_CHAR.get(s) ?? '', 'Svara');
    if (x.tick) add('ˎ', 'Virama');
    for (const a of x.aid) add(a, 'Reference');
    sizes?.push(written - before);
  }
  return mergeRuns(out);
}

/** Are these the same letter, carrying the same marks? */
export const sameLetter = (a: Letter, b: Letter): boolean => a.t === b.t && a.hold === b.hold
  && a.changed === b.changed && a.dot === b.dot && a.tick === b.tick && a.colon === b.colon
  && a.svara.join() === b.svara.join() && a.aid.join('\u0000') === b.aid.join('\u0000');
