/**
 * How wide an element actually is.
 *
 * The zoom's `fit-width` has to be fitted to the space the DOCUMENT has, not
 * to the window: with the navigation panel open those differ by the panel's
 * width, and fitting to the window put a 793px page in a 676px column — the
 * page clipped, with no way to see the right margin. The window's width is not
 * a proxy for the document's.
 *
 * `clientWidth`, so the value excludes the scroller's own scrollbar. Reporting
 * the border box instead would fit the page to a width that includes the
 * scrollbar, the page would then need a horizontal one, and the two would
 * argue at every resize.
 */
import { useEffect, useState } from 'react';

export function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  return useElementSize(ref).width;
}

/**
 * BOTH DIMENSIONS, for the same reason the width was measured in the first
 * place — and the height had been left as the window's.
 *
 * "Fit page" means one whole page visible, and it was fitted to
 * `window.innerHeight` while the width was fitted to the scroller. The
 * scroller is one row of the app's grid, under the title bar, the tab strip
 * and the ribbon, and above the status bar. Measured in the running program at
 * a 900 px window: the canvas is 693 px and Fit page produced an 804 px page —
 * a page that does not fit, by 111 px, every time, which is the one thing the
 * command is named after.
 *
 * `clientWidth`/`clientHeight`, so both exclude the scroller's own scrollbars.
 * Reporting the border box instead would fit the page to a width that includes
 * the scrollbar, the page would then need a horizontal one, and the two would
 * argue at every resize.
 */
export function useElementSize(
  ref: React.RefObject<HTMLElement | null>,
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const read = (): void => setSize((was) => (
      was.width === el.clientWidth && was.height === el.clientHeight
        ? was
        : { width: el.clientWidth, height: el.clientHeight }
    ));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
