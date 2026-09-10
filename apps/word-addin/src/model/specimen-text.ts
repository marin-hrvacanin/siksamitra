/**
 * THE MARKED LINE IN THE SPECIMEN — one text, and one of every marking.
 *
 * Its own module, and its own data, for two reasons.
 *
 * IT IS NOT A CORPUS VERSE. Dropping four pādas of Durgā Sūktam into
 * somebody's blank Word document to demonstrate a style is putting scripture
 * in their file as a side effect of pressing a setup button. This is a line
 * assembled to carry one of each mark and nothing else.
 *
 * IT IS NOT INVENTED SCRIPTURE EITHER. `oṁ agnim īḷe puraḥ` is the opening of
 * the Ṛgveda's first sūkta, which is the most-quoted line of Sanskrit there
 * is; the markings on it here are a demonstration of the notation and are not
 * a claim about how that line is recited. The specimen says so, in the
 * paragraph above it.
 *
 * WHY THE OFFSETS ARE WRITTEN OUT. A marking is a half-open range over the
 * TEXT, so `[4, 9]` has to be the letters it says it is — and `agnim` moving
 * by one character because somebody edited the line would silently box the
 * wrong letters. `setup.test.ts` asserts each range against the substring it
 * is supposed to cover, by name, so a change to the text fails rather than
 * drifting.
 */
import { mark } from '@siksamitra/format';
import type { TextAndMarks } from '@siksamitra/format';

/** The line, and where each mark sits in it. `|` is a pause, not a letter. */
export const SPECIMEN_LINE = 'oṁ agnim īḷe puraḥ';

/**
 * What each range is meant to cover, so the numbers can be checked.
 *
 * Read by the test and by nothing else — the marks below carry the offsets
 * themselves, and a second copy of them that a reader has to keep in step
 * would be the very thing this file exists to prevent.
 */
export const SPECIMEN_RANGES: readonly { readonly what: string;
  readonly from: number; readonly to: number; readonly covers: string }[] = [
    { what: 'a short holding', from: 3, to: 8, covers: 'agnim' },
    { what: 'a long holding', from: 9, to: 12, covers: 'īḷe' },
    { what: 'an anudātta', from: 13, to: 14, covers: 'p' },
    { what: 'a svarita', from: 15, to: 16, covers: 'r' },
    { what: 'a pause, at the end', from: 18, to: 18, covers: '' },
  ];

export const specimenMarks = (): TextAndMarks => ({
  text: SPECIMEN_LINE,
  marks: [
    mark({ k: 'hold', from: 3, to: 8, v: 'short' }),
    mark({ k: 'hold', from: 9, to: 12, v: 'long' }),
    mark({ k: 'svara', from: 13, to: 14, v: 'anudatta' }),
    mark({ k: 'svara', from: 15, to: 16, v: 'svarita' }),
    mark({ k: 'pause', from: 18, to: 18, v: 'short' }),
  ],
});
