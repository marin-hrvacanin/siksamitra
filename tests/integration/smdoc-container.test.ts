/**
 * `.smdoc` — the file a person's work lands in.
 *
 * This is the one thing in the program that must never lose anything: a
 * document saved today has to open in five years, in a version nobody has
 * written yet, and come back the same. It had NO tests. The container, the
 * lean/fat decision, the version detection and the refusals were all exercised
 * only by hand.
 *
 * An integration test rather than a unit one because it crosses three
 * packages — the format's model, the engine's derivation, and the container —
 * and because the interesting question is whether they AGREE. Per the tier's
 * own rule it asserts no value it computed with the code under test: the
 * expectations are the document that went in.
 */
import { describe, expect, it } from 'vitest';
import { derive } from '@siksamitra/engine';
import {
  DOCUMENT_FORMAT, DOCUMENT_VERSION, documentFlavour, fattenDocument, leanDocument,
  packDocument, unpackDocument,
} from '@siksamitra/interop';
import { recitationText, syllableCount } from '@siksamitra/format';
import type { ChantDoc, ChantVerse } from '@siksamitra/format';

/** A real document, derived by the real engine — not a hand-made fake. */
function build(lines: string[][], over: Partial<ChantDoc> = {}): ChantDoc {
  const verses: ChantVerse[] = lines.map((ls, i) => {
    const d = derive({ lines: ls }, undefined, { verseId: `v-${i + 1}`, trace: false });
    return {
      id: `v-${i + 1}`,
      n: `${i + 1}`,
      tokens: d.tokens,
      src: { lines: [...d.srcMap.lines] },
      translation: { en: `verse ${i + 1}` },
    };
  });
  return {
    title: 'durgā sūktam',
    titleForms: { iast: 'durgā sūktam' },
    sections: [{ id: 's1', title: 'Durgā Sūktam', verses }],
    ...over,
  };
}

const save = (doc: ChantDoc, lean = true): Promise<Uint8Array> =>
  packDocument(doc, { slug: 'test.smdoc', engine: 'test', lean });

describe('a document, written and read back', () => {
  it('comes back with the same text, marks and translations', async () => {
    const doc = build([
      ['jātavedase sunavāma somamarātī', 'yato nidahāti vedaḥ .'],
      ['tāmagni varṇāṁ tapasā jvalantīṁ'],
    ]);
    const file = unpackDocument(await save(doc));

    expect(file.doc.title).toBe(doc.title);
    expect(file.doc.sections).toHaveLength(1);
    for (const [i, verse] of file.doc.sections[0]!.verses.entries()) {
      const was = doc.sections[0]!.verses[i]!;
      expect(recitationText(verse.tokens, 'iast')).toBe(recitationText(was.tokens, 'iast'));
      expect(recitationText(verse.tokens, 'deva')).toBe(recitationText(was.tokens, 'deva'));
      expect(syllableCount(verse.tokens)).toBe(syllableCount(was.tokens));
      expect(verse.translation).toEqual(was.translation);
      expect(verse.n).toBe(was.n);
    }
  });

  it('says what wrote it, and to which version of the format', async () => {
    const file = unpackDocument(await save(build([['agnim īḷe']])));
    expect(file.manifest.format).toBe(DOCUMENT_FORMAT);
    expect(file.manifest.version).toBe(DOCUMENT_VERSION);
    expect(file.manifest.engine).toBe('test');
  });

  it('is a zip, and says so in its first four bytes', async () => {
    const bytes = await save(build([['agnim īḷe']]));
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(documentFlavour(bytes)).toBe('v2');
  });

  it('carries the editor s own state without letting it into the document', async () => {
    const bytes = await packDocument(build([['agnim īḷe']]), {
      slug: 'test.smdoc', engine: 'test', editor: { view: 'paged', zoom: 1.25 },
    });
    const file = unpackDocument(bytes);
    expect(file.editor).toEqual({ view: 'paged', zoom: 1.25 });
    // And it is NOT part of the document: another reader ignores it entirely.
    expect(JSON.stringify(file.doc)).not.toContain('paged');
  });

  it('carries an asset beside the document, byte for byte', async () => {
    const audio = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const bytes = await packDocument(build([['agnim īḷe']]), {
      slug: 'test.smdoc', engine: 'test', assets: { 'audio/one.opus': audio },
    });
    const file = unpackDocument(bytes);
    expect([...file.assets['audio/one.opus']!]).toEqual([...audio]);
  });
});

