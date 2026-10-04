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
import { CANDRA, VIRAMA_TICK, digitsIn, type ScriptKey } from '@siksamitra/engine';
import { WORD_DEVANAGARI, WORD_MARKS } from '@siksamitra/tokens/word';
import { BAR_GLYPH, OVERLINE, SVARA_CHAR, changeStyle, holdingStyle } from '../word-styles.js';
import {
  bridging, dandaRun, pauseRun, signature, styleOf, styledParagraph, styledRun, type WordPictures,
} from './body-parts.js';
import { SAID, lettersOfIast, scriptWordRuns } from './script-runs.js';
import { readParagraphs } from '../docx-read.js';
import { registerOf } from '@siksamitra/edit';
import { withParts, type Region } from './rule-parts.js';
import { syllablesOf } from '../docx-syllables.js';
import { figureDrawing, figurePlaceholderText, missingFigureText } from './drawing.js';
import { blockWriter } from './body-blocks.js';

export { bridging, styledParagraph, styledRun, type WordPictures } from './body-parts.js';

/** Write the body. `tail` is appended inside `<w:body>` — see the return. */
export function documentXml(
  doc: ChantDoc, tail = '', pictures?: WordPictures,
  /** The script the verses are written in. IAST unless said — see `script-runs.ts`. */
  script: ScriptKey = 'iast',
  /** Tag the verses (`body-blocks.ts`) — false for a line written into his own file. */
  tags = true,
  /** What ends a book's front pages — a section break, from `exportWord`. */
  sectionBreak?: string,
): string {
  const paras: string[] = [];
  const p = styledParagraph;
  const run = styledRun;

  /* A part heading is drawn where the part CHANGES — it names a run of steps,
     not a step — and a section with no part ends the run. `DocumentBlocks`
     makes the same two decisions in the same order. */
  let part: string | undefined;

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
  const picture = (fig: ChantFigure | undefined): string[] => {
    const paras: string[] = [];
    if (fig === undefined) return paras;
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
    return paras;
  };

  /**
   * The letters of one verse, as runs.
   *
   * A run covers a maximal group of units sharing a `signature` — the inverse
   * of the importer's merge, which is what makes a round trip stable.
   */
  const verseRuns = (tokens: readonly ChantToken[], as: ScriptKey = script): string => {
    let runs = '';
    /* In an Indic script a WORD is written at once, cluster by cluster: the
       syllables of a word share conjuncts, so they cannot be runs apart. */
    let skipTo = -1;
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
      /* The Ṛgvedic overline, in his `Long` — after its letter and BEFORE the
         accent, as his files have it (`yu` `̅` `̍`). It rides in the letter
         (`u.c` is `u̅`); `glyph` leaves it out of the letter's own run. */
      if (u.c.includes(OVERLINE)) r += run(OVERLINE, 'Long');
      /* A kampa's colour and size are the run writer's (`styledRun`). */
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
      /* A number is a name's count, in his `Nma`; a letter is a reading aid. */
      if (u.sup !== undefined) r += run(u.sup, /^[0-9]+$/u.test(u.sup) ? WORD_MARKS.nameNumber.id : 'Reference');
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
    /* The candrabindu rides on ITS letter: `m̐` for the gum, and on whatever
       else carries one — `o̐` typed with the Candrabindu button. Writing `m̐`
       for every one put an `m` into `o̐n`, and dropped the `o` it replaced. */
    const glyph = (u: ChantUnit): string => {
      const c = u.c.replaceAll(OVERLINE, '');
      return u.candra === true ? `${c}${CANDRA}` : c;
    };

    tokens.forEach((t, at) => {
      if (t.t === 'br') { runs += '<w:r><w:br/></w:r>'; return; }
      /* A tab is `<w:tab/>`: a tab character inside `<w:t>` is not drawn as one. */
      if (t.t === 'sp' && t.tab === true) { runs += '<w:r><w:tab/></w:r>'; return; }
      if (t.t === 'sp') {
        const space = t.nb === true ? '\u00a0' : ' ';
        /* In a script line every word gap is two spaces, as his Devan\u0101gar\u012b sets
           it (`WORD_DEVANAGARI.wordGap`), and nothing is boxed \u2014 the reader
           reads two as one (`ScriptReader`). */
        const inside = bridging(tokens, at);
        if (as !== 'iast') {
          runs += run(space.repeat(WORD_DEVANAGARI.wordGap), null);
          /* A holding that CROSSES the gap — `m ṅ` boxed as one in IAST — has
             nothing to draw it in his Devanāgarī, so the record says the
             space is held, and which holding (`Said.k`). */
          if (inside !== null) runs += run(`${SAID}${JSON.stringify({ h: [0], k: inside.hold })}`, null, false, true);
          return;
        }
        runs += run(space, inside === null ? null : holdingStyle(inside.hold!, inside.change === true));
        return;
      }
      /* ONE BAR, its colour its length: short in his blue, long in his red. */
      if (t.t === 'pause') {
        /* A BAR BETWEEN TWO SPACES, as his pages print every one: the praṇava's
           pause is stored `oṁ ␣ |` with the next syllable straight after it,
           and printed so it read `oṁ |śirasi` where his Lalitā has `oṁ | asya`
           (2026-10-04). The space is the page's, so it is written INSIDE the
           bar's run, and the reader reads it as the bar's (`readPause`). */
        const spaced = as === 'iast' && tokens[at + 1]?.t === 'syl';
        runs += pauseRun(spaced ? '| ' : '|', t.len === 'long' ? 'Pause' : changeStyle(''));
        return;
      }
      /* A BAR IS NOT A PAUSE. Both were written as `|` in the `Pause` style, so
         all 59 bars in the corpus came back from a round trip as short pauses.
         `¦` is a different character in the same style: the same colour and
         weight on the page, and unambiguous to the reader. */
      if (t.t === 'bar') { runs += pauseRun(BAR_GLYPH, 'Pause'); return; }
      if (t.t === 'num') { runs += run(digitsIn(t.s, as), null); return; }
      if (t.t === 'danda') { runs += dandaRun(t.s); return; }
      /* His note on the line is his `Comment` style; other prose is plain. */
      if (t.t === 'text') { runs += run(t.s, t.note === true ? 'Comment' : null); return; }
      /* A SLOT IS ITS OWN LETTERS, written where it stands. It fell through to
         the `syl` test below and was skipped, so the deity's name of the Pūjā
         Vidhi — `śrī devan dhyāyāmi` — was `śrī  dhyāyāmi` on every page this
         wrote, in the app's Export Word and in Word alike. Found bringing the
         corpus into Word (`tests/integration/insert-document.test.ts`). */
      if (t.t === 'slot') { runs += verseRuns(t.tokens, as); return; }
      if (t.t !== 'syl') return;
      if (at < skipTo) return;
      if (as !== 'iast') {
        let end = at;
        while (end < tokens.length && tokens[end]!.t === 'syl') end += 1;
        const word = tokens.slice(at, end) as Extract<ChantToken, { t: 'syl' }>[];
        /* The word in IAST is the truth the script must read back to. */
        const truth = lettersOfIast(readParagraphs(`<w:p>${verseRuns(word, 'iast')}</w:p>`)[0]?.runs ?? []);
        /* Its akṣaras by the rule the READER divides by (`syllablesOf`): the
           model's own division can be missing — letters typed into a line
           carry none — and one "syllable" with two vowels is no akṣara:
           `śiva` in one came out `शिव्अ`. */
        const aksaras = syllablesOf(word.flatMap((s) => s.units));
        for (const r of scriptWordRuns(aksaras, as, truth)) runs += run(r.text, r.rStyle, false, r.hidden === true);
        skipTo = end;
        return;
      }

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
          const letters = group.map(glyph).join('');
          runs += run(letters, u.change === true ? changeStyle(letters) : null);
        }
        for (const g of group) runs += trailing(g);
      }
    });
    return runs;
  };

  /* Where each section's paragraphs are, and which register marks it: a
     section marked by other rules than the rest is a PART in Word. Each thing
     a section holds is written as his files write it — `body-blocks.ts`. */
  const blocks = blockWriter({ p, run, verseRuns: (t) => verseRuns(t), picture, tags, ...(sectionBreak === undefined ? {} : { sectionBreak }) });
  paras.push(...blocks.front(doc));
  const regions: Region[] = [];
  for (const s of doc.sections) {
    const from = paras.length;
    paras.push(...blocks.section(doc, s, part, (item) => {
      if (item.t !== 'figure') return null;
      /* One resolution, in the format, and the miss is WRITTEN rather than
         skipped: a `.docx` silently missing a step's picture is a document
         somebody sends on. See `figureItem`. */
      const read = figureItem(item, library);
      return read.figure === undefined ? [p(null, run(missingFigureText(read.missingRef), 'Comment'))] : picture(read.figure);
    }));
    part = s.part;
    regions.push({ from, to: paras.length, register: registerOf(doc, s) });
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
    + `<w:body>${withParts(paras, regions)}${tail}</w:body></w:document>`;
}
