/**
 * Editing a real document, and getting it back unchanged.
 *
 * The claim under test is the owner's: **1:1 in infinite round trips.** Not
 * "the exporter works" — that a document survives being edited, packed,
 * unpacked, re-derived and packed again, byte for byte, however many times you
 * do it. A format that loses a hair on each pass loses the document on the
 * hundredth.
 *
 * Integration tier, and it earns the label: the format, the engine, the editing
 * session, the storage layer and the interchange package all have to agree, and
 * a disagreement between any two of them fails here rather than in a user's
 * document.
 *
 * The expectations are constants or the FILE'S OWN bytes — never a value
 * computed with the code under test. That rule is in tests/README.md because
 * this repository once shipped a conformance suite that broke it and passed 90
 * assertions while testing nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, normalizeChantDoc, syllableCount } from '@siksamitra/format';
import type { ChantDoc } from '@siksamitra/format';
import {
  apply, emptyHistory, flatten, holdingProblems, newState, offsetOf, redo,
  sourcesOf, undo,
} from '@siksamitra/edit';
import { pack, readManifest, unpack } from '@siksamitra/interop';

const DIR = join(process.cwd(), 'corpus', 'chants');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const read = (f: string): ChantDoc =>
  normalizeChantDoc(JSON.parse(readFileSync(join(DIR, f), 'utf8')) as ChantDoc);

/** The first section holding a verse the editor may actually edit. */
function editable(doc: ChantDoc): { sectionId: string; verseId: string } | null {
  for (const section of doc.sections) {
    for (const verse of section.verses) {
      if (verse.src !== undefined) return { sectionId: section.id, verseId: verse.id };
    }
  }
  return null;
}

describe('the corpus is editable', () => {
  /*
   * The one document the engine still cannot reproduce a single verse of.
   *
   * Named rather than tolerated: Puruṣa Sūktam sets 59 pāda bars and its
   * pauses do not fall where these rules place them, so every one of its 26
   * verses stays transcribed. That is an engine question the owner has not
   * settled (00 §5.6), and when it is settled this list is empty.
   */
  const NO_SOURCE_YET = new Set(['purusha-suktam.json']);

  it('every document has a verse with a source layer, except the one named', () => {
    /*
     * The gap this closes. Before `sm attach-src`, 0 of 573 verses carried a
     * source layer, so the editor — correctly, by rule zero — refused to touch
     * a single verse of the shipped corpus. A document nobody can edit is a
     * document this program cannot open for its own purpose.
     */
    const without = files.filter((f) => editable(read(f)) === null);
    expect(without).toEqual([...NO_SOURCE_YET]);
  });

  it('most of the corpus is editable, and the number may only rise', () => {
    // A ratchet in a test, because the alternative is a number nobody notices
    // falling. 420 of 573 at the time of writing.
    let derived = 0;
    let verses = 0;
    for (const file of files) {
      const doc = read(file);
      for (const section of doc.sections) {
        for (const verse of section.verses) {
          verses += 1;
          if (verse.src !== undefined) derived += 1;
        }
      }
    }
    expect(verses).toBe(573);
    expect(derived).toBeGreaterThanOrEqual(420);
  });

  it('a verse with a source layer re-derives to what the file already says', () => {
    for (const file of files) {
      if (NO_SOURCE_YET.has(file)) continue;
      const doc = read(file);
      const where = editable(doc)!;
      const before = canonicalJson(doc);

      // A no-op edit: insert nothing. It still runs the whole pipeline —
      // rebase the marks, re-derive the verse, normalise the holdings.
      const state = newState(doc);
      const flat = flatten(sourcesOf(doc.sections.find((s) => s.id === where.sectionId)!));
      const at = offsetOf(flat, { verseId: where.verseId, line: 0, column: 0 });
      const { state: after } = apply(state, emptyHistory(), {
        k: 'replace', sectionId: where.sectionId, from: at, to: at, insert: '',
      });

      expect(after.refusals, file).toEqual([]);
      expect(after.lostMarks, file).toEqual([]);
      // Byte-identical, which is the only version of "unchanged" worth having.
      expect(canonicalJson(after.doc), file).toBe(before);
    }
  });
});

