/**
 * The most-recently-used list, as arithmetic.
 *
 * Split out of `useRecents` because none of this needs React, a clock or a
 * storage engine to be wrong: the list used to be built inline in an effect,
 * so the two rules it actually has — a document that is opened again MOVES to
 * the front rather than appearing twice, and the list is capped — could only
 * be checked by opening documents in a browser and looking.
 *
 * TEN. Enough to find last week's work, few enough to read at a glance, which
 * is the number Word settled on for the same reason.
 *
 * A row is identified by its `ref`, and a ref is whatever names the document
 * where it lives — a slug for one that ships with the program, an absolute
 * path for a file on the desktop. That is `DocumentRef` in `@siksamitra/
 * storage`, deliberately: the same opaque string, so a recents row can be
 * handed straight to whatever opens it.
 */

/** Where a document came from. Decides who can reopen it, and what to show. */
export type RecentKind = 'library' | 'file';

export interface RecentDoc {
  /** A slug for a library document; an absolute path, or a handle key, for a
   *  file. Opaque here — only the thing that opened it knows how to read it. */
  readonly ref: string;
  readonly kind: RecentKind;
  /** The file's own name, for the second line. Equal to `ref` for a slug. */
  readonly name: string;
  /** The document's title, as it called itself when it was last open. */
  readonly title: string;
  /** When it was last opened, as an ISO string — sortable and readable. */
  readonly at: string;
}

export const RECENTS_KEEP = 10;

/**
 * Parse whatever is under the storage key.
 *
 * Anything could be there: another version of this program, a person with a
 * console, half a write interrupted by a crash. Only rows that are rows.
 *
 * IT STILL READS THE OLD SHAPE. The first version of this list stored
 * `{ slug, title, at }` and knew about library documents only. Bumping the key
 * and starting empty would have thrown away everybody's list to add a field,
 * so a row with a `slug` and no `ref` is read as the library document it was.
 */
export function parseRecents(raw: string | null): RecentDoc[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: RecentDoc[] = [];
  for (const row of parsed as unknown[]) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    const ref = typeof r['ref'] === 'string' ? r['ref']
      : typeof r['slug'] === 'string' ? r['slug'] : null;
    if (ref === null || ref === '') continue;
    if (typeof r['title'] !== 'string' || typeof r['at'] !== 'string') continue;
    out.push({
      ref,
      kind: r['kind'] === 'file' ? 'file' : 'library',
      name: typeof r['name'] === 'string' ? r['name'] : ref,
      title: r['title'],
      at: r['at'],
    });
  }
  return out.slice(0, RECENTS_KEEP);
}

/**
 * Record that a document was opened or saved.
 *
 * The old row for the same ref is REMOVED rather than updated in place: a
 * document opened again belongs at the front, and its title may have changed
 * since — that is the commonest reason a recents list shows a name nobody
 * recognises.
 */
export function withRecent(list: readonly RecentDoc[], entry: RecentDoc): RecentDoc[] {
  return [entry, ...list.filter((r) => r.ref !== entry.ref)].slice(0, RECENTS_KEEP);
}

/**
 * Forget a document.
 *
 * What this is for: a file that has been moved or deleted. Nothing checks a
 * recents list in the background — a stat of ten paths on every start is work
 * done for a list most people never look at, and on a network share it is work
 * that can block. The entry is dropped when opening it fails, which is the
 * first moment its absence is actually known.
 */
export const withoutRecent = (list: readonly RecentDoc[], ref: string): RecentDoc[] =>
  list.filter((r) => r.ref !== ref);
