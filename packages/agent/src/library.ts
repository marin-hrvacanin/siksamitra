/**
 * FINDING A TEXT IN A LIBRARY — the one matcher every host uses.
 *
 * The bot reads its library off the disk, the Word panel and the app off the
 * published `chants/index.json`; what "puruṣa sūktam" finds is the same in
 * all of them. Titles are compared with the diacritics and the usual
 * romanisations folded — "purusha" finds "puruṣa", "sukta" "sūktam" — and a
 * verified document comes before one of the owner's own files.
 */
import { readChantFile, withVerses, type ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import type { Library, LibraryEntry } from './tools/types.js';

/** A title as a search key: no diacritics, the common romanisations folded. */
export const fold = (s: string): string => s
  .normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/sh/g, 's').replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** A document file as it is read for an index — before it is opened. */
interface RawDoc {
  readonly title?: string;
  readonly profile?: { readonly preset?: string };
  readonly sections?: readonly { readonly id: string; readonly title?: string; readonly items?: readonly { readonly t: string }[]; readonly verses?: readonly unknown[] }[];
}

/**
 * WHAT A LIBRARY DOCUMENT OFFERS: itself, and every section with a title.
 *
 * A text is often a section of a larger one — the Gāyatrī is a section of
 * the pūjā manual, verified and marked — and an index of titles alone could
 * not find it: asked for the Gāyatrī, the agent searched the web for sixteen
 * minutes for a text the library had. A section is `<doc>#<section>`.
 */
export function indexEntries(id: string, raw: RawDoc): LibraryEntry[] {
  const count = (s: NonNullable<RawDoc['sections']>[number]): number => (s.items !== undefined
    ? s.items.filter((i) => i.t === 'verse').length : (s.verses ?? []).length);
  const sections = raw.sections ?? [];
  const title = raw.title ?? id;
  const source = raw.profile?.preset;
  const of = { kind: 'verified' as const, ...(source === undefined ? {} : { source }) };
  return [
    { id, title, ...of, note: `${sections.reduce((n, s) => n + count(s), 0)} verses` },
    ...sections.filter((s) => (s.title ?? '').trim() !== '' && sections.length > 1)
      .map((s) => ({ id: `${id}#${s.id}`, title: `${s.title} — in ${title}`, ...of, note: `${count(s)} verse(s)` })),
  ];
}

/**
 * A SECTION TAKEN OUT IS A TEXT OF ITS OWN — what opening `<doc>#<section>` gives.
 *
 * Its heading becomes the document's name, and nothing of the larger
 * document comes with it: not the book's title page, not its table of
 * contents, not the part it stood in, not the book's own description or its
 * directions for the whole rite. Asked for the gāyatrī, the bot opened it out
 * of his sādhanā and sent a PDF whose first two pages were the sādhanā's
 * "Veda Union / sādhanā" and its contents (2026-10-02): "I asked just for
 * gayatri! Why those 2 pages?"
 *
 * The section keeps its source line, and loses its heading, which is now the
 * title: his single documents name a text once.
 */
export function sectionDoc(doc: ChantDoc, sectionId: string): ChantDoc {
  const section = doc.sections.find((s) => s.id === sectionId);
  if (section === undefined) throw new Error(`no section "${sectionId}" in "${doc.title}"`);
  const { part: _part, sub: _sub, title: heading, label: _label, n: _n, groupId, ...alone } = section;
  const {
    book: _book, cover: _cover, contents: _contents, instructions: _instructions, subtitle: _subtitle, groups, ...whole
  } = doc;
  const title = heading?.trim() || doc.title;
  /* A group it is a member of goes with it only as far as it is that group's. */
  const group = groupId === undefined ? undefined : groups?.find((g) => g.id === groupId);
  const own = group === undefined ? undefined : { ...group, members: group.members.filter((m) => m === section.id) };
  return {
    ...whole,
    title,
    titleForms: { iast: title },
    ...(typeof section.source === 'string' && section.source.trim() !== '' ? { source: section.source } : {}),
    ...(own === undefined ? {} : { groups: [own] }),
    sections: [withVerses({ ...alone, ...(own === undefined ? {} : { groupId: own.id }) }, section.verses)],
  };
}

/** The entries a query names, the best first. */
export function findIn(entries: readonly LibraryEntry[], query: string): LibraryEntry[] {
  const words = fold(query).split(' ').filter((w) => w.length > 2);
  const scored = entries.map((e) => {
    const t = fold(`${e.title} ${e.id}`);
    return { e, score: words.filter((w) => t.includes(w)).length };
  }).filter((x) => x.score > 0);
  /* More of the query matched first; then a verified text; then the shorter title — the nearer match. */
  scored.sort((a, b) => b.score - a.score || (a.e.kind === b.e.kind ? 0 : a.e.kind === 'verified' ? -1 : 1)
    || a.e.title.length - b.e.title.length);
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
      const [file, section] = id.split('#') as [string, string | undefined];
      const r = await fetchImpl(new URL(`chants/${encodeURIComponent(file)}.json`, base));
      if (!r.ok) throw new Error(`no library text "${id}"`);
      const read = readChantFile(await r.text());
      if (!read.ok) throw new Error(read.error);
      const doc = openChantDoc(read.doc);
      return { doc: section === undefined ? doc : sectionDoc(doc, section), kind: 'verified' as const };
    },
  };
}
