/**
 * FINDING A TEXT IN A LIBRARY — the one matcher every host uses.
 *
 * The bot reads its library off the disk, the Word panel and the app off the
 * published `chants/index.json`; what "puruṣa sūktam" finds is the same in
 * all of them. Titles are compared with the diacritics and the usual
 * romanisations folded — "purusha" finds "puruṣa", "sukta" "sūktam" — and a
 * verified document comes before one of the owner's own files.
 */
import { readChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import type { Library, LibraryEntry } from './tools/types.js';

/** A title as a search key: no diacritics, the common romanisations folded. */
export const fold = (s: string): string => s
  .normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/sh/g, 's').replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The entries a query names, the best first. */
export function findIn(entries: readonly LibraryEntry[], query: string): LibraryEntry[] {
  const words = fold(query).split(' ').filter((w) => w.length > 2);
  const scored = entries.map((e) => {
    const t = fold(`${e.title} ${e.id}`);
    return { e, score: words.filter((w) => t.includes(w)).length };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || (a.e.kind === b.e.kind ? 0 : a.e.kind === 'verified' ? -1 : 1));
  return scored.map(({ e }) => e);
}

/**
 * A library published beside a program — `chants/index.json` and
 * `chants/<id>.json` under `base` (the corpus plugin, `apps/web/vite-corpus.ts`).
 * The Word panel's and the app's: each reads it from its own address, which
 * is the only one a panel in Word may read.
 */
export function publishedLibrary(base: string, fetchImpl: typeof fetch = (u, i) => fetch(u, i)): Library {
  let index: Promise<LibraryEntry[]> | null = null;
  const entries = (): Promise<LibraryEntry[]> => (index ??= fetchImpl(new URL('chants/index.json', base))
    .then(async (r) => {
      if (!r.ok) throw new Error(`the library could not be read (${r.status})`);
      return (await r.json()) as LibraryEntry[];
    })
    .catch((e: unknown) => { index = null; throw e; }));
  return {
    async find(query) { return findIn(await entries(), query); },
    async load(id) {
      const r = await fetchImpl(new URL(`chants/${encodeURIComponent(id)}.json`, base));
      if (!r.ok) throw new Error(`no library text "${id}"`);
      const read = readChantFile(await r.text());
      if (!read.ok) throw new Error(read.error);
      return { doc: openChantDoc(read.doc), kind: 'verified' as const };
    },
  };
}
