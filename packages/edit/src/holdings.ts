/**
 * The holding invariants, enforced rather than hoped for.
 *
 * A holding is a box drawn over one or more letters. Four things must be true
 * of every one of them, in every document, after every edit — the owner stated
 * these as requirements, and each one is a defect seen in a real file:
 *
 *   1. **Never empty.** A box covers at least one letter. A `hg` group whose
 *      members all lost their `hold` leaves an id nothing draws, and a `hold`
 *      on something that is not a letter draws a box around nothing.
 *   2. **Never nested.** No letter is inside two boxes. `hold` being a single
 *      field makes the obvious nesting unrepresentable; what is representable
 *      is two runs WITHIN ONE SYLLABLE sharing a group id with a gap between
 *      them, which a renderer spanning min..max draws as one box swallowing
 *      the gap. That is nesting by another name, and it produced an 80-letter
 *      box here.
 *
 *      MEASURED, before this was written down: a group id repeated in a LATER
 *      syllable is not a defect, and the shipped corpus does it 537 times,
 *      because `hg` only ever has to tell two boxes apart that TOUCH. Reading
 *      it as a document-wide identifier is what produced the 80-letter box —
 *      the reader was wrong, not the data. Within a syllable the corpus has
 *      4 788 groups and every one is contiguous.
 *   3. **Adjacent same-type boxes are one box.** Two adjacent letters both
 *      marked `short` are one thin box, not two touching ones. Left alone this
 *      is visible: two strokes where the author drew one.
 *   4. **A run does not cross a syllable boundary.** This is the owner's older
 *      convention and it is deliberate — see the note in `holdingSpans`. The
 *      newer convention groups geminates across the boundary; this program
 *      does not follow it.
 *
 * Pure, and shared by three callers: the session asserts it after every
 * command, the invariant tests use it as the oracle, and the importer uses it
 * to report what a Word file actually contained.
 */
import type { ChantSyllable, ChantToken, ChantUnit } from '@siksamitra/format';

export interface HoldingProblem {
  /** Which invariant. Stable ids: they appear in test names and in warnings. */
  code: 'empty-group' | 'split-group' | 'unmerged-adjacent' | 'hold-without-letter';
  message: string;
  /** Token index, and unit index within it when the problem is a letter's. */
  token: number;
  unit?: number;
}

const isSyl = (t: ChantToken): t is ChantSyllable => t.t === 'syl';

/**
 * Check the four invariants. An empty result is the only acceptable one.
 *
 * Reports EVERY problem rather than the first: an importer wants the list, and
 * a test that only ever sees one problem per document hides the others behind
 * whichever happens to come first.
 */
export function holdingProblems(tokens: readonly ChantToken[]): HoldingProblem[] {
  const problems: HoldingProblem[] = [];

  tokens.forEach((token, t) => {
    if (!isSyl(token)) return;

    /** group id → the unit indices carrying it, within THIS syllable. */
    const groups = new Map<number, number[]>();

    token.units.forEach((u, i) => {
      if (u.hg !== undefined && u.hold === undefined) {
        problems.push({
          code: 'empty-group',
          message: `letter "${u.c}" carries group ${u.hg} but no holding`,
          token: t,
          unit: i,
        });
      }
      if (u.hold !== undefined && u.c === '') {
        problems.push({
          code: 'hold-without-letter',
          message: 'a holding on an empty letter draws a box around nothing',
          token: t,
          unit: i,
        });
      }
      if (u.hg !== undefined) groups.set(u.hg, [...(groups.get(u.hg) ?? []), i]);
    });

    // Invariant 2, within the syllable — see the header for why the bound is
    // the syllable and not the verse.
    for (const [id, members] of groups) {
      if (members.every((m, k) => m === members[0]! + k)) continue;
      problems.push({
        code: 'split-group',
        message: `group ${id} covers letters ${members.join(', ')} of one syllable, `
          + 'which is not a contiguous run',
        token: t,
        unit: members[0]!,
      });
    }

    // Invariant 3. Two adjacent letters with the same holding length must
    // share a group, or they draw as two touching boxes.
    for (let i = 1; i < token.units.length; i += 1) {
      const prev = token.units[i - 1]!;
      const here = token.units[i]!;
      if (here.hold === undefined || prev.hold !== here.hold) continue;
      if (prev.hg !== here.hg) {
        problems.push({
          code: 'unmerged-adjacent',
          message: `"${prev.c}${here.c}" are both ${here.hold} but in groups `
            + `${String(prev.hg)} and ${String(here.hg)} — one box, not two`,
          token: t,
          unit: i,
        });
      }
    }
  });

  return problems;
}

