/**
 * WHERE THE CARET GOES BACK TO, after a paragraph is rewritten.
 *
 * Replacing a paragraph's content leaves Word's caret at its end, and Office.js
 * has no way to put a caret at a character offset. What it has is bookmarks:
 * so the paragraph is written with a hidden one, `_smCaret`, at the offset
 * where the caret belongs, and the client selects it and deletes it in the same
 * batch. Nothing is left behind; `inTheWay` passes the name in case a host
 * fails between the two. At the end of a line there is no mark (Word drops
 * one there), and the client puts the caret at the end of the line itself.
 *
 * The offset is a WORD offset — characters as `Paragraph.text` counts them —
 * and it is found by reading the written XML back through the same reader and
 * `offsetMap` the selection is located with, so the two cannot disagree.
 */
import { mergeRuns, readParagraphs } from '@siksamitra/interop';
import { offsetMap, toWord } from './offsets.js';

export const CARET_BOOKMARK = '_smCaret';
const MARK = `<w:bookmarkStart w:id="90210" w:name="${CARET_BOOKMARK}"/><w:bookmarkEnd w:id="90210"/>`;

const RE_RUN = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
const RE_ONLY_TEXT = /^(<w:r\b[^>]*>)(<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t><\/w:r>$/;

const decode = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const encode = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** How many Word characters a run contributes: its text, a break, a tab. */
function lengthOf(run: string): number {
  let n = 0;
  for (const t of run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) n += decode(t[1] ?? '').length;
  n += (run.match(/<w:br\b[^>]*\/>/g) ?? []).length + (run.match(/<w:tab\b[^>]*\/>/g) ?? []).length;
  return n;
}

/**
 * The paragraph XML with the caret bookmark at a Word offset. A run of text is
 * split there, both halves keeping its properties — two adjacent runs with the
 * same border are one box (ECMA-376 §17.3.2.4), so a split inside a holding
 * draws nothing new. A run that is not plain text is never split: the mark
 * goes after it.
 */
export function withCaretAt(paragraph: string, wordOffset: number): string {
  let seen = 0;
  let done = false;
  const out = paragraph.replace(RE_RUN, (run) => {
    if (done) return run;
    const n = lengthOf(run);
    if (wordOffset <= seen) { done = true; return MARK + run; }
    if (wordOffset < seen + n) {
      done = true;
      const m = RE_ONLY_TEXT.exec(run);
      if (m === null) return run + MARK;
      const text = decode(m[3] ?? '');
      const cut = wordOffset - seen;
      const half = (s: string): string => `${m[1]}${m[2] ?? ''}<w:t xml:space="preserve">${encode(s)}</w:t></w:r>`;
      return half(text.slice(0, cut)) + MARK + half(text.slice(cut));
    }
    seen += n;
    return run;
  });
  /* AT THE VERY END, NO MARK. Word on the web drops a bookmark that ends the
     content it is inserting — measured: the mark came back as nothing, and the
     caret was left wherever Word had put it. The client selects the end of the
     paragraph's content instead, which is the same place. */
  return out;
}

/** The Word offset of a model offset, in the paragraph as written. */
export function wordOffsetIn(paragraph: string, modelAt: number): number {
  const [read] = readParagraphs(paragraph);
  if (read === undefined) return 0;
  return toWord(offsetMap(mergeRuns(read.runs)), modelAt);
}
