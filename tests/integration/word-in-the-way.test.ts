/**
 * A PARAGRAPH THAT WOULD LOSE SOMETHING IS REFUSED, NEVER REWRITTEN.
 *
 * One fixture per kind, in the OOXML Word itself writes, and the owner's own
 * files as the measure of what the check costs.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { inTheWay } from '@siksamitra/interop';

const para = (inner: string): string =>
  `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr>${inner}</w:p>`;
const run = (t: string, rPr = '<w:rStyle w:val="Holding"/>'): string =>
  `<w:r><w:rPr>${rPr}</w:rPr><w:t>${t}</w:t></w:r>`;

describe('what is in the way', () => {
  const cases: [string, string, string][] = [
    ['a picture', run('a') + '<w:r><w:drawing><wp:inline/></w:drawing></w:r>', 'a picture'],
    ['a shape from an older Word', '<w:r><w:pict><v:shape/></w:pict></w:r>', 'a picture'],
    ['a text box', '<w:r><mc:AlternateContent><mc:Choice/></mc:AlternateContent></w:r>', 'a picture'],
    ['an OLE object', '<w:r><w:object/></w:r>', 'an embedded object'],
    ['an equation', '<m:oMath><m:r><m:t>x</m:t></m:r></m:oMath>', 'an equation'],
    ['a page-number field', '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r>', 'a field'],
    ['a simple field', '<w:fldSimple w:instr="DATE"><w:r><w:t>1</w:t></w:r></w:fldSimple>', 'a field'],
    ['a content control', '<w:sdt><w:sdtContent>' + run('a') + '</w:sdtContent></w:sdt>', 'a content control'],
    ['a tracked insertion', '<w:ins w:id="1" w:author="x">' + run('a') + '</w:ins>', 'a tracked change'],
    ['a tracked deletion', '<w:del w:id="1" w:author="x"><w:r><w:delText>a</w:delText></w:r></w:del>', 'a tracked change'],
    ['a tracked format change', `<w:r><w:rPr><w:rStyle w:val="Svara"/><w:rPrChange w:id="2"/></w:rPr><w:t>a</w:t></w:r>`, 'a tracked change'],
    ['a comment', '<w:commentRangeStart w:id="0"/>' + run('a') + '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>', 'a comment'],
    ['a footnote', '<w:r><w:footnoteReference w:id="1"/></w:r>', 'a footnote'],
    ['a link', '<w:hyperlink r:id="rId4">' + run('a') + '</w:hyperlink>', 'a link'],
    ['a TOC bookmark', '<w:bookmarkStart w:id="3" w:name="_Toc1"/>' + run('a') + '<w:bookmarkEnd w:id="3"/>', 'a bookmark'],
    ['a symbol', '<w:r><w:sym w:font="Symbol" w:char="F0B7"/></w:r>', 'a symbol'],
    ['bold', run('a', '<w:b/>'), 'formatting of its own'],
    ['a highlight on a styled run', run('a', '<w:rStyle w:val="Holding"/><w:highlight w:val="yellow"/>'), 'formatting of its own'],
    ['a colour', run('a', '<w:color w:val="FF0000"/>'), 'formatting of its own'],
  ];
  for (const [name, inner, what] of cases) {
    it(`${name}: refused, and said`, () => {
      const found = inTheWay(para(inner));
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(what);
    });
  }
  it('two kinds at once: both said, once each', () => {
    expect(inTheWay(para('<w:r><w:drawing/></w:r><w:r><w:drawing/></w:r><w:hyperlink/>'))).toHaveLength(2);
  });
});

describe('what is NOT in the way — the controls', () => {
  it('our own runs: styles, a raised aid, a line break, a tab', () => {
    expect(inTheWay(para(run('g') + run('u', '<w:rStyle w:val="Anusvara"/><w:vertAlign w:val="superscript"/>')
      + '<w:r><w:br/></w:r><w:r><w:tab/></w:r>'))).toEqual([]);
  });
  it('a font or a language set on a run — his files have both', () => {
    expect(inTheWay(para(run('a', '<w:rFonts w:ascii="Mangal"/><w:lang w:val="sa-IN"/>')))).toEqual([]);
  });
  it('Word\'s own caret bookmark, `_GoBack`', () => {
    expect(inTheWay(para('<w:bookmarkStart w:id="0" w:name="_GoBack"/><w:bookmarkEnd w:id="0"/>' + run('a')))).toEqual([]);
  });
  it('italic on the PARAGRAPH MARK is not a run of the line', () => {
    expect(inTheWay('<w:p><w:pPr><w:rPr><w:i/></w:rPr></w:pPr>' + run('a') + '</w:p>')).toEqual([]);
  });
  it('a border is not bold: `w:bdr` does not read as `w:b`', () => {
    expect(inTheWay(para(run('a', '<w:bdr w:val="single"/>')))).toEqual([]);
  });
});

const REF = 'Library/reference';
describe.skipIf(!existsSync(REF))('what it costs his own files', () => {
  for (const f of existsSync(REF) ? readdirSync(REF).filter((x) => x.endsWith('.docx')) : []) {
    it(f, () => {
      const xml = strFromU8(unzipSync(new Uint8Array(readFileSync(`${REF}/${f}`)))['word/document.xml']!);
      const mantras = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((m) => m[0])
        .filter((p) => p.includes('w:pStyle w:val="Translit"'));
      const refused = mantras.filter((p) => inTheWay(p).length > 0);
      /* The lines with a picture on them, and nothing else. */
      for (const p of refused) expect(inTheWay(p)).toEqual([expect.stringMatching(/^a picture/)]);
      expect(refused.length).toBeLessThanOrEqual(3);
    });
  }
});
