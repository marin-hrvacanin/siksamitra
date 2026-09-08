/**
 * WHAT HAS BEEN OPENED, most recent first — kept across restarts.
 *
 * The list's two rules live in `recents.ts`, where they can be tested without
 * a browser; this is the impure half and is deliberately nothing but storage.
 *
 * `localStorage` rather than `@siksamitra/storage`. That package is the
 * DOCUMENT store — where documents live, on this disk or on the platform — and
 * a recents list is not a document: it is about this person on this machine
 * and belongs to no file. One that travelled inside a `.vuchant` would tell
 * the next reader what its author had been reading.
 *
 * Every read and write is guarded. Storage throws rather than returning null
 * in a private window and in a WebView with site data switched off, and a
 * recents list is the last thing that should be allowed to stop a program from
 * starting.
 *
 * RECORDED EXPLICITLY, not by an effect watching the open document. It was an
 * effect keyed on the slug and the title, and that is two bugs: a document
 * that failed to load still recorded itself, and editing a title re-recorded
 * the same document under the new name. A document joins the list when it is
 * OPENED or SAVED — two events, not a rendering condition.
 */
import { useCallback, useState } from 'react';
import {
  parseRecents, withRecent, withoutRecent, type RecentDoc,
} from './recents.js';

export type { RecentDoc, RecentKind } from './recents.js';

const KEY = 'siksamitra.recent.v1';

export interface Recents {
  readonly list: readonly RecentDoc[];
  /** Record an open or a save. The clock is read here and nowhere else. */
  readonly remember: (entry: Omit<RecentDoc, 'at'>) => void;
  /** Drop a row — what happens when opening one fails. */
  readonly forget: (ref: string) => void;
}

export function useRecents(): Recents {
  const [list, setList] = useState<readonly RecentDoc[]>(() => {
    try {
      return parseRecents(localStorage.getItem(KEY));
    } catch {
      return [];
    }
  });

  /** Apply a change to the list and persist whatever it produced. */
  const change = useCallback((how: (was: readonly RecentDoc[]) => RecentDoc[]) => {
    setList((was) => {
      const next = how(was);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not fatal */ }
      return next;
    });
  }, []);

  const remember = useCallback((entry: Omit<RecentDoc, 'at'>) => {
    const at = new Date().toISOString();
    change((was) => withRecent(was, { ...entry, at }));
  }, [change]);

  const forget = useCallback((ref: string) => {
    change((was) => withoutRecent(was, ref));
  }, [change]);

  return { list, remember, forget };
}
