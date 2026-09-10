/**
 * WHAT MAY BE DONE TO A LIST OF MARKINGS.
 *
 * Split out of `mark.ts`, which holds what a marking IS and the invariants it
 * must satisfy; this holds every operation over a list of them. The module gate
 * asked for the split at 414 lines and it is a good seam: nothing here decides
 * what is legal, and nothing there changes anything.
 *
 * ONE SET OF RULES. The editor, the marking rules, the importers and the
 * command line all move markings around, and two implementations of "apply a
 * holding to a selection" is two answers to the same question. `assertMarks`
 * runs after every one of these in the callers that can afford it.
 */
import {
  compareMarks, LETTER_KINDS, MERGING_KINDS, sameValue,
  type Mark, type MarkKind,
} from './mark.js';

/* ── the algebra ──────────────────────────────────────────────────────────── */

/**
 * Sort, then fuse any two markings of one kind that meet and agree.
 *
 * PER KIND, not by position in the sorted list. The first version walked the
 * sorted array and fused neighbours, which fails whenever a marking of another
 * kind sorts between two that should join: a svara over letters 10 to 12 with
 * a candrabindu on letter 11 came out of the editor as svara 10-11 and svara
 * 11-12, because a  sat between them in the array and the two halves
 * never met. Grouping by kind first makes adjacency mean what it says.
 */
export function normalise(marks: readonly Mark[]): Mark[] {
  const byKind = new Map<MarkKind, Mark[]>();
  for (const m of marks) byKind.set(m.k, [...(byKind.get(m.k) ?? []), m]);

  const out: Mark[] = [];
  for (const [kind, list] of byKind) {
    if (!MERGING_KINDS.has(kind)) { out.push(...list); continue; }
    const sorted = [...list].sort(compareMarks);
    for (const m of sorted) {
      const prev = out[out.length - 1];
      if (prev !== undefined && prev.k === kind && prev.to === m.from && sameValue(prev, m)) {
        out[out.length - 1] = { ...prev, to: m.to };
        continue;
      }
      out.push(m);
    }
  }
  return out.sort(compareMarks);
}

/** How much of `from..to` a kind already covers. */
export function coverage(
  marks: readonly Mark[],
  k: MarkKind,
  from: number,
  to: number,
  v?: string,
): 'all' | 'some' | 'none' {
  if (to <= from) {
    const at = marks.some((m) => m.k === k && (v === undefined || m.v === v)
      && m.from <= from && m.to >= to);
    return at ? 'all' : 'none';
  }
  /* Walk the range and count what is covered, so a gap in the middle reads
     `some` rather than `all` — which is what makes a mixed selection turn
     fully on rather than toggling itself off. */
  let at = from;
  let covered = 0;
  const relevant = marks
    .filter((m) => m.k === k && (v === undefined || m.v === v) && m.to > from && m.from < to)
    .sort(compareMarks);
  for (const m of relevant) {
    const start = Math.max(m.from, from);
    const end = Math.min(m.to, to);
    if (start > at) at = start;
    if (end > at) { covered += end - at; at = end; }
  }
  if (covered === 0) return 'none';
  return covered >= to - from ? 'all' : 'some';
}

/**
 * Remove a kind's coverage from a range, splitting whatever straddles the edge.
 *
 * `keep` decides which markings are touched — a re-run in keep-hand mode passes
 * one that spares the markings a person placed.
 */
export function removeMark(
  marks: readonly Mark[],
  k: MarkKind,
  from: number,
  to: number,
  keep: (m: Mark) => boolean = () => false,
): Mark[] {
  const out: Mark[] = [];
  for (const m of marks) {
    const untouched = m.k !== k || keep(m) || m.to < from || m.from > to
      || (m.from === m.to ? m.from < from || m.from > to : m.to <= from || m.from >= to);
    if (untouched) { out.push(m); continue; }
    /* The part before the cut, and the part after it. Either may be empty. */
    if (m.from < from) out.push({ ...m, to: from });
    if (m.to > to) out.push({ ...m, from: to });
  }
  return normalise(out);
}

/** Cover a range with a marking, replacing whatever that kind had there. */
export function applyMark(marks: readonly Mark[], m: Mark): Mark[] {
  const cleared = removeMark(marks, m.k, m.from, m.to);
  return normalise([...cleared, m]);
}

