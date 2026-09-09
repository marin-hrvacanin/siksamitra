/**
 * WHERE THE SELECTION IS, IN THE MODEL'S COORDINATES.
 *
 * Word can say how many characters into a paragraph the selection starts. That
 * number is NOT a model offset, and the gap is not an edge case:
 *
 *   - a svara is a combining character in a `Svara` run; the model holds it as
 *     a `svara` marking and its character is not in the text at all;
 *   - so is the svarabhakti dot `·`, and the raised reading aid after an
 *     anusvāra;
 *   - the importer puts a space either side of a daṇḍa, so `॥1॥` in Word is
 *     `॥ 1 ॥` in the model and everything after it has moved by two.
 *
 * Apply a holding at Word's offset and it lands on the wrong letter — by one
 * for every accent earlier in the line, which on a Ṛgvedic pāda is four or
 * five.
 *
 * HOW THE MAP IS BUILT. By asking the decoder, one prefix at a time, rather
 * than by a second copy of its rules. The paragraph's runs are cut at each
 * character position, the prefix is decoded, and the length of the model text
 * it produces is the answer for that position. Quadratic in the length of a
 * paragraph, which is a line of a verse — sixty characters, sixty decodes.
 *
 * THE SENTINEL. `tokensFromRuns` drops trailing spaces, so the prefix `"na "`
 * decodes to `"na"` and the space between two words would map to nowhere. A
 * one-letter run is appended to every prefix so the space is no longer
 * trailing, and its one character is subtracted again. It goes in a run of its
 * own: `parseLetters` runs per run, so it cannot combine with the letter before
 * it into a digraph.
 */
import type { WordRun } from '@siksamitra/interop';
import { decodeRuns } from './paragraph.js';

/** A letter that is one character in every script this program reads. */
const SENTINEL: WordRun = { text: 'a', rStyle: null, superscript: false };

export interface OffsetMap {
  /** The characters Word shows, in run order — what Word counts. */
  wordText: string;
  /** The model text these runs decode to. */
  text: string;
  /** For each Word offset `0..wordText.length`, the model offset. */
  model: readonly number[];
}

/** The runs truncated to the first `n` characters of the Word text. */
function prefix(runs: readonly WordRun[], n: number): WordRun[] {
  const out: WordRun[] = [];
  let seen = 0;
  for (const r of runs) {
    if (seen >= n) break;
    const take = Math.min(r.text.length, n - seen);
    out.push(take === r.text.length ? r : { ...r, text: r.text.slice(0, take) });
    seen += take;
  }
  return out;
}

export function offsetMap(runs: readonly WordRun[]): OffsetMap {
  const wordText = runs.map((r) => r.text).join('');
  const whole = decodeRuns(runs);
  const model: number[] = [];
  let highest = 0;
  for (let i = 0; i <= wordText.length; i += 1) {
    const decoded = decodeRuns([...prefix(runs, i), SENTINEL]);
    /*
     * Clamped upward because a prefix can decode SHORTER than a shorter prefix
     * does: cutting inside `॥1॥` gives `॥1`, which the importer spaces as
     * `॥ 1` — two characters — while the whole thing is `॥ 1 ॥`, four. A map
     * that went backwards would let a selection's end precede its start.
     */
    highest = Math.max(highest, decoded.text.length - SENTINEL.text.length);
    model.push(Math.min(highest, whole.text.length));
  }
  return { wordText, text: whole.text, model };
}

/** The model offset a Word offset points at. */
export function toModel(map: OffsetMap, wordAt: number): number {
  const at = Math.max(0, Math.min(wordAt, map.wordText.length));
  return map.model[at] ?? map.text.length;
}

/**
 * The Word offset a model offset points at — the LAST one that reaches it.
 *
 * Several Word positions map to one model position, because an accent, a
 * svarabhakti dot and a raised reading aid are characters in Word and markings
 * in the model. The last of them is the answer at both ends of a range: at the
 * START it puts the boundary AFTER the previous letter's accent, so a box does
 * not open on somebody else's svara; at the END it puts the boundary after the
 * last letter's own accent, so the range covers the letter whole.
 *
 * Taking the first instead was measured wrong on 26 of 247 holdings in the
 * corpus — every one of them a box whose preceding letter is accented, which on
 * a Ṛgvedic pāda is most of them.
 */
export function toWord(map: OffsetMap, modelAt: number): number {
  let last = 0;
  for (let i = 0; i < map.model.length; i += 1) {
    const at = map.model[i] ?? 0;
    if (at > modelAt) break;
    if (at === modelAt) last = i;
  }
  return last;
}

/**
 * A Word selection as a model range.
 *
 * Ordered, because Word reports a selection made right-to-left with its start
 * after its end, and a reversed range fails the model's own invariant check
 * rather than marking anything.
 */
export function modelRange(map: OffsetMap, wordFrom: number, wordTo: number): [number, number] {
  const from = toModel(map, wordFrom);
  const to = toModel(map, wordTo);
  return from <= to ? [from, to] : [to, from];
}
