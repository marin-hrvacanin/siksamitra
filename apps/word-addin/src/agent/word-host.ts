/**
 * THE AGENT IN WORD — what the Word panel can give it.
 *
 *   library   the verified documents, published with the panel itself
 *             (`chants/index.json`, `chants/<id>.json` — the app's corpus
 *             plugin, `apps/web/vite-corpus.ts`): the panel's own site, so no
 *             other is asked, which a Word panel may not do;
 *   place     a finished text goes in at the caret, by the add-in's own
 *             writer (`insertChantDoc`), in his styles;
 *   no web    a Word panel cannot read other sites; a person pastes a text
 *             instead, and it is built from as it is (`Session`).
 */
import { findIn, type Host, type LibraryEntry } from '@siksamitra/agent';
import { readChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { insertChantDoc } from '../word/insert-doc.js';

export function wordHost(base: string = new URL('./', globalThis.location?.href ?? 'https://localhost/').toString()): Host {
  let index: Promise<LibraryEntry[]> | null = null;
  const entries = (): Promise<LibraryEntry[]> => (index ??= fetch(new URL('chants/index.json', base))
    .then(async (r) => {
      if (!r.ok) throw new Error(`the library could not be read (${r.status})`);
      return (await r.json()) as LibraryEntry[];
    })
    .catch((e: unknown) => { index = null; throw e; }));
  return {
    library: {
      async find(query) { return findIn(await entries(), query); },
      async load(id) {
        const r = await fetch(new URL(`chants/${encodeURIComponent(id)}.json`, base));
        if (!r.ok) throw new Error(`no library text "${id}"`);
        const read = readChantFile(await r.text());
        if (!read.ok) throw new Error(read.error);
        return { doc: openChantDoc(read.doc), kind: 'verified' };
      },
    },
    async place(doc) {
      const done = await insertChantDoc(doc);
      return `put into the document at the caret: "${done.title}", ${done.verses} verse(s)`;
    },
  };
}
