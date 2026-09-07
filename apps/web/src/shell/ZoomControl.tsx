/**
 * Zoom.
 *
 * The percentage is a button, not a label: clicking it returns to 100 %, which
 * is the action people actually want after fitting to a page and losing track
 * of where they are.
 */

import type { ReactNode } from 'react';
import { zoomLabel, type ZoomMode } from '@siksamitra/layout';

export function ZoomControl(
  { zoom, mode, onZoomIn, onZoomOut, onReset, onSetMode, paginated }: {
    zoom: number;
    mode: ZoomMode;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    onSetMode: (m: ZoomMode) => void;
    paginated: boolean;
  },
): ReactNode {
  return (
    <div className="zoom" role="group" aria-label="Zoom">
      <button type="button" className="zoom__b" onClick={onZoomOut} title="Zoom out (Ctrl -)">−</button>
      <button type="button" className="zoom__v" onClick={onReset} title="Reset to 100%">
        {zoomLabel(zoom)}
      </button>
      <button type="button" className="zoom__b" onClick={onZoomIn} title="Zoom in (Ctrl +)">+</button>
      <button
        type="button"
        className={mode.kind === 'fit-width' ? 'zoom__f is-on' : 'zoom__f'}
        onClick={() => onSetMode({ kind: 'fit-width' })}
        title="Fit the width"
      >
        Width
      </button>
      {/* Fitting a whole page is meaningless where there is no page. */}
      {paginated && (
        <button
          type="button"
          className={mode.kind === 'fit-page' ? 'zoom__f is-on' : 'zoom__f'}
          onClick={() => onSetMode({ kind: 'fit-page' })}
          title="Fit a whole page"
        >
          Page
        </button>
      )}
    </div>
  );
}
