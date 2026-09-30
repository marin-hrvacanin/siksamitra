/**
 * WHICH CONTENT CONTROL A PARAGRAPH SITS IN — the tag of the innermost
 * block-level `<w:sdt>` around it, which is how the Word add-in knows which
 * part of a document a line belongs to, and so which rules mark it.
 */
import { describe, expect, it } from 'vitest';
import { readParagraphs } from '../docx-read.js';

const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
const sdt = (tag: string | null, inner: string) =>
  `<w:sdt><w:sdtPr>${tag === null ? '' : `<w:tag w:val="${tag}"/>`}<w:id w:val="1"/></w:sdtPr>`
  + `<w:sdtContent>${inner}</w:sdtContent></w:sdt>`;
const tags = (xml: string) => readParagraphs(`<w:body>${xml}</w:body>`).map((q) => q.sdt ?? null);

describe('the enclosing content control', () => {
  it('is none outside, and the tag inside', () => {
    expect(tags(p('a') + sdt('sm:rigveda', p('b') + p('c')) + p('d'))).toEqual([null, 'sm:rigveda', 'sm:rigveda', null]);
  });
  it('is the INNERMOST tagged one when they nest', () => {
    expect(tags(sdt('outer', p('a') + sdt('inner', p('b')) + p('c')))).toEqual(['outer', 'inner', 'outer']);
  });
  it('skips an untagged control and reports the tagged one around it', () => {
    expect(tags(sdt('outer', sdt(null, p('a'))))).toEqual(['outer']);
  });
  it('does not count a control INSIDE a paragraph — that one is inline', () => {
    const inline = '<w:p><w:sdt><w:sdtPr><w:tag w:val="inline"/></w:sdtPr><w:sdtContent>'
      + '<w:r><w:t>x</w:t></w:r></w:sdtContent></w:sdt></w:p>';
    expect(tags(inline + p('y'))).toEqual([null, null]);
  });
  it('leaves a document without controls exactly as it was read before', () => {
    const q = readParagraphs(`<w:body>${p('a')}${p('b')}</w:body>`);
    expect(q.every((x) => !('sdt' in x))).toBe(true);
  });
});
