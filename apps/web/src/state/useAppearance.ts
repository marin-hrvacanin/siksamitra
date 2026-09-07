/**
 * Appearance: the chrome theme, the document theme, and the mode.
 *
 * THREE INDEPENDENT SETTINGS, persisted. Independent because they answer to
 * different moments: the shell to whoever is sitting there for two hours, the
 * page to whatever is being proofed, the mode to the light in the room. Binding
 * them together is what makes a fixed set of "designs" never quite right.
 *
 * Persisted in `localStorage` because an appearance that resets on restart is
 * an appearance nobody bothers to set. Every read and write is guarded: a
 * private window, cleared site data, or a packaged shell with storage disabled
 * all throw on access rather than returning null, and a theme picker must not
 * be able to take the application down.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CHROME_CHOICES, CHROME_DENSITY, DEFAULT_CHROME, DEFAULT_DOCUMENT,
  DENSITY_CHOICES, DOCUMENT_CHOICES,
} from '@siksamitra/tokens';

const KEY = 'siksamitra.appearance';

export type Mode = 'light' | 'dark';

export interface Appearance {
  readonly chrome: string;
  readonly document: string;
  readonly mode: Mode;
  /** How condensed the shell is. Independent of the palette. */
  readonly density: string;
  readonly chromeChoices: typeof CHROME_CHOICES;
  readonly documentChoices: typeof DOCUMENT_CHOICES;
  readonly densityChoices: typeof DENSITY_CHOICES;
  readonly setChrome: (id: string) => void;
  readonly setDocument: (id: string) => void;
  readonly setMode: (mode: Mode) => void;
  readonly setDensity: (id: string) => void;
  /**
   * Back to what the program starts with.
   *
   * Six instruments times seven pages times three densities times two modes is
   * 252 combinations. Someone who has tried a dozen needs one way back that
   * does not require remembering which of the four axes they moved.
   */
  readonly reset: () => void;
}

interface Stored { chrome?: string; document?: string; mode?: Mode; density?: string }

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? {} : (JSON.parse(raw) as Stored);
  } catch {
    return {};
  }
}

/** A stored id that no longer exists falls back rather than rendering nothing. */
const known = (id: string | undefined, choices: readonly { id: string }[], fallback: string) =>
  id !== undefined && choices.some((c) => c.id === id) ? id : fallback;

/**
 * The appearance the program starts with, for a reader who has stored nothing.
 *
 * A function rather than a constant because two of the four answers depend on
 * the moment: the mode follows the room's own light, and the density follows
 * whichever instrument is default. It is also what `reset` goes back to, which
 * is why it had to have a name.
 */
function defaults(stored: Stored = {}): Required<Stored> {
  const chrome = known(stored.chrome, CHROME_CHOICES, DEFAULT_CHROME);
  return {
    chrome,
    document: known(stored.document, DOCUMENT_CHOICES, DEFAULT_DOCUMENT),
    // No stored mode means follow the room, not a hardcoded default. Dark as
    // a permanent default is one of the tells of a design nobody chose.
    mode: stored.mode ?? (typeof matchMedia === 'function'
      && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    // Until chosen, follow the chrome theme's own default: a dense palette
    // wants a dense shell, and asking before anyone has an opinion is a
    // setting nobody wants.
    density: stored.density ?? CHROME_DENSITY[chrome] ?? 'regular',
  };
}

export function useAppearance(): Appearance {
  const [state, setState] = useState<Required<Stored>>(() => defaults(read()));

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* not fatal */ }
  }, [state]);

  return useMemo<Appearance>(() => ({
    ...state,
    chromeChoices: CHROME_CHOICES,
    documentChoices: DOCUMENT_CHOICES,
    densityChoices: DENSITY_CHOICES,
    setDensity: (density) => setState((st) => ({ ...st, density })),
    setChrome: (chrome) => setState((s) => ({ ...s, chrome })),
    setDocument: (document) => setState((s) => ({ ...s, document })),
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    reset: () => setState(() => defaults()),
  }), [state]);
}
