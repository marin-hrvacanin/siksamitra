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
import { WORD_FOOTER, WORD_HEADER_RULE, WORD_HYPERLINK } from '@siksamitra/tokens/word';
import type { FooterPiece } from '@siksamitra/tokens/export-styles';

/** The header's relationship id in `document.xml.rels`, clear of the media's. */
export const HEADER_REL = 'rIdHead';
/** The footer's. */
export const FOOTER_REL = 'rIdFoot';

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

const xmlText = (t: string): string => t.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');

/**
 * `word/footer1.xml` — HIS FOOTER, the export style's own line (`footer`), the
 * same pieces the PDF's template draws: Arial at his `Footer` size, each link
 * a HYPERLINK field shown in his `Hyperlink` blue, underlined. The PDF had it
 * and the `.docx` did not, though both were meant to write the one line
 * (2026-10-04).
 */
export function footerXml(pieces: readonly FooterPiece[]): string {
  const size = Math.round(WORD_FOOTER.size * 2);
  const rpr = (link: boolean): string => `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>`
    + `${link ? `<w:color w:val="${WORD_HYPERLINK.color}"/><w:u w:val="single"/>` : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
  const runs = pieces.map((p) => ('link' in p
    ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
      + `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${xmlText(p.link)}" </w:instrText></w:r>`
      + '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
      + `<w:r>${rpr(true)}<w:t xml:space="preserve">${xmlText(p.link)}</w:t></w:r>`
      + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    : `<w:r>${rpr(false)}<w:t xml:space="preserve">${xmlText(p.text)}</w:t></w:r>`)).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + `<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>${runs}</w:p></w:ftr>`;
}
