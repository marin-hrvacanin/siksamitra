/**
 * The view choices a person made, kept between sessions.
 *
 * WHICH VIEW, WHAT PAPER, WHAT ZOOM. All three were held in React state and
 * nowhere else, so every one of them reset on every start: an author who works
 * in Pages on A5 at 75 % was put back in Flow on A4 at 100 % each time the
 * program opened, with no way to say otherwise. `useAppearance` had already
 * said why that is not acceptable — "an appearance that resets on restart is an
 * appearance nobody bothers to set" — and these are the same kind of thing.
 *
 * ITS OWN MODULE, and not because `useViewState` was long. What is delicate
 * here is not the storing, it is the READING: a stored value is input from
 * outside the program, and a page size or a view mode that no longer exists
 * must fall back rather than reach `pageGeometry`, which throws by design. So
 * the validation is a pure function with its own tests, and the hook only
 * calls it.
 *
 * Every access is guarded. A private window, cleared site data or a packaged
 * shell with storage disabled throw on `localStorage` rather than returning
 * null, and remembering a zoom must not be able to take the program down.
 */

import {
  PAGE_SIZES, VIEW_MODES, ZOOM_MAX, ZOOM_MIN, type ViewKind, type ZoomMode,
} from '@siksamitra/layout';

const KEY = 'siksamitra.view';

export interface ViewChoices {
  /** Which of the three views, when one was chosen and still exists. */
  readonly view?: ViewKind;
  /** A page size id from `PAGE_SIZES`. */
  readonly page?: string;
  /**
   * The zoom the person TOOK OVER with.
   *
   * Absent means they never did, and that is not the same as 100 %: until a
   * person presses zoom-in or picks a fit, the zoom follows the window — 100 %
   * while a page fits, fitted to the width when it does not. Storing the
   * resolved number would freeze that automatic behaviour on the first run.
   */
  readonly zoom?: ZoomMode;
}

/** Is this a zoom mode this build can resolve? */
function zoomFrom(raw: unknown): ZoomMode | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const kind = (raw as { kind?: unknown }).kind;
  if (kind === 'fit-width' || kind === 'fit-page') return { kind };
  if (kind !== 'fixed') return undefined;
  const value = (raw as { value?: unknown }).value;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  /* Clamped rather than refused: a stored 8 is a build whose maximum used to
     be higher, and the nearest legal zoom is a better answer than the
     default. */
  return { kind: 'fixed', value: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) };
}

/**
 * The choices in a stored blob, with everything unrecognisable dropped.
 *
 * Pure, so the whole of the tolerance can be tested without a browser: a
 * hand-edited value, a build that has removed a page size, a `null`, a string
 * where an object belongs.
 */
export function viewChoicesFrom(raw: unknown): ViewChoices {
  if (raw === null || typeof raw !== 'object') return {};
  const { view, page, zoom } = raw as { view?: unknown; page?: unknown; zoom?: unknown };
  const zoomMode = zoomFrom(zoom);
  return {
    ...(typeof view === 'string' && Object.hasOwn(VIEW_MODES, view)
      ? { view: view as ViewKind } : {}),
    ...(typeof page === 'string' && Object.hasOwn(PAGE_SIZES, page) ? { page } : {}),
    ...(zoomMode === undefined ? {} : { zoom: zoomMode }),
  };
}

/** What was stored, or nothing at all. Never throws. */
export function readViewChoices(): ViewChoices {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? {} : viewChoicesFrom(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Keep these choices for next time. Never throws. */
export function writeViewChoices(choices: ViewChoices): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(choices));
  } catch { /* not fatal */ }
}
