/**
 * A PART MADE IN XML — the paragraphs exactly as Word gave them, inside one
 * part, for when Word refuses to make one through its API (another document
 * open). Checked in real Word too (`check:word:ui`).
 */
import { describe, expect, it } from 'vitest';
import { partOf, partTag, readParagraphs } from '@siksamitra/interop';
import { asPart } from '../part-package.js';
import { documentPartOf } from '../opc.js';

const P = (t: string) => `<w:p><w:pPr><w:pStyle w:val="Mantra"/></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`;
const pkg = (body: string, root = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">') =>
  '<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage"><pkg:part pkg:name="/word/document.xml"><pkg:xmlData>'
  + `${root}<w:body>${body}</w:body></w:document></pkg:xmlData></pkg:part></pkg:package>`;
const SECT = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>';
const TAG = partTag({ register: 'rigveda' });

describe('asPart', () => {
  const out = documentPartOf(asPart(pkg(P('agnim') + P('īḷe') + SECT), TAG, 'Ṛgveda — śikṣāmitra'));
  it('the paragraphs, every one of them, in one part with the part’s tag', () => {
    const paras = readParagraphs(out);
    expect(paras.map((p) => p.runs.map((r) => r.text).join(''))).toEqual(['agnim', 'īḷe']);
    expect(paras.every((p) => partOf(p.sdt)?.register === 'rigveda')).toBe(true);
  });
  it('the paragraphs are Word’s own XML, unchanged inside it', () => {
    expect(out).toContain(`<w:sdtContent>${P('agnim')}${P('īḷe')}</w:sdtContent>`);
  });
  it('the section’s properties stay after the part, where OOXML requires them', () => {
    expect(out).toMatch(/<\/w:sdt><w:sectPr>/);
  });
  it('titled, and the namespace its frame is written in declared', () => {
    expect(out).toContain('<w:alias w:val="Ṛgveda — śikṣāmitra"/>');
    expect(out).toMatch(/<w:document[^>]*xmlns:w15="/);
  });
  it('a title is escaped as an attribute', () => {
    expect(documentPartOf(asPart(pkg(P('a')), TAG, 'a "b" & <c>'))).toContain('w:val="a &quot;b&quot; &amp; &lt;c&gt;"');
  });
  it('the empty paragraph Word adds after a range is taken off when asked — and only an empty one', () => {
    const extra = documentPartOf(asPart(pkg(P('agnim') + '<w:p w14:paraId="1"/>'), TAG, 't', true));
    expect(readParagraphs(extra).length).toBe(1);
    const real = documentPartOf(asPart(pkg(P('agnim') + P('īḷe')), TAG, 't', true));
    expect(readParagraphs(real).length).toBe(2);
  });
});
