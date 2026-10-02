/**
 * HIS PAGE FURNITURE, FOR THE PRINTED PAGE — the running head over every page
 * and the footer under it, as the browser's own header and footer templates.
 *
 * Every value is his, measured on his PDFs (bhū sūktam, sūryopaniṣat, the
 * sādhanā) and Word's own arithmetic agreeing with them to a tenth of a point:
 *
 *   - the head is his `Header` style, Arial 12 pt, its paragraph his
 *     `w:header` from the top of the sheet, its baseline Word's line gap and
 *     ascent below that — 31.1 pt; the chant and its step centred on his centre
 *     tab, three spaces between them (his two `STYLEREF` fields), the page
 *     number right-aligned on his right tab;
 *   - under it his rule: Word's flat diamond, 430.5 pt by 3.55 pt, centred on
 *     the sheet, hatched — which prints as a hairline thickest in the middle
 *     and tapering to both ends, and is drawn here as exactly that;
 *   - the footer is the export style's own line, his `Footer` in Arial 11 pt,
 *     his `w:footer` from the foot of the sheet, links in his `Hyperlink` blue.
 *
 * A BOOK's head names the chant and the step a page is IN, which needs the
 * page map; until the PDF is printed from it (`openspec/changes/his-page`,
 * F13) a book's head names its first.
 */
import type { ChantDoc } from '@siksamitra/format';
import type { FooterPiece } from '@siksamitra/tokens/export-styles';
import {
  WORD_FACE_METRICS, WORD_FURNITURE_INK, WORD_HEADER_RULE, WORD_HEADER_SHAPE, WORD_HEADER_TABS, WORD_FOOTER, WORD_HYPERLINK,
  WORD_DANDA_FACE, fromTwips,
} from '@siksamitra/tokens/word';
import { WORD_FACES } from '@siksamitra/tokens/fonts';

/** The sheet, in points: its size and the margins the templates sit in. */
export interface FurnitureSheet {
  readonly width: number;
  readonly height: number;
  readonly margins: { readonly top: number; readonly bottom: number; readonly left: number };
}

/** What his two `STYLEREF` fields show: the chant (`Heading 2`) and its step (`Heading 3`). */
export function runningHeadOf(doc: ChantDoc): readonly [string, string] {
  if (doc.book === true) {
    const first = doc.sections.find((s) => s.part !== undefined);
    return [first?.part ?? doc.title, first?.title ?? ''];
  }
  return [doc.title, doc.sections.find((s) => s.part !== undefined)?.part ?? ''];
}

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The head's daṇḍas in his daṇḍa's shape, as the page's are (`WORD_DANDA_FACE`). */
const withDandas = (html: string): string => html.replace(/[।॥]/g, (d) =>
  `<span style="font-family:'${WORD_DANDA_FACE}',${WORD_FACES.sans};line-height:0">${d}</span>`); // token-exempt: a template is a document of its own, with no custom properties; this is the token itself

/**
 * Where a line set with `line-height: 0` puts its baseline, below its box's top:
 * half the difference of the face's ascent and descent.
 */
const baselineInZeroLine = (size: number): number =>
  ((WORD_FACE_METRICS.sans.ascent - WORD_FACE_METRICS.sans.descent) / 2) * size;

/** His rule: the diamond Word prints as a tapering hairline. */
function ruleSvg(sheet: FurnitureSheet): string {
  const w = WORD_HEADER_SHAPE.width;
  const h = WORD_HEADER_SHAPE.ink;
  const left = (sheet.width - w) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:${left}pt;top:${WORD_HEADER_SHAPE.inkTop - h / 2}pt"`
    + ` width="${w}pt" height="${h}pt" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`
    + `<polygon points="0,${h / 2} ${w / 2},0 ${w},${h / 2} ${w / 2},${h}" fill="#${WORD_HEADER_SHAPE.color}" fill-opacity="${WORD_HEADER_SHAPE.opacity}"/></svg>`;
}

export interface Templates { readonly header: string; readonly footer: string }

/**
 * The two templates. `faces` are the `@font-face` rules the page itself
 * embeds — a template is drawn in a document of its own, which has no fonts
 * but those it is given — and only the head's and footer's faces are needed.
 */
export function pageTemplates(
  doc: ChantDoc, sheet: FurnitureSheet, footer: readonly FooterPiece[] | undefined, faces: string,
): Templates {
  const [chant, step] = runningHeadOf(doc);
  const size = WORD_HEADER_RULE.size;
  const headTop = fromTwips(WORD_HEADER_RULE.distance);
  /* A daṇḍa in the head is set in his Mangal, which is taller than Arial: the
     line, and its baseline, come down by the difference (measured: 33.84 pt
     where a head with none sits at 31.08). */
  const danda = /[।॥]/.test(`${chant}${step}`);
  const above = danda ? WORD_FACE_METRICS.mangal.ascent : WORD_FACE_METRICS.sans.gap + WORD_FACE_METRICS.sans.ascent;
  const baseline = headTop + above * size;
  const top = baseline - baselineInZeroLine(size);
  const centre = fromTwips(WORD_HEADER_TABS.center);
  const right = fromTwips(WORD_HEADER_TABS.right);
  const box = `position:absolute;left:0;top:0;width:${sheet.width}pt;font-family:${WORD_FACES.sans};color:#${WORD_FURNITURE_INK};` // token-exempt: a template is a document of its own, with no custom properties; this is the token itself
    + '-webkit-print-color-adjust:exact;print-color-adjust:exact;';
  const header = `<style>${faces}</style><div style="${box}height:${sheet.margins.top}pt;font-size:${size}pt;">`
    + `<div style="position:absolute;left:${sheet.margins.left}pt;width:${2 * centre}pt;top:${top}pt;line-height:0;text-align:center;white-space:pre;">`
    + `${withDandas(escape(chant))}${step === '' ? '' : `   ${withDandas(escape(step))}`}</div>`
    + `<div style="position:absolute;left:${sheet.margins.left}pt;width:${right}pt;top:${top}pt;line-height:0;text-align:right;">`
    + '<span class="pageNumber"></span></div>'
    + `${ruleSvg(sheet)}</div>`;

  const fsize = WORD_FOOTER.size;
  /* The footer's paragraph ends his `w:footer` above the foot of the sheet; its
     baseline is the face's descent above that. A template places an absolute
     box against the SHEET, not against its margin — measured: a footer placed
     against the margin printed 12 pt from the top of the page. */
  const footBaseline = sheet.height - fromTwips(WORD_FOOTER.distance) - WORD_FACE_METRICS.sans.descent * fsize;
  const footTop = footBaseline - baselineInZeroLine(fsize);
  const link = `color:#${WORD_HYPERLINK.color};text-decoration:underline;`;
  const pieces = (footer ?? []).map((p) => ('link' in p
    ? `<a href="${escape(p.link)}" style="${link}">${escape(p.link)}</a>`
    : escape(p.text))).join('');
  const footerHtml = `<style>${faces}</style><div style="${box}height:${sheet.margins.bottom}pt;font-size:${fsize}pt;">`
    + `<div style="position:absolute;left:${sheet.margins.left}pt;top:${footTop}pt;line-height:0;white-space:pre;">${pieces}</div></div>`;
  return { header, footer: footerHtml };
}
