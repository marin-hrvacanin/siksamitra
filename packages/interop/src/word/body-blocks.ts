/**
 * THE PARAGRAPHS OF A SECTION, AS HIS FILES HAVE THEM — what `documentXml`
 * writes for each thing a document holds, in his styles and shapes, so that
 * reading the file back (`build-document.ts`) gives the same document:
 *
 *   - a verse is his `Translit` paragraphs: one per paragraph it records
 *     (`ChantVerse.paragraphs`), its lines inside one joined by soft breaks;
 *   - a translation is his `Prijevod` paragraphs, the same way;
 *   - a source, a metre, a comment on a mantra line is a `Translit` paragraph
 *     holding only a `Comment` run, a line each, ABOVE what it heads; a
 *     comment in the prose register is a `Normal` paragraph holding one;
 *   - an empty line is an empty paragraph of the style it is as tall as, and
 *     a page break is his: a `Normal` paragraph holding only the break;
 *   - a book opens with its title page and contents, and its headings are a
 *     level up: a part `Heading 2`, a chant `Heading 3`, a step `Heading 4`.
 *
 * Out of `body.ts` when that file reached the 400-line limit; the letters of
 * a line are still written there (`verseRuns`).
 */
import type {
  ChantDoc, ChantFigure, ChantGapKind, ChantInstruction, ChantSection, ChantToken, ChantVerse,
} from '@siksamitra/format';
import { WORD_COVER } from '@siksamitra/tokens/word';
import { styleOf } from './body-parts.js';
import { SOURCE_STYLE } from './styles.js';
import { xmlEscape } from '../xml.js';

/** What the section writer is given by `documentXml`. */
export interface BlockTools {
  /** `loose`: a page may break after it, whatever its style keeps. */
  readonly p: (style: string | null, runs: string, loose?: boolean) => string;
  readonly run: (text: string, rStyle: string | null) => string;
  readonly verseRuns: (tokens: readonly ChantToken[]) => string;
  /** A picture's paragraphs: its drawing and its caption. */
  readonly picture: (fig: ChantFigure) => string[];
  /** Tag the verses (`_smv`/`_smp`): a whole document, yes; a line the add-in
   *  writes into HIS file, no — his file is not ours because one line was. */
  readonly tags?: boolean;
}

/** The style an empty line of each height is written in. */
const GAP_STYLE: Readonly<Record<ChantGapKind, string | null>> = {
  verse: styleOf('pada'),
  body: null,
  translation: styleOf('doc__translation'),
  small: 'Insert',
};

/** Lines grouped into his paragraphs: `counts` from the document, or one. */
function grouped<T>(lines: readonly T[], counts: readonly number[] | undefined): T[][] {
  if (counts === undefined || counts.reduce((a, b) => a + b, 0) !== lines.length) return [[...lines]];
  const out: T[][] = [];
  let at = 0;
  for (const n of counts) { out.push(lines.slice(at, at + n)); at += n; }
  return out;
}

/** A verse's tokens, line by line. */
function linesOfTokens(tokens: readonly ChantToken[]): ChantToken[][] {
  const lines: ChantToken[][] = [[]];
  for (const t of tokens) {
    if (t.t === 'br') lines.push([]);
    else lines[lines.length - 1]!.push(t);
  }
  return lines;
}

