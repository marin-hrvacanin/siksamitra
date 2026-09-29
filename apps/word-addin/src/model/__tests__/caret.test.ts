/**
 * THE CARET MARK — at the right Word offset, in a paragraph the writer wrote.
 */
import { describe, expect, it } from 'vitest';
import { mark } from '@siksamitra/format';
import { paragraphsXml } from '../paragraph.js';
import { CARET_BOOKMARK, withCaretAt, wordOffsetIn } from '../caret.js';

const at = (xml: string): string => {
  /* The text before the mark, as Word would count it. */
  const cut = xml.indexOf(`w:name="${CARET_BOOKMARK}"`);
  return [...xml.slice(0, cut).matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
};

describe('the caret mark', () => {
  const plain = paragraphsXml({ text: 'agne naya', marks: [] });
  it('goes where it is asked, splitting a run of text', () => {
    expect(at(withCaretAt(plain, 3))).toBe('agn');
  });
  it('at 0, before everything; past the end, before the paragraph closes', () => {
    expect(at(withCaretAt(plain, 0))).toBe('');
    const end = withCaretAt(plain, 99);
    expect(at(end)).toBe('agne naya');
    expect(end.indexOf(CARET_BOOKMARK)).toBeLessThan(end.lastIndexOf('</w:p>'));
  });
  it('is written once, as an empty bookmark', () => {
    const x = withCaretAt(plain, 4);
    expect(x.match(/bookmarkStart/g)).toHaveLength(1);
    expect(x.match(/bookmarkEnd/g)).toHaveLength(1);
  });
  it('a split inside a box keeps the box style on both halves', () => {
    const boxed = paragraphsXml({ text: 'agne', marks: [mark({ k: 'hold', from: 1, to: 4, v: 'short' })] });
    const x = withCaretAt(boxed, 2);
    expect(at(x)).toBe('ag');
    const styles = [...x.matchAll(/<w:rStyle w:val="([^"]+)"\/>/g)].map((m) => m[1]);
    expect(styles.filter((s) => s === 'Holding').length).toBeGreaterThanOrEqual(2);
  });
  it('after an accent the Word offset counts the accent character', () => {
    const accented = paragraphsXml({ text: 'agne', marks: [mark({ k: 'svara', from: 3, to: 4, v: 'svarita' })] });
    /* Model offset 4 is after the e; in Word the svarita U+030D is one more. */
    expect(wordOffsetIn(accented, 4)).toBe(5);
  });
  it('escapes survive the split', () => {
    const x = withCaretAt('<w:p><w:r><w:t>a&amp;b</w:t></w:r></w:p>', 2);
    expect(x).toContain('<w:t xml:space="preserve">a&amp;</w:t>');
    expect(x).toContain('<w:t xml:space="preserve">b</w:t>');
  });
});
