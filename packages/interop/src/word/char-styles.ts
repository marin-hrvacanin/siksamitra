/**
 * THE MARKING VOCABULARY, as Word character styles.
 *
 * Split out of `styles.ts` at the 400-line module gate. That file writes the
 * PARAGRAPHS — the shape of the page — and this writes what a marked letter
 * looks like: the two holding boxes, the svara, the substitutions, the pause,
 * and the source note.
 *
 * These are HIS ids and his values, measured off
 * `tools/chant/templates/vu-word-template.docx`, because a file we write and a
 * file he already has have to be the same kind of document. What that is worth
 * is checked by `tools/export/gate-word-look.mjs`, which compares every one of
 * them against that template on face, weight, italic and colour.
 */
import { MARK_GEOMETRY } from '@siksamitra/tokens/source';
import type { DocumentMode } from '@siksamitra/tokens/document-themes';
import type { DocTypeScale } from '@siksamitra/tokens/document-type';
import { WORD_MARKS, WORD_PARAGRAPHS } from '@siksamitra/tokens/word';
import { xmlEscape } from '../xml.js';
import {
  PT_PER_PX, PT_PER_REM, eighths, halfPoints, wordHex, type Families,
} from './units.js';
import { roleColor } from './styles.js';

/**
 * The holding box's stroke, in eighths of a point.
 *
 * The page draws it as `max(1px, 0.032em)` (`mark-geometry.css`), so a 16 pt
 * mantra gets a 1 px hairline — 0.75 pt — and the long box 0.075 em, 1.2 pt.
 * Those are the numbers the PDF prints, so they are the numbers the `.docx`
 * has to ask for, or the two exports differ on the most visible mark on the
 * page. Word stores a border weight in eighths of a point and takes integers
 * only, so 1.2 pt is written as 10/8 = 1.25 pt: a 0.05 pt quantisation that
 * `gate-pdf.mjs` reports rather than hides.
 */
export function holdStroke(sizeRem: number, which: 'short' | 'long'): number {
  const em = MARK_GEOMETRY.holdStroke[which];
  const floor = MARK_GEOMETRY.holdStroke.minPx * PT_PER_PX;
  return Math.max(2, eighths(Math.max(em * sizeRem * PT_PER_REM, floor)));
}

/**
 * The mark styles, from the theme's own palette.
 *
 * The `Svara` run is a combining character rather than a drawn stroke, and his
 * file sets it 2 pt larger than the line it sits on — `w:sz="36"` over
 * `w:sz="32"`. Kept as that RATIO of the theme's mantra size rather than as
 * 18 pt, so a theme with a different mantra size gets a mark in proportion; on
 * the `word` theme it resolves to his 18 pt exactly.
 */
