/**
 * WHERE A LINE IS WRITTEN — so that writing it keeps the part it is in.
 *
 * A line is written by replacing its paragraph's content with a package
 * (`insertOoxml`, replace). MEASURED IN WORD: when that paragraph is the only
 * one in a part — a content control of its own — the replacement deletes the
 * content control with it, and the part is gone; a line of a part of two or
 * more is written and the part stays. Choosing a register over one selected
 * line made it a part and the re-mark that followed unmade it, silently.
 *
 * Writing into the content control's own content instead keeps it (the same
 * measurement), so that is the target where the paragraph IS the whole part.
 * "The whole part" is told by text: a control of more than one paragraph has
 * a paragraph break in its text, and one of this line alone has this line's.
 */

/** The range each paragraph's line is written into, in order. */
export async function lineTargets(paragraphs: readonly Word.Paragraph[]): Promise<Word.Range[]> {
  if (paragraphs.length === 0) return [];
  const context = paragraphs[0]!.context;
  const parts = paragraphs.map((p) => {
    const cc = p.parentContentControlOrNullObject;
    cc.load('isNullObject,text');
    p.load('text');
    return cc;
  });
  await context.sync();
  return paragraphs.map((p, i) => {
    const cc = parts[i]!;
    const whole = !cc.isNullObject && cc.text === p.text;
    return (whole ? cc : p).getRange(Word.RangeLocation.content);
  });
}
