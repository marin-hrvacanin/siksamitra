/**
 * `word/document.xml` — the document, as Word paragraphs and runs.
 *
 * THE STRUCTURE IS `DocumentBlocks`'s, element for element and in its order.
 * That component is the one renderer of a chant, the PDF is a print of what it
 * drew, and a Word file that ordered the same content differently would make
 * "the Word document and the PDF are identical" false in a way no style sheet
 * could fix. Four differences were found by putting the two side by side and
 * are closed here:
 *
 *   - a section's SOURCE line is drawn UNDER its verses, not under its heading;
 *   - a part heading is drawn where the part CHANGES, not above every section;
 *   - the levels are Heading3 for a part and Heading4 for a step — see
 *     `styleOf`, which reads them off the page's own role table;
 *   - a verse's instructions and its own source line are drawn, and were not.
 *
 * ONE PARAGRAPH PER VERSE, not per line. `Translit` is
 * `w:ind w:left="284" w:hanging="284"`: the first LINE of a paragraph comes out
 * to the margin and every later line sits in. With a paragraph per pāda every
 * pāda was a first line, so the whole verse printed flush and the hanging
 * indent — the most visible thing about the shape of his page — never appeared.
 * A `<w:br/>` starts a line without starting a paragraph, which is exactly the
 * distinction the page makes between a `.verse` and a `.pada` inside it.
 *
 * NOTHING HERE KNOWS A COLOUR OR A SIZE. A run names a character style and
 * `styles.ts` decides what that style looks like, which is what lets one body
 * be written in eight export styles.
 */
import type { ChantDoc, ChantFigure, ChantToken, ChantUnit } from '@siksamitra/format';
import { FIGURE_DEFAULTS, figureItem } from '@siksamitra/format';
import { CANDRA, VIRAMA_TICK } from '@siksamitra/engine';
import { ROLE_OF_ELEMENT } from '@siksamitra/tokens/document-type';
import { xmlEscape } from '../xml.js';
import { BAR_GLYPH, SVARA_CHAR, holdingStyle } from '../word-styles.js';
import { PARA_STYLE_OF } from './styles.js';
import {
  figureDrawing, figurePlaceholderText, missingFigureText, type WordMedia,
} from './drawing.js';

/**
 * Which Word style each of the page's elements is written in.
 *
 * READ OFF THE PAGE, through the two tables that already exist:
 * `ROLE_OF_ELEMENT` says which type role a class name takes and
 * `PARA_STYLE_OF` says which of his paragraph styles that role is. So the
 * `.docx` cannot put a section heading at a different level from the one the
 * page draws it at — which it did, until this was measured: `doc__part` came
 * out as Heading2 where the page sets it as Heading3, two points larger and at
 * the wrong indent.
 */
const styleOf = (element: keyof typeof ROLE_OF_ELEMENT): string => {
  const found = PARA_STYLE_OF[ROLE_OF_ELEMENT[element]];
  if (found === undefined) throw new Error(`no Word paragraph style for ${element}`);
  return found;
};

/** A unit's character-style signature, so a run covers only letters that agree. */
const signature = (u: ChantUnit): string =>
  `${u.hold ?? '-'}/${u.hg ?? '-'}/${u.change === true ? 'c' : '-'}`;

/**
 * What a picture needs in order to be drawn: its bytes' place in the package,
 * and the column the five width steps are a fraction of.
 *
 * Optional as a whole, because two callers — the add-in's paragraph reader and
 * the determinism check — want the paragraphs and not the pictures. Without it
 * a figure writes its alternative text, which is what the page does for a
 * picture whose bytes are not there either.
 */
export interface WordPictures {
  /** Keyed by the picture's `src`, so one photograph is one part. */
  readonly media: ReadonlyMap<string, WordMedia>;
  /** The section's content width, in EMU. */
  readonly columnEmu: number;
}

/**
 * ONE RUN OF TEXT, in a character style.
 *
 * Module-level and exported, rather than a closure inside `documentXml`,
 * because the Word add-in needs it too: its style specimen has to write a run
 * in `VedicAnusvara`, which is a style this writer READS out of the owner's
 * file and never produces, so there is no marked text that would emit one. A
 * second helper over there would be a second answer to what a run is — and
 * `w:rPr`'s children are a schema SEQUENCE, so a second answer is a file Word
 * calls corrupted.
 */
