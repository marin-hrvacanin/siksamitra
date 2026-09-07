/**
 * 1:1 with the Veda Union Word document — checked, not asserted.
 *
 * The claim: what the author sees in the `word` document theme is what the
 * exported `.docx` and the PDF printed from it will show. That claim has three
 * parts, and each is checkable without a browser:
 *
 *   1. the values the theme uses ARE the values measured from his file;
 *   2. the exporter writes those same values, because it reads the same table;
 *   3. the template really does contain them — read out of the `.docx` here,
 *      independently of the table, so the table cannot drift from the file it
 *      claims to describe.
 *
 * Part 3 is the one that matters. Parts 1 and 2 would both pass if someone
 * changed a number in `word.ts`; only reading the template can catch that.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  WORD_MARKS, WORD_PAGE, WORD_PARAGRAPHS, fromEighths, fromHalfPoints, fromTwips,
  wordColor,
} from '@siksamitra/tokens/word';
import { DOCUMENT_THEMES } from '../../packages/tokens/src/document-themes.js';
import { TEXT_FACES } from '../../packages/tokens/src/fonts.js';
import { CHAR_STYLE_BY_ID } from '@siksamitra/interop';

const TEMPLATE = join(process.cwd(), 'tools', 'chant', 'templates', 'vu-word-template.docx');

/** The template's `word/styles.xml`, as text. Read once. */
const stylesXml = ((): string => {
  const zip = unzipSync(new Uint8Array(readFileSync(TEMPLATE)));
  const part = zip['word/styles.xml'];
  if (part === undefined) throw new Error('the template has no word/styles.xml');
  return strFromU8(part);
})();

/** One `<w:style>` element, by id. */
function styleXml(id: string): string {
  const re = new RegExp(`<w:style [^>]*w:styleId="${id}"[\\s\\S]*?</w:style>`);
  const found = re.exec(stylesXml);
  expect(found, `the template has no style "${id}"`).not.toBeNull();
  return found![0];
}

/** An attribute value out of one element of a style. */
function attr(xml: string, element: string, name: string): string | null {
  const re = new RegExp(`<w:${element}[^>]*w:${name}="([^"]*)"`);
  const found = re.exec(xml);
  return found === null ? null : found[1]!;
}

describe('the theme uses the measured values', () => {
  const word = DOCUMENT_THEMES.find((t) => t.id === 'word');

  it('there is a Veda Union Word document theme', () => {
    expect(word, 'the `word` document theme is missing').toBeDefined();
    expect(word!.name).toContain('Word');
  });

  it('its mark colours are the Word character styles, exactly', () => {
    // Not "close to": the same hex, lower-cased. A holding on screen is the
    // colour Word prints, because it is the same value.
    expect(word!.light.hold).toBe(wordColor(WORD_MARKS.holdShort.color));
    expect(word!.light.holdLong).toBe(wordColor(WORD_MARKS.holdLong.color));
    expect(word!.light.svara).toBe(wordColor(WORD_MARKS.svara.color));
    expect(word!.light.change).toBe(wordColor(WORD_MARKS.change.color));
    expect(word!.light.pauseShort).toBe(wordColor(WORD_MARKS.pause.color));
    expect(word!.light.pauseLong).toBe(wordColor(WORD_MARKS.pause.color));
  });

  it('its leading is the mantra line s exact 24pt over 16pt', () => {
    const line = WORD_PARAGRAPHS.find((p) => p.role === 'verse-line')!;
    expect(line.size).toBe(16);
    expect(line.leading).toBe(24);
    expect(word!.leading).toBeCloseTo(1.5, 6);
  });

  it('its face is metric-compatible with Arial, and names Arial second', () => {
    expect(word!.face).toBe('wordSans');
    const stack = TEXT_FACES.wordSans;
    expect(stack.indexOf('Arimo')).toBeLessThan(stack.indexOf('Arial'));
    expect(stack).toContain('Arial');
  });

  it('it is the same page in dark mode, deliberately', () => {
    // A printed page is not dark. Offering a "dark Word document" would be
    // offering a different document.
    expect(word!.dark).toEqual(word!.light);
  });
});

describe('the exporter writes the same values', () => {
  it('the holding styles carry the theme colour', () => {
    expect(CHAR_STYLE_BY_ID.get('Holding')!.border!.color).toBe(WORD_MARKS.holdShort.color);
    expect(CHAR_STYLE_BY_ID.get('2Holding')!.border!.color).toBe(WORD_MARKS.holdLong.color);
  });

  it('the svara, change and pause styles carry theirs', () => {
    expect(CHAR_STYLE_BY_ID.get('Svara')!.color).toBe(WORD_MARKS.svara.color);
    expect(CHAR_STYLE_BY_ID.get('Anusvara')!.color).toBe(WORD_MARKS.change.color);
    expect(CHAR_STYLE_BY_ID.get('Pause')!.color).toBe(WORD_MARKS.pause.color);
    expect(CHAR_STYLE_BY_ID.get('Comment')!.color).toBe(WORD_MARKS.comment.color);
  });
});

/**
 * The part that makes the other two mean something: the numbers are read out
 * of his `.docx`, not out of the table that claims to describe it.
 */
