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
import { findIn, indexEntries, sectionDoc, type Library, type LibraryEntry } from '@siksamitra/agent';

interface Entry extends LibraryEntry { readonly path: string }

export function diskLibrary(root: string): Library {
  const entries: Entry[] = [];
  const corpus = join(root, 'corpus/chants');
  if (existsSync(corpus)) {
    for (const f of readdirSync(corpus).filter((n) => n.endsWith('.json'))) {
      const path = join(corpus, f);
      for (const e of indexEntries(basename(f, '.json'), JSON.parse(readFileSync(path, 'utf8')))) entries.push({ ...e, path });
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
      return findIn(entries, query).map(({ id, title, kind, source, note }) => ({
        id, title, kind, ...(source === undefined ? {} : { source }), ...(note === undefined ? {} : { note }),
      }));
    },
    async load(id): Promise<{ doc: ChantDoc; kind: LibraryEntry['kind'] }> {
      const e = entries.find((x) => x.id === id);
      if (e === undefined) throw new Error(`no library text "${id}"`);
      if (e.kind === 'verified') {
        const read = readChantFile(readFileSync(e.path, 'utf8'));
        if (!read.ok) throw new Error(read.error);
        const doc = openChantDoc(read.doc);
        const section = id.split('#')[1];
        return { doc: section === undefined ? doc : sectionDoc(doc, section), kind: e.kind };
      }
      const opened = await openDocumentFile(new Uint8Array(readFileSync(e.path)), basename(e.path));
      return { doc: openChantDoc(opened.doc), kind: e.kind };
    },
  };
}
