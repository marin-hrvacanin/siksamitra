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
  DEFAULT_PAGE, DEFAULT_VIEW, PT_TO_PX, nextView, pageGeometry, resolveZoom, stepZoom,
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

  const page = useMemo(() => pageGeometry(pageId), [pageId]);
  const view = viewMode(kind);

  /*
   * THE ZOOM FOLLOWS THE WINDOW UNTIL SOMEONE TAKES IT OVER.
   *
   * 100% while the page fits, fitted to the width when it does not — and the
   * moment a person presses zoom-in, chooses a fit, or asks for actual size,
   * their choice stands and the window stops interfering.
   *
   * Both halves matter. A fixed 100% on a 500px window shows two thirds of an
   * A4 page and hides the rest behind a horizontal scrollbar, which is not a
   * document anyone can read; and a program that overrode a chosen zoom every
   * time the window moved would be worse. Decided once at startup was not
   * enough either: the window that is open now is the one that matters, not
   * the one it opened in.
   */
  const [chosen, setChosen] = useState<ZoomMode | null>(null);
  const zoomMode: ZoomMode = chosen ?? (
    viewport.width < (page.width * PT_TO_PX) + 48
      ? { kind: 'fit-width' }
      : { kind: 'fixed', value: 1 }
  );
  const setZoomMode = useCallback((m: ZoomMode) => setChosen(m), []);

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
    /* From the CURRENT zoom, whether that came from a choice or from the
       window — so a step out of the automatic fit lands where the eye is. */
    setChosen({ kind: 'fixed', value: stepZoom(zoom, direction) });
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
