/**
 * Keeping the three layers of a verse in step: source, marks, tokens.
 *
 * A verse holds the same text three times over — the source lines the author
 * types, the hand-placed marks addressed into them, and the derived tokens the
 * renderer draws. An edit that updates one and not the others is exactly the
 * class of defect that made v1 untraceable, so the reconciliation is one
 * module with one order of operations:
 *
 *   1. change the source,
 *   2. rebase the marks onto it — reporting every one that could not follow,
 *   3. re-derive only the verses whose source actually changed.
 *
 * The order is not negotiable. Re-deriving before rebasing derives against
 * stale mark addresses, and rebasing after deriving means the tokens were
 * built from marks that had already moved.
 */
import { norm } from '@siksamitra/engine';
import { withVerses } from '@siksamitra/format';
import type { ChantDoc, ChantOverride, ChantSection, ChantVerse } from '@siksamitra/format';
import { flatten, type VerseSource } from './caret.js';
import { rebaseFlat, type FlatEdit } from './rebase.js';
import { deriveVerse, type VerseReport } from './derive-verse.js';
import { carryWitness } from './witness.js';

export type LostMark = { override: ChantOverride; why: string };

/**
 * A stand-in source for an attested verse.
 *
 * An attested verse has no source and must not be re-derived, but it still has
 * to occupy space in the flat text — or the caret would skip over it and a
 * selection across it would silently exclude it, which is worse than either
 * allowing or forbidding the edit. So it contributes its RECITED text, and the
 * surface refuses edits that reach it, by name.
 */
export function linesFromTokens(verse: ChantVerse): string[] {
  const lines: string[] = [''];
  const put = (s: string): void => { lines[lines.length - 1] += s; };
  for (const t of verse.tokens) {
    if (t.t === 'br') lines.push('');
    else if (t.t === 'syl') put(t.iast);
    else if (t.t === 'text') put(t.placeholder === true ? '' : t.s);
    else if (t.t === 'sp') put(' ');
    else if (t.t === 'danda') put(t.s);
  }
  /*
   * NORMALISED, like every other line in the flat source.
   *
   * It was not, and the consequence was not local: an attested verse's tokens
   * produce `… ॥॥ ` with a trailing space and a double space, which
   * `replaceRange` then trims — so a NO-OP edit shortened the section's flat
   * text by 11 characters, every offset after that verse moved, and the
   * witness on 23 hand-placed marks correctly refused to follow. The stand-in
   * has to be as canonical as a real source line, or it is a moving reference
   * point.
   */
  return lines.map((l) => norm(l));
}

export const sourcesOf = (section: ChantSection): VerseSource[] =>
  section.verses.map((v) => ({ id: v.id, lines: v.src?.lines ?? linesFromTokens(v) }));

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
  /** Text the write could not store, because its verse cannot hold source.
   *  Never silent: this is a whole verse's words going missing. */
  refused: { verseId: string; lines: string[] }[];
  /** Accents the edit removed with the letters they were on, per verse. An
   *  edit that costs a transcribed accent has to say so. */
  accentsLost: { verseId: string; count: number }[];
}

/**
 * Write the new sources into a section, in the new order.
 *
 * Order comes from `sources`, not from the old section: a paste that added a
 * verse in the middle must not append it at the end. A verse that survived
 * keeps every field that is not derived — `words`, `audioId`, `translation`,
 * the instructions — because none of them is this function's business.
 *
 * AN ATTESTED VERSE'S SOURCE IS NEVER WRITTEN, and if the caller hands one
 * lines that differ from its own stand-in, that text is REFUSED and named. It
 * used to be dropped on the floor: a single Backspace at the start of the verse
 * after a transcribed one merged the two, and the merged text — a whole verse
 * of words — vanished with no refusal and no mention.
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
    if (was === undefined) return { id: s.id, tokens: [], src: { lines: [...s.lines] } };
    if (was.src === undefined) {
      /*
       * Compared NORMALISED. The stand-in comes from the verse's own tokens
       * and every line `replaceRange` returns has been through `norm`, so an
       * un-normalised comparison reported a refusal for every transcribed
       * verse on every keystroke anywhere in the section — five warnings for a
       * perfectly legal edit. What this has to catch is text genuinely merged
       * INTO the verse, which differs by more than whitespace.
       */
      const stand = linesFromTokens(was).map((l) => norm(l)).join('\n');
      if (s.lines.map((l) => norm(l)).join('\n') !== stand) {
        refused.push({ verseId: s.id, lines: [...s.lines] });
      }
      return was;
    }
    /*
     * The witness moves with the letters. Leaving it behind made the engine
     * refuse the line — correctly, since the two no longer matched — and every
     * transcribed accent on it vanished from the document.
     */
    const carried = carryWitness(was.src, s.lines);
    if (carried.lost > 0) accentsLost.push({ verseId: s.id, count: carried.lost });
    return {
      ...was,
      src: {
        ...was.src,
        lines: [...s.lines],
        ...(carried.accented === undefined ? {} : { accented: carried.accented }),
      },
    };
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
