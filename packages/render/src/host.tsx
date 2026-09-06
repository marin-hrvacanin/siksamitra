/**
 * The render host — everything the reader needs from whoever is embedding it.
 *
 * WHY THIS EXISTS. The reader was written inside vedaunion.org and reached
 * straight into the platform for four things: the user's preferences, a
 * cache-busting URL helper, the day's pañcāṅga coordinates, and the reader's
 * chosen location. Every one of those is a HOST concern, not a rendering
 * concern — siksamitra has preferences too, and they live in a file rather than
 * in a database.
 *
 * So the renderer declares what it needs and the host supplies it. That is what
 * makes this package publishable to two different applications without either
 * of them growing a copy of the reader.
 *
 * Every field has a working default, so a bare `<ChantReader>` renders with no
 * provider at all. That matters for tests, for the render check, and for anyone
 * embedding a single chant without wanting a preferences system.
 */

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_RENDER_PREFERENCES,
  type RenderPreferences,
} from './preferences.js';
import type { SankalpaCoordinates } from './modules/sankalpa.js';

/**
 * The day's pañcāṅga, for the rites whose wording states when and where they
 * are performed.
 *
 * NOTE: this is the one place the host contract still names a specific module.
 * The general form is a module registry the host populates; until that exists,
 * naming the type honestly beats pretending the coupling is not there.
 */
export type HostCoordinates = SankalpaCoordinates;

export interface RenderHost {
  /** The reader's display and saṅkalpa preferences. */
  readonly prefs: RenderPreferences;
  /** Persist a partial preference change. Shallow-merged per top-level block. */
  readonly update: (patch: DeepPartialPrefs) => void;
  /**
   * Turn a document-relative asset path into a URL this host can fetch.
   *
   * The platform appends a build version so a cached chant is never stale
   * against a new renderer. A packaged desktop app resolves against its own
   * bundle instead, because a bare relative href in a packaged shell resolves
   * to the WebView's origin and silently 404s.
   */
  readonly resolveUrl: (path: string) => string;
  /**
   * Coordinates for the day, or null when the host does not compute them.
   *
   * Returning null is a supported answer, not a failure: siksamitra offline has
   * no pañcāṅga service, and a saṅkalpa still renders without one.
   */
  readonly useCoordinates: (needed: boolean) => HostCoordinates | null;
}

type DeepPartialPrefs = {
  [K in keyof RenderPreferences]?: Partial<RenderPreferences[K]>;
};

const NO_COORDINATES = (): null => null;

const FALLBACK: RenderHost = {
  prefs: DEFAULT_RENDER_PREFERENCES,
  update: () => undefined,
  resolveUrl: (path) => path,
  useCoordinates: NO_COORDINATES,
};

const HostContext = createContext<RenderHost>(FALLBACK);

export function useRenderHost(): RenderHost {
  return useContext(HostContext);
}

export function RenderHostProvider(
  { host, children }: { host: RenderHost; children: ReactNode },
): ReactNode {
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

/**
 * A host backed by nothing but React state.
 *
 * Enough to run the reader standalone — in a test, in the render check, or in
 * an embed that has no preference store of its own. Preferences last as long as
 * the component tree and no longer, which is the honest behaviour for a host
 * that was never given anywhere to write them.
 */
export function useMemoryHost(
  initial: RenderPreferences = DEFAULT_RENDER_PREFERENCES,
): RenderHost {
  const [prefs, setPrefs] = useState<RenderPreferences>(initial);

  const update = useCallback((patch: DeepPartialPrefs) => {
    setPrefs((prev) => ({
      chant: { ...prev.chant, ...(patch.chant ?? {}) },
      sankalpa: { ...prev.sankalpa, ...(patch.sankalpa ?? {}) },
    }));
  }, []);

  return useMemo<RenderHost>(() => ({
    prefs,
    update,
    resolveUrl: (path) => path,
    useCoordinates: NO_COORDINATES,
  }), [prefs, update]);
}
