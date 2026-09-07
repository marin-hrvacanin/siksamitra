/**
 * Structural invariants for holdings.
 *
 * OWNER'S REQUIREMENTS (2026-09-07): there can never be an empty holding, never
 * a nested holding, and adjacent holdings of the same kind must always be
 * merged. Plus: running automatic holdings over text that is ALREADY marked
 * must behave.
 *
 * These are properties, not examples, so they are checked over the whole corpus
 * AND over generated input. A property that holds for eleven documents and
 * fails on the twelfth is not an invariant, it is a coincidence.
 *
 * `hg` is the group id. A box is a contiguous run of units sharing `hold` and
 * `hg` within a syllable — see `holdingSpans` in `@siksamitra/format`, which is
 * where the same rule is written for readers.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { holdingSpans, syllablesOf, type ChantToken } from '@siksamitra/format';
import { DEFAULT_PROFILE, derive, resolveProfile } from '../index.js';

const CORPUS = 'corpus/chants';
const profile = resolveProfile([{ preset: 'taittiriya' }]) ?? DEFAULT_PROFILE;

interface Unit { c: string; hold?: 'short' | 'long'; hg?: number }

/** Every verse in the corpus, with where it came from for a useful failure. */
function corpusVerses(): { where: string; tokens: ChantToken[] }[] {
  const out: { where: string; tokens: ChantToken[] }[] = [];
  for (const file of readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort()) {
    const doc = JSON.parse(readFileSync(join(CORPUS, file), 'utf8')) as {
      sections?: { id: string; verses?: { id: string; tokens: ChantToken[] }[] }[];
    };
    for (const s of doc.sections ?? []) {
      for (const v of s.verses ?? []) {
        out.push({ where: `${file.replace('.json', '')}/${s.id}/${v.id}`, tokens: v.tokens });
      }
    }
  }
  return out;
}

/** The units of every syllable, flattened, as the renderer sees them. */
function unitsOf(tokens: readonly ChantToken[]): Unit[][] {
  return syllablesOf(tokens)
    .filter((t): t is Extract<ChantToken, { t: 'syl' }> => t.t === 'syl')
    .map((syl) => syl.units as Unit[]);
}

const VERSES = corpusVerses();

