/**
 * RULE ZERO, and how it says no.
 *
 * A verse with no source layer was hand-marked from a Word file or a PDF and
 * its marks exist nowhere else. Everything in this file is about one thing:
 * noticing before anything is changed, and then saying so in words the person
 * at the keyboard can act on.
 *
 * It is separate from `session.ts` because a refusal is a piece of WRITING as
 * much as a piece of logic — the owner read the old one on screen and asked
 * what it meant — and because the guard and the sentence belong together: a
 * change to what is refused should be made beside the change to what is said.
 */
import type { ChantSection } from '@siksamitra/format';
import { VERSE_GAP, type VerseSource } from './caret.js';
import { verseExtents } from './range.js';

/**
 * Rule zero at the surface: does this range reach a transcribed verse?
 *
 * A verse with no source layer was hand-marked from a Word file or a PDF and
 * its marks exist nowhere else. Refusing here — before anything is changed —
 * is the difference between a guard and an apology.
 *
 * THE EXTENT INCLUDES THE SEPARATORS. A transcribed verse is an atomic barrier
 * in the flat text, not just a span of letters: deleting the blank line either
 * side of one MERGES it into its neighbour, and the merge then re-derives the
 * neighbour from text that includes the transcription. Measured, all three of
 * these were allowed with no refusal at all — a single Backspace destroyed a
 * transcribed verse, and in one case discarded a whole verse's words:
 *
 *   Delete at the end of the verse before it
 *   Backspace at the start of the verse itself
 *   Backspace at the start of the verse after it
 *
 * so the barrier covers the gap on both sides.
 */
/**
 * WHICH verse, said the way the page says it.
 *
 * The refusal has to name what it refused or the reader is left guessing —
 * a selection can reach a transcribed verse without the caret ever being in
 * one. It used to name the internal id (`v-2`), which is what the DOCUMENT
 * calls it and not what anything on screen calls it. This says "verse 2",
 * counting from the top of the section exactly as the numbers beside the
 * lines do, so the sentence points at something the reader can see.
 */
export function named(section: ChantSection, blocked: readonly string[]): string {
  const numbers = blocked
    .map((id) => section.verses.findIndex((v) => v.id === id) + 1)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (numbers.length === 0) {
    return blocked.length === 1 ? 'This verse was' : 'These verses were';
  }
  if (numbers.length === 1) return `Verse ${numbers[0]} was`;
  const last = numbers[numbers.length - 1];
  return `Verses ${numbers.slice(0, -1).join(', ')} and ${last} were`;
}

export function attestedInRange(
  section: ChantSection,
  sources: readonly VerseSource[],
  from: number,
  to: number,
): string[] {
  const transcribed = new Set(
    section.verses.filter((v) => v.src === undefined).map((v) => v.id),
  );
  if (transcribed.size === 0) return [];

  const gap = VERSE_GAP.length;
  const names = new Set<string>();
  for (const extent of verseExtents(sources)) {
    if (!transcribed.has(extent.id)) continue;
    /*
     * A COLLAPSED caret is refused only inside the verse itself: typing at the
     * start of the verse AFTER a transcribed one merely prepends to that verse
     * and touches nothing. A RANGE is refused if it reaches the separator
     * either side, because deleting any part of that separator merges the
     * transcription into its neighbour — which is how one Backspace used to
     * destroy a transcribed verse, and how another discarded a whole verse's
     * words.
     */
    /*
     * STRICT OVERLAP, not touching.
     *
     * `<=` refused a range that merely ENDED where the barrier began — and
     * selecting a verse exactly, from its first letter to its last, is such a
     * range. Replacing a derived verse whose neighbours happen to be
     * transcribed was therefore refused outright, which is the one edit this
     * guard has no business stopping: it removes none of the separator and
     * merges nothing. A range must go INTO the gap to be refused, and the
     * three Backspaces that used to destroy a transcription all do.
     */
    const reaches = from === to
      ? from >= extent.start && from <= extent.end
      : from < extent.end + gap && to > extent.start - gap;
    if (reaches) names.add(extent.id);
  }
  return [...names];
}


/**
 * The refusal for an EDIT that reaches a transcribed verse.
 *
 * This read "whose marks are evidence rather than output — edit the
 * transcription itself, or give the verse a source layer first", which is this
 * program's private vocabulary and told the person nothing they could act on.
 * What they need to know is what the verse IS and why the keystroke did
 * nothing.
 */
export const refusalForEdit = (section: ChantSection, blocked: readonly string[]): string =>
  `${named(section, blocked)} copied from a marked source, so the marks on `
  + `${blocked.length === 1 ? 'it' : 'them'} are a record of what someone wrote `
  + 'by hand — the program cannot rebuild them, and so will not change the '
  + 'text under them.';

/** The refusal for a MARK aimed at a transcribed verse: there is nowhere to put it. */
export const refusalForMark = (section: ChantSection, verseId: string): string =>
  `${named(section, [verseId])} copied from a marked source, so the marks on it `
  + 'are a record of what someone wrote by hand — there is nowhere to put a new '
  + 'one without losing that record.';

/** The refusal for a command that names verses outside the section it addresses. */
export const refusalForOutside = (section: ChantSection, outside: readonly string[]): string =>
  `${named(section, outside)} not in "${section.title ?? section.id}" — a command `
  + 'may only touch the part of the document it names.';
