/**
 * Editing the accented witness alongside the letters.
 *
 * THE PROBLEM, seen on screen before it was seen in a test. A verse whose
 * svaras are a transcription stores them as `src.accented`: the same letters
 * with the accents written in as combining marks, one slot per letter. Typing
 * one character into such a verse changed `src.lines` and left `src.accented`
 * as it was — so the witness no longer matched the text, the engine refused
 * the whole line rather than sliding the accents along it (which is right),
 * and every accent on that line disappeared from the document. Measured in the
 * walkthrough: 156 svaras became 151 after typing three characters.
 *
 * So the same edit is applied to both. An accent inside the replaced range goes
 * with the letter it belonged to; every accent outside it stays exactly where
 * it was. Nothing is guessed and nothing is moved.
 *
 * The offsets differ between the two strings — the witness has extra
 * characters — so a plain-line offset is translated by COUNTING LETTERS, which
 * is the one thing the two strings agree on.
 */
import type { ChantVerseSource } from '@siksamitra/format';

/** The combining marks a witness may carry. Not letters. */
const MARKS = new Set(['̍', '̎', '̱']);

/** One replacement that turns `before` into `after`. */
function replacement(before: string, after: string): { from: number; to: number; insert: string } {
  let prefix = 0;
  const max = Math.min(before.length, after.length);
  while (prefix < max && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < max - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1;
  return {
    from: prefix,
    to: before.length - suffix,
    insert: after.slice(prefix, after.length - suffix),
  };
}

/**
 * A plain-line offset, as an offset into the witness.
 *
 * The boundary goes AFTER the marks of the letter it follows, because a mark
 * belongs to the letter before it. Placing it before them cost an accent that
 * had nothing to do with the edit: deleting the `d` of `bha̱draṁ` produced the
 * range `̱d`, so the anudātta on the surviving `a` went with the `d`. Caught
 * by the property test over every single-character deletion, not by an
 * example — the examples all happened to edit at or before an accent.
 */
function witnessOffset(witness: string, letters: number): number {
  let seen = 0;
  let at = 0;
  while (at < witness.length && seen < letters) {
    if (!MARKS.has(witness[at]!)) seen += 1;
    at += 1;
  }
  // Only past a letter: a mark at offset 0 has no letter to belong to, and
  // skipping it there would delete it for an edit that never touched it.
  if (letters > 0) {
    while (at < witness.length && MARKS.has(witness[at]!)) at += 1;
  }
  return at;
}

/** How many accents a witness line carries. */
export const accentsIn = (line: string): number =>
  [...line].filter((c) => MARKS.has(c)).length;

/**
 * Apply the change between two plain lines to the witness of the first.
 *
 * The inserted text carries no accents — it was just typed — so the marks in
 * the replaced range are the ones that go. The count of those is returned, so
 * the caller can say what the edit cost rather than leaving it to be noticed
 * in a PDF.
 */
export function editWitness(
  witness: string,
  before: string,
  after: string,
  insert: string,
): { witness: string; lost: number } {
  if (before === after) return { witness, lost: 0 };
  const change = replacement(before, after);
  const from = witnessOffset(witness, change.from);
  const to = witnessOffset(witness, change.to);
  const cut = witness.slice(from, to);
  return {
    witness: witness.slice(0, from) + insert + witness.slice(to),
    lost: accentsIn(cut),
  };
}

/**
 * Carry a verse's witness across a change to its lines.
 *
 * Lines are matched by index, which is what the source layer means by a line:
 * `lines[i]` and `accented[i]` are the same line twice. A change in the NUMBER
 * of lines cannot be carried this way, and is reported instead — the caller
 * then re-derives without a witness for the lines it could not match, which
 * loses those accents and says so.
 */
export function carryWitness(
  src: ChantVerseSource,
  lines: readonly string[],
): { accented: string[] | undefined; lost: number; unmatched: number } {
  const witness = src.accented;
  if (witness === undefined) return { accented: undefined, lost: 0, unmatched: 0 };

  let lost = 0;
  let unmatched = 0;
  const out: string[] = [];

  lines.forEach((line, i) => {
    const was = src.lines[i];
    const had = witness[i];
    if (was === undefined || had === undefined) {
      // A line the witness never had: it contributes no accents, and the plain
      // text stands in for it so the two arrays stay the same length.
      unmatched += 1;
      out.push(line);
      return;
    }
    const change = replacement(was, line);
    const result = editWitness(had, was, line, change.insert);
    lost += result.lost;
    out.push(result.witness);
  });

  // A line the edit removed takes its accents with it.
  for (let i = lines.length; i < witness.length; i += 1) lost += accentsIn(witness[i]!);

  return { accented: out, lost, unmatched };
}
