/**
 * WHAT HAS BEEN OPENED, most recent first.
 *
 * Kept in the browser's own storage because it is about this person on this
 * machine and belongs to no document — a recents list that travelled inside
 * the file would tell the next reader what its author had been reading.
 *
 * Ten is enough to find last week's work and few enough to read at a glance,
 * which is the number Word settled on for the same reason.
 *
 * Every read and write is guarded. Storage throws rather than returning null
 * in a private window and in a WebView with site data switched off, and a
 * recents list is the last thing that should be allowed to stop a program from
 * starting.
 */
import { useEffect, useState } from 'react';

export interface RecentDocument {
  readonly slug: string;
  readonly title: string;
  /** When it was last opened, as an ISO string — sortable and readable. */
  readonly at: string;
}

const KEY = 'siksamitra.recent.v1';
const KEEP = 10;

/** Read the list, and hand back the recorder that keeps it up to date. */
export function useRecents(slug: string, title: string | null): readonly RecentDocument[] {
  const [recents, setRecents] = useState<readonly RecentDocument[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      /* Anything could be under that key — another version of this program,
         or a person with a console. Only rows that are actually rows. */
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((r): r is RecentDocument => typeof r === 'object' && r !== null
        && typeof (r as RecentDocument).slug === 'string'
        && typeof (r as RecentDocument).title === 'string'
        && typeof (r as RecentDocument).at === 'string');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (title === null) return;
    setRecents((was) => {
      const next = [
        { slug, title, at: new Date().toISOString() },
        ...was.filter((r) => r.slug !== slug),
      ].slice(0, KEEP);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not fatal */ }
      return next;
    });
  }, [slug, title]);

  return recents;
}
