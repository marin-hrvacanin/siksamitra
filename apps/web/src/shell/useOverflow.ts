/**
 * Which ribbon groups fit, and which collapse.
 *
 * Word's behaviour, and it is the right one: a group that no longer fits does
 * not wrap to a second row and does not scroll off — it collapses to a single
 * labelled button that opens the same controls in a popover. The ribbon stays
 * one row tall at every window size, and nothing becomes unreachable.
 *
 * WHY MEASURED AND NOT MEDIA QUERIES. A breakpoint guesses at the content: the
 * same 900px window holds a different number of groups depending on the
 * density setting, the chrome face, and the length of the words in whichever
 * language is being shown. Measuring asks the only question that matters —
 * does it fit — and keeps working when any of those change.
 *
 * The algorithm is deliberately greedy and stable: keep groups in priority
 * order while they fit, collapse the rest. Stable matters more than optimal —
 * a layout that reshuffles which groups are visible as you drag a window edge
 * is worse than one that drops them in a predictable order.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface OverflowGroup {
  readonly id: string;
  /** Lower goes first, and survives longest. */
  readonly priority: number;
}

export interface OverflowResult {
  /** Attach to the row being measured. */
  readonly ref: React.RefObject<HTMLDivElement | null>;
  /** Ids that fit and should render inline. */
  readonly visible: ReadonlySet<string>;
  /** Ids that did not fit and belong in the overflow popover. */
  readonly collapsed: readonly string[];
  /** Re-measure. Call when the group CONTENTS change, not on resize. */
  readonly remeasure: () => void;
}

/**
 * `reserve` is the width kept free for the fixed parts of the row — the brand,
 * the document picker, the overflow button itself. Measuring those instead
 * would mean measuring while the layout is mid-change.
 */
export function useOverflow(
  groups: readonly OverflowGroup[],
  reserve = 220,
): OverflowResult {
  const ref = useRef<HTMLDivElement | null>(null);
  /** Natural width of each group at the current density, measured once. */
  const widths = useRef<Map<string, number>>(new Map());
  const [available, setAvailable] = useState<number>(0);
  const [tick, setTick] = useState(0);

  const remeasure = useCallback(() => {
    widths.current.clear();
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const row = ref.current;
    if (row === null) return;

    const read = (): void => {
      // Measure each group's natural width ONCE per density/content change.
      // Re-measuring while some are collapsed would read the collapsed width
      // and the row would never expand again — a one-way ratchet that looks
      // like the ribbon slowly eating itself.
      if (widths.current.size === 0) {
        for (const el of row.querySelectorAll<HTMLElement>('[data-group]')) {
          const id = el.dataset['group'];
          if (id === undefined) continue;
          widths.current.set(id, el.getBoundingClientRect().width);
        }
      }
      setAvailable(row.getBoundingClientRect().width);
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(row);
    return () => observer.disconnect();
  }, [tick]);

  const { visible, collapsed } = useMemo(() => {
    const byPriority = [...groups].sort((a, b) => a.priority - b.priority);
    const fits = new Set<string>();
    const out: string[] = [];

    // Nothing measured yet: show everything. A first paint with groups hidden
    // then appearing is a visible flash; showing all and collapsing on the
    // first measurement is not.
    if (available === 0 || widths.current.size === 0) {
      return { visible: new Set(groups.map((g) => g.id)), collapsed: [] };
    }

    let used = reserve;
    for (const g of byPriority) {
      const w = widths.current.get(g.id) ?? 0;
      if (used + w <= available) {
        used += w;
        fits.add(g.id);
      } else {
        out.push(g.id);
      }
    }
    // Keep the overflow list in the row's own order, not priority order, so the
    // popover reads like the ribbon it came from.
    return {
      visible: fits,
      collapsed: groups.filter((g) => out.includes(g.id)).map((g) => g.id),
    };
  }, [groups, available, reserve, tick]);

  return { ref, visible, collapsed, remeasure };
}
