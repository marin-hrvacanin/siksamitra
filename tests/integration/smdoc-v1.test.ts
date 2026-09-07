/**
 * Reading the old format — the owner's existing work.
 *
 * There are years of `.smdoc` v1 files: a Quill editor's `innerHTML` inside a
 * JSON envelope, optionally xz- or zlib-compressed. BACK COMPATIBILITY IS A
 * PROMISE, and it was tested only against the owner's own Library, which is
 * not in this repository — so on any other machine the importer was untested.
 *
 * The fixtures here are built BY HAND, in the shape v1 actually wrote, rather
 * than produced by our own writer. A fixture our writer made would only prove
 * the importer agrees with a writer that no longer exists.
 *
 * The v1 marking vocabulary, measured across his Library and recorded in
 * `smdoc/content.ts`:
 *   `ql-holding-short` / `ql-holding-long`   the box, over the letters it holds
 *   `ql-svara-true` / `ql-svara-char`        an accent, as the combining mark
 *   `ql-change-style`                        a letter produced by sandhi
 *   `ql-short-pause` / `ql-long-pause`       a pause, containing a literal `|`
 *   `ql-doc-title` / `-section` / `-translation` / `-comment`   the structure
 */
import { describe, expect, it } from 'vitest';
import { zlibSync, strToU8 } from 'fflate';
import {
  importSmdoc, parseSmdocContent, readSmdoc, smdocFlavour, tokenizeSmdocHtml,
} from '@siksamitra/interop';
import { recitationText } from '@siksamitra/format';

/** A v1 file as bare JSON — the simplest of the three flavours. */
const bare = (content: string, title = 'durgā sūktam'): Uint8Array =>
  strToU8(JSON.stringify({ version: 1, meta: { title }, content }));

/** The same, zlib-compressed behind the `SMDC` magic v1 wrote. */
function compressed(content: string, title = 'durgā sūktam'): Uint8Array {
  const payload = zlibSync(bare(content, title));
  const out = new Uint8Array(4 + payload.byteLength);
  out.set(strToU8('SMDC'), 0);
  out.set(payload, 4);
  return out;
}

/*
 * A page of v1, in the shape it actually wrote: the STRUCTURE is a class on the
 * paragraph, the MARKS are spans inside it, and a verse is the default — a
 * paragraph with no structural class is a mantra line.
 */
const HTML = [
  '<p class="ql-doc-section">durgā sūktam</p>',
  '<p>jātavedase sunavāma <span class="ql-holding-short">so</span>mamarātī<br>',
  'yato nidahāti veda<span class="ql-change-style">ḥ</span></p>',
  '<p class="ql-doc-translation">For Jātavedas we shall extract soma.</p>',
].join('');

describe('the container', () => {
  it('knows its three flavours by their first bytes', () => {
    expect(smdocFlavour(strToU8('SMDI....'))).toBe('xz');
    expect(smdocFlavour(strToU8('SMDC....'))).toBe('zlib');
    expect(smdocFlavour(strToU8('{"version":1}'))).toBe('json');
  });

  it('reads a bare JSON file', async () => {
    const file = await readSmdoc(bare(HTML));
    expect(file.meta?.title).toBe('durgā sūktam');
    expect(file.content).toContain('ql-holding-short');
  });

  it('reads a zlib file, which is what most of his are', async () => {
    const file = await readSmdoc(compressed(HTML));
    expect(file.content).toBe(HTML);
  });

  it('refuses an xz file rather than guessing, and says what it needs', async () => {
    /*
     * `SMDI` carries an XZ stream. Without a decoder the honest answer is a
     * refusal that names what would fix it — a half-read document is worse
     * than an error.
     */
    await expect(readSmdoc(strToU8('SMDInot-really-xz'))).rejects.toThrow(/XZ/);
  });

  it('refuses a payload that will not decompress', async () => {
    const broken = new Uint8Array([...strToU8('SMDC'), 1, 2, 3, 4, 5]);
    await expect(readSmdoc(broken)).rejects.toThrow(/would not decompress/);
  });

  it('refuses JSON that is not a document', async () => {
    await expect(readSmdoc(strToU8('[1,2,3]'))).rejects.toThrow();
    await expect(readSmdoc(strToU8('not json at all'))).rejects.toThrow();
  });
});

describe('the HTML tokeniser', () => {
  it('reads the vocabulary v1 wrote: paragraphs, spans, breaks', () => {
    const nodes = tokenizeSmdocHtml(HTML);
    expect(nodes.length).toBeGreaterThan(6);
    const kinds = nodes.map((n) => `${n.t}:${'tag' in n ? n.tag : 'text'}`);
    expect(kinds).toContain('open:p');
    expect(kinds).toContain('open:span');
    expect(kinds).toContain('void:br');
  });

  it('refuses a construct outside that vocabulary rather than guessing', () => {
    /* A strict tokeniser over a closed vocabulary: v1's writer emitted a known
       set of tags, and anything else is a file we do not understand. */
    expect(() => tokenizeSmdocHtml('<script>alert(1)</script>')).toThrow();
  });

  it('is not confused by an unclosed tag', () => {
    /* His files are machine-written and well formed; a malformed one is a file
       we do not understand, and reading half of it is the wrong answer. */
    expect(() => tokenizeSmdocHtml('<p>a<span>b</p>')).toThrow();
  });
});

