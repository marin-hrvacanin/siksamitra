/**
 * THE LOOK RESOLVER — what `check:word:reference` compares with. It has to be
 * right about Word before it can be right about anything else.
 */
import { describe, expect, it } from 'vitest';
import { asRuled, differences, drawn, inserted, runProps, styleTable } from '../word-look.js';

const STYLES = `<w:styles>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Translit"><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Anusvara"><w:rPr><w:i/><w:color w:val="0070c0"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Pause"><w:basedOn w:val="Anusvara"/><w:rPr><w:color w:val="C00000"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Holding"><w:rPr><w:bdr w:val="single" w:sz="2" w:color="538135"/></w:rPr></w:style>
</w:styles>`;
const t = styleTable(STYLES);
const P = (inner: string): string => `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr>${inner}</w:p>`;
const R = (text: string, rPr = ''): string => `<w:r>${rPr === '' ? '' : `<w:rPr>${rPr}</w:rPr>`}<w:t xml:space="preserve">${text}</w:t></w:r>`;

describe('resolving a look', () => {
  it('the paragraph style over the defaults', () => {
    expect(drawn(P(R('a')), t)[0]!.look).toBe('font=Arial,sz=32');
  });
  it('a character style over the paragraph, and its basedOn chain under it', () => {
    expect(drawn(P(R('|', '<w:rStyle w:val="Pause"/>')), t)[0]!.look).toBe('color=C00000,font=Arial,i=true,sz=32');
  });
  it('direct formatting over everything', () => {
    expect(drawn(P(R('।', '<w:rFonts w:ascii="Mangal"/>')), t)[0]!.look).toBe('font=Mangal,sz=32');
  });
  it('a raise and a box are part of the look', () => {
    expect(drawn(P(R('u', '<w:rStyle w:val="Anusvara"/><w:vertAlign w:val="superscript"/>')), t)[0]!.look).toContain('va=superscript');
    expect(drawn(P(R('n', '<w:rStyle w:val="Holding"/>')), t)[0]!.look).toContain('bdr=single/2/538135');
  });
  it('an explicit off is off: `<w:i w:val="0"/>`', () => {
    expect(runProps('<w:i w:val="0"/>').i).toBe('false');
  });
});

describe('what is drawn', () => {
  it('hidden text is not', () => {
    expect(drawn(P(R('a') + R('b', '<w:vanish/>')), t).map((d) => d.ch)).toEqual(['a']);
  });
  it('a tab, a break, a symbol, and escaped text are', () => {
    const d = drawn(P(R('a') + '<w:r><w:tab/></w:r>' + '<w:r><w:br/></w:r>' + R('&amp;') + '<w:r><w:sym w:char="F141"/></w:r>'), t);
    expect(d.map((x) => x.ch).join('')).toBe('a\t\n&');
  });
  it('trailing whitespace, and a space before a break, draw nothing', () => {
    expect(drawn(P(R('a ') + '<w:r><w:br/></w:r>' + R('b  ')), t).map((x) => x.ch).join('')).toBe('a\nb');
  });
  it('a space has no look unless it is boxed', () => {
    expect(drawn(P(R(' x')), t)[0]!.look).toBe('');
    expect(drawn(P(R('n n', '<w:rStyle w:val="Holding"/>')), t)[1]!.look).toContain('bdr=');
  });
});

describe('merging on an insertion', () => {
  it('a style the document has keeps ITS definition; one it lacks arrives', () => {
    const carried = styleTable('<w:style w:type="character" w:styleId="Anusvara"><w:rPr><w:b/></w:rPr></w:style>'
      + '<w:style w:type="character" w:styleId="Visarga"><w:rPr><w:i/><w:color w:val="0070C0"/></w:rPr></w:style>');
    const m = inserted(t, carried);
    expect(drawn(P(R('m', '<w:rStyle w:val="Anusvara"/>')), m)[0]!.look).not.toContain('b=true');
    expect(drawn(P(R('s', '<w:rStyle w:val="Visarga"/>')), m)[0]!.look).toContain('color=0070C0');
  });
});

describe('differences', () => {
  const a = drawn(P(R('tat sa')), t);
  it('none between a line and itself', () => {
    expect(differences(a, a)).toEqual([]);
  });
  it('a character lost and one added', () => {
    expect(differences(a, drawn(P(R('tat sa')), t))).toEqual(expect.arrayContaining(['added U+0020', 'lost U+00A0']));
  });
  it('the same letters in another look', () => {
    expect(differences(drawn(P(R('s', '<w:rStyle w:val="Anusvara"/>')), t), drawn(P(R('s')), t)))
      .toEqual(['look color=0070C0,i=true → ']);
  });
  it('two styles with the same look are no difference — the names may differ', () => {
    const withVisarga = inserted(t, styleTable('<w:style w:type="character" w:styleId="Visarga"><w:rPr><w:i/><w:color w:val="0070C0"/></w:rPr></w:style>'));
    expect(differences(drawn(P(R('s', '<w:rStyle w:val="Anusvara"/>')), withVisarga), drawn(P(R('s', '<w:rStyle w:val="Visarga"/>')), withVisarga))).toEqual([]);
  });
});

describe('inserted — the package’s defaults folded into what arrives, as Word does', () => {
  const doc = styleTable('<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>');
  const pkg = styleTable('<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:color w:val="000000"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:styleId="Mantra"><w:rPr><w:sz w:val="32"/></w:rPr></w:style>'
    + '<w:style w:type="character" w:styleId="Svara"><w:basedOn w:val="Mantra"/></w:style></w:styles>');
  const t = inserted(doc, pkg);
  it('an arriving root style takes the package default the document lacks', () => {
    expect(t.styles.get('Mantra')!.props).toEqual(expect.objectContaining({ color: '000000', sz: '32' }));
  });
  it('but not one the document shares, nor over what the style sets itself', () => {
    expect(t.styles.get('Mantra')!.props.sz).toBe('32');
  });
  it('and a style based on another inherits it rather than having it written in', () => {
    expect(t.styles.get('Svara')!.props.color).toBeUndefined();
  });
});

describe('asRuled — the owner’s rulings, on both sides', () => {
  it('a pause bar’s slant is not compared; everything else about it still is', () => {
    const his = [{ ch: '|', look: 'color=0070C0,i=true' }];
    const ours = [{ ch: '|', look: 'color=0070C0,i=false' }];
    expect(differences(asRuled(his), asRuled(ours))).toEqual([]);
    expect(differences(asRuled(his), asRuled([{ ch: '|', look: 'color=FF0000,i=false' }]))).not.toEqual([]);
  });
  it('and a letter’s slant still is', () => {
    expect(differences(asRuled([{ ch: 'a', look: 'i=true' }]), asRuled([{ ch: 'a', look: '' }]))).not.toEqual([]);
  });
});
