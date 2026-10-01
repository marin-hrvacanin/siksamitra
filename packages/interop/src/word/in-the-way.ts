/**
 * WHAT IN A WORD PARAGRAPH WOULD NOT SURVIVE BEING REWRITTEN.
 *
 * A marking changes where a paragraph's runs are cut anywhere in the line, so
 * whatever writes one — the Word add-in, and any later program that marks a
 * document in place — replaces the paragraph's content whole. That is safe for
 * text and our styles, and for nothing else: a picture, a comment, a field or a
 * tracked change inside the line would simply be gone.
 *
 * So a paragraph carrying any of them is REFUSED, never rewritten, and the
 * person is told what is in the way. Carrying them through by splicing was
 * rejected: it is how a comment ends up anchored to the wrong letter. A later
 * change may carry one kind at a time, once each is proven round-trip in Word.
 *
 * Measured against the owner's own files first, so the check costs his work
 * nothing it need not: across 853 mantra paragraphs of the sādhanā and
 * kanakadhārā the run formatting is `rStyle`, `vertAlign`, `rFonts` and `lang`
 * and nothing else — none of which is refused. What is: the 3 lines with a
 * picture on them. Their 6 bookmarks are all Word's own scratch ones, and
 * pass. See `word-addin-complete`, design D4.
 */

/** One kind of thing, how to see it, and what the person is told. */
const IN_THE_WAY: readonly (readonly [RegExp, string])[] = [
  [/<w:drawing\b|<w:pict\b|<mc:AlternateContent\b|<v:shape\b/, 'a picture, a shape or a text box'],
  [/<w:object\b/, 'an embedded object'],
  [/<m:oMath(?:Para)?\b/, 'an equation'],
  [/<w:fldChar\b|<w:fldSimple\b|<w:instrText\b/, 'a field — a page number, a date, a cross-reference'],
  [/<w:sdt\b/, 'a content control'],
  [/<w:(?:ins|del|moveFrom|moveTo|rPrChange|pPrChange)\b/, 'a tracked change — accept or reject it first'],
  [/<w:commentRangeStart\b|<w:commentReference\b/, 'a comment'],
  [/<w:footnoteReference\b|<w:endnoteReference\b/, 'a footnote or an endnote'],
  [/<w:hyperlink\b/, 'a link'],
  /* Word's own scratch bookmarks go: `_GoBack` marks where the caret last was
     and is rewritten on every save, `_Hlk…` is left behind by a copy and
     nothing points at it, and `_smCaret` / `_smCaretEnd` are the Word
     add-in's own caret and selection marks, deleted in the batch that writes
     them. Any other — `_Toc…`, `_Ref…`, a named one — is
     somebody's cross-reference target. */
  [/<w:bookmarkStart\b(?![^>]*w:name="(?:_GoBack|_Hlk\d+|_smCaret|_smCaretEnd)")/, 'a bookmark — a table of contents or a cross-reference points here'],
  [/<w:sym\b/, 'a symbol inserted from a font'],
  /* Direct formatting on a run — bold, a highlight, a colour — is the person's
     own, and our runs carry only a style. His files have none. */
  [/<w:r\b[^>]*>\s*<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<w:(?:b|i|u|strike|dstrike|highlight|shd|color|caps|smallCaps)\b/,
    'formatting of its own — bold, italic, a colour or a highlight'],
];

/**
 * What in this paragraph's OOXML a rewrite would lose, once per kind, in the
 * person's words. Empty means the paragraph may be written.
 */
export function inTheWay(paragraphXml: string): string[] {
  const xml = withoutOurUprightPauses(paragraphXml);
  return IN_THE_WAY.filter(([re]) => re.test(xml)).map(([, what]) => what);
}

/*
 * THE UPRIGHT PAUSE IS OURS. The writer takes the slant off a pause bar by
 * direct formatting — `i`/`iCs` off (`pauseRun`) — and the rule above took
 * that for the person's own: every line with a pause in it was then refused
 * ("formatting of its own"), found when the owner chose a register over his
 * lines in Word. A run that is a pause bar and nothing else, in a style, with
 * italic turned OFF and no other direct formatting, is the add-in's; any
 * other formatting on it, or on any other run, is still the person's.
 */
const OFF = String.raw`<w:i(?:Cs)? w:val="(?:0|false)"\s*/>`;
const UPRIGHT_PAUSE = new RegExp(
  String.raw`(<w:r\b[^>]*>\s*<w:rPr>\s*<w:rStyle w:val="[^"]+"\s*/>)\s*(?:${OFF}\s*){1,2}(</w:rPr>\s*<w:t\b[^>]*>\s*[|¦]{1,2}\s*</w:t>\s*</w:r>)`,
  'g',
);
const withoutOurUprightPauses = (xml: string): string => xml.replace(UPRIGHT_PAUSE, '$1$2');
