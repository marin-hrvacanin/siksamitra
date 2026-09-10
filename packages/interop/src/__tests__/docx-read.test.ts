/**
 * READING PARAGRAPHS OUT OF `word/document.xml` — and the empty one.
 *
 * THE FAULT, measured against the owner's own file and against a real Word.
 * `RE_PARA` had the paired form first — `<w:p\b[^>]*>([\s\S]*?)<\/w:p>` — and
 * `[^>]*` happily eats the `/` in a self-closing tag. So
 * `<w:p w14:paraId="22B0"/>` matched the OPEN alternative, and `[\s\S]*?`
 * then ran on to the next `</w:p>` and swallowed the paragraph AFTER it as
 * well. Two paragraphs read as one, and the second one's style and runs
 * reported under the first's position.
 *
 * WHAT IT COST. 27 of the 872 paragraphs in
 * `tools/chant/fixtures-sadhana.docx` are empty and self-closing, so this
 * reader answered 846 where Word answered 872. The Word add-in's
 * whole-document re-mark addresses paragraphs BY INDEX from one read and
 * writes them through another — Word's — so from the first empty paragraph
 * onwards every index was off by one more, and a re-mark would have written
 * mantra text into the wrong lines of his document.
 *
 * `tools/word-live.mjs` now compares the two counts against a real Word, and
 * `writeDocument` refuses to write at all when they disagree. This is the
 * arithmetic underneath both.
 */
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { mergeRuns, readParagraphs } from '../docx-read.js';

/** A paragraph tag as Word writes it — the attributes are the point. */
const OPEN = '<w:p w14:paraId="71BBD2BB" w14:textId="34E7DFC0" w:rsidR="00FB5649">';
const SELF = '<w:p w14:paraId="22B07F5C" w14:textId="77777777" w:rsidR="005C1610"/>';
const run = (text: string, style?: string) =>
  `<w:r>${style === undefined ? '' : `<w:rPr><w:rStyle w:val="${style}"/></w:rPr>`}`
  + `<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (style: string, text: string) =>
  `${OPEN}<w:pPr><w:pStyle w:val="${style}"/></w:pPr>${run(text)}</w:p>`;

describe('an empty paragraph is a paragraph', () => {
  it('a self-closing tag WITH ATTRIBUTES is one, and does not eat the next', () => {
    /*
     * THE EXACT SHAPE THAT BROKE IT. A bare `<w:p/>` was handled; Word never
     * writes a bare one — every paragraph carries `w14:paraId`.
     */
    const xml = `<w:body>${para('Translit', 'agnim')}${SELF}${para('Translit', 'īḷe')}</w:body>`;
    const read = readParagraphs(xml);
    expect(read).toHaveLength(3);
    expect(read[1]?.empty).toBe(true);
    expect(read[1]?.runs).toHaveLength(0);
    /* And the paragraph after it is still its own, with its own text. */
    expect(mergeRuns(read[2]?.runs ?? []).map((r) => r.text).join('')).toBe('īḷe');
    expect(read[2]?.pStyle).toBe('Translit');
  });

  it('a bare self-closing tag too', () => {
    const xml = `<w:body>${para('Translit', 'a')}<w:p/>${para('Translit', 'b')}</w:body>`;
    expect(readParagraphs(xml)).toHaveLength(3);
  });

  it('several in a row are several paragraphs', () => {
    const xml = `<w:body>${SELF}${SELF}${SELF}${para('Normal', 'x')}</w:body>`;
    const read = readParagraphs(xml);
    expect(read).toHaveLength(4);
    expect(read.filter((p) => p.empty === true)).toHaveLength(3);
  });

  it('one at the very end counts', () => {
    expect(readParagraphs(`<w:body>${para('Normal', 'x')}${SELF}</w:body>`)).toHaveLength(2);
  });

  it('and the count is the number of opening tags — the control', () => {
    /*
     * The measurement that names the bug: every `<w:p` in the body is a
     * paragraph, whether it closes with `</w:p>` or with `/>`. Counting them
     * independently of the reader is what makes this an expectation rather
     * than the reader agreeing with itself.
     */
    const xml = `<w:body>${para('A', '1')}${SELF}${para('B', '2')}${SELF}${SELF}</w:body>`;
    const opens = [...xml.matchAll(/<w:p(?=[\s>])|<w:p\//g)].length;
    expect(readParagraphs(xml)).toHaveLength(opens);
    expect(opens).toBe(5);
  });
});

describe('his own document', () => {
  const FILE = 'tools/chant/fixtures-sadhana.docx';
  const zip = unzipSync(new Uint8Array(readFileSync(FILE)));
  const xml = strFromU8(zip['word/document.xml']!);

  it('has 872 paragraphs, which is what Word says it has', () => {
    /*
     * 872 IS WORD'S OWN ANSWER, read over COM by `tools/word-live.mjs`:
     * `doc.Paragraphs.Count`. It is written here as a number because that gate
     * needs Word installed and this tier does not — and because the number is
     * the whole point. This reader used to answer 846.
     */
    expect(readParagraphs(xml)).toHaveLength(872);
  });

  it('and 27 of them are empty and self-closing', () => {
    /* The reason the two counts differed by 26 rather than by nothing: 27
       empty paragraphs, each of which had swallowed the one after it, except
       the last, which had nothing after it to swallow. */
    const read = readParagraphs(xml);
    expect(read.filter((p) => p.empty === true)).toHaveLength(27);
    expect([...xml.matchAll(/<\/w:p>/g)]).toHaveLength(872 - 27);
  });

  it('and its mantra paragraphs still read as mantras', () => {
    /* THE CONTROL. A reader that returned 872 empty paragraphs would satisfy
       both checks above and have lost the document. */
    const read = readParagraphs(xml);
    const verses = read.filter((p) => p.pStyle === 'Translit' && p.runs.length > 0);
    expect(verses.length).toBeGreaterThan(400);
    const text = mergeRuns(verses[0]!.runs).map((r) => r.text).join('');
    expect(text.trim().length).toBeGreaterThan(0);
  });
});