/**
 * Bold's rule, and the owner's: on unless it is already fully on.
 *
 * A MIXED selection turns fully on rather than toggling each part, so one press
 * always has one visible meaning. A subset of a marked run reads `all` within
 * itself and therefore turns off, splitting the run in two — which is what
 * "I can take a subset and apply again and it's erased" asks for.
 */
export function toggleMark(marks: readonly Mark[], m: Mark): Mark[] {
  return coverage(marks, m.k, m.from, m.to, m.v) === 'all'
    ? removeMark(marks, m.k, m.from, m.to)
    : applyMark(marks, m);
}

/* ── moving with the text ─────────────────────────────────────────────────── */

export interface TextEdit {
  /** The range replaced. */
  from: number;
  to: number;
  /** How many characters went in. */
  inserted: number;
}

/**
 * Carry markings across an edit to the text.
 *
 * The rules, and each one is a decision rather than arithmetic:
 *
 *   - entirely before the edit — untouched;
 *   - entirely after — shifted by the difference;
 *   - containing the edit — grows or shrinks by the difference, so typing
 *     inside a held word stays held, which is what a person expects;
 *   - overlapping one edge — clipped to the edit's boundary;
 *   - entirely inside the replaced range — GONE, and the caller is told,
 *     because a holding whose letters were all deleted has nothing to be a
 *     holding of, and silently moving it to a neighbour marks a letter nobody
 *     marked.
 */
export function shiftForEdit(
  marks: readonly Mark[],
  edit: TextEdit,
): { marks: Mark[]; dropped: Mark[] } {
  const delta = edit.inserted - (edit.to - edit.from);
  const kept: Mark[] = [];
  const dropped: Mark[] = [];
  const move = (at: number): number => {
    if (at <= edit.from) return at;
    if (at >= edit.to) return at + delta;
    return edit.from + Math.min(at - edit.from, edit.inserted);
  };

  /**
   * A MARKING'S START, when the marking must not take in what was typed.
   *
   * `move` leaves an offset alone at `edit.from` and pushes everything after
   * it, so a marking whose START is exactly the insertion point keeps its
   * start and gains its end: it GROWS over the new letters. For a holding
   * that is right — typing at the edge of a box belongs in the box, which is
   * bold's behaviour.
   *
   * For an accent it is wrong, and it is the owner's report: "when I type,
   * that new character also carries a svara". A svara is a property OF a
   * letter, so the marking has to move along with the letter it is about.
   * `<` rather than `<=`, which is the whole difference: at the insertion
   * point the start moves too.
   *
   * Only a pure insertion differs. For a deletion or a replacement the middle
   * branch answers, and it answers the same for both. Which kinds are which is
   * `LETTER_KINDS`, and it is stated once because Lexical asks the same
   * question through `canInsertTextBefore`.
   */
  const moveStart = (at: number): number => {
    if (at < edit.from) return at;
    if (at >= edit.to) return at + delta;
    return edit.from + Math.min(at - edit.from, edit.inserted);
  };

  for (const m of marks) {
    if (m.from === m.to) {
      /* A point marking inside the replaced range has lost its place. */
      if (m.from > edit.from && m.from < edit.to) { dropped.push(m); continue; }
      const at = move(m.from);
      kept.push({ ...m, from: at, to: at });
      continue;
    }
    if (m.from >= edit.from && m.to <= edit.to && edit.to > edit.from) {
      dropped.push(m);
      continue;
    }
    const from = LETTER_KINDS.has(m.k) ? moveStart(m.from) : move(m.from);
    const to = move(m.to);
    if (to <= from) { dropped.push(m); continue; }
    kept.push({ ...m, from, to });
  }
  return { marks: normalise(kept), dropped };
}

/* ── reading ──────────────────────────────────────────────────────────────── */

/** The markings of one kind covering a position, in stage order. */
export const marksAt = (marks: readonly Mark[], k: MarkKind, at: number): Mark[] =>
  marks.filter((m) => m.k === k && m.from <= at && (m.to > at || (m.from === m.to && m.from === at)));

/** Every marking that touches a range. */
export const marksIn = (marks: readonly Mark[], from: number, to: number): Mark[] =>
  marks.filter((m) => (m.from === m.to ? m.from >= from && m.from <= to : m.to > from && m.from < to));
