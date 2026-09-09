/**
 * THE EDITS BETWEEN TWO TEXTS, so markings can be moved across them.
 *
 * `shiftForEdit` moves a list of markings across ONE range replacement, which
 * is every edit a person makes: typing, deleting, pasting, splitting a line.
 * A re-run is not one of those. The rules can change a letter here and a space
 * three words away, and treating that as a single replacement from the first
 * difference to the last discards every marking between them — which is how
 * Puruṣa Sūktam lost 40 of its 61 syllable boundaries to a re-run that
 * altered eight characters.
 *
 * So the differences are found properly and applied one at a time, right to
 * left, so that an earlier edit cannot invalidate a later one's offsets.
 *
 * A LONGEST COMMON SUBSEQUENCE, computed by the ordinary dynamic program. It
 * is O(n·m), and the strings are one verse — a couple of hundred characters,
 * so a few tens of thousands of cells. The common case is answered before the
 * table is built at all: identical texts, and texts differing in one place,
 * are found by scanning from both ends.
 */

import { splitsCharacter } from './mark.js';

/** One contiguous replacement: `[from, to)` of the OLD text becomes `inserted`. */
export interface TextEdit3 {
  from: number;
  to: number;
  /** How many characters replace it. The characters themselves are in the new
   *  text and the caller already has it. */
  inserted: number;
}

/** How far two strings agree from the left. */
function head(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

/** How far they agree from the right, without crossing the head. */
function tail(a: string, b: string, from: number): number {
  const max = Math.min(a.length, b.length) - from;
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}

/**
 * Every replacement that turns `before` into `after`, left to right and
 * non-overlapping.
 *
 * Empty when the two are identical. One entry for a single change, which is
 * the case every keystroke produces and which is answered without the table.
 */
export function textEdits(before: string, after: string): TextEdit3[] {
  if (before === after) return [];
  const h = head(before, after);
  const t = tail(before, after, h);
  /* One contiguous change: the ends agree and everything between them is the
     replacement. Every ordinary edit lands here. */
  const midBefore = before.slice(h, before.length - t);
  const midAfter = after.slice(h, after.length - t);
  if (midBefore.length === 0 || midAfter.length === 0) {
    return snap([{ from: h, to: before.length - t, inserted: midAfter.length }], before);
  }

  /*
   * Otherwise line the two middles up. The table holds the length of the
   * longest common subsequence of each pair of prefixes; walking back from the
   * corner gives the alignment, and each run of non-matching characters is one
   * replacement.
   */
  const n = midBefore.length;
  const m = midAfter.length;
  const lcs = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number): number => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[at(i, j)] = midBefore[i] === midAfter[j]
        ? (lcs[at(i + 1, j + 1)] ?? 0) + 1
        : Math.max(lcs[at(i + 1, j)] ?? 0, lcs[at(i, j + 1)] ?? 0);
    }
  }

  const raw: TextEdit3[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && midBefore[i] === midAfter[j]) { i += 1; j += 1; continue; }
    /* A run of characters that do not line up: one replacement. */
    const from = i;
    const start = j;
    while (
      (i < n || j < m)
      && !(i < n && j < m && midBefore[i] === midAfter[j])
    ) {
      if (j >= m) { i += 1; continue; }
      if (i >= n) { j += 1; continue; }
      if ((lcs[at(i + 1, j)] ?? 0) >= (lcs[at(i, j + 1)] ?? 0)) i += 1;
      else j += 1;
    }
    raw.push({ from: h + from, to: h + i, inserted: j - start });
  }
  return snap(raw, before);
}

/**
 * Widen each edit until its ends fall between characters.
 *
 * A subsequence alignment works on code units and will happily cut between a
 * letter and the combining mark over it — `a` + U+0304 is one letter to a
 * reader, and a marking that began between them would box a macron on its own.
 * `assertMarks` refuses such a list, which in a re-run means a thrown error
 * rather than a result.
 *
 * Widening on the left includes a character the two texts AGREE on, so the
 * replacement grows by one on both sides; the same on the right. Edits that
 * meet after widening are merged, because two replacements that overlap cannot
 * both be applied.
 */
function snap(edits: readonly TextEdit3[], before: string): TextEdit3[] {
  const out: TextEdit3[] = [];
  for (const e of edits) {
    let { from, to, inserted } = e;
    while (from > 0 && splitsCharacter(before, from)) { from -= 1; inserted += 1; }
    while (to < before.length && splitsCharacter(before, to)) { to += 1; inserted += 1; }
    const last = out[out.length - 1];
    if (last !== undefined && from <= last.to) {
      last.to = Math.max(last.to, to);
      last.inserted += inserted;
      continue;
    }
    out.push({ from, to, inserted });
  }
  return out;
}
