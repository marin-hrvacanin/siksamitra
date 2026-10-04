/**
 * A MARKED PDF PAGE as Word-style paragraphs — so it is read by the same
 * builder and run reader as a `.docx`, and cannot be read another way.
 */
import { describe, expect, it } from 'vitest';
import type { ChantToken } from '@siksamitra/format';
import { importPdfRows, paragraphsOfRows, runsOf, type PdfEvent, type PdfRow } from '../pdf/page-rows.js';
import { buildDocument } from '../build-document.js';
import { reportFor } from '../docx-report.js';
import { documentXml } from '../word/body.js';

const text = (t: string, hold: 'short' | 'long' | null = null, change = false): PdfEvent =>
  ({ kind: 'text', text: t, hold, change });
const row = (cls: PdfRow['cls'], ...events: PdfEvent[]): PdfRow => ({ page: 0, baseline: 0, cls, events });

describe('each event, as the run his Word file would have had', () => {
  it('a box is his Holding or 2Holding; blue is Anusvara; both, the combined style', () => {
    expect(runsOf([text('g', 'short'), text('k', 'long'), text('n', null, true), text('ñ', 'short', true)])
      .map((r) => r.rStyle)).toEqual(['Holding', '2Holding', 'Anusvara', 'HoldingChange']);
  });
  it('an accent is Svara; the Ṛgvedic overline is Long', () => {
    expect(runsOf([{ kind: 'svara', mark: '̍' }, { kind: 'svara', mark: '̅' }])
      .map((r) => r.rStyle)).toEqual(['Svara', 'Long']);
  });
  it('a raised letter is a superscript; a pause is one bar or two; a margin note a Comment', () => {
    const r = runsOf([{ kind: 'sup', text: 'u' }, { kind: 'pause', len: 'long' }, { kind: 'ann', text: 'note' }]);
    expect(r[0]).toMatchObject({ text: 'u', superscript: true });
    expect(r[1]).toMatchObject({ text: '||', rStyle: 'Pause' });
    expect(r[2]).toMatchObject({ text: 'note', rStyle: 'Comment' });
  });
  it('a svarabhakti dot given as text is in the accent style, even after a svara — śīr̍·ṣan', () => {
    expect(runsOf([text(' śīr'), { kind: 'svara', mark: '̍' }, text('·'), text('r·ṣa')])
      .map((r) => [r.text, r.rStyle ?? null])).toEqual([
      [' śīr', null], ['̍', 'Svara'], ['·', 'Svara'], ['r', null], ['·', 'Svara'], ['ṣa', null]]);
  });
  it('the candrabindu glyph after an m is the candrabindu on it', () => {
    expect(runsOf([text('gm'), { kind: 'candra' }])[1]).toMatchObject({ text: '̐' });
  });
  it('after a VOWEL it is the Ṛgvedic anunāsika m̐, a replaced letter — devām̐ eha', () => {
    expect(runsOf([text('devā'), { kind: 'candra' }])[1]).toMatchObject({ text: 'm̐', rStyle: 'Anusvara' });
  });
});

describe('each row, as the paragraph it is', () => {
  it('the first title is the title, a later one a part; a subtitle a section', () => {
    const p = paragraphsOfRows([row('title', text('A')), row('title', text('B')), row('subtitle', text('C'))]);
    expect(p.map((x) => x.pStyle)).toEqual(['Title', 'Heading2', 'Heading3']);
  });
  it('a shloka row is a mantra line; a small row the translation', () => {
    expect(paragraphsOfRows([row('shloka', text('agnim')), row('small', text('I praise'))]).map((x) => x.pStyle))
      .toEqual(['Translit', 'Prijevod']);
  });
  it('the header and the table of contents are not content', () => {
    expect(paragraphsOfRows([row('body', text('agnimīḻe ..... 1')), row('body', text('file: x.pdf'))])).toEqual([]);
  });
  it('other body text is ordinary prose — the control', () => {
    expect(paragraphsOfRows([row('body', text('About Veda Union'))])[0]!.pStyle).toBeNull();
  });
});

describe('a page into a document, through the one builder', () => {
  const syl = (d: ReturnType<typeof importPdfRows>['doc']) => d.sections.flatMap((s) => s.verses)
    .flatMap((v) => v.tokens).filter((t): t is Extract<ChantToken, { t: 'syl' }> => t.t === 'syl').map((t) => t.iast);
  const page = [
    row('title', text('agnimīḻe sūktam')),
    row('shloka', text('agnimī-ḻe pu'), text('ro'), text('hi'), { kind: 'svara', mark: '̅' },
      { kind: 'svara', mark: '̍' }, text('taṁ ।')),
    row('shloka', text('hotāraṁ ॥ 1॥')),
    row('small', text('I praise Agni')),
  ];
  const { doc } = importPdfRows(page, { fallbackTitle: 'f', bytes: 0 });
  it('the title is the page\'s own', () => expect(doc.title).toBe('agnimīḻe sūktam'));
  it('the hyphen closes the syllable before it', () => expect(syl(doc)).toContain('mī-'));
  it('the overline rides on its vowel, one syllable, not two', () => expect(syl(doc)).toContain('hi̅'));
  it('the two lines are one verse, with its translation', () => {
    const vs = doc.sections.flatMap((s) => s.verses);
    expect(vs).toHaveLength(1);
    expect(vs[0]!.translation?.en).toBe('I praise Agni');
  });
});

describe('a translation after an empty line, as his sādhanā\'s puruṣa sūktam has it', () => {
  const page = [row('title', text('t')), row('shloka', text('adbhyaḥ sambhūtaḥ ॥ 1॥')), row('small', text('From the essence of water'))];
  const { paragraphs } = importPdfRows(page, { fallbackTitle: 'f', bytes: 0 });
  const withGap = [...paragraphs.slice(0, 2), { pStyle: 'Insert', runs: [] }, ...paragraphs.slice(2)];
  const doc = buildDocument(withGap, { fallbackTitle: 'f', report: reportFor('docx', 0, withGap) });
  const ins = doc.sections.flatMap((s) => s.items ?? []).find((x) => x.t === 'instruction');
  it('is kept in his translation face, not as a plain direction', () => {
    expect(ins).toMatchObject({ instruction: { kind: 'note', comment: 'translation', text: { en: 'From the essence of water' } } });
  });
  it('and is written back as a Translation paragraph', () => {
    const xml = documentXml(doc);
    expect(xml).toMatch(/<w:pStyle w:val="Insert"\/><\/w:pPr><\/w:p><w:p><w:pPr><w:pStyle w:val="(?:Prijevod|Translation)"\/><\/w:pPr><w:r><w:t xml:space="preserve">From the essence of water/u);
  });
});
