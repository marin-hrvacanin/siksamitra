/**
 * THE PACKAGE WORD IS HANDED, AND THE ONE IT HANDS BACK.
 *
 * NOT TAUTOLOGICAL: the package built here is torn down again by
 * `readParagraphs` — `packages/interop/src/docx.ts`'s OOXML reader, which knows
 * nothing about flat OPC and nothing about this add-in — and the runs it finds
 * must be the runs that went in. The reader is the same one that reads the
 * owner's own `.docx`, so a package it cannot read is a package Word could not
 * have written.
 *
 * The extraction case uses a package shaped like the one `getOoxml` actually
 * returns: the document part is not first, and it is surrounded by parts we
 * have no use for.
 */
import { describe, expect, it } from 'vitest';
import { mark } from '@siksamitra/format';
import { mergeRuns, readParagraphs } from '@siksamitra/interop';
import { documentPartOf, flatPackage, textParagraph } from '../opc.js';
import { decodeRuns, paragraphsXml, unresolvedIn } from '../paragraph.js';

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  + '<w:style w:type="character" w:customStyle="1" w:styleId="Holding">'
  + '<w:name w:val="Holding"/><w:rPr><w:bdr w:val="single" w:sz="2" w:space="0"'
  + ' w:color="538135"/></w:rPr></w:style></w:styles>';

const marked = { text: 'agne tvam', marks: [mark({ k: 'hold', from: 0, to: 4, v: 'short' })] };

describe('the package handed to insertOoxml', () => {
  const pkg = flatPackage(paragraphsXml(marked), STYLES);

  it('declares exactly the four parts it contains, and no others', () => {
    const named = [...pkg.matchAll(/pkg:name="([^"]+)"/g)].map((m) => m[1]);
    expect(named).toEqual([
      '/_rels/.rels',
      '/word/_rels/document.xml.rels',
      '/word/document.xml',
      '/word/styles.xml',
    ]);
    /* Every relationship must have its part and every part its relationship;
       a target with no part is an error Word reports as a broken package. */
    const targets = [...pkg.matchAll(/Target="([^"]+)"/g)].map((m) => m[1]);
    expect(targets).toEqual(['word/document.xml', 'styles.xml']);
  });

  it('carries the style definition, so the box is drawn in a blank document', () => {
    expect(pkg).toContain('w:styleId="Holding"');
    expect(pkg).toContain('w:bdr w:val="single" w:sz="2"');
  });

  it('has exactly one XML declaration — the package’s own', () => {
    expect(pkg.match(/<\?xml/g)).toHaveLength(1);
  });

  it('gives the reader back the runs that went in', () => {
    const paragraphs = readParagraphs(documentPartOf(pkg));
    expect(paragraphs).toHaveLength(1);
    /* Merged first: the exporter writes one run per letter for unstyled text
       and Word does the same, so the reader's job is to join them again. */
    const runs = mergeRuns(paragraphs[0]?.runs ?? []);
    expect(runs.map((r) => r.rStyle)).toEqual(['Holding', null]);
    const holds = decodeRuns(runs).marks.filter((m) => m.k === 'hold');
    expect(holds).toEqual([
      expect.objectContaining({ k: 'hold', from: 0, to: 4, v: 'short' }),
    ]);
  });
});

describe('the package Word hands back', () => {
  /* `getOoxml` returns whatever the range dragged in with it — the theme, the
     font table, the numbering, the settings — and the document part is not
     first. Matching by position rather than by name found `theme1.xml`. */
  const returned = '<?xml version="1.0" standalone="yes"?>'
    + '<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">'
    + '<pkg:part pkg:name="/word/theme/theme1.xml" pkg:contentType="x">'
    + '<pkg:xmlData><a:theme/></pkg:xmlData></pkg:part>'
    + '<pkg:part pkg:name="/word/document.xml" pkg:contentType="y">'
    + '<pkg:xmlData><w:document xmlns:w="w"><w:body>'
    + '<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr>'
    + '<w:r><w:rPr><w:rStyle w:val="2Holding"/></w:rPr><w:t>ag</w:t></w:r>'
    + '</w:p></w:body></w:document></pkg:xmlData></pkg:part>'
    + '<pkg:part pkg:name="/word/settings.xml" pkg:contentType="z">'
    + '<pkg:xmlData><w:settings/></pkg:xmlData></pkg:part>'
    + '</pkg:package>';

  it('finds the document part by name, not by position', () => {
    const xml = documentPartOf(returned);
    expect(xml.startsWith('<w:document')).toBe(true);
    expect(xml).not.toContain('a:theme');
    expect(xml).not.toContain('w:settings');
  });

  it('reads back through the ordinary OOXML reader', () => {
    const [p] = readParagraphs(documentPartOf(returned));
    expect(p?.pStyle).toBe('Translit');
    expect(p?.runs).toEqual([{ text: 'ag', rStyle: '2Holding', superscript: false }]);
  });

  it('says so when there is no document part', () => {
    expect(() => documentPartOf('<pkg:package/>')).toThrow(/no \/word\/document\.xml/);
  });
});

describe('a plain paragraph', () => {
  it('escapes what would otherwise close a tag', () => {
    expect(textParagraph('Heading3', 'a < b & c')).toContain('a &lt; b &amp; c');
  });

  it('names its style', () => {
    expect(textParagraph('Heading3', 'x')).toContain('<w:pStyle w:val="Heading3"/>');
    expect(textParagraph(null, 'x')).not.toContain('w:pStyle');
  });
});

describe('what the reader could not place', () => {
  const run = (text: string, rStyle: string | null) => ({ text, rStyle, superscript: false });

  /*
   * The importer reports three different things under one name and only one of
   * them costs anything. Getting this wrong the first way round locked the
   * add-in out of most of Śrī Rudram: 387 of the corpus's 4 788 boxes cover two
   * letters, and every one of them is reported.
   */
  it('does not call a two-letter holding a loss', () => {
    const found = unresolvedIn([{ pStyle: 'Translit', runs: [run('bha', 'Holding')] }]);
    expect(found).toHaveLength(1);
    expect(found[0]?.lossy).toBe(false);
  });

  it('calls an inline comment a loss, because its letters leave the text', () => {
    const found = unresolvedIn([{
      pStyle: 'Translit',
      runs: [run('agne ', null), run('(Taittirīya 1.1)', 'Comment')],
    }]);
    expect(found.filter((u) => u.lossy).map((u) => u.raw)).toEqual(['(Taittirīya 1.1)']);
  });

  it('does not call an unplaced style a loss when its letters stay', () => {
    /* `Long` has no home in the format yet, so the style is dropped and the
       letters are kept — reportable, not refusable. */
    const found = unresolvedIn([{ pStyle: 'Translit', runs: [run('agne', 'Long')] }]);
    expect(found).toHaveLength(1);
    expect(found[0]?.lossy).toBe(false);
  });

  it('finds nothing to report in an ordinary marked line', () => {
    expect(unresolvedIn([{
      pStyle: 'Translit',
      runs: [run('a', 'Holding'), run('gne', null)],
    }])).toEqual([]);
  });
});
