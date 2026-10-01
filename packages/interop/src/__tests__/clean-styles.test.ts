/**
 * HIS STYLES UNDER THE CLEAN NAMES — his definitions, renamed.
 */
import { describe, expect, it } from 'vitest';
import { DOC_DEFAULTS, hisStylesAsClean, legacyStylesIn, withHisDefinitions } from '../word/clean-styles.js';

const HIS = `<w:styles>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Translit"><w:name w:val="Translit"/><w:link w:val="TranslitChar"/><w:rsid w:val="00893C5C"/><w:pPr><w:spacing w:line="480" w:lineRule="exact"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="character" w:customStyle="1" w:styleId="Anusvara"><w:name w:val="Anusvara"/><w:rPr><w:i/><w:color w:val="0070C0"/></w:rPr></w:style>
<w:style w:type="character" w:customStyle="1" w:styleId="VedicAnusvara"><w:name w:val="VedicAnusvara"/><w:basedOn w:val="Anusvara"/><w:rPr><w:rFonts w:ascii="URW Palladio ITU"/></w:rPr></w:style>
<w:style w:type="character" w:customStyle="1" w:styleId="Long"><w:name w:val="Long"/><w:basedOn w:val="Svara"/><w:rPr><w:rFonts w:ascii="Calibri Light"/></w:rPr></w:style>
<w:style w:type="character" w:customStyle="1" w:styleId="Holding"><w:name w:val="Holding"/><w:rPr><w:bdr w:val="single" w:sz="2" w:color="538135"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`;

describe('hisStylesAsClean', () => {
  const his = hisStylesAsClean(HIS);
  it('renames each of his to its clean id and name', () => {
    expect([...his.keys()].filter((k) => !k.startsWith('#')).sort()).toEqual(['Anusvara', 'HoldingShort', 'Mantra', 'Overline', 'VedicAnusvara', 'Visarga']);
    expect(his.get('Mantra')).toContain('w:styleId="Mantra"');
    expect(his.get('Mantra')).toContain('<w:name w:val="Mantra"/>');
    expect(his.get('HoldingShort')).toContain('<w:name w:val="Holding · Short"/>');
  });
  it('and keeps HIS definition — his face, his size, his leading', () => {
    expect(his.get('Mantra')).toContain('<w:rFonts w:ascii="Arial"/><w:sz w:val="32"/>');
    expect(his.get('Mantra')).toContain('w:line="480"');
    expect(his.get('Overline')).toContain('Calibri Light');
  });
  it('drops what points outside the sheet: the linked Char style, his edit session', () => {
    expect(his.get('Mantra')).not.toContain('w:link');
    expect(his.get('Mantra')).not.toContain('w:rsid');
  });
  it('renames a basedOn with the style: Overline on Svara, VedicAnusvara on Anusvara', () => {
    expect(his.get('Overline')).toContain('<w:basedOn w:val="Svara"/>');
    expect(his.get('VedicAnusvara')).toContain('<w:basedOn w:val="Anusvara"/>');
  });
  it('makes Visarga from his Anusvara — his blue italic, saying what it is', () => {
    expect(his.get('Visarga')).toContain('w:styleId="Visarga"');
    expect(his.get('Visarga')).toContain('<w:color w:val="0070C0"/>');
  });
  it('keeps HIS name where his id is the clean one — so Word maps onto his style, not a second one', () => {
    expect(his.get('Anusvara')).toContain('<w:name w:val="Anusvara"/>');
    expect(his.get('VedicAnusvara')).toContain('<w:name w:val="VedicAnusvara"/>');
    expect(his.get('Mantra')).toContain('<w:name w:val="Mantra"/>');
  });
  it('leaves Word’s own built-ins alone', () => {
    expect(his.has('Heading1')).toBe(false);
  });
  it('keeps his docDefaults with them — a document of his', () => {
    const withDefaults = HIS.replace('<w:styles>', '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>');
    expect(hisStylesAsClean(withDefaults).get(DOC_DEFAULTS)).toContain('<w:sz w:val="22"/>');
  });
  it('but not from a document with none of the vocabulary: a new document keeps our defaults', () => {
    expect(hisStylesAsClean('<w:styles><w:docDefaults/><w:style w:type="paragraph" w:styleId="Normal"/></w:styles>').size).toBe(0);
  });
});

describe('withHisDefinitions', () => {
  const ours = '<w:styles><w:style w:type="character" w:styleId="VedicAnusvara"><w:name w:val="VedicAnusvara"/><w:rPr><w:b/></w:rPr></w:style>'
    + '<w:style w:type="character" w:styleId="Pause"><w:name w:val="Pause"/></w:style></w:styles>';
  const out = withHisDefinitions(ours, hisStylesAsClean(HIS));
  it('his definition replaces ours for a style he has', () => {
    expect(out).toContain('URW Palladio ITU');
    expect(out).not.toContain('<w:b/>');
  });
  it('ours stays for a style he has not got', () => {
    expect(out).toContain('w:styleId="Pause"');
  });
  it('and the style his is based on comes with it', () => {
    expect(out).toContain('w:styleId="Anusvara"');
  });
  it('his docDefaults replace ours, so Word folds nothing of ours into his styles', () => {
    const sheet = '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:color w:val="000000"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>';
    const mine = new Map([[DOC_DEFAULTS, '<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>']]);
    const got = withHisDefinitions(sheet, mine);
    expect(got).not.toContain('000000');
    expect(got).toContain('<w:sz w:val="22"/>');
  });
  it('and the namespaces his definitions use are declared — an undeclared prefix is not XML, and Word refuses it', () => {
    const his2 = hisStylesAsClean(HIS.replace('<w:styles>', '<w:styles xmlns:w="W" xmlns:w14="W14" xmlns:w15="W15"><w:docDefaults><w:rPrDefault><w:rPr><w14:ligatures w14:val="standardContextual"/></w:rPr></w:rPrDefault></w:docDefaults>'));
    const sheet = '<w:styles xmlns:w="W"><w:docDefaults><w:rPrDefault/></w:docDefaults></w:styles>';
    const got = withHisDefinitions(sheet, his2);
    expect(got).toContain('<w14:ligatures');
    expect(/<w:styles\b[^>]*>/.exec(got)![0]).toBe('<w:styles xmlns:w="W" xmlns:w14="W14">');
  });
  it('no definitions of his: the sheet unchanged', () => {
    expect(withHisDefinitions(ours, new Map())).toBe(ours);
  });
});

describe('legacyStylesIn', () => {
  it('names his older ids a document still defines or uses — not the ones shared with the clean', () => {
    expect(legacyStylesIn(HIS).sort()).toEqual(['2Holding', 'Holding', 'Long', 'Translit'].filter((x) => HIS.includes(`"${x}"`)).sort());
    expect(legacyStylesIn('<w:p><w:pPr><w:pStyle w:val="Mantra"/></w:pPr></w:p>')).toEqual([]);
  });
});
