/**
 * Gate R2 — word surfaces, over the whole shipped corpus.
 *
 * Two invariants, both load-bearing:
 *
 *   V05  `words[]` has exactly one entry per SURFACE. It is indexed
 *        positionally, so a drift of one makes every popover after it describe
 *        the wrong word.
 *   R2   `detectJoins` → `expandJoins` is the identity on the wire. A shared
 *        analysis is stored by duplicating it onto every member surface, which
 *        is what the eleven shipped files contain; the editor wants it as one
 *        target. Opening a document and re-saving it must not change a byte.
 *
 * Measured here rather than asserted from memory: the counts below are read off
 * the corpus, and the spec's own table (04 §4A.2) was written from them.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, normalizeChantDoc } from '@siksamitra/format';
import type { ChantDoc, ChantVerse } from '@siksamitra/format';
import { detectJoins, expandJoins, surfacesOf, wordsAlign } from '../words.js';

const DIR = 'corpus/chants';
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

function versesOf(file: string): { id: string; verse: ChantVerse }[] {
  const doc = normalizeChantDoc(
    JSON.parse(readFileSync(join(DIR, file), 'utf8')) as ChantDoc,
  );
  return doc.sections.flatMap((s) => s.verses.map((v) => ({ id: `${s.id}/${v.id}`, verse: v })));
}

describe('R2 · word surfaces across the corpus', () => {
  it('the corpus is actually there', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(11);
  });

  for (const file of FILES) {
    it(`V05 · one words[] entry per surface — ${file}`, () => {
      const bad: string[] = [];
      for (const { id, verse } of versesOf(file)) {
        const a = wordsAlign(verse);
        if (!a.ok) bad.push(`${id}: ${a.words} words, ${a.surfaces} surfaces`);
      }
      expect(bad).toEqual([]);
    });

    it(`R2 · detect then expand changes nothing — ${file}`, () => {
      const bad: string[] = [];
      for (const { id, verse } of versesOf(file)) {
        if (verse.words === undefined) continue;
        const back = expandJoins(detectJoins(verse.words, surfacesOf(verse.tokens)));
        if (canonicalJson(back) !== canonicalJson(verse.words)) bad.push(id);
      }
      expect(bad).toEqual([]);
    });
  }

  it('the three cases the spec names are all present', () => {
    let joins = 0;
    let multi = 0;
    let single = 0;
    for (const file of FILES) {
      for (const { verse } of versesOf(file)) {
        if (verse.words === undefined) continue;
        const detected = detectJoins(verse.words, surfacesOf(verse.tokens));
        joins += detected.filter((w) => w.join === 'prev').length;
        multi += verse.words.filter((w) => w.entries.length > 1).length;
        single += verse.words.filter((w) => w.entries.length === 1).length;
      }
    }
    // Case 1 is the majority; cases 2 and 3 are real and must not be optimised
    // away by a "simplification" that assumes one surface is one word.
    expect(single).toBeGreaterThan(multi);
    expect(multi).toBeGreaterThanOrEqual(400);
    expect(joins).toBeGreaterThanOrEqual(19);
  });
});
