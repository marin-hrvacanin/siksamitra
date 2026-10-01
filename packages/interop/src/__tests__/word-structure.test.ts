/**
 * Three things his files showed, side by side with ours in a real Word:
 *
 *   - a line break inside a run is where it stands, not after the run's text;
 *   - a pause the rules placed is his blue, one placed by hand his red, and
 *     each comes back as what it was;
 *   - a single document names itself in Heading 2, its chants in Heading 3
 *     and their steps in Heading 4 — and no heading gains a number it did not
 *     have.
 *
 * Every expectation is written out by hand.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantToken } from '@siksamitra/format';
import { toTextAndMarks, toTokens } from '@siksamitra/format';
import { mark as derive } from '@siksamitra/engine';
import { readParagraphs } from '../docx-read.js';
import { tokensFromRuns } from '../docx-runs.js';
import { buildDocument } from '../build-document.js';
import { reportFor } from '../docx-report.js';
import { documentXml } from '../word/body.js';
import { blank } from './runs-helpers.js';

const p = (style: string | null, inner: string): string =>
  `<w:p>${style === null ? '' : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`}${inner}</w:p>`;
const r = (text: string, style?: string): string =>
  `<w:r>${style === undefined ? '' : `<w:rPr><w:rStyle w:val="${style}"/></w:rPr>`}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const build = (xml: string): ChantDoc => {
  const paragraphs = readParagraphs(`<w:body>${xml}</w:body>`);
  return buildDocument(paragraphs, { fallbackTitle: 'file', report: reportFor('docx', 0, paragraphs) });
};

describe('a break inside a run', () => {
  it('is read where it stands', () => {
    const [para] = readParagraphs(p('Translit', '<w:r><w:t xml:space="preserve">vidmahe | </w:t><w:br/><w:t>satya</w:t></w:r>'));
    expect(para!.runs[0]!.text).toBe('vidmahe | \nsatya');
  });
  it('and so is a tab, as a tab, and a carriage return', () => {
    /* A tab read as a space wrote the indent he puts before a pāda back as
       one — one character either way, as Word counts it. */
    const [para] = readParagraphs(p(null, '<w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:cr/><w:t>c</w:t></w:r>'));
    expect(para!.runs[0]!.text).toBe('a\tb\nc');
  });
});

describe('a pause: its colour is its length, one bar each — as his files write it', () => {
  const pauses = (tokens: ChantToken[]) => tokens.filter((t) => t.t === 'pause');
  const line = (style: string, bar = ' | ') => tokensFromRuns([
    { text: 'oṁ', rStyle: null, superscript: false }, { text: bar, rStyle: style, superscript: false },
    { text: 'agnim', rStyle: null, superscript: false }], blank(), 'x');

  /* His Devī Māhātmyam: 815 single bars in his blue `Anusvara`, 119 in his red
     `Pause`; his sādhanās add twelve `||` in red. The owner, 2026-10-01: "short
     is blue line and long is red. Both single." */
  it('one bar in his blue is a SHORT pause', () => {
    expect(pauses(line('Anusvara'))).toEqual([{ t: 'pause', len: 'short' }]);
  });
  it('one bar in his red Pause is a LONG pause', () => {
    expect(pauses(line('Pause'))).toEqual([{ t: 'pause', len: 'long' }]);
  });
  it('and the twelve `||` of his sādhanās are long pauses too', () => {
    expect(pauses(line('Pause', ' || '))).toEqual([{ t: 'pause', len: 'long' }]);
  });

  it('is written back as ONE bar, upright, in the colour of its length', () => {
    const doc = (tokens: ChantToken[]): ChantDoc => ({ title: '', titleForms: {}, sections: [{ id: 's', verses: [{ id: 'v', tokens }] }] });
    const upright = '<w:i w:val="0"/><w:iCs w:val="0"/></w:rPr><w:t xml:space="preserve">|</w:t>';
    expect(documentXml(doc([{ t: 'pause', len: 'short' }]))).toContain(`<w:rStyle w:val="Anusvara"/>${upright}`);
    expect(documentXml(doc([{ t: 'pause', len: 'long' }]))).toContain(`<w:rStyle w:val="Pause"/>${upright}`);
    expect(documentXml(doc([{ t: 'pause', len: 'long' }]))).not.toContain('||');
  });

  it('keeps who placed it from the markings to the tokens and back', () => {
    const tm = toTextAndMarks({ id: 'v', tokens: derive('oṁ agnim īḻe') });
    const withRule = { text: tm.text, marks: tm.marks.map((m) => (m.k === 'pause' ? { ...m, by: 'rule' as const } : m)) };
    const tokens = toTokens(withRule, { spell: (s) => ({ deva: s } as never), split: (s) => [...s] });
    expect(pauses(tokens).every((t) => t.t === 'pause' && t.rule === true)).toBe(true);
  });
});

