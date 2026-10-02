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
import { memoryAttachments, publishedLibrary, type Host } from '@siksamitra/agent';
import { insertChantDoc } from '../word/insert-doc.js';

export function wordHost(base: string = new URL('./', globalThis.location?.href ?? 'https://localhost/').toString()): Host {
  return {
    where: "the Word add-in's panel, beside the person's open Word document",
    library: publishedLibrary(base),
    /* What the person adds to a message from the panel, kept for this conversation (`attachments.ts`). */
    attachments: memoryAttachments(),
    async place(doc) {
      const done = await insertChantDoc(doc);
      return `put into the document at the caret: "${done.title}", ${done.verses} verse(s)`;
    },
  };
}
