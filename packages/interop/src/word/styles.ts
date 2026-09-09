/**
 * `word/styles.xml` — the export style, written in Word's own units.
 *
 * ONE STYLESHEET GENERATOR, ONE TYPE SCALE. Every number here comes out of
 * `typeScaleOf(theme)` — the same call the CSS token generator makes — so a
 * `.docx` and the page it was exported beside cannot disagree about a size, a
 * leading or an indent. The `veda-union` style resolves to `wordScale()`, which
 * is `WORD_PARAGRAPHS`, which was read out of the owner's own file; that chain
 * is what makes "identical to his document" a measurement rather than a claim,
 * and `tools/export/gate-word.mjs` walks it back the other way.
 *
 * IT REPLACED A TEMPLATE. The old exporter copied `styles.xml` out of a
 * stripped copy of his file. That gave exactly one style — his — and the copy
 * was a broken package: its `[Content_Types].xml` still declared eleven parts
 * the stripping had removed, so Word offered to repair every file we wrote.
 * Generating the part means eight styles instead of one and a package that
 * opens.
 *
 * WORD'S UNITS, converted once, here:
 *   `w:sz`      HALF-points        16 pt → 32
 *   `w:line`    TWENTIETHS of a pt 24 pt → 480
 *   `w:ind`     TWIPS              14.2 pt → 284
 *   `w:bdr sz`  EIGHTHS of a pt    0.75 pt → 6
 * The type scale is in rem at 1 rem = 12 pt, so every conversion below is that
 * identity times one of these four factors.
 */
import type { DocumentMode, DocumentTheme } from '@siksamitra/tokens/document-themes';
import { typeScaleOf } from '@siksamitra/tokens/document-themes';
import type { DocRole, DocTypeScale, RoleMetric } from '@siksamitra/tokens/document-type';
import { WORD_SUBSTITUTES } from '@siksamitra/tokens/word';
import type { PageGeometry } from '@siksamitra/layout';
import { xmlEscape } from '../xml.js';
import { charStyles } from './char-styles.js';
import {
  PT_PER_REM, channels, halfPoints, twips, wordHex, type Families,
} from './units.js';


/**
 * Which of his paragraph styles each of our roles is written as.
 *
 * His ids, not new ones, because `documentXml` writes his ids into the body and
 * `word-styles.ts` reads them back — one vocabulary for the importer, the
 * exporter and the file the owner already has. `comment` is missing on purpose:
 * in his file it is a CHARACTER style, applied to a run inside an ordinary
 * paragraph, and it is emitted with the other character styles below.
 */
export const PARA_STYLE_OF: Readonly<Partial<Record<DocRole, string>>> = {
  title: 'Heading1',
  part: 'Heading2',
  section: 'Heading3',
  step: 'Heading4',
  verse: 'Translit',
  translation: 'Prijevod',
  body: 'Normal',
  head: 'Header',
  /*
   * A PICTURE'S CAPTION IS WORD'S OWN `Caption`, set from the `comment` role —
   * the same 11 pt italic grey the page draws it in, because a caption is
   * apparatus exactly as a source note is.
   *
   * His file has no Caption style, and it has no pictures either; this is not
   * a departure from his page but a place his page never went. A PARAGRAPH
   * style rather than the `Comment` character style a source line takes,
   * because a caption has to be findable coming back — one that merely looked
   * like a caption was read as a direction — and because a Word user gets a
   * real Caption, which is what "Insert Table of Figures" collects.
   */
  comment: 'Caption',
};


/**
 * A role's colour, resolved against the mode it will be printed in.
 *
 * The type scale states a colour either as a measured hex — his greys — or as a
 * reference into the theme's own palette, which is how a screen theme's roles
 * follow their mode. Word has no indirection, so the reference is resolved
 * here, by the same table `emit.mjs` writes into CSS. An unknown `var()` throws
 * rather than defaulting to black: a translation silently printed in the ink
 * colour is the kind of wrong that looks right.
 */
