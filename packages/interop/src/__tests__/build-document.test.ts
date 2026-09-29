/**
 * THE ONE BUILDER — Word-style paragraphs into a document, for Word and PDF.
 */
import { describe, expect, it } from 'vitest';
import { buildDocument } from '../build-document.js';
import { reportFor } from '../docx-report.js';
import { wordRun, type WordParagraph } from '../docx-read.js';

const line = (text: string): WordParagraph => ({ pStyle: 'Translit', runs: [wordRun(text)] });
const para = (pStyle: string | null, text: string): WordParagraph => ({ pStyle, runs: [wordRun(text)] });
const build = (ps: WordParagraph[], title?: string) =>
  buildDocument(ps, { ...(title === undefined ? {} : { title }), fallbackTitle: 'file-name', report: reportFor('docx', 0, ps) });
const verses = (ps: WordParagraph[]) => build(ps).sections.flatMap((s) => s.verses);

describe('where a verse ends', () => {
  it('a single daṇḍa is the half-verse — the verse goes on', () => {
    expect(verses([line('agnim īḷe purohitam |'), line('hotāraṁ ratnadhātamam || 1||')])).toHaveLength(1);
  });
  it('a double daṇḍa ends it, numbered or not', () => {
    expect(verses([line('oṁ bhūr bhuvas svaḥ ||'), line('tat savitur vareṇyam ||')])).toHaveLength(2);
  });
  it('a daṇḍa with the verse number ends it', () => {
    expect(verses([line('a | 1'), line('b | 2')])).toHaveLength(2);
  });
  it('the Devanāgarī daṇḍas a PDF carries end it the same way as the ASCII bars', () => {
    expect(verses([line('agnim īḷe ।'), line('hotāram ॥ 1॥'), line('agniḥ ॥ 2॥')])).toHaveLength(2);
  });
  it('and whatever is not a verse line closes the verse', () => {
    expect(verses([line('agnim īḷe |'), para('Prijevod', 'I praise Agni'), line('hotāram |')])).toHaveLength(2);
  });
});

describe('the title', () => {
  it('is read from the file\'s own Title or Heading1', () => {
    expect(build([para('Title', 'śrī kanakadhārā stotram'), line('a ||')]).title).toBe('śrī kanakadhārā stotram');
    expect(build([para('Heading1', 'agnimīḻe sūktam'), line('a ||')]).title).toBe('agnimīḻe sūktam');
  });
  it('a title the caller gives wins over it', () => {
    expect(build([para('Title', 'own'), line('a ||')], 'given').title).toBe('given');
  });
  it('a file that names itself nowhere is called by its file name', () => {
    expect(build([line('a ||')]).title).toBe('file-name');
  });
  it('a SECOND title-styled paragraph is a part, not a new title', () => {
    const d = build([para('Title', 'one'), para('Title', 'two'), para('Heading3', 's'), line('a ||')]);
    expect(d.title).toBe('one');
    expect(d.sections[0]!.part).toBe('two');
  });
});

describe('prose before the first section', () => {
  it('is kept as the document\'s own front matter, not dropped', () => {
    const d = build([para(null, 'Close your eyes and concentrate.'), para('Heading3', 's'), line('a ||')]);
    expect(d.instructions?.map((i) => i.text.en)).toEqual(['Close your eyes and concentrate.']);
  });
  it('a document with none has none — the control', () => {
    expect(build([para('Heading3', 's'), line('a ||')]).instructions).toBeUndefined();
  });
});
