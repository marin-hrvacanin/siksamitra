/**
 * ANY FILE THIS PROGRAM READS, AS A DOCUMENT — one function, for the app's
 * Import and the Word add-in's "Insert a document" both.
 *
 * It lived inside the app's File group, a React component, so the add-in
 * could not open what the app opens without a second copy (rule 1). Which
 * reader a file takes is decided by its name and its own bytes:
 *
 *   `.smdoc` / `.vuchant`  both generations — v2 is a zip, v1 is `SMDI` (xz),
 *                          `SMDC` (zlib) or bare JSON;
 *   `.docx`                one of OURS carries the document itself and comes
 *                          back exactly; anyone else's is read from its styles;
 *   `.html`                the app's own page, which carries the document too.
 */
import type { ChantDoc } from '@siksamitra/format';
import { documentFlavour, unpackDocument } from './document.js';
import { importSmdoc } from './smdoc/index.js';
import { importDocx } from './docx.js';
import { importWord, isSiksamitraDocx } from './word/index.js';
import { importHtml } from './html/index.js';

export interface OpenedFile {
  doc: ChantDoc;
  /** Something worth saying about how it was read, or `null`. */
  note: string | null;
}

/** The file extensions `openDocumentFile` reads — for a file picker's `accept`. */
export const OPENABLE = ['.smdoc', '.vuchant', '.docx', '.html'] as const;

export async function openDocumentFile(bytes: Uint8Array, name: string): Promise<OpenedFile> {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'smdoc' || ext === 'vuchant') {
    if (documentFlavour(bytes) === 'v2') return { doc: unpackDocument(bytes).doc, note: null };
    const result = await importSmdoc(bytes);
    const marks = result.doc.overrides?.length ?? 0;
    return {
      doc: result.doc,
      note: `${name}: an older document, derived into this format${marks > 0 ? ` — ${marks} mark(s) kept as the author's own` : ''}`,
    };
  }
  if (ext === 'docx') {
    if (isSiksamitraDocx(bytes)) {
      const read = await importWord(bytes);
      /* What was done to the page in Word since is IN the document (`body-edits.ts`). */
      const { edited, added, removed } = read.inWord;
      const inWord = [
        edited > 0 ? `${edited} verse(s) edited` : '', added > 0 ? `${added} added` : '', removed > 0 ? `${removed} removed` : '',
      ].filter((x) => x !== '').join(', ');
      return {
        doc: read.doc,
        note: inWord !== ''
          ? `${name}: opened, with what was done in Word — ${inWord}`
          : read.intact
            ? `${name}: opened exactly — the document was inside the file`
            : `${name}: the document inside the file no longer hashes to what it recorded`,
      };
    }
    const result = importDocx(bytes);
    const unresolved = result.report.unresolved.length;
    return {
      doc: result.doc,
      note: unresolved > 0 ? `${name}: ${unresolved} run(s) whose styling this version does not understand were kept as plain text` : null,
    };
  }
  if (ext === 'html' || ext === 'htm') {
    const read = await importHtml(new TextDecoder().decode(bytes));
    return { doc: read.doc, note: null };
  }
  throw new Error(`${name}: not a document this program opens (${OPENABLE.join(', ')})`);
}
