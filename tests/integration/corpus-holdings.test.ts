/**
 * The holding invariants, over the eleven shipped documents.
 *
 * The other half of `packages/edit/src/__tests__/holdings.test.ts`, which
 * proves the checker CAN fail. This proves the thing that matters: that every
 * document this program ships already satisfies the invariants, and that the
 * repair is a no-op on all of them. If it changes a single group id in a
 * verified file, either the rules or the repair is wrong about what the owner
 * draws.
 *
 * Integration rather than unit, by the tier rule: it reads the corpus.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeChantDoc, type ChantDoc } from '@siksamitra/format';
import { holdingProblems, normaliseHoldings } from '@siksamitra/edit';
import { openChantDoc } from '@siksamitra/engine';

/**
 * The corpus. Every shipped document must already satisfy the invariants, and
 * the repair must be a no-op on all of them — if it changes a single group id
 * in a verified file, either the rules or this module is wrong about what the
 * owner draws.
 */
describe('the eleven shipped documents', () => {
  const dir = join(process.cwd(), 'corpus', 'chants');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  it('there are documents to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(11);
  });

  for (const file of files) {
    it(`${file} satisfies the invariants, and the repair is a no-op`, () => {
      /* NORMALISED. A composed section stores its verses in `items` and no
         longer repeats them in `verses` on disk, so a raw read walks nothing —
         which the "there are verses" assertion below is what caught. */
      const parsed = openChantDoc(
        JSON.parse(readFileSync(join(dir, file), 'utf8')) as ChantDoc,
      );
      let verses = 0;
      for (const section of parsed.sections) {
        for (const verse of section.verses) {
          verses += 1;
          const problems = holdingProblems(verse.tokens);
          expect(problems, `${file} ${verse.id}: ${problems.map((p) => p.message).join('; ')}`)
            .toEqual([]);
          expect(normaliseHoldings(verse.tokens).changed, `${file} ${verse.id} regrouped`)
            .toBe(0);
        }
      }
      expect(verses).toBeGreaterThan(0);
    });
  }
});
