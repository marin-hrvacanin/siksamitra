/**
 * A DOCUMENT OF THE APP, BROUGHT INTO WORD — "marked exactly as it is in the
 * app", over the whole corpus.
 *
 * Each document is packed as the app saves it (`.smdoc`), opened by the one
 * reader the app and the add-in share (`openDocumentFile`), written by the
 * add-in's insert path (`documentBody`), and read back by the add-in's own
 * reader. The expectation is the document's own verses, as the app holds
 * them — a different path from the one under test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { openChantDoc } from '@siksamitra/engine';
import { toTextAndMarks, type ChantDoc, type TextAndMarks } from '@siksamitra/format';
import { mergeRuns, openDocumentFile, packDocument, partOf, readParagraphs } from '@siksamitra/interop';
import { decodeRuns, isVerseParagraph } from '../../apps/word-addin/src/model/paragraph.js';
import { documentBody } from '../../apps/word-addin/src/model/document-body.js';

const DIR = join(process.cwd(), 'corpus', 'chants');
const load = (f: string): ChantDoc => openChantDoc(JSON.parse(readFileSync(join(DIR, f), 'utf8')) as ChantDoc);
/*
 * Letters and markings, less three things Word cannot hold and a reader does
 * not invent: which letters are a fill-in SLOT (the deity's name — its
 * letters DO come in; the slot is a thing of the app), which characters are
 * PLAIN (the brackets of `(parameśvara)`, not recited either way), and
 * whitespace BEFORE A PARAGRAPH's first letter, which the reader drops on
 * purpose (one verse of the Puruṣa Sūktam begins with a space).
 */
const bare = (tm: TextAndMarks) => {
  const lead = tm.text.length - tm.text.trimStart().length;
  return JSON.stringify([tm.text.slice(lead), tm.marks.filter((m) => !['syl', 'plain', 'slot'].includes(m.k))
    .map(({ by: _b, stage: _s, ...m }) => JSON.stringify({ ...m, from: m.from - lead, to: m.to - lead })).sort()]);
};
const versesOf = (doc: ChantDoc) => doc.sections.flatMap((s) => s.verses);

describe('every corpus document, brought into Word', () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    it(`${file}: every verse, letters and marks, as the app has it`, async () => {
      const doc = load(file);
      const bytes = await packDocument(doc, { slug: 'x.smdoc', engine: 'test' });
      const { doc: opened } = await openDocumentFile(bytes, `${file}.smdoc`);
      const { body, verses } = documentBody(opened);
      const lines = readParagraphs(body).filter(isVerseParagraph).map((p) => bare(decodeRuns(mergeRuns(p.runs))));
      const want = versesOf(doc).map((v) => bare(toTextAndMarks(v)));
      expect(verses).toBe(want.length);
      expect(lines).toEqual(want);
    });
  }
});

describe('a section of another śākhā comes in as a part', () => {
  it('its paragraphs are one part, in its register; the rest are in none', async () => {
    const doc = load('sri-rudram.json');
    const two: ChantDoc = { ...doc, sections: doc.sections.map((s, i) => (i === 1 ? { ...s, profile: { ...(s.profile ?? {}), preset: 'rigveda' } } : s)) };
    const bytes = await packDocument(two, { slug: 'x.smdoc', engine: 'test' });
    const { body } = documentBody((await openDocumentFile(bytes, 'x.smdoc')).doc);
    const paras = readParagraphs(body).filter(isVerseParagraph);
    const registers = new Set(paras.map((p) => partOf(p.sdt)?.register ?? null));
    expect(registers).toEqual(new Set([null, 'rigveda']));
    expect(paras.filter((p) => partOf(p.sdt)?.register === 'rigveda').length).toBe(two.sections[1]!.verses.length);
  });
});

describe('a fill-in slot is written as its letters', () => {
  it('the Pūjā Vidhi’s deity, on the page — in Word and in the app’s Export Word, one writer', () => {
    const { body } = documentBody(load('puja-vidhi.json'));
    const text = readParagraphs(body).map((p) => p.runs.map((r) => r.text).join('')).join(String.fromCharCode(10));
    expect(text).toContain('śrī devan dhyāyāmi');
    expect(text).not.toContain('śrī  dhyāyāmi');
  });
});

describe('what cannot come in is said', () => {
  it('a picture is counted, and marked where it goes', async () => {
    const doc = load('puja-vidhi.json');
    const { body, pictures } = documentBody(doc);
    expect(pictures).toBeGreaterThan(0);
    expect(body).toMatch(/w:val="Comment"/);
  });
  it('a file of another kind is refused, naming what is read', async () => {
    await expect(openDocumentFile(new Uint8Array([1, 2, 3]), 'notes.txt')).rejects.toThrow(/\.smdoc, \.vuchant, \.docx, \.html/);
  });
});
