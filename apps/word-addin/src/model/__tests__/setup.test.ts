/**
 * PREPARING A DOCUMENT — the arithmetic behind the two buttons.
 *
 * A marking IS a style in Word, and ECMA-376 §17.7.4.4 says what happens to a
 * `w:rStyle` naming a style the document has not got: it is IGNORED. No error,
 * no warning, no box. So "which styles does this document have" is not a
 * cosmetic question, and every answer here is measured against the sheet the
 * `.docx` exporter itself generates rather than against a list typed out.
 *
 * THE ONE THAT MATTERS MOST is `every style is USED, not merely defined`. Word
 * merges the styles an insertion references; a definition nothing references
 * may be dropped, and then "Add the styles" would report success and leave a
 * document missing half of them. `tools/word-live.mjs` proves the same thing
 * against a real Word; this proves the specimen gives it the chance.
 */
import { describe, expect, it } from 'vitest';
import { styleSheet } from '../sheet.js';
import { paragraphsXml } from '../paragraph.js';
import {
  SPECIMEN_NOTE, SPECIMEN_TITLE, STYLE_MEANS, missingStyles, specimenBody, styleIds,
} from '../setup.js';
import { SPECIMEN_LINE, SPECIMEN_RANGES, specimenMarks } from '../specimen-text.js';

const sheet = styleSheet();
const styles = styleIds(sheet);
const specimen = specimenBody(sheet, paragraphsXml(specimenMarks()));

describe('what the sheet declares', () => {
  it('is his vocabulary, read out of the generated sheet', () => {
    /* Not a list typed here: `char-styles.ts` and `PARA_STYLE_OF` are where
       styles are added, and this must follow them without anybody
       remembering. The named ones are the load-bearing ones. */
    const ids = styles.map((s) => s.id);
    for (const id of ['Translit', 'Holding', '2Holding', 'Svara', 'Pause', 'Comment']) {
      expect(ids, id).toContain(id);
    }
    expect(styles.length).toBeGreaterThan(12);
  });

  it('and each is a paragraph style or a character style, never both', () => {
    for (const style of styles) {
      expect(['paragraph', 'character'], style.id).toContain(style.kind);
    }
    /* Both kinds are present, which is what makes the specimen need two
       shapes — a paragraph OF a style, and a run IN one. */
    expect(styles.some((s) => s.kind === 'paragraph')).toBe(true);
    expect(styles.some((s) => s.kind === 'character')).toBe(true);
  });

  it('and a holding is a character style, which is why it can cross a space', () => {
    expect(styles.find((s) => s.id === 'Holding')?.kind).toBe('character');
    expect(styles.find((s) => s.id === 'Translit')?.kind).toBe('paragraph');
  });

  it('and each one has a sentence saying what it is', () => {
    /*
     * The specimen prints these beside the style. A style with no word for it
     * would print its own id twice, which teaches nobody anything — so adding
     * a style to the sheet has to come with a sentence about it.
     */
    for (const style of styles) {
      expect(STYLE_MEANS[style.id], `${style.id} has no meaning written for it`)
        .toBeTruthy();
    }
  });

  it('and the two we do not write are not in the sheet by default', () => {
    /*
     * `HoldingChange` and `2HoldingChange` are ours, they exist for a case
     * his documents do not contain, and they used to appear in the Styles
     * pane of every exported file. The owner's report: "there are
     * hallucinated styles, namely '2holdingchange' and so on." A document
     * being SET UP must not gain them either.
     */
    const ids = styles.map((s) => s.id);
    expect(ids).not.toContain('HoldingChange');
    expect(ids).not.toContain('2HoldingChange');
  });
});

describe('what a document is missing', () => {
  it('all of them, when it declares none — a fresh Word file', () => {
    const missing = missingStyles('<w:styles></w:styles>', sheet);
    /* `Normal` is excluded: every Word document has one, so reporting it
       would make a prepared document look unprepared forever. */
    expect(missing).not.toContain('Normal');
    expect(missing).toHaveLength(styles.filter((s) => s.id !== 'Normal').length);
    expect(missing).toContain('Translit');
  });

  it('none of them, when it declares the same sheet', () => {
    expect(missingStyles(sheet, sheet)).toEqual([]);
  });

  it('and exactly the ones taken away — the control', () => {
    /*
     * Without this, a `missingStyles` that returned everything always would
     * pass the first case and a `missingStyles` that returned nothing always
     * would pass the second.
     */
    const without = sheet
      .replace(/<w:style\b[^>]*w:styleId="Holding"[\s\S]*?<\/w:style>/, '')
      .replace(/<w:style\b[^>]*w:styleId="Pause"[\s\S]*?<\/w:style>/, '');
    expect(missingStyles(without, sheet).sort()).toEqual(['Holding', 'Pause']);
  });

  it('and it reads a whole flat package, not just a styles part', () => {
    /* What arrives is `Body.getOoxml()`: a package of eight parts with the
       document's own `styles.xml` inside it. A reader that only worked on a
       bare `<w:styles>` would report every style missing, always. */
    const pkg = `<pkg:package><pkg:part pkg:name="/word/document.xml">`
      + `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr></w:p></pkg:part>`
      + `<pkg:part pkg:name="/word/styles.xml">${sheet}</pkg:part></pkg:package>`;
    expect(missingStyles(pkg, sheet)).toEqual([]);
  });
});

