/**
 * FINDING A TEXT IN A LIBRARY — the one matcher every host uses.
 *
 * The bot reads its library off the disk, the Word panel and the app off the
 * published `chants/index.json`; what "puruṣa sūktam" finds is the same in
 * all of them. Titles are compared with the diacritics and the usual
 * romanisations folded — "purusha" finds "puruṣa", "sukta" "sūktam" — and a
 * verified document comes before one of the owner's own files.
 */
import type { LibraryEntry } from './tools/types.js';

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