export function roleColor(color: string, mode: DocumentMode): string {
  if (!color.startsWith('var(')) return wordHex(color);
  const name = /var\(--doc-([a-z]+)\)/.exec(color)?.[1];
  if (name === 'ink') return wordHex(mode.ink);
  if (name === 'heading') return wordHex(mode.heading);
  if (name === 'quiet') return wordHex(mode.quiet);
  if (name === 'fill') return wordHex(mode.fill);
  if (name === 'soft') {
    if (mode.soft !== undefined) return wordHex(mode.soft);
    /* `color-mix(in srgb, ink 74%, bg)` — the fallback `emit.mjs` writes when a
       theme names no translation register. sRGB, so it is a plain mix. */
    const ink = channels(mode.ink);
    const bg = channels(mode.bg);
    return ink
      .map((v, i) => Math.round(v * 0.74 + bg[i]! * 0.26).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  throw new Error(`the type scale asks for "${color}", which has no Word equivalent`);
}

/**
 * The family Word is asked for, given the family the page is set in.
 *
 * The ORIGINAL where one exists. Arimo, Tinos and Carlito are metric-compatible
 * stand-ins for Arial, Times New Roman and Calibri — same advance widths at the
 * same size — carried in the installer because the originals are not
 * redistributable. A machine running Word has the originals, so asking for
 * Arial gives literally his page; asking for Arimo would give a substitution
 * chosen by Word, and a substituted face breaks the line somewhere else.
 */
export function wordFamily(stack: string): string {
  const first = /'([^']+)'/.exec(stack)?.[1] ?? stack.split(',')[0]!.trim();
  const original = Object.values(WORD_SUBSTITUTES).find((s) => s.use === first);
  return original?.of ?? first;
}

/** The four face slots a theme resolves, as Word family names. */
export function familiesOf(
  theme: DocumentTheme, textStack: string, uiStack: string,
): Families {
  return {
    text: wordFamily(textStack),
    display: wordFamily(theme.faces?.display ?? textStack),
    serif: wordFamily(theme.faces?.serif ?? textStack),
    ui: wordFamily(theme.faces?.ui ?? uiStack),
  };
}


