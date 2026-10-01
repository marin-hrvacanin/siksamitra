/**
 * "INSERT A DOCUMENT" — one of the app's documents, at the caret in Word.
 *
 * The file is read by the app's own reader (`openDocumentFile`), written by
 * the app's own Word body writer (`model/document-body.ts`), and goes in as
 * the add-in's package, so it arrives in the clean styles and — in one of
 * his documents — in his look (`packageOf`).
 */
import type { ChantDoc } from '@siksamitra/format';
import { documentBody } from '../model/document-body.js';
import { styleSheetFor } from '../model/sheet.js';
import { learn, packageOf } from './client.js';

export interface Inserted {
  title: string;
  verses: number;
  pictures: number;
  note: string | null;
}

export async function insertDocument(bytes: Uint8Array, name: string): Promise<Inserted> {
  /* Loaded when a document is brought in, not with the ribbon: the readers
     carry the compression code. */
  const { openDocumentFile } = await import('@siksamitra/interop');
  const { doc, note } = await openDocumentFile(bytes, name);
  return { ...(await insertChantDoc(doc)), note };
}

/** A document already open — the agent's — at the caret, by the same writer. */
export async function insertChantDoc(doc: ChantDoc): Promise<Inserted> {
  const { body, verses, pictures } = documentBody(doc);
  await Word.run(async (context) => {
    /* His look first, as every write does: the target's own styles. */
    const line = context.document.getSelection().paragraphs.getLast();
    line.load('text');
    const sample = line.getRange().getOoxml();
    await context.sync();
    learn(sample.value);
    /*
     * INTO A PARAGRAPH OF ITS OWN, after the one the caret is in — or that
     * one, when it is empty. Measured in Word: paragraphs inserted into a bare
     * caret inside a paragraph are refused ("GeneralException"), while the
     * same package goes in whole into a paragraph of its own — which is how
     * the specimen has always gone in (`addStyles`).
     */
    const room = line.text.trim() === '' ? line : line.insertParagraph('', Word.InsertLocation.after);
    room.getRange(Word.RangeLocation.whole).insertOoxml(packageOf(body, styleSheetFor(body)), Word.InsertLocation.replace);
    await context.sync();
  });
  return { title: doc.title, verses, pictures, note: null };
}