describe('the headings of a single document', () => {
  const xml = [
    p('Heading2', r('॥ śivopāsana mantrāḥ ॥')),
    p('Heading3', r('taittirīya-āraṇyaka 10.16')),
    p('Translit', r('oṁ namaḥ śivāya ॥ 1॥')),
    p('Heading4', r("prathamo'nuvākaḥ")),
    p('Translit', r('namaste rudra ॥ 2॥')),
  ].join('');

  it('names the document in its one Heading 2, and keeps each chant as the part of its steps', () => {
    const doc = build(xml);
    expect(doc.title).toBe('॥ śivopāsana mantrāḥ ॥');
    expect(doc.sections.map((s) => [s.part ?? null, s.title ?? null])).toEqual([
      ['taittirīya-āraṇyaka 10.16', ''], ['taittirīya-āraṇyaka 10.16', "prathamo'nuvākaḥ"],
    ]);
  });

  it('gives no heading a number it did not have', () => {
    expect(build(xml).sections.map((s) => s.n)).toEqual([undefined, undefined]);
  });

  it('is written out as it was read: Heading 2, 3 and 4 in the same places', () => {
    const out = documentXml(build(xml));
    const heads = readParagraphs(out).filter((q) => /^Heading/.test(q.pStyle ?? ''))
      .map((q) => [q.pStyle, q.runs.map((x) => x.text).join('')]);
    expect(heads).toEqual([
      ['Heading2', '॥ śivopāsana mantrāḥ ॥'], ['Heading3', 'taittirīya-āraṇyaka 10.16'], ['Heading4', "prathamo'nuvākaḥ"],
    ]);
  });
});

describe('the headings of a book', () => {
  it('keep its Heading 2 as its parts, under a title of its own', () => {
    const doc = build([
      p('Title', r('sādhanā')),
      p('Heading2', r('॥ prastāvanā ॥')), p('Heading3', r('gaṇapati dhyānam')), p('Translit', r('śuklāmbaradharam ॥')),
      p('Heading2', r('॥ śrī rudram ॥')), p('Heading3', r('camakam')), p('Translit', r('agnāviṣṇū ॥')),
    ].join(''));
    expect(doc.title).toBe('sādhanā');
    expect(doc.sections.map((s) => [s.part, s.title])).toEqual([['॥ prastāvanā ॥', 'gaṇapati dhyānam'], ['॥ śrī rudram ॥', 'camakam']]);
  });
});

describe('a candrabindu on a letter that is not m', () => {
  const doc = (text: string): ChantDoc => ({ title: '', titleForms: {}, sections: [{ id: 's', verses: [{ id: 'v', tokens: toTokens({ text, marks: [] }, { spell: (x) => ({ deva: x } as never), split: (x) => [...x] }) }] }] });
  const shown = (xml: string): string => readParagraphs(xml).filter((q) => q.pStyle === 'Translit').map((q) => q.runs.map((x) => x.text).join('')).join('');

  it('stays on its letter in Word, and adds no m', () => {
    expect(shown(documentXml(doc('o̐n')))).toBe('o̐n');
    expect(shown(documentXml(doc('sam̐hitā')))).toBe('sam̐hitā');
  });
});


describe('a source line', () => {
  const doc: ChantDoc = {
    title: 'd', titleForms: {},
    sections: [{ id: 's', title: 'x', source: 'RV 3.62.10', verses: [
      { id: 'a', tokens: derive('tat savitur vareṇyam'), source: 'gāyatrī chandaḥ' },
      { id: 'b', tokens: derive('bhargo devasya dhīmahi'), source: 'śivopāsana mantrāḥ' },
    ] }],
  };

  it('is written above what it names, as in his files', () => {
    const lines = readParagraphs(documentXml(doc)).map((q) => q.runs.map((x) => x.text).join('').slice(0, 12));
    expect(lines.slice(0, 7)).toEqual(['d', 'x', 'RV 3.62.10', 'gāyatrī chan', 'tat savitur ', 'śivopāsana m', 'bhargo devas']);
  });

  it('and comes back as the source of that same verse, and the section’s', () => {
    const back = build(documentXml(doc).replace(/^[\s\S]*<w:body>|<\/w:body>[\s\S]*$/g, ''));
    const s = back.sections[0]!;
    expect(s.source).toBe('RV 3.62.10');
    expect(s.verses.map((v) => v.source)).toEqual(['gāyatrī chandaḥ', 'śivopāsana mantrāḥ']);
  });
});