export function charStyles(
  scale: DocTypeScale,
  mode: DocumentMode,
  families: Families,
  used: ReadonlySet<string>,
): string {
  const verse = scale.verse;
  const markRatio = WORD_MARKS.svara.size
    / WORD_PARAGRAPHS.find((p) => p.role === 'verse-line')!.size;
  const svaraSz = halfPoints(verse.size * markRatio);
  /*
   * `w:bdr` COMES LAST in `CT_RPr`, after `w:color` and `w:sz` — the schema is a
   * sequence and Word reports a violation only as "the file appears to be
   * corrupted". The combined styles below are what makes a letter able to be
   * boxed and substituted at once; see `word-styles.ts` for the measurement
   * that found the pairing losing its blue.
   */
  const box = (
    id: string, which: 'short' | 'long', color: string, also?: string,
  ): string =>
    `<w:style w:type="character" w:customStyle="1" w:styleId="${id}"><w:name w:val="${id}"/>`
    + '<w:uiPriority w:val="1"/><w:qFormat/><w:rPr>'
    + (also === undefined ? '' : `<w:i/><w:color w:val="${wordHex(also)}"/>`)
    + `<w:bdr w:val="single" w:sz="${holdStroke(verse.size, which)}" w:space="0"`
    + ` w:color="${wordHex(color)}"/></w:rPr></w:style>`;
  /*
   * A MARK'S OWN FACE AND WEIGHT, which this used to have no way of writing.
   *
   * It emitted a colour and a size and no `<w:rFonts>` at all, so `Svara`
   * inherited Arial from the `Translit` paragraph it sits in — while his is
   * URW Palladio ITU and bold. Same colour, same size, different font, in
   * every document this program has ever exported. `WORD_MARKS` now carries
   * both, measured off his template.
   *
   * ORDER IS THE SCHEMA'S, not ours: `CT_RPr` is a SEQUENCE — `rFonts`, `b`,
   * `i`, `color`, `sz` — and Word reports a violation of it only as "the file
   * appears to be corrupted".
   */
  const ink = (
    id: string,
    color: string,
    opts: { sz?: number; italic?: boolean; face?: string; bold?: boolean } = {},
  ): string =>
    `<w:style w:type="character" w:customStyle="1" w:styleId="${id}"><w:name w:val="${id}"/>`
    + '<w:uiPriority w:val="1"/><w:qFormat/><w:rPr>'
    + (opts.face === undefined
      ? ''
      : `<w:rFonts w:ascii="${xmlEscape(opts.face)}" w:hAnsi="${xmlEscape(opts.face)}"/>`)
    + `${opts.bold === true ? '<w:b/>' : ''}${opts.italic === true ? '<w:i/>' : ''}`
    + `<w:color w:val="${wordHex(color)}"/>`
    + (opts.sz === undefined ? '' : `<w:sz w:val="${opts.sz}"/><w:szCs w:val="${opts.sz}"/>`)
    + '</w:rPr></w:style>';

  const comment = scale.comment;
  const family = xmlEscape(families[comment.face]);
  /*
   * A STYLE HIS VOCABULARY DOES NOT HAVE IS ONLY WRITTEN WHEN IT IS USED.
   *
   * `HoldingChange` and `2HoldingChange` are OURS. They exist for a real
   * problem — a Word run carries ONE character style, so a letter that is both
   * boxed and substituted cannot have a border style and a colour style at
   * once — but his documents contain no such letter, and neither did any
   * document we have ever exported: measured, zero runs.
   *
   * So they appeared in the Styles pane of every file, named after nothing on
   * the page. The owner's report: "there are hallucinated styles, namely
   * '2holdingchange' and so on." Now the body is written first and asked which
   * styles it actually references, and a document that has the paired case
   * still gets them.
   */
  const paired = [
    ...(used.has('HoldingChange') ? [box('HoldingChange', 'short', mode.hold, mode.change)] : []),
    ...(used.has('2HoldingChange')
      ? [box('2HoldingChange', 'long', mode.holdLong, mode.change)] : []),
  ];

  return [
    box('Holding', 'short', mode.hold),
    box('2Holding', 'long', mode.holdLong),
    ...paired,
    ink('Svara', mode.svara, {
      sz: svaraSz, face: WORD_MARKS.svara.face, bold: WORD_MARKS.svara.bold,
    }),
    ink('Virama', mode.svara, { sz: svaraSz, face: WORD_MARKS.virama.face }),
    ink('Anusvara', mode.change, { italic: true }),
    ink('VedicAnusvara', mode.change, { italic: true, face: WORD_MARKS.vedicChange.face }),
    ink('Pause', mode.pauseShort, { italic: true }),
    /* His `Comment` is a character style with a face of its own — the source
       line under a heading is set in it, inside an ordinary paragraph. */
    `<w:style w:type="character" w:customStyle="1" w:styleId="Comment">`
    + '<w:name w:val="Comment"/><w:uiPriority w:val="1"/><w:qFormat/><w:rPr>'
    + `<w:rFonts w:ascii="${family}" w:hAnsi="${family}" w:cs="${family}"/>`
    + `${comment.italic ? '<w:i/>' : ''}`
    + `<w:color w:val="${roleColor(comment.color, mode)}"/>`
    + `<w:sz w:val="${halfPoints(comment.size)}"/>`
    + `<w:szCs w:val="${halfPoints(comment.size)}"/></w:rPr></w:style>`,
  ].join('');
}

