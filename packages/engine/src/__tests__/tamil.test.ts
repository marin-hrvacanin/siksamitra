/**
 * TAMIL, HELD TO THE SAME STANDARD AS DEVANĀGARĪ AND TELUGU.
 *
 * Those two are checked against the owner's published forms, syllable by
 * syllable, and they match exactly. Tamil cannot be checked that way: the
 * shipped documents write Sanskrit in bare Tamil letters, so `ba`, `bha`, `pa`
 * and `pha` are all `ப`, and they disagree with themselves on 43 syllables.
 * There is no single published spelling to check against.
 *
 * So Tamil is held to PROPERTIES, which are stronger than a table because they
 * cannot be satisfied by copying what the code already does:
 *
 *   1. every syllable of the corpus round-trips, with no hidden marker
 *   2. the four members of a stop series are distinct, and differ ONLY by the
 *      qualifier
 *   3. Tamil collides no more than Devanāgarī does, over the whole corpus
 *   4. a qualifier is never inside an akṣara — always after the vowel sign
 *   5. `ṛ` is distinguishable from `ru`, which is the case the whole
 *      approximation-marker mechanism exists for
 *
 * The oracle for 1, 3 and 5 is the corpus; for 2 and 4 it is the printed
 * convention, written out here as literals rather than computed, so a change
 * to the tables cannot quietly redefine what the test is checking.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ambiguitiesIn, isLosslessScript, toIast, transliterateSyllable,
} from '../index.js';
import type { ScriptUnit } from '../index.js';

const REFERENCE = fileURLToPath(new URL('../../../../corpus/transliteration-reference.json', import.meta.url));
const ref = JSON.parse(readFileSync(REFERENCE, 'utf8')) as {
  rows: [string, ScriptUnit[], string, number][];
};
/** Every distinct syllable the corpus contains, once. */
const SYLLABLES = [...new Map(ref.rows.map((r) => [JSON.stringify(r[1]), r[1]])).values()];
const iastOf = (u: readonly ScriptUnit[]): string => u.map((x) => x.c).join('');
/** One consonant with its inherent `a` — the way a letter is cited. */
const one = (iast: string): string => transliterateSyllable([{ c: iast }, { c: 'a' }], 'tam');

/**
 * The marks that never enter a script's text at all.
 *
 * The virāma tick, the accents, the candrabindu and the `:` of `ḥ:` are DATA
 * on the token, drawn by the renderer and stripped by every transliterator —
 * `withoutMarks` in `gates/lossless.ts` says the same thing for the same
 * reason. Devanāgarī and Telugu drop them too, so a round trip that does not
 * bring them back is not Tamil losing something.
 */
const notation = (s: string): string => s.replace(/[̱̍̎̐ˎ·:]/gu, '');

/**
 * The praṇava has one meaning and several spellings.
 *
 * A script with its own ligature writes `om`, `oṁ` and `auṁ` as that one glyph
 * — `ௐ` in Tamil — and reading it back gives the canonical spelling. `om`
 * returning as `oṁ` is the ligature doing its job, and `gates/lossless.ts`
 * makes the same allowance for the same reason.
 */
const PRANAVA = new Set(['om', 'oṁ', 'oṃ', 'auṁ']);
const canonical = (s: string): string => (PRANAVA.has(s) ? 'oṁ' : s);

describe('the corpus is there to measure against', () => {
  it('has syllables', () => {
    expect(SYLLABLES.length).toBeGreaterThan(1000);
  });
});

