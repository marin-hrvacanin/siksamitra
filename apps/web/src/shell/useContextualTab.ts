/**
 * WHICH RIBBON TAB IS IN FRONT, and the one rule that is not "the one you
 * clicked".
 *
 * A contextual tab comes to the front when its object is selected and gets out
 * of the way when it is not. Word's behaviour, and the half people notice:
 * selecting a picture puts Picture Tools in front so the controls are simply
 * there.
 *
 * DESELECTING GOES BACK TO WHERE YOU WERE, not to Home. Being thrown to Home
 * every time you click away from a picture is worse than the problem it
 * solves; the tab you were on is remembered, so it survives the selection
 * changing twice.
 *
 * Split out of `App.tsx` at the 400-line module gate, and it belongs out: the
 * next contextual tab is one more entry in `objects` and nothing else.
 */
import { useEffect, useRef, useState } from 'react';

export interface ContextualTabs {
  readonly tab: string;
  readonly setTab: (id: string) => void;
}

/**
 * @param objects Which contextual tab, if any, an object selection is asking
 *   for. `null` when nothing is selected. One entry per kind of object; the
 *   first one asking wins, which is the order they are listed in.
 */
export function useContextualTab(objects: readonly (string | null)[]): ContextualTabs {
  const [tab, setTab] = useState('home');
  const before = useRef('home');
  const wanted = objects.find((o) => o !== null) ?? null;

  useEffect(() => {
    if (wanted !== null) {
      setTab((now) => {
        if (now !== wanted) before.current = now;
        return wanted;
      });
      return;
    }
    /* Nothing is selected. If a contextual tab is in front, leave it — but
       only if it IS one: the person may have clicked back to Home themselves
       while the picture was still selected. */
    setTab((now) => (objectTabs.has(now) ? before.current : now));
  }, [wanted]);

  return { tab, setTab };
}

/**
 * The tabs that only exist while something is selected.
 *
 * A set rather than a check on the current tab list, because the list is
 * rebuilt every render and this has to know what a contextual tab IS in order
 * to leave one.
 */
const objectTabs = new Set(['picture']);
