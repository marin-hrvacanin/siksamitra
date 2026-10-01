/**
 * WHERE THE CARET IS, AS THE ADD-IN READS IT — for the panel to show.
 *
 * The same `locate` a command reads the selection with, so what the panel
 * shows is what a button would act on. Read after the selection settles
 * (Word reports every caret step) and again after every command the panel
 * runs, because a command changes the line under the caret.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { locate, type Located } from '../../word/selection.js';
import { registerHere, type RegisterHere } from '../../word/register.js';

export interface Here {
  readonly at: Located | null;
  readonly register: RegisterHere | null;
  /** Why there is nothing to show, when there is not. */
  readonly why: string | null;
  readonly refresh: () => void;
}

/** How long the selection has to rest before it is read. */
const SETTLE_MS = 220;

export function useHere(): Here {
  const [at, setAt] = useState<Located | null>(null);
  const [register, setRegister] = useState<RegisterHere | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const read = useCallback(() => {
    const mine = ++seq.current;
    void Promise.all([locate(), registerHere()]).then(([l, r]) => {
      if (mine !== seq.current) return;
      setAt(l);
      setRegister(r);
      setWhy(null);
    }, (e: unknown) => {
      if (mine !== seq.current) return;
      setAt(null);
      /* A plain sentence, and the reason for whoever is looking for it. */
      console.debug('śikṣāmitra: nothing to show at the caret', e);
      setWhy('Put the caret in a mantra line, or select some letters.');
    });
  }, []);

  const later = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(read, SETTLE_MS);
  }, [read]);

  useEffect(() => {
    if (typeof Office === 'undefined') return undefined;
    read();
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, later);
    return () => {
      window.clearTimeout(timer.current);
      Office.context.document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged, { handler: later });
    };
  }, [read, later]);

  return { at, register, why, refresh: later };
}