function rPr(
  m: RoleMetric,
  mode: DocumentMode,
  families: Families,
  /**
   * The colour this style would INHERIT — `docDefaults`', which every style
   * without a `w:color` of its own gets.
   *
   * Restating it changes nothing on the page and does not match his file: his
   * `Translit` carries no `w:color` at all, ours wrote `#000000`. A style that
   * genuinely differs — a grey heading, a grey translation — still writes one.
   * Omitted for `docDefaults` itself, which is where the value comes from.
   */
  inherited?: string,
): string {
  const family = xmlEscape(families[m.face]);
  const sz = halfPoints(m.size);
  const color = roleColor(m.color, mode);
  return `<w:rPr><w:rFonts w:ascii="${family}" w:hAnsi="${family}" w:cs="${family}"/>`
    + `${m.bold ? '<w:b/>' : ''}${m.italic ? '<w:i/>' : ''}`
    + (color === inherited ? '' : `<w:color w:val="${color}"/>`)
    + `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
}

function pPr(m: RoleMetric, keep = false): string {
  /*
   * `lineRule="exact"` for a stated leading and `"auto"` for `'normal'`. The
   * distinction is his: `Translit` is `w:line="480" w:lineRule="exact"`, an
   * unconditional 24 pt that reserves room for the marks drawn outside the line
   * box, while `Prijevod` is `w:line="240" w:lineRule="auto"` — single spacing,
   * which is the FONT's own line height and only the font knows the number.
   */
  const line = m.leading === 'normal'
    ? 'w:line="240" w:lineRule="auto"'
    : `w:line="${Math.round(m.size * m.leading * PT_PER_REM * 20)}" w:lineRule="exact"`;
  const ind = m.indent === 0 && m.hanging === 0 && m.right === 0
    ? ''
    : `<w:ind w:left="${twips(m.indent)}" w:right="${twips(m.right)}"`
      + ` w:hanging="${twips(m.hanging)}"/>`;
  /* `keepNext` and `keepLines` come FIRST: `CT_PPrBase` is a sequence, and a
     `w:keepNext` written after `w:spacing` is a schema violation Word reports
     only as "the file appears to be corrupted". */
  return `<w:pPr>${keep ? '<w:keepNext/><w:keepLines/>' : ''}`
    + `<w:spacing w:after="${twips(m.after)}" ${line}/>${ind}</w:pPr>`;
}

/**
 * A style's NAME, which is not always its id.
 *
 * Word identifies its built-in styles by name, and the name of `Heading3` is
 * `heading 3` — lower case, with a space. A file that gives a built-in id a
 * name Word does not know is a file Word offers to repair, which is exactly
 * what it did to the first `.docx` this generator wrote. The two custom styles
 * are the owner's own and carry `w:customStyle="1"`, where the name is free.
 */
function styleName(id: string): string {
  const heading = /^Heading(\d)$/.exec(id);
  if (heading !== null) return `heading ${heading[1]!}`;
  if (id === 'Header') return 'header';
  return id;
}

/**
 * A VERSE AND ITS TRANSLATION ARE ONE BLOCK, in both media.
 *
 * Measured against a real Word: with nothing said, Word's widow control moved a
 * four-line verse whole to the next page while Chrome split it two and two, so
 * the `.docx` broke after verse 5 and the PDF after verse 6 — the two files
 * disagreed about what is on page one. `keepLines` stops Word splitting a verse
 * and `keepNext` keeps it with the translation that follows, which is what his
 * own `Translit` style already does; the print block in `export.css` says the
 * same thing to the browser as `break-inside: avoid` on `.verse`.
 *
 * Headings keep with what they introduce, for the ordinary reason.
 */
const KEEP_WITH_NEXT: readonly DocRole[] = ['verse', 'title', 'part', 'section', 'step'];

/** One `<w:style>` for a paragraph role. */
function paraStyle(
  id: string,
  role: DocRole,
  scale: DocTypeScale,
  mode: DocumentMode,
  families: Families,
  inherited: string,
): string {
  const m = scale[role];
  const isNormal = id === 'Normal';
  const custom = id === 'Translit' || id === 'Prijevod';
  const outline = /^Heading(\d)$/.exec(id);
  return `<w:style w:type="paragraph"${custom ? ' w:customStyle="1"' : ''}`
    + `${isNormal ? ' w:default="1"' : ''} w:styleId="${id}">`
    + `<w:name w:val="${styleName(id)}"/>`
    + (isNormal ? '' : '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>')
    + '<w:qFormat/>'
    + pPr(m, KEEP_WITH_NEXT.includes(role))
      .replace('</w:pPr>', `${outline === null ? '' : `<w:outlineLvl w:val="${Number(outline[1]) - 1}"/>`}</w:pPr>`)
    + rPr(m, mode, families, inherited)
    + '</w:style>';
}

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

export interface StyleSheetInput {
  theme: DocumentTheme;
  mode: 'light' | 'dark';
  /** The theme's reading stack, and the chrome's interface stack — resolved by
   *  the caller, exactly as `buildExportPage` resolves them for the page. */
  textStack: string;
  uiStack: string;
  /**
   * The `w:rStyle` ids the BODY actually references.
   *
   * A stylesheet that lists a style nothing uses is a Styles pane full of
   * names for things that are not on the page — the owner's "hallucinated
   * styles". Only the two paired hold-and-change styles are gated on it,
   * because only they are ours rather than his; the rest of the vocabulary is
   * written whether or not this document happens to need it, which is what
   * makes our files and his interchangeable.
   */
  usedStyles?: ReadonlySet<string>;
}

/** The whole of `word/styles.xml`. */
export function stylesXml(input: StyleSheetInput): string {
  const scale = typeScaleOf(input.theme);
  const mode = input.theme[input.mode];
  const families = familiesOf(input.theme, input.textStack, input.uiStack);
  const body = scale.body;
  /* `docDefaults` is what a paragraph with no style gets. Set to the body role
     so an unstyled paragraph is not Word's own 11 pt Calibri. */
  const defaults = '<w:docDefaults><w:rPrDefault>'
    + rPr(body, mode, families)
    + '</w:rPrDefault><w:pPrDefault>'
    + pPr(body)
    + '</w:pPrDefault></w:docDefaults>';
  /* What `docDefaults` sets, and therefore what every style inherits. */
  const inherited = roleColor(body.color, mode);
  const paras = Object.entries(PARA_STYLE_OF)
    .map(([role, id]) => paraStyle(id, role as DocRole, scale, mode, families, inherited))
    .join('');
  const used = input.usedStyles ?? new Set<string>();
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<w:styles ${W_NS}>${defaults}${paras}`
    + `${charStyles(scale, mode, families, used)}</w:styles>`;
}

/**
 * The section properties: the sheet the document is printed on.
 *
 * From `pageGeometry`, which is in points and is the same object `FlowView`
 * pads the exported page's column with — so the `.docx`'s margins and the
 * PDF's are one number, not two.
 */
export function sectPr(page: PageGeometry): string {
  const tw = (pt: number): number => Math.round(pt * 20);
  return `<w:sectPr><w:pgSz w:w="${tw(page.width)}" w:h="${tw(page.height)}"/>`
    + `<w:pgMar w:top="${tw(page.margins.top)}" w:right="${tw(page.margins.right)}"`
    + ` w:bottom="${tw(page.margins.bottom)}" w:left="${tw(page.margins.left)}"`
    + ' w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="708"/></w:sectPr>';
}