describe('the specimen', () => {
  it('USES every style the sheet declares', () => {
    /*
     * THE ONE THAT DECIDES WHETHER "ADD THE STYLES" WORKS AT ALL. Word merges
     * the styles an insertion references. A style that is defined and not
     * referenced may be dropped — so a specimen that omitted one would leave
     * that style out of the document while reporting success.
     */
    for (const style of styles) {
      const attr = style.kind === 'paragraph' ? 'w:pStyle' : 'w:rStyle';
      /* `Normal` is Word's own and is never named explicitly: a paragraph
         with no `pStyle` IS Normal. */
      if (style.id === 'Normal') continue;
      expect(specimen, `${style.id} is defined but never used`)
        .toContain(`<${attr} w:val="${style.id}"/>`);
    }
  });

  it('says what it is, and that it can be deleted', () => {
    /* A block of text appearing at the end of somebody's document with no
       explanation is a block of text they will not dare delete. */
    expect(specimen).toContain(SPECIMEN_TITLE);
    expect(specimen).toContain('delete this block');
    expect(SPECIMEN_NOTE).toContain('the styles stay');
  });

  it('carries a real marked line, written by the real writer', () => {
    /* The boxes and accents in the specimen are the ones the buttons produce,
       not a drawing of them — so `paragraphsXml`'s output is IN it, byte for
       byte, rather than resembled. */
    expect(specimen).toContain(paragraphsXml(specimenMarks()));
  });

  it('and the box it asks for is a real character border in the sheet', () => {
    /*
     * WHERE THE BOX ACTUALLY IS. The body says `w:rStyle="Holding"` and
     * nothing more; `w:bdr` — the character border, ECMA-376 §17.3.2.4 — is
     * in the style DEFINITION. That split is the whole reason the sheet
     * travels with every insertion, and asserting the two halves separately
     * is what says so.
     */
    expect(specimen).toContain('<w:rStyle w:val="Holding"/>');
    expect(sheet).toMatch(/w:styleId="Holding"[\s\S]{0,400}?<w:bdr\b/);
    expect(sheet).toMatch(/w:styleId="2Holding"[\s\S]{0,400}?<w:bdr\b/);
  });

  it('is a balanced sequence of paragraphs', () => {
    const opens = [...specimen.matchAll(/<w:p>/g)].length;
    const closes = [...specimen.matchAll(/<\/w:p>/g)].length;
    expect(opens).toBe(closes);
    expect(opens).toBeGreaterThan(styles.length - 4);
  });

  it('and puts each character style on a line of its own', () => {
    /*
     * ECMA-376 §17.3.2.4: two ADJACENT runs with identical border attributes
     * are one border group and are drawn inside ONE set of borders. That is
     * what lets a holding cross a space — and it means `Holding` and
     * `2Holding` side by side in one paragraph would draw as a single box,
     * which is exactly what a specimen must not do. So each is followed by a
     * run of plain text and then a paragraph end.
     */
    const boxed = /<w:rStyle w:val="Holding"\/>[\s\S]{0,400}?<\/w:p>/.exec(specimen)?.[0] ?? '';
    expect(boxed).not.toContain('w:val="2Holding"');
  });
});

describe('the marked line in the specimen', () => {
  const tm = specimenMarks();

  it('is the line the ranges say it is', () => {
    /*
     * A marking is a half-open range over the TEXT. If somebody edits the
     * line and the offsets do not move with it, the specimen boxes the wrong
     * letters — and it would still look plausible. So each range is checked
     * against the substring it is supposed to cover, by name.
     */
    expect(tm.text).toBe(SPECIMEN_LINE);
    for (const range of SPECIMEN_RANGES) {
      expect(tm.text.slice(range.from, range.to), range.what).toBe(range.covers);
    }
  });

  it('and every range in the list is really a marking on the line', () => {
    /* The control: a `SPECIMEN_RANGES` that had drifted away from the marks
       would satisfy the check above and describe nothing. */
    for (const range of SPECIMEN_RANGES) {
      expect(
        tm.marks.some((m) => m.from === range.from && m.to === range.to),
        `${range.what} is described but not placed`,
      ).toBe(true);
    }
    expect(tm.marks).toHaveLength(SPECIMEN_RANGES.length);
  });

  it('and covers a short holding, a long one, two accents and a pause', () => {
    const kinds = tm.marks.map((m) => `${m.k}:${m.v ?? ''}`).sort();
    expect(kinds).toEqual([
      'hold:long', 'hold:short', 'pause:short', 'svara:anudatta', 'svara:svarita',
    ]);
  });

  it('and the pause is a point marking, at the end of the line', () => {
    const pause = tm.marks.find((m) => m.k === 'pause');
    expect(pause?.from).toBe(pause?.to);
    expect(pause?.from).toBe(tm.text.length);
  });
});
