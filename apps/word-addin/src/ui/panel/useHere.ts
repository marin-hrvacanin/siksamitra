/**
 * WHERE THE CARET IS, AS THE ADD-IN READS IT — for the panel to show.
 *
 * The same `locate` a command reads the selection with, so what the panel
 * shows is what a button would act on. Read after the selection settles
 * (Word reports every caret step) and again after every command the panel
 * runs, because a command changes the line under the caret.
 *
 * THE SOURCES HERE are those of the mantra lines the selection touches —
 * one, usually; two or more when a selection reaches across lines of
 * different sources. Off every mantra line (a title, a translation), the
 * document's own: the source a line takes when nothing says otherwise.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChantProfileKey } from '@siksamitra/format';
import { DEFAULT_PROFILE_KEY } from '@siksamitra/engine';
import { locate, type Located } from '../../word/selection.js';
import { recordedFor } from '../../word/rules.js';
import { recordedRegister } from '../../word/settings.js';

export interface Here {
  readonly at: Located | null;
  /** The sources of the lines here, each once, in the order the lines come. */
  readonly sources: readonly ChantProfileKey[];
  /** The document's own source — what a line with no record of its own is. */
  readonly own: ChantProfileKey;
  /** Why there is nothing to show, when there is not. */
  readonly why: string | null;
  readonly refresh: () => void;
}

/** How long the selection has to rest before it is read. */
const SETTLE_MS = 220;

/** The sources of the lines a selection touches, each once. */
export function sourcesOf(at: Located | null): ChantProfileKey[] {
  const own = recordedRegister() ?? DEFAULT_PROFILE_KEY;
  const lines = (at?.lines ?? []).filter((l) => l.isVerse);
  const all = lines.map((l) => recordedFor(l.part) ?? own);
  return all.length === 0 ? [own] : [...new Set(all)];
}

export function useHere(): Here {
  const [at, setAt] = useState<Located | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const read = useCallback(() => {
    const mine = ++seq.current;
    void locate().then((l) => {
      if (mine !== seq.current) return;
      setAt(l);
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

  return { at, sources: sourcesOf(at), own: recordedRegister() ?? DEFAULT_PROFILE_KEY, why, refresh: later };
}
