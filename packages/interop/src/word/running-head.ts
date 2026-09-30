/**
 * HIS RUNNING HEAD — the chant and the step a page is in, and its number.
 *
 * Every one of his documents carries it: the page's Heading 2 and Heading 3,
 * as fields Word fills in for each page (`STYLEREF`), centred over a rule,
 * and the page number at the right. Word updates the fields as it lays the
 * pages out, so nothing here needs to know where a page breaks.
 *
 * Written for the `veda-union` export style (`runningHead` on it), which is
 * his document; a card or a web page has no pages to head.
 */
import { WORD_HEADER_RULE } from '@siksamitra/tokens/word';

/** The header's relationship id in `document.xml.rels`, clear of the media's. */
export const HEADER_REL = 'rIdHead';

/** One field, with an empty result for Word to fill in. */
const field = (code: string): string =>
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
  + `<w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r>`
  + '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t></w:t></w:r>'
  + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';

/** `word/header1.xml`. */
export function runningHeadXml(): string {
  const rule = `<w:pBdr><w:bottom w:val="single" w:sz="${WORD_HEADER_RULE.eighths}" w:space="${WORD_HEADER_RULE.space}" w:color="auto"/></w:pBdr>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + `<w:p><w:pPr><w:pStyle w:val="Header"/>${rule}</w:pPr><w:r><w:tab/></w:r>`
    + `${field('STYLEREF  "Heading 2"')}<w:r><w:t xml:space="preserve">   </w:t></w:r>${field('STYLEREF  "Heading 3"')}`
    + `<w:r><w:tab/></w:r>${field('PAGE')}</w:p></w:hdr>`;
}
