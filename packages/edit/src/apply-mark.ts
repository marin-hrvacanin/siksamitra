/**
 * PLACING AND WITHDRAWING MARKS — the `mark` and `unmark` commands.
 *
 * Lifted out of `session.ts` when it passed 400 lines and the module gate said
 * so. It is a good seam rather than a convenient one: everything here is about
 * one question the other commands never ask — CAN THIS VERSE HOLD A MARK, and
 * where does the mark go if it cannot hold one the ordinary way.
 *
 * Three answers, in order of preference:
 *
 *   the verse has a source layer   the mark is an override in source
 *                                  coordinates, and the verse re-derives.
 *                                  This is the ordinary path and rule three.
 *   it can be given one            `adoptSource` derives a source whose marks
 *                                  reproduce the transcription exactly, and
 *                                  then the ordinary path applies.
 *   it cannot                      `markUnits` writes onto the letter, and the
 *                                  verse stays frozen.
 *
 * The last two exist because refusing was the alternative, and refusing is
 * what made the holding buttons dead on every document imported from Word.
 */
import type { ChantOverride, ChantSection, ChantProfileRef } from '@siksamitra/format';
import type { SrcMap } from '@siksamitra/engine';
import type { OverrideField } from '@siksamitra/engine';
import { adoptSource } from './adopt-source.js';
import { markUnits } from './mark-tokens.js';
import { verseSrcMap } from './derive-verse.js';
import { clearMarks, markLetters, type MarkPatch, type MarkReason, type UnitAddress } from './marks.js';
import { refusalForMark } from './rule-zero.js';

/** A `mark` or `unmark`, without the parts `apply` has already dealt with. */
export type MarkCommand =
  | { k: 'mark'; targets: readonly UnitAddress[]; patch: MarkPatch; why: MarkReason; note?: string }
  | { k: 'unmark'; targets: readonly UnitAddress[]; fields: readonly OverrideField[] };

export interface MarkResult {
  /** The section as the command leaves it — verses may have gained a source. */
  section: ChantSection;
  overrides: readonly ChantOverride[];
  /** Verses that must be re-derived. A frozen verse is never in here. */
  touched: Set<string>;
  /** Why a verse could not be marked. Never silent. */
  refusals: string[];
}

/** Group targets by verse, since a source map is per verse. */
function byVerse(targets: readonly UnitAddress[]): Map<string, UnitAddress[]> {
  const out = new Map<string, UnitAddress[]>();
  for (const t of targets) out.set(t.verseId, [...(out.get(t.verseId) ?? []), t]);
  return out;
}

/** The patch that a withdrawal is, when it has to be written onto a letter. */
const clearingPatch = (fields: readonly OverrideField[]): MarkPatch =>
  Object.fromEntries(fields.map((f) => [f, null]));

export function applyMark(
  section: ChantSection,
  docProfile: ChantProfileRef | undefined,
  startingOverrides: readonly ChantOverride[],
  command: MarkCommand,
): MarkResult {
  const groups = byVerse(command.targets);
  let working = section;
  let overrides = startingOverrides;
  const touched = new Set(groups.keys());
  const refusals: string[] = [];

  const replaceVerse = (id: string, next: ChantSection['verses'][number]): void => {
    working = { ...working, verses: working.verses.map((v) => (v.id === id ? next : v)) };
  };

  for (const [verseId, targets] of groups) {
    const verse = working.verses.find((v) => v.id === verseId);
    if (verse === undefined) {
      touched.delete(verseId);
      refusals.push(refusalForMark(section, verseId, 'it is not in this section'));
      continue;
    }

    /*
     * THE DERIVED MAP, and deliberately not `srcMapFor`.
     *
     * `srcMapFor` falls back to a map over a transcribed verse's recited text
     * so the pointer can address its letters. That map is for POINTING; an
     * override addressed through it would name an offset in a source the verse
     * does not have. Asking `verseSrcMap` keeps the null that sends this verse
     * down the adoption path below.
     */
    let map: SrcMap | null = verseSrcMap(verse, working, docProfile, overrides);

    if (map === null) {
      const adopted = adoptSource(verse, working, docProfile, overrides);

      /*
       * WHERE ADOPTION CANNOT GO, THE MARK STILL GOES.
       *
       * 42% of the corpus's transcribed verses cannot take a source layer: the
       * engine's sandhi and the transcription disagree about a LETTER, and no
       * source text derives to what is on the page. Refusing there put the
       * person back where they started — a selected letter, a pressed button,
       * nothing happening. `mark-tokens.ts` says why writing onto the letter
       * does not violate rule zero.
       */
      if (!adopted.ok) {
        const patch = command.k === 'mark' ? command.patch : clearingPatch(command.fields);
        const done = markUnits(verse, targets.map((t) => t.unit), patch);
        if (done.marked === 0) {
          touched.delete(verseId);
          refusals.push(refusalForMark(section, verseId, adopted.why));
          continue;
        }
        replaceVerse(verseId, done.verse);
        /* Frozen: it must be redrawn, never re-derived. */
        touched.delete(verseId);
        continue;
      }

      if (adopted.changed) {
        overrides = adopted.overrides;
        replaceVerse(verseId, adopted.verse);
      }
      map = verseSrcMap(adopted.verse, working, docProfile, overrides);
      if (map === null) {
        touched.delete(verseId);
        refusals.push(refusalForMark(section, verseId, 'it has no source map'));
        continue;
      }
    }

    overrides = command.k === 'mark'
      ? markLetters(overrides, map, targets, command.patch, command.why, command.note).overrides
      : clearMarks(overrides, map, targets, command.fields);
  }

  return { section: working, overrides, touched, refusals };
}
