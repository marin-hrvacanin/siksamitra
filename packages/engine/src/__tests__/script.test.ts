/**
 * Scripts: the losslessness gate, and the conjunct boundary.
 *
 * "All scripts mutually interchangeable, lossless conversion between them,
 * always" is the requirement. It is met in two different ways, and the
 * difference matters:
 *
 *   - Devanāgarī and Telugu carry every distinction IAST does, so they
 *     round-trip on their own.
 *   - Tamil does NOT: its native orthography has no aspiration and no voicing
 *     contrast, so `k kh g gh` are all `க`. Native Tamil is therefore lossy BY
 *     DESIGN, and lossless mode adds variation selectors — which render as
 *     nothing — to carry what the glyph cannot show.
 *
 * A test that quietly passed for Tamil would be hiding the interesting fact, so
 * the lossy case is asserted explicitly rather than skipped.
 */
import { describe, expect, it } from 'vitest';
import {
  ambiguitiesIn, detectScript, hasSelectors, isLosslessScript, stripSelectors,
  toIast, transliterate, transliterateSyllable,
} from '../script/index.js';
import { ZWJ, ZWNJ } from '../alphabet.js';

const WORDS = [
  'puruṣa', 'sahasra', 'śiva', 'agni', 'kṛṣṇa', 'brahman', 'jñāna',
  'tvam', 'devīṁ', 'namaḥ', 'oṁ', 'saṁskṛta', 'kṣatriya', 'vāyu',
  'indra', 'yajña', 'ṛta', 'aiśvarya', 'auṣadha', 'ḍhakkā',
];

describe('which scripts are lossless on their own', () => {
  it('Devanāgarī and Telugu are', () => {
    expect(isLosslessScript('deva')).toBe(true);
    expect(isLosslessScript('tel')).toBe(true);
  });
  it('Tamil is not, and says which letters it cannot tell apart', () => {
    expect(isLosslessScript('tam')).toBe(false);
    const amb = ambiguitiesIn('tam');
    const byGlyph = new Map(amb.map((a) => [a.glyph, a.letters]));
    // The five stop vargas collapse four ways each; `ஜ` collapses two.
    expect(byGlyph.get('க')).toEqual(['k', 'kh', 'g', 'gh']);
    expect(byGlyph.get('ச')).toEqual(['c', 'ch']);
    expect(byGlyph.get('ட')).toEqual(['ṭ', 'ṭh', 'ḍ', 'ḍh']);
    expect(byGlyph.get('த')).toEqual(['t', 'th', 'd', 'dh']);
    expect(byGlyph.get('ப')).toEqual(['p', 'ph', 'b', 'bh']);
    expect(byGlyph.get('ஜ')).toEqual(['j', 'jh']);
  });
});

describe('round trip — IAST → script → IAST', () => {
  for (const script of ['deva', 'tel'] as const) {
    it(`${script} round-trips every word exactly`, () => {
      for (const w of WORDS) {
        const there = transliterate(w, script);
        const back = toIast(there, script);
        expect(back.iast, `${w} → ${there} → ${back.iast}`).toBe(w);
        expect(back.ambiguous).toEqual([]);
      }
    });
  }

  it('native Tamil is lossy, and reports exactly where', () => {
    const there = transliterate('gaṅgā', 'tam');
    const back = toIast(there, 'tam');
    // `g` is written `க`, which reads back as the group's default `k`.
    expect(back.iast).not.toBe('gaṅgā');
    expect(back.ambiguous.length).toBeGreaterThan(0);
    expect(back.ambiguous[0]!.alternatives).toEqual(['k', 'kh', 'g', 'gh']);
  });

  it('Tamil in LOSSLESS mode round-trips every word exactly', () => {
    for (const w of WORDS) {
      const there = transliterate(w, 'tam', { lossless: true });
      const back = toIast(there, 'tam', { lossless: true });
      expect(back.iast, `${w} → ${there} → ${back.iast}`).toBe(w);
      expect(back.ambiguous).toEqual([]);
    }
  });

  it('the selectors render as nothing — stripping them gives the plain form', () => {
    const plain = transliterate('gaṅgā', 'tam');
    const lossless = transliterate('gaṅgā', 'tam', { lossless: true });
    expect(hasSelectors(lossless)).toBe(true);
    expect(hasSelectors(plain)).toBe(false);
    expect(stripSelectors(lossless)).toBe(plain);
  });

  it('a lossless script emits no selectors even when asked', () => {
    for (const script of ['deva', 'tel'] as const) {
      expect(hasSelectors(transliterate('gaṅgā', script, { lossless: true }))).toBe(false);
    }
  });
});

describe('the conjunct boundary (01 §2.5)', () => {
  const units = (spec: [string, ('split' | 'join')?][]) =>
    spec.map(([c, cj]) => (cj === undefined ? { c } : { c, cj }));

  it('a split emits virāma + ZWNJ, a join virāma + ZWJ', () => {
    const split = transliterateSyllable(units([['k'], ['t', 'split'], ['y'], ['a']]), 'deva');
    const join = transliterateSyllable(units([['k'], ['t', 'join'], ['y'], ['a']]), 'deva');
    const none = transliterateSyllable(units([['k'], ['t'], ['y'], ['a']]), 'deva');
    expect(split).toContain(ZWNJ);
    expect(join).toContain(ZWJ);
    expect(none).not.toContain(ZWNJ);
    expect(none).not.toContain(ZWJ);
    // The control is the ONLY difference: strip it and the three agree.
    expect(split.replace(ZWNJ, '')).toBe(none);
    expect(join.replace(ZWJ, '')).toBe(none);
  });

  it('absent `cj` changes nothing — the shipped documents must not move', () => {
    expect(transliterateSyllable(units([['s'], ['r'], ['a']]), 'deva')).toBe('स्र');
    expect(transliterateSyllable(units([['s'], ['r'], ['a']]), 'tel')).toBe('స్ర');
  });

  it('the boundary survives a round trip as its ASCII authoring form', () => {
    const there = transliterateSyllable(units([['k'], ['t', 'split'], ['y'], ['a']]), 'deva');
    expect(toIast(there, 'deva').iast).toBe('kt_ya');
  });
});

describe('script detection', () => {
  it('names the script, or says mixed', () => {
    expect(detectScript('पुरुष')).toBe('deva');
    expect(detectScript('పురుష')).toBe('tel');
    expect(detectScript('புருஷ')).toBe('tam');
    expect(detectScript('puruṣa')).toBe('iast');
    expect(detectScript('पुरुष புருஷ')).toBe('mixed');
    expect(detectScript('123 ॥')).toBe('unknown');
  });
});
