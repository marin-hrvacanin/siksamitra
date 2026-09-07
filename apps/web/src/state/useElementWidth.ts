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
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const read = (): void => setWidth(el.clientWidth);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
