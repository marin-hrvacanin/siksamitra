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
import { encodeMarks, markFaults, toTextAndMarks, withVerses } from '@siksamitra/format';
import type { ChantDoc, ChantOverride, ChantSection, ChantVerse, Mark } from '@siksamitra/format';
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

/** How many markings a verse carries. For reporting what a split moved. */
const markCount = (verse: ChantVerse): number => toTextAndMarks(verse).marks.length;

/**
 * THE TAIL OF A SPLIT VERSE, WITH ITS MARKINGS.
 *
 * `origin` says which verse this one was carved out of; this works out where,
 * and moves the markings that belong to the part that left.
 *
 * THE OFFSET IS VERIFIED, NOT COMPUTED. It would be easy to take it from the
 * edit's arithmetic, and wrong: `normLoose` runs on every line, so a space
 * collapsed anywhere before the split moves every offset after it and the
 * markings would land a character out — silently, on the wrong letters, which
 * is worse than losing them. So the new text has to BE a suffix of the old
 * one; if it is not — because the edit also changed the text, or the split
 * fell inside a line that was renormalised — nothing is carried and the verse
 * starts clean, exactly as before. Never a marking on a letter nobody put it
 * on.
 *
 * `null` means "not a clean split, do not claim to know".
 */
function carryInto(id: string, origin: ChantVerse, text: string): ChantVerse | null {
  const before = toTextAndMarks(origin);
  if (text === '' || !before.text.endsWith(text)) return null;
  const at = before.text.length - text.length;
  if (at === 0) return null; // The whole verse: not a split, and `retext` has it.

  const moved: Mark[] = [];
  for (const m of before.marks) {
    /* Only what lies wholly in the part that moved. A marking straddling the
       break belongs to neither half whole, and half a holding is not a
       holding — `retext` reports it lost on the verse that kept the text. */
    if (m.from < at) continue;
    moved.push({ ...m, from: m.from - at, to: m.to - at });
  }

  /* Checked before it is written, like every other mark list: a marking that
     would start inside a character, or run past the end, is dropped rather
     than made into a document that `assertMarks` will throw on. */
  const faulty = new Set(markFaults(moved, text).map((f) => f.at));
  const clean = moved.filter((_, i) => !faulty.has(i));
  return hydrateVerse({ id, tokens: [], text, marks: encodeMarks(clean) });
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
  /**
   * For a verse this edit CREATED, the old verse its text was carved out of.
   * From `replaceRange`, decided by the edit's RANGE — see `range.ts`.
   */
  origins: Readonly<Record<string, string>> = {},
): WriteResult {
  const existing = new Map(section.verses.map((v) => [v.id, v]));
  const refused: WriteResult['refused'] = [];
  const accentsLost: WriteResult['accentsLost'] = [];
  /** How many markings each old verse handed on to a verse the split created. */
  const rescued = new Map<string, number>();

  const verses: ChantVerse[] = sources.map((s) => {
    const was = existing.get(s.id);
    const text = s.lines.join('\n');
    if (was === undefined) {
      /*
       * A VERSE THE EDIT CREATED — which is not the same as a verse out of
       * nowhere. Splitting one in two makes a "new" verse whose text is the
       * TAIL of an old one, and this gave it `marks: []`: pressing Enter at
       * the end of a line took Puruṣa Sūktam's verse from 124 markings to 30,
       * and every holding, svara and substitution after the caret was gone.
       *
       * So the markings come across, shifted. `carryInto` will only do it when
       * the new text really is a suffix of the old — the origin says WHICH
       * verse (from the edit's range, not from similarity) and the suffix says
       * BY HOW MUCH, verified rather than computed from offsets that
       * normalisation may have moved.
       */
      const from = origins[s.id];
      const source = from === undefined ? undefined : existing.get(from);
      const carried = source === undefined ? null : carryInto(s.id, source, text);
      if (carried !== null) {
        rescued.set(from as string, (rescued.get(from as string) ?? 0) + markCount(carried));
        return carried;
      }
      return hydrateVerse({ id: s.id, tokens: [], text, marks: [] });
    }
    const done = retext(was, text);
    if (done.dropped.length > 0) {
      accentsLost.push({ verseId: s.id, count: done.dropped.length });
    }
    return done.verse;
  });

  /*
   * A MARKING THAT MOVED IS NOT A MARKING THAT WAS LOST.
   *
   * `retext` reports the tail's markings as dropped from the verse that kept
   * the head — correctly, from where it stands — but they have gone to the
   * verse the split created, and saying so anyway put "94 marking(s) … went
   * with them" in the status bar of an edit that lost nothing. A warning that
   * cries wolf is worse than no warning: it is the one a person learns to
   * ignore, and the next one will be real.
   */
  const reported = accentsLost
    .map((row) => ({ ...row, count: row.count - (rescued.get(row.verseId) ?? 0) }))
    .filter((row) => row.count > 0);

  // `withVerses` because a composed section keeps its verses in `items` too,
  // and `normalizeChantDoc` rebuilds `verses` from those — writing only
  // `verses` would discard the author's edit on the next load.
  return { section: withVerses(section, verses), refused, accentsLost: reported };
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
