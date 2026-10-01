/**
 * A WHOLE DOCUMENT OF THE APP AS WORD PARAGRAPHS — for "Insert a document".
 *
 * The body the app's own Export Word writes (`documentXml` in interop): its
 * name, its parts' headings, every verse in the script chosen, translations,
 * and a section of another register as a PART — the content control Word
 * shows framed and the add-in reads back as that register. The same writer,
 * so a chant brought into Word from the app is the chant the app exports.
 *
 * Pictures are the one thing left out: they need the file's media parts, and
 * Word inserts a picture better than a package can. Each is written as the
 * note the writer leaves where a picture's bytes are missing, and counted, so
 * the person is told.
 */
import type { ChantDoc } from '@siksamitra/format';
import { documentXml } from '@siksamitra/interop';
import type { ScriptKey } from '@siksamitra/engine';

const BODY = /<w:body>([\s\S]*)<\/w:body>/;

export interface DocumentBody {
  /** The `<w:p>` and `<w:sdt>` elements. */
  body: string;
  /** Mantra lines written. */
  verses: number;
  /** Pictures the document has that were not brought in. */
  pictures: number;
}

export function documentBody(doc: ChantDoc, script: ScriptKey = 'iast'): DocumentBody {
  const body = BODY.exec(documentXml(doc, '', undefined, script))?.[1] ?? '';
  /* A composed section holds its verses in `items`; any other in `verses`. */
  const items = doc.sections.flatMap((s) => (s.items ?? []) as readonly { t?: string }[]);
  const verses = doc.sections.reduce((n, s) => n + (s.items === undefined
    ? s.verses.length : (s.items as readonly { t?: string }[]).filter((x) => x.t === 'verse').length), 0);
  const pictures = items.filter((x) => x.t === 'figure').length;
  return { body, verses, pictures };
}
