/**
 * Rebasing — keeping hand-placed marks attached when the text moves.
 *
 * An override is addressed by source offset (`{verse, line, letter}`). That is
 * the right address for its purpose: it survives a rule change, a profile
 * change and a re-derivation, which is what rule zero requires. It does not
 * survive an edit to the text before it, and no addressing scheme would — the
 * letter may simply be gone.
 *
 * IT IS DONE IN FLAT COORDINATES, and that is the whole design. An earlier
 * version rebased per line: it aligned the old lines to the new ones, shifted
 * line indices, then diffed each line and shifted offsets within it. Three
 * passes over one edit, and they interfered — pasting a line above four marked
 * lines moved every mark onto the LAST line, because the pass walked upwards
 * and re-shifted the marks it had just shifted. Four owner-hand boxes became
 * one, and nothing was reported.
 *
 * A section's source is one string (`flatten`), an edit is one replacement in
 * it, and an override is one offset into it. In those terms the rebase is
 * arithmetic that cannot double-count:
 *
 *   before the edit   unchanged
 *   inside it         the letter is gone — dropped, and reported
 *   after it          shifted by the edit's measured length change
 *
 * and the new `(verse, line, column)` comes from `addressAt`, so a verse that
 * merged, split or was renamed is handled by the same arithmetic rather than by
 * a special case.
 *
 * EVERY REBASE IS CHECKED against the letter recorded on the override. Offsets
 * cannot tell a correct rebase from one that shifted a box a letter to the
 * left: both are valid offsets, and only the author would ever notice. A
 * failed check is REPORTED, never silently moved and never silently dropped —
 * `owner-hand` is evidence.
 */
import { norm } from '@siksamitra/engine';
import type { ChantOverride } from '@siksamitra/format';
import { addressAt, offsetOf, type FlatSource } from './caret.js';

/** One replacement in a section's flat source. */
export interface FlatEdit {
  /** Half-open, in characters of the flat source BEFORE the edit. */
  from: number;
  to: number;
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
 * Rebase a document's overrides across one flat edit of one section.
 *
 * `before` and `after` are the section's flat source on each side of the edit;
 * `edit` is the range that was replaced, in `before`'s coordinates. Overrides
 * belonging to other sections pass through untouched — they are addressed by
 * verse, and this function only knows the verses `before` contains.
 */
export function rebaseFlat(
  overrides: readonly ChantOverride[],
  before: FlatSource,
  after: FlatSource,
  edit: FlatEdit,
): RebaseResult {
  const out: ChantOverride[] = [];
  const dropped: RebaseResult['dropped'] = [];

  /** The verses this section held before the edit. Others are not ours. */
  const mine = new Set(before.lineStarts.map((l) => l.verseId));
  const delta = after.text.length - before.text.length;

  for (const ov of overrides) {
    if (!mine.has(ov.at.verse)) { out.push(ov); continue; }

    const at = offsetOf(before, { verseId: ov.at.verse, line: ov.at.line, column: ov.at.letter });
    if (at === null) {
      dropped.push({
        override: ov,
        why: `it addresses line ${ov.at.line} of "${ov.at.verse}", which is not in this section`,
      });
      continue;
    }
    if (at >= edit.from && at < edit.to) {
      dropped.push({
        override: ov,
        why: `the letter it marked was replaced (offset ${at} lies in `
          + `[${edit.from}, ${edit.to}))`,
      });
      continue;
    }

    const moved = at < edit.from ? at : at + delta;
    const address = addressAt(after, moved);
    if (address === null) {
      dropped.push({ override: ov, why: 'the section it belonged to is now empty' });
      continue;
    }

    const next: ChantOverride = {
      ...ov,
      at: { verse: address.verseId, line: address.line, letter: address.column },
    };

    if (ov.ch !== undefined) {
      // The check. Not "is the offset in range" — is the LETTER still the one
      // the author marked. A rebase that passes range and fails this is exactly
      // the silent one-letter drift the `ch` field exists to catch.
      const found = after.text.slice(moved, moved + ov.ch.length);
      if (found !== ov.ch) {
        dropped.push({
          override: ov,
          why: `after the edit, offset ${moved} holds "${found}" and not the `
            + `"${ov.ch}" this override was placed on`,
        });
        continue;
      }
    }
    out.push(next);
  }

  return { overrides: out, dropped };
}
