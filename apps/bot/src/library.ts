/**
 * THE LIBRARY ON DISK — the verified corpus, then the owner's own documents.
 *
 * `corpus/chants/*.json` are marked and checked: the agent opens one and
 * delivers it as it is. HIS OWN DOCUMENTS are a folder `tools/bot-library.ts`
 * writes from his files, on his machine — each read as `sm import` reads it,
 * kept as the lossless `.smdoc` beside a copy of his own file, and an index
 * of what tells one text from another: title, version, tradition, locus,
 * first words, verses. On the server the folder is the data directory's
 * `library/`, outside the image and outside the repository; on his machine,
 * `Library/bot-library/`. Titles are matched with the diacritics and the
 * usual spellings folded — "purusha" finds "puruṣa".
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ChantDoc } from '@siksamitra/format';
import { readChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { openDocumentFile } from '@siksamitra/interop';
import { findIn, indexEntries, sectionDoc, type Library, type LibraryEntry } from '@siksamitra/agent';

interface Entry extends LibraryEntry { readonly path: string }

/** One of his documents, as `tools/bot-library.ts` writes it into `index.json`. */
export interface HisDocument {
  /** `his:<slug>`; a section is `his:<slug>#<section>`. */
  readonly id: string;
  readonly title: string;
  /** Out of his file's name: `v1.1`. */
  readonly version?: string;
  /** The script his file is written in. */
  readonly script: 'IAST' | 'Devanāgarī';
  /** His own file, copied beside the document as it is. */
  readonly file: string;
  /** The document, as the importer read it. */
  readonly smdoc: string;
  readonly tradition?: string;
  readonly locus?: string;
  readonly first: string;
  readonly verses: number;
  readonly sections: readonly { readonly id: string; readonly title: string; readonly first: string; readonly verses: number }[];
}

/**
 * `hide`: texts it must not find — a whole text by its id, with its sections.
 * The self-test asks the agent for a text of his with that text hidden, so it
 * must build it, and holds its page against his (`tools/fidelity/agent-eval.ts`).
 */
export function diskLibrary(root: string, his = join(root, 'Library', 'bot-library'), hide: readonly string[] = []): Library {
  const entries: Entry[] = [];
  const corpus = join(root, 'corpus/chants');
  if (existsSync(corpus)) {
    for (const f of readdirSync(corpus).filter((n) => n.endsWith('.json'))) {
      const path = join(corpus, f);
      for (const e of indexEntries(basename(f, '.json'), JSON.parse(readFileSync(path, 'utf8')))) entries.push({ ...e, path });
    }
  }
  const index = join(his, 'index.json');
  const own: readonly HisDocument[] = existsSync(index) ? JSON.parse(readFileSync(index, 'utf8')) as HisDocument[] : [];
  for (const h of own) {
    const named = `${h.title}${h.version === undefined ? '' : ` ${h.version}`}`;
    const path = join(his, h.smdoc);
    entries.push({
      id: h.id, title: named, kind: 'reference', path, first: h.first,
      ...(h.tradition === undefined ? {} : { source: h.tradition }),
      note: `his own document, in ${h.script}, ${h.verses} verses${h.locus === undefined ? '' : ` · ${h.locus}`}`,
    });
    for (const s of h.sections) {
      entries.push({ id: `${h.id}#${s.id}`, title: `${s.title} — in ${named}`, kind: 'reference', path, first: s.first, note: `a section of his document, ${s.verses} verse(s)` });
    }
  }
  const hidden = (id: string): boolean => hide.includes(id) || hide.includes(id.split('#')[0]!);
  for (let i = entries.length - 1; i >= 0; i -= 1) if (hidden(entries[i]!.id)) entries.splice(i, 1);
  return {
    async find(query) {
      return findIn(entries, query).map(({ id, title, kind, source, note, first }) => ({
        id, title, kind, ...(source === undefined ? {} : { source }), ...(note === undefined ? {} : { note }),
        ...(first === undefined ? {} : { first }),
      }));
    },
    async load(id): Promise<{ doc: ChantDoc; kind: LibraryEntry['kind'] }> {
      const e = entries.find((x) => x.id === id);
      if (e === undefined) throw new Error(`no library text "${id}"`);
      const section = id.split('#')[1];
      let doc: ChantDoc;
      if (e.kind === 'verified') {
        const read = readChantFile(readFileSync(e.path, 'utf8'));
        if (!read.ok) throw new Error(read.error);
        doc = openChantDoc(read.doc);
      } else {
        doc = openChantDoc((await openDocumentFile(new Uint8Array(readFileSync(e.path)), basename(e.path))).doc);
      }
      return { doc: section === undefined ? doc : sectionDoc(doc, section), kind: e.kind };
    },
    async original(id) {
      const h = own.find((x) => x.id === id);
      return h === undefined ? null : { name: h.file, bytes: new Uint8Array(readFileSync(join(his, h.file))) };
    },
  };
}
