/**
 * THE PARAGRAPH STYLE A WRITE NEEDS, BY NAME — when the line it wrote is in
 * another style than the paragraph was.
 *
 * Replacing a paragraph's content keeps its paragraph mark, and the mark is
 * where the style is (measured in Word): a line written in another style kept
 * the old one. So the paragraph is given the new style by NAME — the name
 * Word knows it by in the clean vocabulary — once the package has brought it
 * in. A plain line marked becomes a mantra line; a line written in Devanāgarī
 * takes his `Devanagari`; one written back in IAST, the mantra style again.
 */
import { VOCABULARY } from '@siksamitra/interop';

/** The style a written body names, as Word knows it — or `null` when it is the paragraph's own. */
export function restyleTo(body: string, was: string | null): string | null {
  const id = /<w:pStyle w:val="([^"]+)"/.exec(body)?.[1] ?? null;
  if (id === null || id === (was ?? 'Normal')) return null;
  return VOCABULARY.find((e) => e.legacy === id || e.clean === id)?.name ?? id;
}