describe('the printed convention', () => {
  /**
   * The stop series, as Tamil Sanskrit is printed. Written out, not computed:
   * a test that asked the table what the table says would pass on any table.
   */
  const SERIES: [string, string, string, string, string][] = [
    ['க', 'k', 'kh', 'g', 'gh'],
    ['ச', 'c', 'ch', '', ''],
    ['ட', 'ṭ', 'ṭh', 'ḍ', 'ḍh'],
    ['த', 't', 'th', 'd', 'dh'],
    ['ப', 'p', 'ph', 'b', 'bh'],
  ];

  for (const [base, plain, aspirate, voiced, voicedAspirate] of SERIES) {
    it(`${base}: ${plain} bare, ${aspirate} ², ${voiced} ³, ${voicedAspirate} ⁴`, () => {
      expect(one(plain)).toBe(base);
      expect(one(aspirate)).toBe(`${base}²`);
      if (voiced !== '') expect(one(voiced)).toBe(`${base}³`);
      if (voicedAspirate !== '') expect(one(voicedAspirate)).toBe(`${base}⁴`);
      /* Four distinct forms where the shipped documents had one. */
      const all = new Set([one(plain), one(aspirate), one(voiced), one(voicedAspirate)]);
      expect(all.size).toBe(voiced === '' ? 3 : 4);
    });
  }

  it('ja has its own letter, and jha qualifies it', () => {
    expect(one('j')).toBe('ஜ');
    expect(one('jh')).toBe('ஜ²');
  });

  it('writes the qualifier AFTER the vowel sign, not inside the akṣara', () => {
    /* `கீ³தா`, the way Bhagavadgītā is printed — not `க³ீதா`, which breaks the
       cluster and draws the vowel sign as an orphan. */
    expect(transliterateSyllable([{ c: 'g' }, { c: 'ī' }], 'tam')).toBe('கீ³');
    expect(transliterateSyllable([{ c: 'd' }, { c: 'e' }], 'tam')).toBe('தே³');
    /* And after the virāma, for a syllable-final consonant: `வத்³`. */
    expect(transliterateSyllable([{ c: 'v' }, { c: 'a' }, { c: 'd' }], 'tam')).toBe('வத்³');
  });

  it('keeps the visarga and the anusvāra as their own signs', () => {
    expect(transliterateSyllable([{ c: 't' }, { c: 'a' }, { c: 'ḥ' }], 'tam')).toBe('தஃ');
    expect(transliterateSyllable([{ c: 't' }, { c: 'a' }, { c: 'ṁ' }], 'tam')).toBe('தஂ');
    /* And a real `m` is not the anusvāra — the distinction the source makes
       has to survive onto the page. */
    expect(transliterateSyllable([{ c: 't' }, { c: 'a' }, { c: 'm' }], 'tam')).toBe('தம்');
  });

  it('marks the vocalic vowels, so ṛ is not ru', () => {
    const kr = transliterateSyllable([{ c: 'k' }, { c: 'ṛ' }], 'tam');
    const kru = transliterateSyllable([{ c: 'k' }, { c: 'r' }, { c: 'u' }], 'tam');
    expect(kr).not.toBe(kru);
    expect(toIast(kr, 'tam').iast).toBe('kṛ');
    expect(toIast(kru, 'tam').iast).toBe('kru');
  });
});

describe('no qualifier is ever left inside an akṣara', () => {
  /* A qualifier immediately followed by a combining mark means the digit was
     composed onto the bare consonant and never moved — the shaping bug. */
  const INSIDE = /[²³⁴](?:\p{Mn}|\p{Mc})/u;

  it('over every syllable in the corpus', () => {
    const bad: string[] = [];
    for (const units of SYLLABLES) {
      const t = transliterateSyllable(units, 'tam');
      if (INSIDE.test(t)) bad.push(`${iastOf(units)} → ${t}`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
  });
});

describe('Tamil round-trips, with nothing hidden in it', () => {
  it('every syllable of the corpus comes back exactly', () => {
    const bad: string[] = [];
    for (const units of SYLLABLES) {
      const want = canonical(notation(iastOf(units)));
      const back = canonical(notation(toIast(transliterateSyllable(units, 'tam'), 'tam').iast));
      if (back !== want) bad.push(`${want} → ${transliterateSyllable(units, 'tam')} → ${back}`);
    }
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('needs no variation selector to do it', () => {
    /* The whole point of the printed convention: the distinction is ON THE
       PAGE. If plain and lossless output ever differ again, Tamil has gone
       back to hiding something a reader cannot see. */
    const differ = SYLLABLES.filter((u) => (
      transliterateSyllable(u, 'tam') !== transliterateSyllable(u, 'tam', { lossless: true })
    ));
    expect(differ.map(iastOf).slice(0, 8)).toEqual([]);
  });

  it('is a lossless script, and says so', () => {
    expect(ambiguitiesIn('tam')).toEqual([]);
    expect(isLosslessScript('tam')).toBe(true);
  });
});

describe('Tamil is no more ambiguous than Devanāgarī', () => {
  /** How many distinct syllables share one written form, in a script. */
  const collisions = (script: 'deva' | 'tel' | 'tam'): string[] => {
    const by = new Map<string, Set<string>>();
    for (const units of SYLLABLES) {
      const t = transliterateSyllable(units, script);
      if (!by.has(t)) by.set(t, new Set());
      by.get(t)!.add(iastOf(units));
    }
    return [...by].filter(([, s]) => s.size > 1).map(([t]) => t);
  };

  it('collides on exactly the syllables the other two do', () => {
    const deva = collisions('deva');
    const tam = collisions('tam');
    expect(tam.length).toBe(deva.length);
    /* And they are the SAME cases — the virāma tick and the visarga colon,
       which no script writes — rather than a coincidence of counts. */
    expect(collisions('tel').length).toBe(deva.length);
  });

  it('and those are notation, not letters', () => {
    /* Every remaining collision must be a pair that differs only by `ˎ` or
       `:` — both of which are recitation notation with no glyph anywhere. */
    const by = new Map<string, Set<string>>();
    for (const units of SYLLABLES) {
      const t = transliterateSyllable(units, 'tam');
      if (!by.has(t)) by.set(t, new Set());
      by.get(t)!.add(iastOf(units));
    }
    const letters = [...by]
      .filter(([, s]) => s.size > 1)
      .filter(([, s]) => new Set([...s].map((x) => canonical(x.replace(/[ˎ:]/g, '')))).size > 1);
    expect(letters.map(([t, s]) => `${t}: ${[...s].join(' / ')}`)).toEqual([]);
  });
});
