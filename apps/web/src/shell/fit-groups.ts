/**
 * WHICH RIBBON GROUPS FIT — the arithmetic, on its own.
 *
 * Extracted from `useOverflow` because this is where three separate bugs
 * lived, and none of them could be tested: the fit was computed inside a hook,
 * verified only by resizing a real browser and looking, and each bug survived
 * a green gate.
 *
 *   1. the folded button's own width was not counted, so a "collapse" left
 *      18px of ribbon past the edge;
 *   2. the running total was grown from the front and never reconsidered, so
 *      once the affordance was added the row was over budget with no way back
 *      — 59px at 400px;
 *   3. the widths were measured before the interface font had loaded, ~3%
 *      narrow, which is exactly enough to fit a group that then does not.
 *
 * Only (3) is about measurement. (1) and (2) are arithmetic, and arithmetic
 * belongs in a pure function with tests.
 *
 * THE MODEL. Groups are offered in priority order; the first `cut` of them
 * render inline and the rest go behind an affordance — a single folded button
 * when exactly one is left out (which names it, and is more useful than a
 * chevron), or one shared "More" when several are. The affordance costs width
 * too, and the cut only ever SHRINKS, so the answer can never end over budget.
 */

export interface FitInput {
  /** The groups, in the order they appear in the ribbon. */
  readonly groups: readonly { readonly id: string; readonly priority: number }[];
  /** Natural width of each group, in px. A missing id counts as zero. */
  readonly widths: ReadonlyMap<string, number>;
  /** The row's CONTENT width in px — its border box less its own padding. */
  readonly available: number;
  /** Width kept free for anything the row holds that is not a group. */
  readonly reserve?: number;
  /** What a folded group's own button costs, and the shared one. */
  readonly foldedWidth?: number;
  readonly moreWidth?: number;
}

export interface Fit {
  /** Ids that render inline, at their natural width. */
  readonly visible: readonly string[];
  /** The single group that became a labelled button of its own, if any. */
  readonly folded: readonly string[];
  /** Ids behind the shared overflow button. */
  readonly overflow: readonly string[];
}

/** What a folded group's button costs, and what the shared one costs, in px. */
export const FOLDED_W = 100;
export const MORE_W = 68;

export function fitGroups(input: FitInput): Fit {
  const {
    groups, widths, available,
    reserve = 0, foldedWidth = FOLDED_W, moreWidth = MORE_W,
  } = input;

  /*
   * NOTHING MEASURED YET means show everything. A first paint with groups
   * hidden and then appearing is a visible flash; showing all of them and
   * collapsing on the first real measurement is not.
   */
  if (available <= 0 || widths.size === 0) {
    return { visible: groups.map((g) => g.id), folded: [], overflow: [] };
  }

  const byPriority = [...groups].sort((a, b) => a.priority - b.priority);

  const sizeOf = (keep: number): number => {
    let sum = reserve;
    for (let i = 0; i < keep; i += 1) sum += widths.get(byPriority[i]!.id) ?? 0;
    const rest = byPriority.length - keep;
    if (rest === 1) sum += foldedWidth;
    else if (rest > 1) sum += moreWidth;
    return sum;
  };

  let cut = byPriority.length;
  while (cut > 0 && sizeOf(cut) > available) cut -= 1;

  const kept = new Set(byPriority.slice(0, cut).map((g) => g.id));
  const left = byPriority.slice(cut).map((g) => g.id);

  /* In the ROW's order, not priority order, so a popover reads like the ribbon
     it came from. */
  const inOrder = (ids: readonly string[]): string[] =>
    groups.filter((g) => ids.includes(g.id)).map((g) => g.id);

  return {
    visible: inOrder([...kept]),
    folded: left.length === 1 ? inOrder(left) : [],
    overflow: left.length > 1 ? inOrder(left) : [],
  };
}

/** What the fit occupies, for a caller that wants to assert it fits. */
export function fitWidth(input: FitInput, fit: Fit): number {
  const { widths, reserve = 0, foldedWidth = FOLDED_W, moreWidth = MORE_W } = input;
  let sum = reserve;
  for (const id of fit.visible) sum += widths.get(id) ?? 0;
  if (fit.folded.length > 0) sum += foldedWidth;
  if (fit.overflow.length > 0) sum += moreWidth;
  return sum;
}
