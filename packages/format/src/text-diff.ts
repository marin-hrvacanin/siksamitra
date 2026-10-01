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

/** What `carrySpacing` gives back: the text, and where each offset went. */
export interface Spacing {
  text: string;
  /** The offset in `text` of what was at offset `b` of `after`. */
  at: (b: number) => number;
}

/**
 * `before`'s SPACING, put back into `after` wherever the rules only
 * normalised it.
 *
 * The rules normalise whitespace — `derive` reads a no-break space as an
 * ordinary one, collapses a run of spaces and trims each line — so a re-run
 * over one of his lines rewrote his spacing: his 4 000-odd no-break spaces
 * (which keep two words on one line), his double spaces, and the tab that
 * indents a pāda after `|⏎`. Nothing about the recitation changes; the page
 * does.
 *
 * Aligned character by character by `textEdits`, over `before` with its
 * no-break spaces and tabs read as spaces — what the rules see — and NOT with
 * runs collapsed: the rules put two spaces around a pause themselves, and
 * collapsing counted them twice. Then:
 *
 *   - a space the rules left where his no-break space or tab was is his again;
 *   - an edit that only DELETED whitespace — his double space, his indent — is
 *     undone, and his whitespace stays;
 *   - anything else the rules changed stays as the rules made it.
 *
 * `at` carries every offset of `after` across, so the markings made on it
 * move with the text.
 */
export function carrySpacing(before: string, after: string): Spacing {
  if (before === after) return { text: after, at: (b) => b };
  const seen = before.replace(/[\u00a0\t]/g, ' ');
  const blank = (s: string): boolean => /^[ \u00a0\t]+$/.test(s);
  const pos: number[] = [];
  let out = '';
  let a = 0;
  let b = 0;
  const same = (): void => {
    pos[b] = out.length;
    out += after[b] === ' ' ? before[a]! : after[b]!;
    a += 1;
    b += 1;
  };
  for (const e of textEdits(seen, after)) {
    while (a < e.from) same();
    const gone = before.slice(e.from, e.to);
    if (e.inserted === 0 && blank(gone)) {
      out += gone;
    } else {
      for (let k = 0; k < e.inserted; k += 1, b += 1) { pos[b] = out.length; out += after[b]!; }
    }
    a = e.to;
  }
  while (b < after.length) same();
  pos[after.length] = out.length;
  return { text: out, at: (x) => pos[x] ?? out.length };
}