describe('the template really contains these values', () => {
  it('Translit is Arial 16pt on exactly 24pt', () => {
    const xml = styleXml('Translit');
    expect(attr(xml, 'rFonts', 'ascii')).toBe('Arial');
    expect(fromHalfPoints(Number(attr(xml, 'sz', 'val')))).toBe(16);
    expect(attr(xml, 'spacing', 'lineRule')).toBe('exact');
    expect(fromTwips(Number(attr(xml, 'spacing', 'line')))).toBe(24);
    expect(fromTwips(Number(attr(xml, 'ind', 'left')))).toBe(14.2);
  });

  it('the headings are 22, 18 and 16 point', () => {
    const sizes = ['Heading2', 'Heading3', 'Heading4']
      .map((id) => fromHalfPoints(Number(attr(styleXml(id), 'sz', 'val'))));
    expect(sizes).toEqual([22, 18, 16]);
  });

  it('the section and step headings are the grey the theme uses', () => {
    for (const id of ['Heading3', 'Heading4']) {
      expect(attr(styleXml(id), 'color', 'val')).toBe('7F7F7F');
    }
    const section = WORD_PARAGRAPHS.find((p) => p.role === 'section')!;
    expect(section.color).toBe('7F7F7F');
  });

  it('the translation is Times New Roman, italic, grey', () => {
    const xml = styleXml('Prijevod');
    expect(attr(xml, 'rFonts', 'ascii')).toBe('Times New Roman');
    expect(xml).toContain('<w:i/>');
    expect(attr(xml, 'color', 'val')).toBe('808080');
    const translation = WORD_PARAGRAPHS.find((p) => p.role === 'translation')!;
    expect(translation.italic).toBe(true);
    expect(translation.color).toBe('808080');
    expect(translation.face).toBe('serif');
  });

  it('the body default is 11pt at 1.08 lines', () => {
    const defaults = /<w:docDefaults>[\s\S]*?<\/w:docDefaults>/.exec(stylesXml)![0];
    expect(fromHalfPoints(Number(attr(defaults, 'sz', 'val')))).toBe(WORD_PAGE.bodySize);
    expect(Number(attr(defaults, 'spacing', 'line')) / 240).toBeCloseTo(WORD_PAGE.bodyLeading, 6);
  });

  it('every paragraph metric in the table matches the template it names', () => {
    // The whole table, not a sample: a value nobody thought to check is a
    // value that drifts.
    for (const metric of WORD_PARAGRAPHS) {
      if (metric.style === 'Comment') continue; // a character style, checked above.
      const xml = styleXml(metric.style);
      const sz = attr(xml, 'sz', 'val');
      // `Normal` inherits its size from the document defaults.
      if (sz !== null) {
        expect(fromHalfPoints(Number(sz)), metric.style).toBe(metric.size);
      }
      const line = attr(xml, 'spacing', 'line');
      const exact = attr(xml, 'spacing', 'lineRule') === 'exact';
      expect(
        exact && line !== null ? fromTwips(Number(line)) : null,
        `${metric.style} leading`,
      ).toBe(metric.leading === null || !exact ? null : metric.leading);
      const after = attr(xml, 'spacing', 'after');
      if (after !== null) {
        expect(fromTwips(Number(after)), `${metric.style} space after`).toBe(metric.after);
      }
      const indent = attr(xml, 'ind', 'left');
      expect(
        indent === null ? 0 : fromTwips(Number(indent)),
        `${metric.style} indent`,
      ).toBe(metric.indent);
      /*
       * The two indent fields the table used not to carry, and both matter on
       * the page: the hanging indent is why a VU verse opens flush and steps
       * in, and the negative right indent is why a long pāda runs into the
       * margin instead of wrapping.
       */
      const hanging = attr(xml, 'ind', 'hanging');
      expect(
        hanging === null ? 0 : fromTwips(Number(hanging)),
        `${metric.style} hanging indent`,
      ).toBe(metric.hanging);
      const right = attr(xml, 'ind', 'right');
      expect(
        right === null ? 0 : fromTwips(Number(right)),
        `${metric.style} right indent`,
      ).toBe(metric.right);
      /* None of his headings is bold. */
      expect(xml.includes('<w:b/>'), `${metric.style} bold`).toBe(metric.bold === true);
    }
  });

  it('the mantra line hangs out to the margin and into the right one', () => {
    const xml = styleXml('Translit');
    expect(fromTwips(Number(attr(xml, 'ind', 'hanging')))).toBe(14.2);
    expect(fromTwips(Number(attr(xml, 'ind', 'right')))).toBe(-13.8);
    const line = WORD_PARAGRAPHS.find((p) => p.role === 'verse-line')!;
    // First line at the margin, continuations 14.2pt in.
    expect(line.indent - line.hanging).toBe(0);
  });

  it('the running head is 12pt, and the page is A4 with 25mm margins', () => {
    // Measured off his PDF: a line at the margin starts at x = 70.9pt, and the
    // running head sets at 12pt. An inch would be 72.
    expect(fromHalfPoints(Number(attr(styleXml('Header'), 'sz', 'val')))).toBe(12);
    expect(WORD_PAGE.marginPt).toBeCloseTo(70.85, 2);
  });

  it('the holding weights are 0.25pt and 1.5pt', () => {
    // The ONLY difference between a short and a long box in his file.
    expect(fromEighths(2)).toBe(0.25);
    expect(fromEighths(12)).toBe(1.5);
    expect(WORD_MARKS.holdShort.weight).toBe(0.25);
    expect(WORD_MARKS.holdLong.weight).toBe(1.5);
  });
});
