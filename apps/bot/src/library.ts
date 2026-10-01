/**
 * THE LIBRARY ON DISK — the verified corpus first, then the owner's own files.
 *
 * `corpus/chants/*.json` are marked and checked: the agent opens one and
 * delivers it as it is. `Library/reference/` (his .docx files, present on his
 * machine and on his server, never in the repository) is read the way the app
 * opens them, `openDocumentFile`. Titles are matched with the diacritics and
 * the usual spellings folded — "purusha" finds "puruṣa".
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ChantDoc } from '@siksamitra/format';
import { readChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { openDocumentFile } from '@siksamitra/interop';
import type { Library, LibraryEntry } from '@siksamitra/agent';

/** A title as a search key: no diacritics, the common romanisations folded. */
export const fold = (s: string): string => s
  .normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/sh/g, 's').replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

interface Entry extends LibraryEntry { readonly path: string }

export function diskLibrary(root: string): Library {
  const entries: Entry[] = [];
  const corpus = join(root, 'corpus/chants');
  if (existsSync(corpus)) {
    for (const f of readdirSync(corpus).filter((n) => n.endsWith('.json'))) {
      const path = join(corpus, f);
      const read = readChantFile(readFileSync(path, 'utf8'));
      if (!read.ok) continue;
      entries.push({
        id: basename(f, '.json'), title: read.doc.title, kind: 'verified', path,
        ...(read.doc.profile?.preset === undefined ? {} : { source: read.doc.profile.preset }),
        note: `${read.doc.sections.reduce((n, s) => n + s.verses.length, 0)} verses`,
      });
    }
  }
  const reference = join(root, 'Library/reference');
  if (existsSync(reference)) {
    for (const f of readdirSync(reference).filter((n) => /\.(docx|smdoc|vuchant)$/i.test(n))) {
      entries.push({ id: `ref:${f}`, title: f.replace(/\.[a-z]+$/i, ''), kind: 'reference', path: join(reference, f) });
    }
  }
  return {
    async find(query) {
      const words = fold(query).split(' ').filter((w) => w.length > 2);
      const scored = entries.map((e) => {
        const t = fold(`${e.title} ${e.id}`);
        return { e, score: words.filter((w) => t.includes(w)).length };
      }).filter((x) => x.score > 0);
      scored.sort((a, b) => b.score - a.score || (a.e.kind === 'verified' ? -1 : 1));
      return scored.map(({ e }) => ({ id: e.id, title: e.title, kind: e.kind, ...(e.source === undefined ? {} : { source: e.source }), ...(e.note === undefined ? {} : { note: e.note }) }));
    },
    async load(id): Promise<{ doc: ChantDoc; kind: LibraryEntry['kind'] }> {
      const e = entries.find((x) => x.id === id);
      if (e === undefined) throw new Error(`no library text "${id}"`);
      if (e.kind === 'verified') {
        const read = readChantFile(readFileSync(e.path, 'utf8'));
        if (!read.ok) throw new Error(read.error);
        return { doc: openChantDoc(read.doc), kind: e.kind };
      }
      const opened = await openDocumentFile(new Uint8Array(readFileSync(e.path)), basename(e.path));
      return { doc: openChantDoc(opened.doc), kind: e.kind };
    },
  };
}