export const styledRun = (text: string, rStyle: string | null, sup = false): string =>
  `<w:r>${rStyle === null && !sup ? '' : `<w:rPr>${rStyle === null ? '' : `<w:rStyle w:val="${rStyle}"/>`}${sup ? '<w:vertAlign w:val="superscript"/>' : ''}</w:rPr>`}`
  + `<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;

/** One paragraph, in a paragraph style. Exported for the same reason. */
export const styledParagraph = (style: string | null, runs: string): string =>
  `<w:p>${style === null ? '' : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`}${runs}</w:p>`;

/** Write the body. `tail` is appended inside `<w:body>` — see the return. */
export function documentXml(doc: ChantDoc, tail = '', pictures?: WordPictures): string {
  const paras: string[] = [];
  const p = styledParagraph;
  const run = styledRun;

  /* A part heading is drawn where the part CHANGES — it names a run of steps,
     not a step — and a section with no part ends the run. `DocumentBlocks`
     makes the same two decisions in the same order. */
  let part: string | undefined;
  const prose = (style: string | null, rStyle: string | null, text: string): void => {
    if (text !== '') paras.push(p(style, run(text, rStyle)));
  };

  /* The shared library, so a `ref` draws the picture it points at rather than
     nothing: the puja manual uses one anjali drawing at five steps. */
  const library = new Map((doc.figures ?? []).map((f) => [f.id, f]));
  /*
   * A drawing's `docPr` id must be unique in the whole document — Word treats
   * a repeated one as the same object in two places and the second loses its
   * alternative text. Counted here rather than derived from a position,
   * because the same figure may be drawn at five steps through `ref`.
   */
  let drawingId = 0;

  /**
   * One picture: the drawing, then its caption where the page puts it.
   *
   * A picture the document does not CARRY — the pūjā manual names 22 that live
   * on the platform — writes its alternative text instead. The page draws a
   * plate carrying the same words for the same reason: the alt text IS the
   * instruction, and a reader who cannot see the drawing still needs it.
   */
  const picture = (fig: ChantFigure | undefined): void => {
    if (fig === undefined) return;
    drawingId += 1;
    const at = fig.captionAt ?? FIGURE_DEFAULTS.captionAt;
    const caption = at === 'none' ? undefined : fig.caption?.en;
    /* Word's `Caption`, generated from the page's own `comment` role — see
       `PARA_STYLE_OF`. A paragraph style rather than the `Comment` character
       style a source line takes, because a caption has to be findable coming
       back: one that merely looked like a caption came back as a direction. */
    const cap = (): void => {
      if (caption !== undefined && caption !== '') paras.push(p(styleOf('fig__cap'), run(caption, null)));
    };
    if (at === 'above') cap();
    const drawing = pictures === undefined
      ? null
      : figureDrawing(fig, pictures.media.get(fig.src), drawingId, pictures.columnEmu);
    if (drawing === null) {
      paras.push(p(null, run(figurePlaceholderText(fig), 'Comment')));
    } else {
      /* Centred for an inline picture, which is what `margin-inline: auto`
         does on the page. A floated one is positioned by the anchor itself and
         its paragraph is only the thing it is anchored to. */
      const flow = fig.flow ?? FIGURE_DEFAULTS.flow;
      const centred = flow !== 'start' && flow !== 'end';
      paras.push(`<w:p>${centred ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ''}`
        + `<w:r>${drawing}</w:r></w:p>`);
    }
    if (at !== 'above') cap();
  };

  /**
   * The letters of one verse, as runs.
   *
   * A run covers a maximal group of units sharing a `signature` — the inverse
   * of the importer's merge, which is what makes a round trip stable.
   */
  const verseRuns = (tokens: readonly ChantToken[]): string => {
    let runs = '';
    /** The dot is written BEFORE its letter, in the `Svara` style. */
    const leading = (u: ChantUnit): string => (u.sbhakti === true ? run('·', 'Svara') : '');
    /*
     * A unit's TRAILING marks — its svara, its raised aid — are emitted in ONE
     * place, after whatever base run carried the letter. Emitting them per
     * branch is how they went missing: the holding branch dropped them and so
     * did the gum branch, which together lost 25 of his svaras.
     */
    const trailing = (u: ChantUnit): string => {
      let r = '';
      if (u.svara !== undefined) r += run(SVARA_CHAR.get(u.svara) ?? '', 'Svara');
      /*
       * `Reference`, AND IT USED TO BE `Anusvara`. A `sup` is "a superscript
       * after the range" — the little counting number the owner described as
       * "barely visible little info next to the word" — and it was written in
       * the style named after the SUBSTITUTION blue, with the superscript
       * bolted onto the run. So the Styles pane said `Anusvara` for something
       * that is not one, and a reader could not tell the two apart.
       *
       * `Reference` is one style of ours for one marking of the format's, and
       * it answers the owner's own question about his `Name` and `Nma`. The
       * superscript is IN the style now, not on the run.
       */
      if (u.sup !== undefined) r += run(u.sup, 'Reference');
      return r;
    };
    /**
     * The character a unit contributes: a gum anusvāra is `m` plus a candra.
     *
     * A CANDRABINDU IS A CHARACTER, not a style. His file has a `VedicAnusvara`
     * character style for it, in URW Palladio and in the substitution blue, and
     * writing every candra letter in it made the two exports disagree: the page
     * colours a letter by `is-change` and not by `u.candra`, so a gum letter
     * that is NOT a substitution is ink on the page and was blue in Word. It
     * also came back from a round trip carrying a substitution nobody wrote —
     * 3 letters in the Puruṣa Sūktam alone. The mark travels in the text and
     * the style is chosen by the letter's other marks, exactly as for any other
     * letter. The importer still reads his `VedicAnusvara`.
     */
    const glyph = (u: ChantUnit): string => (u.candra === true ? `m${CANDRA}` : u.c);

    /**
     * The hold group a space falls inside, if it falls inside one.
     *
     * A `sp` written unstyled inside a holding closes the box and opens a new
     * one, so a box spanning two words draws as two rectangles. The space takes
     * the group's own style when the letters on both sides of it are in the
     * same group — which is the only case where one rectangle is what was
     * meant.
     */
    const bridging = (at: number): ChantUnit | null => {
      let before: ChantUnit | null = null;
      for (let k = at - 1; k >= 0; k -= 1) {
        const t = tokens[k]!;
        if (t.t === 'syl') { before = t.units[t.units.length - 1] ?? null; break; }
        if (t.t !== 'sp') return null;
      }
      for (let k = at + 1; k < tokens.length; k += 1) {
        const t = tokens[k]!;
        if (t.t === 'syl') {
          const after = t.units[0];
          if (before === null || after === undefined) return null;
          /* BOTH must be in the SAME NUMBERED group. Comparing only `hold`
             matched two ADJACENT boxes with no group id at all — `undefined`
             equals `undefined` — and the styled space between them was then
             swallowed by the importer, turning `dadan naḥ` into `dadannaḥ`. */
          return before.hold !== undefined && before.hg !== undefined
            && before.hold === after.hold && before.hg === after.hg ? before : null;
        }
        if (t.t !== 'sp') return null;
      }
      return null;
    };

    tokens.forEach((t, at) => {
      if (t.t === 'br') { runs += '<w:r><w:br/></w:r>'; return; }
      if (t.t === 'sp') {
        const inside = bridging(at);
        runs += run(' ', inside === null ? null : holdingStyle(inside.hold!, inside.change === true));
        return;
      }
      if (t.t === 'pause') { runs += run(t.len === 'long' ? '||' : '|', 'Pause'); return; }
      /* A BAR IS NOT A PAUSE. Both were written as `|` in the `Pause` style, so
         all 59 bars in the corpus came back from a round trip as short pauses.
         `¦` is a different character in the same style: the same colour and
         weight on the page, and unambiguous to the reader. */
      if (t.t === 'bar') { runs += run(BAR_GLYPH, 'Pause'); return; }
      if (t.t === 'danda' || t.t === 'num' || t.t === 'text') { runs += run(t.s, null); return; }
      if (t.t !== 'syl') return;

      let i = 0;
      while (i < t.units.length) {
        const u = t.units[i]!;
        /*
         * ONLY A HOLDING GROUPS. A box has to be ONE run or Word draws two
         * rectangles, so held letters that agree are written together; nothing
         * else is. Grouping plain letters as well put a svarabhakti dot before
         * the wrong letter and a svara after the wrong one — `leading` and
         * `trailing` are emitted around a run, and a run of four letters has
         * only one place to put them. Caught by the add-in's own tests:
         * `-:agne Svara:̱` where `-:a Svara:̱ -:gne` was meant.
         */
        const sig = signature(u);
        const group: ChantUnit[] = [u];
        i += 1;
        if (u.hold !== undefined) {
          while (i < t.units.length && signature(t.units[i]!) === sig) {
            group.push(t.units[i]!);
            i += 1;
          }
        }
        for (const g of group) runs += leading(g);
        if (u.hold !== undefined) {
          /* A HELD LETTER CAN ALSO BE A SUBSTITUTION. A run carries one
             character style, so a boxed letter that is also recited as another
             printed black: `styles.ts` emits a combined style for the pairing
             rather than making the body choose which mark to lose. */
          runs += run(group.map(glyph).join(''), holdingStyle(u.hold, u.change === true));
        } else if (u.c === VIRAMA_TICK) {
          runs += run(VIRAMA_TICK, 'Virama');
        } else {
          runs += run(group.map(glyph).join(''), u.change === true ? 'Anusvara' : null);
        }
        for (const g of group) runs += trailing(g);
      }
    });
    return runs;
  };

  for (const s of doc.sections) {
    if (s.part !== undefined && s.part !== part) {
      paras.push(p(styleOf('doc__part'), run(s.part, null)));
    }
    part = s.part;
    const title = s.title ?? s.label;
    /* `${n}. ${title}` — the page's `headingOf`, not a middle dot. */
    const head = title === undefined || title === ''
      ? '' : s.n === undefined ? title : `${s.n}. ${title}`;
    if (head !== '') paras.push(p(styleOf('section__title'), run(head, null)));

    /* The section's own item list when it has one, its verses otherwise —
       `itemsOf` in `DocumentBlocks`. */
    const items = s.items !== undefined && s.items.length > 0
      ? s.items
      : s.verses.map((v) => ({ t: 'verse' as const, ...v }));

    for (const item of items) {
      if (item.t === 'instruction') {
        prose(styleOf('doc__instruction'), null, item.instruction.text.en ?? '');
        continue;
      }
      if (item.t === 'figure') {
        /* One resolution, in the format, and the miss is WRITTEN rather than
           skipped: a `.docx` silently missing a step's picture is a document
           somebody sends on. See `figureItem`. */
        const read = figureItem(item, library);
        if (read.figure === undefined) paras.push(p(null, run(missingFigureText(read.missingRef), 'Comment')));
        else picture(read.figure);
        continue;
      }
      if (item.t !== 'verse') continue;
      const runs = verseRuns(item.tokens);
      if (runs !== '') paras.push(p(styleOf('pada'), runs));
      for (const ins of item.instructions ?? []) {
        prose(styleOf('doc__instruction'), null, ins.text.en ?? '');
      }
      for (const f of item.figures ?? []) picture(f);
      if (item.translation?.en !== undefined) {
        prose(styleOf('doc__translation'), null, item.translation.en);
      }
      /* `Comment` is a CHARACTER style in his file, so a source line is an
         ordinary paragraph with one styled run in it. */
      if (item.source !== undefined) prose(null, 'Comment', item.source);
    }

    /* Under the section's verses, where the page draws it. */
    if (s.source != null && s.source !== '') prose(null, 'Comment', s.source);
  }

  /* `tail` is the section properties — the sheet size and its margins — which
     OOXML requires as the last child of `<w:body>`. The body writer does not
     know what paper it is being printed on; `exportWord` does. */
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    /* `r:` is what `<a:blip r:embed>` names a picture's bytes with. Declared
       on the root whether or not the document has a picture, because a
       namespace that appears only sometimes is a file that parses only
       sometimes. */
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `<w:body>${paras.join('')}${tail}</w:body></w:document>`;
}
