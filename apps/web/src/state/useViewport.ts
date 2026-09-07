/**
 * The viewport size, as state.
 *
 * `fit-width` and `fit-page` are resolved against it, so it has to be a value
 * that causes a re-render rather than something read on demand — a fit that
 * does not follow a window resize is a fit that is wrong most of the time.
 */

import { useEffect, useState } from 'react';
import type { Viewport } from '@siksamitra/layout';

export function useViewport(): Viewport {
  const [size, setSize] = useState<Viewport>(() => ({
    width: typeof window === 'undefined' ? 1200 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    let raf = 0;
    const onResize = (): void => {
      // Coalesced to one per frame: a resize drag fires continuously, and
      // re-resolving the zoom on every event re-lays out the whole document.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return size;
}