/**
 * Rewrite group ids so the invariants hold, changing no `hold` value.
 *
 * The distinction matters: this function never adds or removes a holding, so
 * it cannot change what the author marked. It only decides which marked
 * letters share a box — presentation of the same fact, and the part a hand
 * edit gets wrong.
 *
 * It also changes AS LITTLE AS POSSIBLE. A run that already carries a
 * consistent id keeps it; a fresh id is minted only for a run that has none,
 * or that would otherwise collide with another run in the same syllable.
 * Renumbering from one would have been simpler and would have rewritten a
 * group id in all eleven shipped documents — changing their hashes to no
 * purpose, and making this function's output disagree with the engine's for
 * text neither of them had any trouble with.
 */
export function normaliseHoldings(
  tokens: readonly ChantToken[],
): { tokens: ChantToken[]; changed: number } {
  // One counter for the whole verse, past every id already in use, so a minted
  // id cannot collide with one further down the verse either.
  let next = 1;
  for (const token of tokens) {
    if (!isSyl(token)) continue;
    for (const u of token.units) {
      if (u.hg !== undefined && u.hg >= next) next = u.hg + 1;
    }
  }

  let changed = 0;

  const out = tokens.map((token): ChantToken => {
    if (!isSyl(token)) return token;

    const units: ChantUnit[] = [];
    /** Ids already used by a run in THIS syllable — invariant 2. */
    const usedHere = new Set<number>();
    let i = 0;

    while (i < token.units.length) {
      const u = token.units[i]!;
      if (u.hold === undefined) {
        // An orphan group id is dropped: invariant 1. `hg` without `hold` is
        // not a lesser mark, it is a mark nothing draws.
        if (u.hg !== undefined) {
          const { hg: _drop, ...rest } = u;
          units.push(rest);
          changed += 1;
        } else {
          units.push(u);
        }
        i += 1;
        continue;
      }

      // The run: adjacent letters of the SAME length, within this syllable.
      let j = i;
      while (j < token.units.length && token.units[j]!.hold === u.hold) j += 1;

      // Keep the id the run already agrees on; mint one only if there is none
      // or it is taken by an earlier run in this syllable.
      const first = u.hg;
      const id = first !== undefined && !usedHere.has(first)
        ? first
        : (() => { const fresh = next; next += 1; return fresh; })();
      usedHere.add(id);

      for (let k = i; k < j; k += 1) {
        const unit = token.units[k]!;
        if (unit.hg !== id) changed += 1;
        units.push({ ...unit, hg: id });
      }
      i = j;
    }

    return { ...token, units };
  });

  return { tokens: out, changed };
}

/**
 * Assert the invariants, throwing with the whole list.
 *
 * Used by the session after every command. A holding defect that reaches the
 * document is a defect the author has to find by eye in a PDF, so failing
 * loudly at the edit is strictly kinder than saving quietly.
 */
export function assertHoldings(tokens: readonly ChantToken[], where: string): void {
  const problems = holdingProblems(tokens);
  if (problems.length === 0) return;
  const lines = problems.map((p) => `  ${p.code} at token ${p.token}: ${p.message}`);
  throw new Error(`holding invariants violated in ${where}:\n${lines.join('\n')}`);
}