describe('typing and taking it back', () => {
  it('an edit and its undo leave the document byte-identical, ten times over', () => {
    const doc = read('durga-suktam.json');
    const where = editable(doc)!;
    const before = canonicalJson(doc);

    let state = newState(doc);
    let history = emptyHistory();
    for (let round = 0; round < 10; round += 1) {
      const section = state.doc.sections.find((s) => s.id === where.sectionId)!;
      const flat = flatten(sourcesOf(section));
      const at = offsetOf(flat, { verseId: where.verseId, line: 0, column: 0 });

      const typed = apply(state, history, {
        k: 'replace', sectionId: where.sectionId, from: at, to: at, insert: 'oṁ ',
      });
      expect(typed.state.refusals, `round ${round}`).toEqual([]);
      expect(canonicalJson(typed.state.doc), `round ${round}`).not.toBe(before);

      const back = undo(typed.state, typed.history);
      expect(canonicalJson(back.state.doc), `round ${round}`).toBe(before);

      // Redo has to be exact too, or "undo, undo, redo" quietly loses work.
      const again = redo(back.state, back.history);
      expect(canonicalJson(again.state.doc), `round ${round}`)
        .toBe(canonicalJson(typed.state.doc));

      state = undo(again.state, again.history).state;
      history = emptyHistory();
    }
    expect(canonicalJson(state.doc)).toBe(before);
  });

  it('every mark stays legal through a burst of typing', () => {
    const doc = read('sri-rudram.json');
    const where = editable(doc)!;
    let state = newState(doc);
    let history = emptyHistory();

    for (const ch of 'namas te rudra ') {
      const section = state.doc.sections.find((s) => s.id === where.sectionId)!;
      const flat = flatten(sourcesOf(section));
      const at = offsetOf(flat, { verseId: where.verseId, line: 0, column: 0 });
      const result = apply(state, history, {
        k: 'replace',
        sectionId: where.sectionId,
        from: at,
        to: at,
        insert: ch,
        coalesce: 'type',
      });
      state = result.state;
      history = result.history;
      for (const verse of state.doc.sections.flatMap((s) => s.verses)) {
        expect(holdingProblems(verse.tokens), `${verse.id} after "${ch}"`).toEqual([]);
      }
    }
    // One burst, one undo step — and it takes the whole burst back.
    expect(history.past).toHaveLength(1);
    expect(canonicalJson(undo(state, history).state.doc)).toBe(canonicalJson(doc));
  });
});

describe('through the interchange format', () => {
  it('pack, unpack, pack: the same document and the same hash, every pass', async () => {
    const doc = read('bhagya-suktam.json');
    /*
     * `documentBytes` is passed on purpose, and the contract says why: the
     * packer stores THE BYTES THE WEB SERVES, and only the caller knows what
     * those are. Serialising a re-normalised document instead writes every
     * verse twice — once in `verses`, once in `items` — and a 122 KB file
     * becomes 210 KB. So the round trip is over canonical bytes, which is the
     * form the contract defines (INTERCHANGE §9).
     *
     * WHAT IS COMPARED IS `docHash`, NOT THE ARCHIVE. A `.vuchant` records
     * `createdAt`, so two packs of the same document are the same size and the
     * same hash and differ in that one field — measured, not assumed. The
     * identity of a document is its `docHash`; the archive is a container.
     */
    const bytesOf = (d: ChantDoc): Uint8Array =>
      new TextEncoder().encode(`${canonicalJson(d)}
`);
    const opts = { slug: 'bhagya-suktam', engine: 'test' };

    let current = doc;
    let hash: string | null = null;
    for (let pass = 0; pass < 4; pass += 1) {
      const archive = await pack(current, { ...opts, documentBytes: bytesOf(current) });
      const manifest = await readManifest(archive);
      hash ??= manifest.docHash;
      expect(manifest.docHash, `pass ${pass}`).toBe(hash);
      expect(manifest.contents.documentBytes, `pass ${pass}`)
        .toBe(bytesOf(current).byteLength);

      const back = await unpack(archive);
      expect(canonicalJson(back.doc), `pass ${pass}`).toBe(canonicalJson(current));
      current = back.doc;
    }
  });

  it('an edited document survives the round trip with its overrides', async () => {
    const doc = read('sri-rudram.json');
    expect((doc.overrides ?? []).length).toBeGreaterThan(0);

    const where = editable(doc)!;
    const section = doc.sections.find((s) => s.id === where.sectionId)!;
    const flat = flatten(sourcesOf(section));
    const at = offsetOf(flat, { verseId: where.verseId, line: 0, column: 0 });
    const { state } = apply(newState(doc), emptyHistory(), {
      k: 'replace', sectionId: where.sectionId, from: at, to: at, insert: 'oṁ ',
    });

    const packed = await pack(state.doc, { slug: 'sri-rudram', engine: 'test' });
    const back = await unpack(packed);
    expect(canonicalJson(back.doc)).toBe(canonicalJson(state.doc));
    expect(back.doc.overrides).toEqual(state.doc.overrides);
    expect(
      back.doc.sections.reduce(
        (n, s) => n + s.verses.reduce((m, v) => m + syllableCount(v.tokens), 0), 0,
      ),
    ).toBe(
      state.doc.sections.reduce(
        (n, s) => n + s.verses.reduce((m, v) => m + syllableCount(v.tokens), 0), 0,
      ),
    );
  });
});
