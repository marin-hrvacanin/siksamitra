/**
 * The two XML string conversions, in one place.
 *
 * A `.docx` is a zip of XML and so is the custom part the document rides in, so
 * the reader and both writers need the same escaping. Two copies of it is how a
 * file comes back with `&amp;amp;` in a title: one side escaped twice because
 * the other side was known to escape once.
 *
 * `xmlEscape` deliberately does NOT escape `"` or `'`. Everything this program
 * writes into an attribute is a style id or a family name it chose itself; text
 * from a document only ever goes between tags, where a quote is an ordinary
 * character. Escaping it there would put `&quot;` in the owner's prose.
 */

/** `&lt;` and friends, back to the characters they stand for. */
export function xmlText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    /* `&amp;` LAST, so `&amp;lt;` gives back `&lt;` and not `<`. */
    .replace(/&amp;/g, '&');
}

/** Text that can sit between two tags. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
