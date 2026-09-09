/**
 * Keeping a verse in step with an edit to its text.
 *
 * THERE IS ONE TEXT NOW. A verse used to hold the same words three times over:
 * `src.lines` as typed, the hand-placed marks addressed into them, and the
 * tokens the renderer draws — and the caret edited the first, so showing the
 * result meant running the rules. That is why typing placed holdings nobody
 * asked for.
 *
 * The caret edits what is SHOWN. An edit changes the verse's text, the
 * markings move across it (`retext`), and the syllables are rebuilt from the
 * two. No rule runs; `recompute` is the only thing that runs one.
 *
 * `src` survives as what it always was underneath: the accented witness and
 * the declared departures, evidence about where the verse came from. It is no
 * longer the thing being edited.
 */
import { hydrateVerse } from '@siksamitra/engine';
import { toTextAndMarks, withVerses } from '@siksamitra/format';
import type { ChantDoc, ChantOverride, ChantSection, ChantVerse } from '@siksamitra/format';
import { flatten, type VerseSource } from './caret.js';
import { rebaseFlat, type FlatEdit } from './rebase.js';
import { deriveVerse, type VerseReport } from './derive-verse.js';
import { retext } from './retext.js';

export type LostMark = { override: ChantOverride; why: string };

/**
 * A verse's text, as lines.
 *
 * ONE ANSWER, and it is `sourcesOf`'s. This used to walk the tokens and
 * normalise each line, which made it differ from the text the caret addresses
 * — a space collapsed here and not there puts every offset after it out by
 * one, and a marking lands on the wrong letter. It is kept as a name because
 * the letter-to-offset map reads better with it, and it delegates.
 */
export const linesFromTokens = (verse: ChantVerse): string[] =>
  toTextAndMarks(verse).text.split('\n');

/**
 * The text of each verse, as the caret addresses it.
 *
 * `toTextAndMarks` and nothing else, so there is one answer to "what does this
 * verse say". It used to be `v.src?.lines ?? linesFromTokens(v)` — the typed
 * letters for a derived verse and the shown letters for a transcribed one,
 * which is two coordinate systems in one flat string, and it is why an edit
 * had to be run through the rules to be displayed.
 */
export const sourcesOf = (section: ChantSection): VerseSource[] =>
  section.verses.map((v) => ({ id: v.id, lines: toTextAndMarks(v).text.split('\n') }));

/** Which verses a text change touched, by comparing sources. */
export function changedVerses(
  before: readonly VerseSource[],
  after: readonly VerseSource[],
): Set<string> {
  const out = new Set<string>();
  const was = new Map(before.map((v) => [v.id, v.lines.join('\n')]));
  for (const v of after) {
    if (was.get(v.id) !== v.lines.join('\n')) out.add(v.id);
  }
  return out;
}

/**
 * Rebase a section's overrides across a source change.
 *
 * One call, in flat coordinates — see `rebaseFlat`, and the note there about
 * what the three-pass per-line version did to four marked lines.
 */
export function rebaseSection(
  overrides: readonly ChantOverride[],
  before: readonly VerseSource[],
  after: readonly VerseSource[],
  edit: FlatEdit,
): { overrides: ChantOverride[]; lost: LostMark[] } {
  const result = rebaseFlat(overrides, flatten(before), flatten(after), edit);
  return { overrides: result.overrides, lost: result.dropped };
}

export interface WriteResult {
  section: ChantSection;
  /** Kept for the shape of the result; nothing refuses text any more. */
  refused: { verseId: string; lines: string[] }[];
  /** Markings the edit ran over, which could not follow the letters. Never
   *  silent: a marking somebody placed by hand going missing has to be said. */
  accentsLost: { verseId: string; count: number }[];
}

/**
 * Write the new text into a section, in the new order.
 *
 * Order comes from `sources`, not from the old section: a paste that added a
 * verse in the middle must not append it at the end. A verse that survived
 * keeps every field that is not derived — `words`, `audioId`, `translation`,
 * the instructions — because none of them is this function's business.
 *
 * NOTHING IS REFUSED ANY MORE. A verse used to be either derived, and editable,
 * or transcribed, and frozen — the second kind had no source layer, so an edit
 * to it had nowhere to go and was declined by name. That distinction was the
 * owner's "what are these layers you are talking about?", and it is gone:
 * every verse is one text and a list of markings, and every verse takes an
 * edit the same way.
 */
export function writeSources(
  section: ChantSection,
  sources: readonly VerseSource[],
): WriteResult {
  const existing = new Map(section.verses.map((v) => [v.id, v]));
  const refused: WriteResult['refused'] = [];
  const accentsLost: WriteResult['accentsLost'] = [];

  const verses: ChantVerse[] = sources.map((s) => {
    const was = existing.get(s.id);
    const text = s.lines.join('\n');
    /* A verse the edit created: it has text and no markings yet. */
    if (was === undefined) return hydrateVerse({ id: s.id, tokens: [], text, marks: [] });
    const done = retext(was, text);
    if (done.dropped.length > 0) {
      accentsLost.push({ verseId: s.id, count: done.dropped.length });
    }
    return done.verse;
  });

  // `withVerses` because a composed section keeps its verses in `items` too,
  // and `normalizeChantDoc` rebuilds `verses` from those — writing only
  // `verses` would discard the author's edit on the next load.
  return { section: withVerses(section, verses), refused, accentsLost };
}

/** Re-derive the named verses. The one place a verse's tokens are replaced. */
export function rederive(
  doc: ChantDoc,
  section: ChantSection,
  verseIds: ReadonlySet<string>,
  overrides: readonly ChantOverride[],
): { section: ChantSection; reports: VerseReport[]; refusals: string[] } {
  const reports: VerseReport[] = [];
  const refusals: string[] = [];
  const verses = section.verses.map((verse) => {
    if (!verseIds.has(verse.id)) return verse;
    const result = deriveVerse(verse, section, doc.profile, overrides);
    if (!result.ok) {
      refusals.push(result.why);
      return verse;
    }
    reports.push(result.report);
    return result.verse;
  });
  return { section: withVerses(section, verses), reports, refusals };
}
