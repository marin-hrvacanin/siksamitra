/**
 * OUR PARAGRAPH INDEX → WORD'S, when hidden paragraphs are in the document.
 *
 * `readDocument` reads every `<w:p>` of the OOXML; `writeDocument` addresses
 * Word's own `body.paragraphs`. The two agree — except that Word leaves OUT a
 * paragraph whose MARK is hidden (`<w:pPr><w:rPr><w:vanish/>`) whenever hidden
 * text is not being shown, which is the default. Measured on his Devī
 * Māhātmyam, which hides 21 paragraphs: Word counts 3 900 with hidden text
 * hidden and 3 921 with it shown, and our reader 3 921. The whole-document
 * re-mark refused on that file, and would have written the wrong lines had it
 * not checked.
 *
 * AND ONE MORE THAT WORD DOES NOT COUNT: `body.getOoxml()` ends the body with
 * an empty paragraph of its own (`<w:p …/>` before `<w:sectPr>`), which
 * `body.paragraphs` does not have — measured on a one-line document: 2
 * against 1, and every whole-document run refused "the document changed".
 * A document that really ends in an empty paragraph has it counted by Word
 * too, so an empty last paragraph may or may not be in Word's count; both
 * are accepted, and neither changes an index before it.
 *
 * With hidden text collapsed a hidden-mark paragraph is joined to the one
 * after it, so THAT paragraph, in Word, begins with the hidden text: writing it
 * would delete what is hidden. It is not written — see `nextToHidden`.
 */

/** Is this paragraph's MARK hidden? */
export const markIsHidden = (paragraphXml: string): boolean =>
  /<w:pPr>(?:(?!<\/w:pPr>)[\s\S])*<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<w:vanish\s*\/>/.test(paragraphXml);

/** Is this paragraph empty — no run at all, as `getOoxml`'s own last one is? */
export const isEmptyParagraph = (paragraphXml: string): boolean => !/<w:r[\s>]/.test(paragraphXml);

/** What a read of the whole body says about its paragraphs. */
export interface BodyShape {
  /** Paragraphs our reader found. */
  total: number;
  /** Ours whose mark is hidden. */
  hidden: readonly number[];
  /** Is our last one empty — possibly `getOoxml`'s own, which Word does not count? */
  emptyLast?: boolean;
}

/** The shape of a body read from its paragraphs' OOXML. */
export const bodyShape = (raw: readonly string[]): BodyShape => ({
  total: raw.length,
  hidden: raw.flatMap((x, i) => (markIsHidden(x) ? [i] : [])),
  emptyLast: raw.length > 0 && isEmptyParagraph(raw.at(-1)!),
});

/** Does this paragraph follow one whose mark is hidden — so Word may have joined them? */
export const nextToHidden = (index: number, hidden: readonly number[]): boolean => hidden.includes(index - 1);

/**
 * The Word index for each of ours, or `null` where there is no safe one.
 *
 * `undefined` when Word's count matches neither reading — the document changed
 * under the read, and nothing may be written.
 */
export function wordIndexOf(
  { total, hidden, emptyLast = false }: BodyShape, wordCount: number,
): ((index: number) => number | null) | undefined {
  const totals = emptyLast ? [total, total - 1] : [total];
  if (totals.includes(wordCount)) return (i) => i;
  if (!totals.includes(wordCount + hidden.length)) return undefined;
  return (i) => (hidden.includes(i) || nextToHidden(i, hidden) ? null : i - hidden.filter((h) => h < i).length);
}
