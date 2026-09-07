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
import { fitGroups } from './fit-groups.js';

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
  /** Ids that fit as a SINGLE folded button of their own. */
  readonly collapsed: readonly string[];
  /**
   * Ids that did not even fit as a folded button, and belong behind one shared
   * overflow button.
   *
   * The third state exists because two were not enough. At 400px the View tab
   * has five groups and room for two: folding the other three produced three
   * more buttons, 91px past the edge — a "collapse" that still cut a control
   * in half. Word does the same thing in the same order: shrink, fold, then
   * one chevron for the rest.
   */
  readonly overflow: readonly string[];
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
  /**
   * A counter bumped when the widths are (re)measured.
   *
   * The widths live in a ref — the measuring pass must not itself cause a
   * render — but a ref's mutation does not recompute anything, and the fit is a
   * `useMemo`. Without this the sequence "clear the widths, render with none
   * measured (everything visible), measure, set the same available width"
   * ended with React skipping the render, so the memo kept its
   * everything-fits answer and the ribbon never collapsed. Measured at 400px:
   * five groups inline and 265px past the edge.
   */
  const [measured, setMeasured] = useState(0);
  /** Whether the after-the-fonts re-measure has already been scheduled. */
  const fontsChecked = useRef(false);

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
        if (widths.current.size > 0) setMeasured((n) => n + 1);
      }
      /*
       * The CONTENT box, not the border box. The row carries its own
       * horizontal padding, and measuring the outer width credited the fit
       * with 16px it does not have — enough to leave the last group's edge
       * cut off at every width where it only just fitted.
       */
      const cs = getComputedStyle(row);
      const pad = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
      setAvailable(row.getBoundingClientRect().width - (Number.isFinite(pad) ? pad : 0));
    };

    read();
    /*
     * AND AGAIN WHEN THE FONTS ARRIVE. The first measurement happens before
     * the interface face has loaded, so every label is measured in the
     * fallback and every group comes out about 3% narrow — 17px across a
     * ribbon, which is exactly enough to fit a group that then does not fit.
     * Measured at 620px: the fit was computed from 542px of groups that
     * rendered at 559.
     */
    let live = true;
    /*
     * ONCE, and the guard is load-bearing. `fonts.ready` is already resolved
     * by the time the ribbon re-measures for any other reason, so an
     * unguarded re-measure cleared the widths and bumped the counter this
     * effect depends on — which ran the effect again, which cleared them
     * again. The hook churned forever, and the published fit alternated
     * between "nothing measured, everything visible" and a correct collapse:
     * at 620px the ribbon showed all five groups and ran 97px past the edge
     * about half the time.
     */
    if (!fontsChecked.current) {
      fontsChecked.current = true;
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      void fonts?.ready.then(() => {
        if (!live) return;
        widths.current.clear();
        setTick((t) => t + 1);
      });
    }
    const observer = new ResizeObserver(read);
    observer.observe(row);
    return () => { live = false; observer.disconnect(); };
  }, [tick]);

  const { visible, collapsed, overflow } = useMemo(() => {
    /*
     * THE ARITHMETIC IS `fitGroups`, and it is not repeated here.
     *
     * It was inline once, which is why three fitting bugs shipped: a fit that
     * lives inside a hook can only be checked by resizing a browser and
     * looking. It is now a pure function with a test that sweeps every width,
     * and this hook does what only a hook can — measure, and re-measure when
     * the fonts land or the row changes size.
     */
    const fit = fitGroups({ groups, widths: widths.current, available, reserve });
    return {
      visible: new Set(fit.visible),
      collapsed: fit.folded,
      overflow: fit.overflow,
    };
  }, [groups, available, reserve, tick, measured]);

  /*
   * The fit, on the element, for the tools.
   *
   * `tools/responsive.mjs` cannot read a hook's state, and every attempt to
   * verify the collapse from the outside has had to infer it from class names
   * — which is how three separate overflow bugs survived a green gate. The
   * numbers the decision was made from are published where a browser can read
   * them back.
   */
  useEffect(() => {
    const row = ref.current;
    if (row === null) return;
    row.dataset['fit'] = JSON.stringify({
      available: Math.round(available),
      measured: [...widths.current.entries()].map(([id, w]) => [id, Math.round(w)]),
      visible: [...visible],
      collapsed,
      overflow,
    });
  }, [available, visible, collapsed, overflow, measured]);

  return { ref, visible, collapsed, overflow, remeasure };
}
