/**
 * OPENING AND SAVING THE ELEVEN DOCUMENTS THE PROGRAM SHIPS WITH.
 *
 * `readChantFile` and `writeChantFile` are what the window's Open and Save
 * reach; before them, every caller wrote its own `JSON.parse` and nothing
 * checked anything, so a truncated or foreign file failed as a `TypeError` in
 * a renderer minutes later.
 *
 * An integration test rather than a unit one, per the tier's own rule: it
 * reads the corpus. And it has to — a validator that accepts hand-made objects
 * and rejects the documents this program is FOR is a validator that has never
 * met one, and the round trip is only meaningful over documents with real
 * overrides, real `items`, real recordings and 198 verses in them. The unit
 * suite in `packages/format/src/__tests__/chant-file.test.ts` covers the
 * refusals, which need no corpus.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, readChantFile, recitationText, writeChantFile } from '@siksamitra/format';
import type { ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';

const CORPUS = join(process.cwd(), 'corpus', 'chants');
const NAMES = readdirSync(CORPUS).filter((n) => n.endsWith('.json'));

/**
 * What a document SAYS — the conformance surface, not its object graph.
 *
 * OPENED first. `readChantFile` gives back the structure with no tokens: a
 * stored verse is text and markings and the syllables are rebuilt by
 * `openChantDoc`. Reading `v.tokens` straight off a read document is exactly
 * the mistake this comment exists to stop.
 */
const said = (doc: ChantDoc): string[] => openChantDoc(doc).sections.flatMap(
  (s) => s.verses.map((v) => recitationText(v.tokens, 'iast')),
);

describe('every document in the corpus', () => {
  it('is there to be read', () => {
    // Guards against a green suite that ran over an empty directory.
    expect(NAMES.length).toBeGreaterThan(5);
  });

  for (const name of NAMES) {
    describe(name, () => {
      const text = readFileSync(join(CORPUS, name), 'utf8');
      const read = readChantFile(text);

      it('opens', () => {
        expect(read.ok ? null : read.error).toBeNull();
      });

      it('says the same thing after a write and a read', () => {
        if (!read.ok) throw new Error(read.error);
        const again = readChantFile(writeChantFile(read.doc));
        if (!again.ok) throw new Error(again.error);
        /*
         * Compared through `recitationText` rather than by deep-equalling the
         * halves against each other: a round trip that dropped a syllable, a
         * daṇḍa or a pause would pass an object comparison of what it kept.
         */
        expect(said(again.doc)).toEqual(said(read.doc));
        expect(canonicalJson(again.doc)).toBe(canonicalJson(read.doc));
      });

      it('has stable bytes — writing it twice gives the same file', () => {
        if (!read.ok) throw new Error(read.error);
        const once = writeChantFile(read.doc);
        const twice = writeChantFile(readChantFile(once).ok
          ? (readChantFile(once) as { doc: ChantDoc }).doc
          : read.doc);
        /* `docHash`, the `.vuchant` manifest and every variant's `baseHash`
           are taken over these bytes. A save that produced different bytes for
           the same document would give it two identities. */
        expect(twice).toBe(once);
      });
    });
  }
});