export function blockWriter(tools: BlockTools) {
  const { p, run, verseRuns, picture } = tools;
  const br = '<w:r><w:br/></w:r>';
  /* EVERY MANTRA PARAGRAPH WE WRITE IS TAGGED, with a hidden bookmark Word
     keeps and does not show: `_smv…` where a verse begins, `_smp…` on each
     further paragraph of it. So a verse of several paragraphs with no number
     of its own reads back as one verse, and a paragraph with no tag at all in
     a file of ours is one somebody typed in Word — a verse of its own. */
  let mark = 0;
  const tag = (kind: 'v' | 'p'): string => {
    if (tools.tags === false) return '';
    mark += 1;
    return `<w:bookmarkStart w:id="${mark}" w:name="_sm${kind}${mark}"/><w:bookmarkEnd w:id="${mark}"/>`;
  };

  /** Comment lines on mantra lines: a `Translit` paragraph each. */
  const onMantraLines = (text: string): string[] =>
    text.split('\n').filter((l) => l.trim() !== '').map((l) => p(styleOf('pada'), run(l, 'Comment')));

  /** A direction, a note, or a comment, where it stands. */
  const instruction = (ins: ChantInstruction): string[] => {
    const text = ins.text.en ?? '';
    if (text === '') return [];
    if (ins.comment === 'verse') return onMantraLines(text);
    if (ins.comment === 'body') return [p(null, text.split('\n').map((l) => run(l, 'Comment')).join(br))];
    return [p(styleOf('doc__instruction'), run(text, null))];
  };

  const verse = (v: ChantVerse): string[] => {
    const out: string[] = [];
    /* The bookmark goes on the verse's FIRST paragraph, its own source line
       when it has one: a source line right under a heading is otherwise the
       section's, and the verse came back without it. */
    let first = true;
    const next = (): string => { const t = tag(first ? 'v' : 'p'); first = false; return t; };
    if (v.source !== undefined) {
      out.push(...v.source.split('\n').filter((l) => l.trim() !== '')
        .map((l) => p(styleOf('pada'), `${next()}${run(l, 'Comment')}`)));
    }
    /* A page may break between a verse's half-verses, and not after its
       last: `Translit` keeps with the next paragraph, and his bhū sūktam
       breaks verse 8 between its halves — which Word, measured, does only
       for a paragraph that does not keep. The print sheet says the same. */
    const groups = grouped(linesOfTokens(v.tokens), v.paragraphs);
    groups.forEach((group, gi) => {
      const tokens = group.flatMap((line, i) => (i === 0 ? line : [{ t: 'br' } as ChantToken, ...line]));
      const runs = verseRuns(tokens);
      if (runs !== '') out.push(p(styleOf('pada'), `${next()}${runs}`, gi < groups.length - 1));
    });
    if (v.translation?.en !== undefined) {
      for (const group of grouped(v.translation.en.split('\n'), v.translation.paragraphs)) {
        out.push(p(styleOf('doc__translation'), group.map((l) => (l === '' ? '' : run(l, null))).join(br)));
      }
    }
    for (const ins of v.instructions ?? []) out.push(...instruction(ins));
    /* A verse's own pictures, which are inside it and move with it. */
    for (const f of v.figures ?? []) out.push(...picture(f));
    return out;
  };

  const gap = (of: ChantGapKind): string => p(GAP_STYLE[of], '');
  const pageBreak = (): string => p(null, '<w:r><w:br w:type="page"/></w:r>');

  /** What heads the document: a single text's name, or a book's two pages. */
  const front = (doc: ChantDoc): string[] => {
    if (doc.book !== true) return doc.title.trim() === '' ? [] : [p(styleOf('doc__name'), run(doc.title, null))];
    const out: string[] = [];
    if (doc.cover !== undefined) {
      const lines = doc.cover.lines.map((l) => `<w:t xml:space="preserve">${xmlEscape(l)}</w:t>`).join('<w:br/>');
      out.push(`<w:p><w:pPr><w:spacing w:before="${WORD_COVER.before}"/><w:jc w:val="center"/></w:pPr>`
        + `<w:r><w:rPr><w:sz w:val="${WORD_COVER.size * 2}"/><w:szCs w:val="${WORD_COVER.size * 2}"/></w:rPr>${lines}</w:r></w:p>`);
      out.push(pageBreak());
    }
    if (doc.contents !== undefined) {
      /* Word's own contents, as his is: its heading, and the field Word fills
         from the headings — two levels, his `TOC \o "2-3"`. */
      out.push('<w:sdt><w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/><w:docPartUnique/></w:docPartObj></w:sdtPr><w:sdtContent>'
        + p('TOCHeading', run(doc.contents.title, null))
        + '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "2-3" \\h \\z \\u </w:instrText></w:r>'
        + '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'
        + '</w:sdtContent></w:sdt>');
      out.push(pageBreak());
    }
    return out;
  };

  /** A section: its part where the part changes, its heading, its source, its items. */
  const section = (doc: ChantDoc, s: ChantSection, partBefore: string | undefined,
    item: (it: NonNullable<ChantSection['items']>[number]) => string[] | null): string[] => {
    const out: string[] = [];
    const book = doc.book === true;
    if (s.part !== undefined && s.part !== partBefore) out.push(p(book ? 'Heading2' : styleOf('doc__part'), run(s.part, null)));
    const title = s.title ?? s.label;
    /* `${n}. ${title}` — the page's `headingOf`, not a middle dot. */
    const head = title === undefined || title === '' ? '' : s.n === undefined ? title : `${s.n}. ${title}`;
    if (head !== '') out.push(p(book ? (s.sub === true ? 'Heading4' : 'Heading3') : styleOf('section__title'), run(head, null)));
    /* A SOURCE LINE GOES ABOVE WHAT IT NAMES, as in his files — the section's
       under its heading, a verse's over the verse — on a mantra line. */
    if (s.source != null && s.source !== '') {
      out.push(...s.source.split('\n').filter((l) => l.trim() !== '').map((l) => p(SOURCE_STYLE, run(l, 'Comment'))));
    }
    const items = s.items !== undefined && s.items.length > 0 ? s.items : s.verses.map((v) => ({ t: 'verse' as const, ...v }));
    for (const it of items) {
      if (it.t === 'instruction') out.push(...instruction(it.instruction));
      else if (it.t === 'gap') out.push(gap(it.of));
      else if (it.t === 'break') out.push(pageBreak());
      else if (it.t === 'verse') out.push(...verse(it));
      else out.push(...(item(it) ?? []));
    }
    return out;
  };

  return { front, section, verse };
}
