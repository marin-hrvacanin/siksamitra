/**
 * HIS DEVANĀGARĪ STYLES, from `WORD_DEVANAGARI` — written only when a body uses
 * them, so an IAST document's Styles pane does not gain three names for things
 * that are not on its page.
 *
 * `Devanagari` sets its face explicitly: in his file it comes from the
 * document's defaults, which a document of anyone else's does not share.
 * `CT_RPr` is a schema SEQUENCE — `rFonts`, `b`, `noProof`, `color`,
 * `position`, `sz` — and Word reports a violation only as a corrupted file.
 */
import { WORD_DEVANAGARI } from '@siksamitra/tokens/word';
import { xmlEscape } from '../xml.js';

const D = WORD_DEVANAGARI;
const face = (f: string): string => {
  const x = xmlEscape(f);
  return `<w:rFonts w:ascii="${x}" w:hAnsi="${x}" w:cs="${x}"/>`;
};

const paragraph = (): string => {
  const p = D.paragraph;
  return `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${p.style}"><w:name w:val="${p.style}"/>`
    + `<w:basedOn w:val="Normal"/><w:next w:val="${p.style}"/><w:qFormat/>`
    + `<w:pPr><w:keepNext/><w:spacing w:before="0" w:after="0" w:line="${p.line}" w:lineRule="exact"/>`
    + `<w:ind w:left="${p.indentLeft}" w:hanging="${p.hanging}"/></w:pPr>`
    + `<w:rPr>${face(p.face)}<w:noProof/><w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/></w:rPr></w:style>`;
};

const hold = (): string => {
  const h = D.hold;
  return `<w:style w:type="character" w:customStyle="1" w:styleId="${h.style}"><w:name w:val="${h.style}"/>`
    + '<w:uiPriority w:val="1"/><w:qFormat/>'
    + `<w:rPr>${face(h.face)}<w:b w:val="0"/><w:color w:val="${h.color}"/><w:position w:val="${h.raise}"/>`
    + `<w:sz w:val="${h.size}"/><w:szCs w:val="${h.size}"/></w:rPr></w:style>`;
};

const aid = (): string => {
  const a = D.aid;
  return `<w:style w:type="character" w:customStyle="1" w:styleId="${a.style}"><w:name w:val="${a.style}"/>`
    + '<w:uiPriority w:val="1"/><w:qFormat/>'
    + `<w:rPr><w:color w:val="${a.color}"/><w:position w:val="${a.raise}"/>`
    + `<w:sz w:val="${a.size}"/><w:szCs w:val="${a.size}"/></w:rPr></w:style>`;
};

/** The Devanāgarī styles `used` names — paragraph or character ids. */
export function devanagariStyles(used: ReadonlySet<string>): string {
  return (used.has(D.paragraph.style) ? paragraph() : '')
    + (used.has(D.hold.style) ? hold() : '')
    + (used.has(D.aid.style) ? aid() : '');
}
