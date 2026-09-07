/**
 * Rebasing — keeping hand-placed marks attached when the text moves.
 *
 * An override is addressed by source offset (`{verse, line, letter}`). That is
 * the right address for its purpose: it survives a rule change, a profile
 * change and a re-derivation, which is what rule zero requires. It does not
 * survive an edit to the text before it, and no addressing scheme would — the
 * letter may simply be gone.
 *
 * So every text edit rebases the overrides it moved, and every rebase is
 * CHECKED against the letter recorded on the override. Arithmetic cannot tell
 * a correct rebase from one that shifted a box one letter left: both give a
 * valid offset, and only the author would ever notice. An override that fails
 * its check is REPORTED, never silently moved and never silently dropped —
 * `owner-hand` is evidence.
 *
 * The invariant this module maintains, and the reason it can do arithmetic at
 * all: **a stored source line is always canonical.** `norm()` is idempotent on
 * it, so an offset means one thing. `canonicalInsert` is what keeps that true.
 */
import { norm } from '@siksamitra/engine';
import type { ChantOverride } from '@siksamitra/format';

/** One replacement within one line of one verse. */
export interface LineEdit {
  verseId: string;
  line: number;
  /** Half-open, in characters of the canonical line. */
  from: number;
  to: number;
  insert: string;
}

export interface RebaseResult {
  overrides: ChantOverride[];
  /** Overrides whose letter was deleted, or whose check failed. */
  dropped: { override: ChantOverride; why: string }[];
}

/**
 * What an insertion ACTUALLY inserts, once the line has been normalised.
 *
 * `norm` folds case, commas and the conjunct controls (all length-preserving)
 * and collapses whitespace and trims (both length-changing). The
 * length-changing part is what would make an offset ambiguous, so this
 * function settles it by MEASUREMENT rather than by prediction: it normalises
 * the whole edited line and reports the difference in length.
 *
 * Predicting was tried first and was wrong in a way worth recording, because
 * it is the obvious implementation: `norm(insert)` on the insertion ALONE
 * trims it, so typing a single space between two syllables inserted nothing at
 * all. A fold defined on whole lines cannot be applied to a fragment.
 *
 * Consequences, all of them measured here rather than assumed:
 *  - a space typed next to an existing space inserts nothing;
 *  - a space typed at either end of a line inserts nothing, because the trim
 *    would remove it;
 *  - a space typed between two letters inserts a space.
 *
 * The caller uses the length of the result to place the caret, so the caret
 * lands where the text did.
 */
export function canonicalInsert(
  line: string,
  from: number,
  to: number,
  insert: string,
): string {
  const start = Math.max(0, Math.min(from, to, line.length));
  const end = Math.min(Math.max(from, to), line.length);
  const next = norm(line.slice(0, start) + insert + line.slice(end));
  const length = next.length - line.length + (end - start);
  return length <= 0 ? '' : next.slice(start, start + length);
}

/**
 * Apply one edit to one canonical line, returning a canonical line.
 *
 * The caret is placed by the MEASURED length of what was inserted, not by the
 * length of what was typed: a collapsed space must not push the caret past a
 * character that is not there.
 */
export function editLine(
  line: string,
  from: number,
  to: number,
  insert: string,
): { line: string; insert: string; caret: number } {
  const start = Math.max(0, Math.min(from, to, line.length));
  const end = Math.min(Math.max(from, to), line.length);
  const next = norm(line.slice(0, start) + insert + line.slice(end));
  const mid = canonicalInsert(line, start, end, insert);
  return { line: next, insert: mid, caret: Math.min(start + mid.length, next.length) };
}

/**
 * Move one override across one edit.
 *
 * Three cases, and the middle one is the only interesting one:
 *  - entirely before the edit: unchanged.
 *  - inside the replaced range: its letter was replaced. Dropped, reported.
 *  - after: shifted by the line's measured length delta.
 */
function shift(
  ov: ChantOverride,
  edit: LineEdit,
  before: string,
  after: string,
): { ov: ChantOverride } | { why: string } {
  if (ov.at.verse !== edit.verseId || ov.at.line !== edit.line) return { ov };

  const at = ov.at.letter;
  if (at < edit.from) return { ov };
  if (at < edit.to) {
    return {
      why: `the letter it marked was replaced (offset ${at} lies in `
        + `[${edit.from}, ${edit.to}))`,
    };
  }

  /*
   * The MEASURED delta over the whole line, not the arithmetic one.
   * `canonicalInsert` has already settled the seam, so the only length change
   * is the replacement itself and the two agree today — but measuring means a
   * future fold that alters length cannot make this quietly wrong.
   */
  const moved = at + (after.length - before.length);
  const next: ChantOverride = { ...ov, at: { ...ov.at, letter: moved } };

  if (ov.ch !== undefined) {
    // The check. Not "is the offset in range" — is the LETTER still the one
    // the author marked. A rebase that passes range and fails this is exactly
    // the silent one-letter drift the `ch` field exists to catch.
    const found = after.slice(moved, moved + ov.ch.length);
    if (found !== ov.ch) {
      return {
        why: `after the edit, offset ${moved} holds "${found}" and not the `
          + `"${ov.ch}" this override was placed on`,
      };
    }
  }
  return { ov: next };
}

/** Rebase a document's overrides across one line edit. */
export function rebase(
  overrides: readonly ChantOverride[],
  edit: LineEdit,
  before: string,
  after: string,
): RebaseResult {
  const out: ChantOverride[] = [];
  const dropped: RebaseResult['dropped'] = [];
  for (const ov of overrides) {
    const r = shift(ov, edit, before, after);
    if ('ov' in r) out.push(r.ov);
    else dropped.push({ override: ov, why: r.why });
  }
  return { overrides: out, dropped };
}

/**
 * Rebase across a change in the NUMBER of lines in a verse.
 *
 * Splitting a line moves every override on every later line down one. Nothing
 * clever, but forgetting it silently moves every mark in the rest of the verse
 * — which is worse than dropping them, because it looks fine.
 */
export function rebaseLines(
  overrides: readonly ChantOverride[],
  verseId: string,
  atLine: number,
  delta: number,
): ChantOverride[] {
  if (delta === 0) return [...overrides];
  return overrides.map((ov) => (
    ov.at.verse === verseId && ov.at.line >= atLine
      ? { ...ov, at: { ...ov.at, line: ov.at.line + delta } }
      : ov
  ));
}