describe('lean and fat', () => {
  const doc = build([['jātavedase sunavāma somamarātī']]);

  it('a lean file stores the source and rebuilds the tokens on open', async () => {
    const lean = await save(doc, true);
    const fat = await save(doc, false);
    expect(lean.byteLength).toBeLessThan(fat.byteLength);

    const opened = unpackDocument(lean);
    expect(opened.report.rederived).toBeGreaterThan(0);
    expect(recitationText(opened.doc.sections[0]!.verses[0]!.tokens, 'iast'))
      .toBe(recitationText(doc.sections[0]!.verses[0]!.tokens, 'iast'));
  });

  it('both give the same document — the difference is only what is stored', async () => {
    const fromLean = unpackDocument(await save(doc, true)).doc;
    const fromFat = unpackDocument(await save(doc, false)).doc;
    expect(recitationText(fromLean.sections[0]!.verses[0]!.tokens, 'deva'))
      .toBe(recitationText(fromFat.sections[0]!.verses[0]!.tokens, 'deva'));
  });

  it('keeps the tokens of any verse that does NOT re-derive exactly', () => {
    /*
     * THE RULE THAT MAKES LEAN SAFE. `leanDocument` drops a verse's tokens only
     * where it has verified that deriving the source reproduces them; a verse
     * whose marks are the author's hand, or whose derivation differs by one
     * syllable, keeps every token. It is checked per verse, not assumed from
     * the engine's overall accuracy.
     */
    const hand = build([['agnim īḷe']]);
    /* Put a mark on the verse that the rules would not place. */
    const verse = hand.sections[0]!.verses[0]!;
    const first = verse.tokens.find((t) => t.t === 'syl');
    if (first !== undefined && first.t === 'syl' && first.units[0] !== undefined) {
      (first.units[0] as { hold?: string }).hold = 'long';
    }
    const { doc: slim, lean } = leanDocument(hand);
    expect(lean).not.toContain('v-1');
    expect(slim.sections[0]!.verses[0]!.tokens.length).toBeGreaterThan(0);
  });

  it('an attested verse is never leaned — it has no source to rebuild from', () => {
    const attested = build([['agnim īḷe']]);
    delete attested.sections[0]!.verses[0]!.src;
    const { doc: slim, lean } = leanDocument(attested);
    expect(lean).toEqual([]);
    expect(slim.sections[0]!.verses[0]!.tokens.length).toBeGreaterThan(0);
  });

  it('fattening a lean document is the inverse of leaning it', () => {
    const doc2 = build([['agnim īḷe purohitaṁ'], ['yajñasya devam ṛtvijam']]);
    const { doc: slim } = leanDocument(doc2);
    const fat = fattenDocument(slim);
    for (const [i, verse] of fat.doc.sections[0]!.verses.entries()) {
      expect(recitationText(verse.tokens, 'iast'))
        .toBe(recitationText(doc2.sections[0]!.verses[i]!.tokens, 'iast'));
    }
  });
});

describe('what it refuses', () => {
  it('refuses bytes that are not a document', () => {
    expect(() => unpackDocument(new Uint8Array([1, 2, 3, 4, 5]))).toThrow();
  });

  it('refuses an empty file', () => {
    expect(() => unpackDocument(new Uint8Array(0))).toThrow();
  });

  it('tells a v1 file apart from a v2 one, by its bytes', () => {
    /* v1 was `SMDI` (xz), `SMDC` (zlib) or bare JSON; v2 is a zip. Back
       compatibility is a promise, so the detection may not guess. */
    expect(documentFlavour(new TextEncoder().encode('SMDI...'))).toBe('v1');
    expect(documentFlavour(new TextEncoder().encode('SMDC...'))).toBe('v1');
    expect(documentFlavour(new TextEncoder().encode('{"v":1}'))).toBe('v1');
  });

  it('refuses a zip whose entry names try to escape', async () => {
    /*
     * Hand-built, not produced by our writer — a fixture from our own zip
     * library would only prove it agrees with itself. The full adversarial set
     * lives in `tests/security/package-archive.test.ts`; this is the one line
     * of it that belongs to the document container.
     */
    const { zipSync, strToU8 } = await import('fflate');
    const evil = zipSync({
      'manifest.json': strToU8(JSON.stringify({
        format: DOCUMENT_FORMAT, version: DOCUMENT_VERSION,
      })),
      '../escaped.json': strToU8('{}'),
    });
    expect(() => unpackDocument(evil)).toThrow(/refused entry/);
  });
});