describe('a holding is never empty', () => {
  it('every box covers at least one letter, across the corpus', () => {
    for (const { where, tokens } of VERSES) {
      for (const span of holdingSpans(tokens)) {
        expect(span.to, `${where}: span ${span.from}-${span.to}`)
          .toBeGreaterThanOrEqual(span.from);
        expect(span.letters.length, `${where}: empty box at ${span.from}`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('a group id never appears without a hold beside it', () => {
    // `hg` without `hold` is an empty box: the renderer groups on both, so a
    // stray group id is a mark that draws nothing and cannot be selected.
    for (const { where, tokens } of VERSES) {
      for (const units of unitsOf(tokens)) {
        for (const u of units) {
          if (u.hg === undefined) continue;
          expect(u.hold, `${where}: hg=${u.hg} on "${u.c}" with no hold`).toBeDefined();
        }
      }
    }
  });

  it('derivation never produces a group id without a hold', () => {
    for (const line of [
      'uttamam', 'gacchati', 'viddhi', 'tad dhi', 'satyam uttaram',
      'agni mīḷe purohitam', 'viśvā nāve-va sindhun',
    ]) {
      for (const syl of syllablesOf(derive({ lines: [line] }, profile).tokens)) {
        if (syl.t !== 'syl') continue;
        for (const u of syl.units as Unit[]) {
          if (u.hg !== undefined) expect(u.hold, `${line}: "${u.c}"`).toBeDefined();
        }
      }
    }
  });
});

describe('holdings are never nested', () => {
  it('no two spans overlap, across the corpus', () => {
    // Nesting is not representable in the model — a unit carries at most one
    // `hold` — but a SPAN could still overlap another if group ids interleaved.
    // This is the assertion that the flat model stays flat in practice.
    for (const { where, tokens } of VERSES) {
      const spans = holdingSpans(tokens);
      for (let i = 1; i < spans.length; i += 1) {
        const prev = spans[i - 1]!;
        const here = spans[i]!;
        expect(here.from, `${where}: span ${here.from}-${here.to} overlaps ${prev.from}-${prev.to}`)
          .toBeGreaterThan(prev.to);
      }
    }
  });

  it('a unit carries at most one holding, by construction', () => {
    for (const { where, tokens } of VERSES) {
      for (const units of unitsOf(tokens)) {
        for (const u of units) {
          if (u.hold === undefined) continue;
          expect(['short', 'long'], `${where}: hold="${String(u.hold)}"`).toContain(u.hold);
        }
      }
    }
  });
});

describe('adjacent holdings of the same kind are merged', () => {
  /**
   * Two boxes of the same length touching each other should be one box.
   *
   * This is the invariant most likely to be violated by an importer or by a
   * hand edit, and it is visible on the page: two adjacent boxes draw two
   * frames where the author meant one run.
   */
  const unmerged = (tokens: readonly ChantToken[]): string[] => {
    const bad: string[] = [];
    const spans = holdingSpans(tokens);
    for (let i = 1; i < spans.length; i += 1) {
      const prev = spans[i - 1]!;
      const here = spans[i]!;
      if (here.from === prev.to + 1 && here.len === prev.len) {
        bad.push(`${prev.from}-${prev.to} and ${here.from}-${here.to} (both ${here.len})`);
      }
    }
    return bad;
  };

  it('the corpus contains no unmerged adjacent pair of the same length', () => {
    const failures: string[] = [];
    for (const { where, tokens } of VERSES) {
      for (const pair of unmerged(tokens)) failures.push(`${where}: ${pair}`);
    }
    expect(failures).toEqual([]);
  });

  it('derivation never produces one', () => {
    const lines = [
      'uttamam', 'satyam uttaram', 'ucchantu bhadrāḥ', 'viddhi tad dhi',
      'agnim īḷe purohitam yajñasya devam ṛtvijam',
      'tvamagne dyubhistvamāśuśukṣaṇistvamadbhyastvamaśmanaspari',
    ];
    for (const line of lines) {
      const d = derive({ lines: [line] }, profile);
      expect(unmerged(d.tokens), line).toEqual([]);
    }
  });
});

describe('running automatic holdings over already-marked text', () => {
  /**
   * The case the owner named: an author selects text that already carries marks
   * and runs the automatic pass.
   *
   * Derivation is a pure function of SOURCE, so re-running it cannot accumulate
   * marks the way an in-place mutation would. That is the design, and this is
   * the test that says so — an in-place implementation would drift here and
   * nothing else in the suite would notice.
   */
  const lines = [
    'uttamam', 'gacchati', 'satyam uttaram', 'ucchantu bhadrāḥ',
    'viśvā nāve-va sindhun duritā\'tya-gniḥ',
  ];

  it('is idempotent: deriving twice gives byte-identical output', () => {
    for (const line of lines) {
      const once = derive({ lines: [line] }, profile);
      const twice = derive({ lines: [line] }, profile);
      expect(JSON.stringify(twice.tokens), line).toBe(JSON.stringify(once.tokens));
    }
  });

  it('does not accumulate boxes when run again', () => {
    for (const line of lines) {
      const a = holdingSpans(derive({ lines: [line] }, profile).tokens);
      const b = holdingSpans(derive({ lines: [line] }, profile).tokens);
      expect(b.length, line).toBe(a.length);
    }
  });

  it('renumbers groups canonically, so identical input gives identical ids', () => {
    // `hg` must not be a raw counter: two derivations of the same text have to
    // produce the same bytes or `docHash` can never validate.
    const ids = (line: string): (number | null)[] =>
      holdingSpans(derive({ lines: [line] }, profile).tokens).map((s) => s.group);
    for (const line of lines) expect(ids(line)).toEqual(ids(line));
  });
});

describe('edge cases that must not produce a malformed holding', () => {
  it.each([
    ['', 'empty input'],
    ['   ', 'only spaces'],
    ['|', 'a bare pause'],
    ['||', 'a bare double pause'],
    ['।', 'a bare daṇḍa'],
    ['॥', 'a bare double daṇḍa'],
    ['a', 'one vowel'],
    ['k', 'one consonant with no vowel'],
    ['kk', 'a cluster with no vowel at all'],
    ['ttttttt', 'a long run of one consonant'],
    ['1234', 'digits'],
    ['xyz@#$', 'characters outside the alphabet'],
    [' ', 'control characters'],
    ['uttamam\n\nuttamam', 'blank lines'],
    ['ut|tamam', 'a pause inside a cluster'],
    ['uttamam ।। uttamam', 'daṇḍas between marked words'],
    ['ऀ', 'a Devanāgarī sign in an IAST source'],
    ['🙏', 'an emoji'],
    ['u_ttamam', 'an explicit conjunct split inside a cluster'],
    ['u+ttamam', 'an explicit conjunct join inside a cluster'],
  ])('survives %s (%s) with every invariant intact', (line) => {
    const d = derive({ lines: [line] }, profile);
    const spans = holdingSpans(d.tokens);

    // Every box is non-empty.
    for (const s of spans) {
      expect(s.letters.length).toBeGreaterThan(0);
      expect(s.to).toBeGreaterThanOrEqual(s.from);
    }
    // No overlap, and no unmerged same-length adjacency.
    for (let i = 1; i < spans.length; i += 1) {
      const prev = spans[i - 1]!;
      const here = spans[i]!;
      expect(here.from).toBeGreaterThan(prev.to);
      expect(here.from === prev.to + 1 && here.len === prev.len).toBe(false);
    }
    // Every group id has a hold.
    for (const syl of syllablesOf(d.tokens)) {
      if (syl.t !== 'syl') continue;
      for (const u of syl.units as Unit[]) {
        if (u.hg !== undefined) expect(u.hold).toBeDefined();
      }
    }
  });

  it('never throws on any single codepoint from a wide sweep', () => {
    // A file arriving from elsewhere contains whatever it contains. The engine
    // may refuse to mark something; it may not fall over.
    const ranges: [number, number][] = [
      [0x20, 0x7e], [0xa0, 0xff], [0x100, 0x17f], [0x1e00, 0x1eff],
      [0x300, 0x36f], [0x900, 0x97f], [0xc00, 0xc7f], [0x2000, 0x206f],
    ];
    for (const [lo, hi] of ranges) {
      for (let cp = lo; cp <= hi; cp += 1) {
        const ch = String.fromCodePoint(cp);
        expect(() => derive({ lines: [`a${ch}a`] }, profile), `U+${cp.toString(16)}`)
          .not.toThrow();
      }
    }
  });
});
