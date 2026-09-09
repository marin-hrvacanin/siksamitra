/**
 * TIDYING THE TEXT A CONVERSION PRODUCES, and moving the markings with it.
 *
 * Split out of `migrate.ts` at the 400-line module gate. It is the one place
 * that changes the text `toTextAndMarks` builds, so it is worth being able to
 * find.
 */
import { normalise, shiftForEdit } from './mark-ops.js';
import type { TextAndMarks } from './migrate.js';

/**
 * A LINE DOES NOT END IN A SPACE.
 *
 * A token stream that ends a line with a space token produces one in the text,
 * where it is invisible — and `derive` trims every line it returns, so the
 * same verse put through the rules comes back two characters shorter. `rerun`
 * then reads that as "the rules rewrote the letters" and discards every
 * marking in range: pressing Re-apply on Durgā Sūktam threw away 75 holdings
 * and shortened the verse from 331 syllables to 219, and the whole cause was
 * two spaces nobody could see.
 *
 * So they are removed here, where the text is made, and the markings move with
 * `shiftForEdit` — right to left, so an earlier removal cannot invalidate a
 * later one's offsets. 340 of the corpus's 1373 lines carried one.
 */
export function trimLineEnds({ text, marks, units }: TextAndMarks): TextAndMarks {
  const cuts: { from: number; to: number }[] = [];
  let at = 0;
  for (const line of text.split('\n')) {
    const kept = line.replace(/[ 	]+$/u, '');
    if (kept.length !== line.length) cuts.push({ from: at + kept.length, to: at + line.length });
    at += line.length + 1;
  }
  if (cuts.length === 0) return { text, marks, units };

  let out = text;
  let moved = marks;
  let spans = units ?? [];
  for (const cut of [...cuts].reverse()) {
    out = out.slice(0, cut.from) + out.slice(cut.to);
    const shift = shiftForEdit(moved, { from: cut.from, to: cut.to, inserted: 0 });
    moved = shift.marks;
    const gone = cut.to - cut.from;
    spans = spans.map((u) => (u.from >= cut.to
      ? { from: u.from - gone, to: u.to - gone }
      : u));
  }
  return { text: out, marks: normalise(moved), units: spans };
}
