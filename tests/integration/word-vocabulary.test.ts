/**
 * HIS STYLE NAMES, OR CLEAN ONES — and the visarga change told from the
 * anusvāra's.
 *
 * The ruling: a document that already has his names keeps them; one that does
 * not gets clean English-with-IAST ones. Whichever a file carries, it reads the
 * same.
 */
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import {
  canonicalStyleId, exportWord, importDocx, inVocabulary, readParagraphs, vocabularyOf,
} from '@siksamitra/interop';
import { openChantDoc } from '@siksamitra/engine';
import { EXPORT_STYLES } from '@siksamitra/tokens/export-styles';
import type { ChantDoc, ChantToken } from '@siksamitra/format';

const style = EXPORT_STYLES.find((s) => s.id === 'veda-union')!;
const doc = (): ChantDoc =>
  openChantDoc(JSON.parse(readFileSync('corpus/chants/durga-suktam.json', 'utf8')) as never);
const exported = (vocabulary?: 'legacy' | 'clean') => exportWord({
  doc: doc(), style, textStack: 'serif', uiStack: 'sans-serif',
  engine: 'test', slug: 'v.docx', script: 'iast', ...(vocabulary === undefined ? {} : { vocabulary }),
});
const part = (bytes: Uint8Array, name: string): string => strFromU8(unzipSync(bytes)[name]!);

describe('which vocabulary a document speaks', () => {
  it('an empty document: clean', () => expect(vocabularyOf('')).toBe('clean'));
  it('his `Translit` defined: legacy', () => {
    expect(vocabularyOf('<w:style w:type="paragraph" w:styleId="Translit">')).toBe('legacy');
  });
  it('his `2Holding` merely USED in the body: legacy', () => {
    expect(vocabularyOf('<w:r><w:rPr><w:rStyle w:val="2Holding"/></w:rPr></w:r>')).toBe('legacy');
  });
  it('both at once: legacy — his styles win', () => {
    expect(vocabularyOf('<w:pStyle w:val="Mantra"/><w:rStyle w:val="Holding"/>')).toBe('legacy');
  });
  it('clean ids only: clean', () => {
    expect(vocabularyOf('<w:pStyle w:val="Mantra"/><w:rStyle w:val="HoldingShort"/>')).toBe('clean');
  });
  it('a style named the same in both (`Svara`) decides nothing', () => {
    expect(vocabularyOf('<w:rStyle w:val="Svara"/>')).toBe('clean');
  });
});

describe('writing in the clean vocabulary', () => {
  const sheet = '<w:style w:type="character" w:customStyle="1" w:styleId="2Holding">'
    + '<w:name w:val="2Holding"/><w:basedOn w:val="Holding"/></w:style>'
    + '<w:style w:type="character" w:styleId="Virama"><w:name w:val="Virama"/></w:style>';
  const clean = inVocabulary(sheet, 'clean');
  it('renames the id, the name, and what it is based on', () => {
    expect(clean).toContain('w:styleId="HoldingLong"');
    expect(clean).toContain('<w:name w:val="Holding · Long"/>');
    expect(clean).toContain('<w:basedOn w:val="HoldingShort"/>');
  });
  it('a style whose id is the same still shows its IAST name', () => {
    expect(clean).toContain('<w:name w:val="Virāma"/>');
  });
  it('legacy is the identity', () => expect(inVocabulary(sheet, 'legacy')).toBe(sheet));
  it('once is enough — writing it again changes nothing', () => {
    expect(inVocabulary(clean, 'clean')).toBe(clean);
  });
  it('an id of neither vocabulary is left alone', () => {
    const x = '<w:pStyle w:val="Heading3"/><w:rStyle w:val="MyOwn"/>';
    expect(inVocabulary(x, 'clean')).toBe(x);
  });
});

describe('reading either back', () => {
  it('a clean id reads as his', () => {
    expect(canonicalStyleId('Mantra', undefined)).toBe('Translit');
    expect(canonicalStyleId('HoldingLong', undefined)).toBe('2Holding');
    expect(canonicalStyleId('Overline', undefined)).toBe('Long');
  });
  it('runs too, not only paragraphs', () => {
    const [p] = readParagraphs('<w:p><w:pPr><w:pStyle w:val="Mantra"/></w:pPr>'
      + '<w:r><w:rPr><w:rStyle w:val="HoldingShort"/></w:rPr><w:t>g</w:t></w:r></w:p>');
    expect(p).toMatchObject({ pStyle: 'Translit', runs: [{ rStyle: 'Holding', text: 'g' }] });
  });
});

describe('the exporter', () => {
  it('writes clean names by default — a new file has no legacy to keep', async () => {
    const bytes = await exported();
    expect(part(bytes, 'word/styles.xml')).toContain('w:styleId="Mantra"');
    expect(part(bytes, 'word/styles.xml')).not.toContain('w:styleId="Translit"');
    expect(part(bytes, 'word/document.xml')).not.toContain('w:val="Translit"');
  });
  it('his names when asked', async () => {
    expect(part(await exported('legacy'), 'word/styles.xml')).toContain('w:styleId="Translit"');
  });
  it('the two files read back to the same document', async () => {
    const syl = (d: ChantDoc) => d.sections.flatMap((s) => s.verses).flatMap((v) => v.tokens)
      .filter((t): t is Extract<ChantToken, { t: 'syl' }> => t.t === 'syl');
    const a = importDocx(await exported('clean')).doc;
    const b = importDocx(await exported('legacy')).doc;
    expect(JSON.stringify(syl(a))).toBe(JSON.stringify(syl(b)));
    expect(syl(a).some((s) => s.units.some((u) => u.hold !== undefined))).toBe(true);
  });
});

describe('the visarga change has a style of its own', () => {
  const marked = (): ChantDoc => ({
    title: 't', version: 3,
    sections: [{
      id: 's', title: 's', verses: [{
        id: 'v', n: '1', tokens: [
          { t: 'syl', iast: 'naś', deva: '', units: [{ c: 'n' }, { c: 'a' }, { c: 'ś', change: true }] },
          { t: 'sp' },
          { t: 'syl', iast: 'tan', deva: '', units: [{ c: 't' }, { c: 'a' }, { c: 'n', change: true }] },
        ] as never,
      }],
    }],
  });
  const body = async () => part(await exportWord({
    doc: marked(), style, textStack: 'serif', uiStack: 'sans-serif',
    engine: 'test', slug: 'v.docx', script: 'iast',
  }), 'word/document.xml');
  it('ś, a replaced visarga, is written `Visarga`', async () => {
    expect(await body()).toMatch(/<w:rStyle w:val="Visarga"\/>[\s\S]*?<w:t[^>]*>ś</);
  });
  it('n, a replaced anusvāra, stays `Anusvara` — the control', async () => {
    expect(await body()).toMatch(/<w:rStyle w:val="Anusvara"\/>[\s\S]*?<w:t[^>]*>n</);
  });
  it('and both read back as a change', async () => {
    const d = importDocx(await exportWord({
      doc: marked(), style, textStack: 'serif', uiStack: 'sans-serif',
      engine: 'test', slug: 'v.docx', script: 'iast',
    })).doc;
    const changed = d.sections[0]!.verses[0]!.tokens.flatMap((t) => (t.t === 'syl' ? t.units : []))
      .filter((u) => u.change === true).map((u) => u.c);
    expect(changed).toEqual(['ś', 'n']);
  });
});
