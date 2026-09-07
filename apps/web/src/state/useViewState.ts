/**
 * The view state: which mode, which page size, what zoom.
 *
 * One hook, because these three interact and splitting them would mean three
 * components each having to remember that `web` pins its theme and that
 * changing the page size must not change the zoom. Keeping the interaction in
 * one place is what stops each surface inventing its own answer.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE, DEFAULT_VIEW, nextView, pageGeometry, resolveZoom, stepZoom,
  themeFor, viewMode,
  type PageGeometry, type ViewKind, type ViewMode, type Viewport, type ZoomMode,
} from '@siksamitra/layout';

export interface ViewState {
  readonly view: ViewMode;
  readonly page: PageGeometry;
  readonly zoom: number;
  readonly zoomMode: ZoomMode;
  /** After the mode's pin is applied. */
  readonly theme: string;
  readonly setView: (kind: ViewKind) => void;
  readonly cycleView: () => void;
  readonly setPageSize: (id: string) => void;
  readonly setZoom: (mode: ZoomMode) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly resetZoom: () => void;
}

export function useViewState(
  viewport: Viewport,
  preferredTheme: string,
  initial: ViewKind = DEFAULT_VIEW,
): ViewState {
  const [kind, setKind] = useState<ViewKind>(initial);
  const [pageId, setPageId] = useState<string>(DEFAULT_PAGE);
  const [zoomMode, setZoomMode] = useState<ZoomMode>({ kind: 'fixed', value: 1 });

  const page = useMemo(() => pageGeometry(pageId), [pageId]);
  const view = viewMode(kind);

  /**
   * `fit-*` is resolved against the CURRENT viewport, so it tracks a window
   * resize without anything having to listen for one — the viewport is already
   * a prop and a re-render recomputes it.
   */
  const zoom = useMemo(
    () => resolveZoom(zoomMode, page, viewport),
    [zoomMode, page, viewport],
  );

  const theme = themeFor(kind, preferredTheme);

  /**
   * Stepping from a `fit-*` mode leaves it.
   *
   * Otherwise pressing zoom-in while fitted does nothing visible — the fit
   * recomputes and lands on the same number — and the control appears broken.
   */
  const step = useCallback((direction: 1 | -1) => {
    setZoomMode((prev) => ({
      kind: 'fixed',
      value: stepZoom(prev.kind === 'fixed' ? prev.value : zoom, direction),
    }));
  }, [zoom]);

  return {
    view,
    page,
    zoom,
    zoomMode,
    theme,
    setView: setKind,
    cycleView: useCallback(() => setKind((k) => nextView(k)), []),
    setPageSize: setPageId,
    setZoom: setZoomMode,
    zoomIn: useCallback(() => step(1), [step]),
    zoomOut: useCallback(() => step(-1), [step]),
    resetZoom: useCallback(() => setZoomMode({ kind: 'fixed', value: 1 }), []),
  };
}