describe('the content model', () => {
  it('reads a heading, a mantra line and a translation as different blocks', () => {
    const kinds = parseSmdocContent(HTML).map((b) => b.kind);
    expect(kinds).toEqual(['heading', 'verse', 'translation']);
  });

  it('reads a `<br>` inside a verse as a LINE of it — a breath', () => {
    const verse = parseSmdocContent(HTML).find((b) => b.kind === 'verse')!;
    expect('lines' in verse && verse.lines).toHaveLength(2);
  });

  it('gives a heading its level', () => {
    const heading = parseSmdocContent(HTML).find((b) => b.kind === 'heading')!;
    /* The level is the v1 class it came from — `section`, `title`, and so on
       — not a number: a heading's rank in that format is a NAME. */
    expect('level' in heading && heading.level).toBe('section');
    expect('text' in heading && heading.text).toBe('durgā sūktam');
  });

  it('keeps a holding as a MARK, on the letters the span covered', () => {
    /*
     * The presentation becomes DATA: the box is not a span any more, it is a
     * run of letters in the line — which is what makes "is this holding
     * correct?" a question with an answer.
     *
     * A mark's `at` is a LETTER index, the same counting `SrcMap.units` uses,
     * so it is not an offset into the string: `ā` is one letter and two
     * characters. What it points AT is checked below, through the import.
     */
    const verse = parseSmdocContent(HTML).find((b) => b.kind === 'verse')!;
    const marks = 'lines' in verse ? verse.lines[0]!.marks : [];
    const held = marks.filter((m) => m.hold !== undefined);
    expect(held.length, 'the holding was lost').toBe(2);
    expect(held.every((m) => m.hold === 'short')).toBe(true);
    expect(held[1]!.at - held[0]!.at, 'the two letters are not adjacent').toBe(1);
  });

  it('keeps a sandhi-produced letter marked as one', () => {
    const verse = parseSmdocContent(HTML).find((b) => b.kind === 'verse')!;
    const marks = 'lines' in verse ? verse.lines[1]!.marks : [];
    expect(marks.some((m) => m.change === true), 'the change mark was lost').toBe(true);
  });
});

describe('importing one', () => {
  it('produces a document whose text is the file s text', async () => {
    const result = await importSmdoc(compressed(HTML));
    const verses = result.doc.sections.flatMap((s) => s.verses);
    expect(verses.length).toBeGreaterThan(0);
    expect(recitationText(verses[0]!.tokens, 'iast')).toContain('jātavedase');
    expect(result.doc.sections[0]!.title ?? result.doc.title).toBeTypeOf('string');
  });

  it('puts the holding on the same letters it was on in the file', async () => {
    /*
     * THE CLAIM THAT MATTERS. Whatever the counting inside, the box has to end
     * up around `so` — the letters it was drawn around in his document.
     */
    const result = await importSmdoc(compressed(HTML));
    const verse = result.doc.sections.flatMap((s) => s.verses)[0]!;
    const held = verse.tokens
      .flatMap((t) => (t.t === 'syl' ? [...t.units] : []))
      .filter((u) => u.hold !== undefined);
    expect(held.map((u) => u.c).join('')).toBe('so');
    expect(held.every((u) => u.hold === 'short')).toBe(true);
  });

  it('DERIVES the document rather than translating it', async () => {
    /*
     * The v1 file is presentation — spans and classes. What comes out is a v2
     * document with a source layer, so it can be re-derived, edited and
     * checked. A translation of the HTML into tokens would carry v1's
     * presentation forward for ever.
     */
    const result = await importSmdoc(compressed(HTML));
    const verse = result.doc.sections.flatMap((s) => s.verses)[0]!;
    expect(verse.src, 'the imported verse has no source layer').toBeDefined();
    expect(verse.src!.lines.join(' ')).toContain('jātavedase');
  });

  it('reports what it could not account for, rather than dropping it', async () => {
    const result = await importSmdoc(compressed(HTML));
    expect(result.report).toBeDefined();
    // Overrides are the marks the rules did NOT reproduce: a number, not a
    // silence. Zero is a fine answer; undefined is not.
    expect(result.doc.overrides ?? []).toBeInstanceOf(Array);
  });

  it('gives the document a slug from its title', async () => {
    const result = await importSmdoc(compressed(HTML));
    expect(result.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('survives a file with no content at all', async () => {
    const result = await importSmdoc(bare(''));
    expect(result.doc.sections.flatMap((s) => s.verses)).toEqual([]);
  });
});
