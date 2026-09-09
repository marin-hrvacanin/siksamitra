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
  /**
   * TAMIL IS, NOW.
   *
   * It was not, and this test said so: `க` stood for k, kh, g and gh at once
   * and the five stop vargas each collapsed four ways. That is what NATIVE
   * Tamil orthography does — and it is not how Tamil Sanskrit is printed.
   * Marking the series with superscript digits, which is the convention of
   * Ramakrishna Math, Giri and most stotra publishing, gives each member its
   * own written form. See `tamil.test.ts`.
   */
  it('Tamil is too, once the stop series is marked', () => {
    expect(isLosslessScript('tam')).toBe(true);
    expect(ambiguitiesIn('tam')).toEqual([]);
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

  it('Tamil round-trips every word exactly, in PLAIN mode', () => {
    /* It did not, and could not: `gaṅgā` came back `kaṅkā`, because `g` was
       written `க` and read back as the group's default `k`. The printed
       convention writes it `க³`, so the reading is unambiguous and the round
       trip needs no marker at all. */
    for (const w of WORDS) {
      const there = transliterate(w, 'tam');
      const back = toIast(there, 'tam');
      expect(back.iast, `${w} → ${there} → ${back.iast}`).toBe(w);
      expect(back.ambiguous).toEqual([]);
    }
  });

  it('Tamil in LOSSLESS mode round-trips every word exactly', () => {
    for (const w of WORDS) {
      const there = transliterate(w, 'tam', { lossless: true });
      const back = toIast(there, 'tam', { lossless: true });
      expect(back.iast, `${w} → ${there} → ${back.iast}`).toBe(w);
      expect(back.ambiguous).toEqual([]);
    }
  });

  it('no registered script needs a selector any more', () => {
    /* Tamil was the one that did. Now that the distinction is ON THE PAGE,
       lossless mode has nothing left to add for any of them — which is the
       better answer, because a reader can see it. */
    for (const script of ['deva', 'tel', 'tam'] as const) {
      const plain = transliterate('gaṅgā', script);
      const lossless = transliterate('gaṅgā', script, { lossless: true });
      expect(hasSelectors(plain), script).toBe(false);
      expect(hasSelectors(lossless), script).toBe(false);
      expect(lossless, script).toBe(plain);
    }
  });

  it('and stripping selectors is still the inverse of adding them', () => {
    /* The mechanism stays for the next script that needs it, so it stays
       tested — on a string that carries one, rather than on Tamil, which no
       longer produces any. */
    const withSelector = `க${String.fromCodePoint(0xfe01)}`;
    expect(hasSelectors(withSelector)).toBe(true);
    expect(stripSelectors(withSelector)).toBe('க');
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

  it('the boundary comes back as the control, not as its ASCII spelling', () => {
    // OWNER'S RULING (2026-09-06): the marker carried in IAST text must be a
    // neutral, invisible character. `_` and `+` are the AUTHORING forms —
    // `normalize` rewrites them to ZWNJ/ZWJ before anything else runs — so a
    // reverse conversion emitting `_` produced a second spelling of the same
    // information, depending on which end of the pipeline made it.
    const there = transliterateSyllable(units([['k'], ['t', 'split'], ['y'], ['a']]), 'deva');
    expect(toIast(there, 'deva').iast).toBe(`kt${ZWNJ}ya`);
  });

  it('IAST always carries the conjunct choice, invisibly', () => {
    // THE LOSS THE OWNER NAMED (2026-09-06): Devanāgarī distinguishes `क्त्य`
    // from `क्‌त्य` — whether the stack is composed `kt` + `ya` or `k` + `tya`
    // — and IAST spelled both `ktya`. So a document could not reproduce its own
    // Devanāgarī from its own IAST.
    //
    // Carried ALWAYS rather than only in lossless mode: the control is
    // zero-width, `bare()` strips it before every rule, and the renderer draws
    // nothing for it, so there is no cost to it always being right. A mode you
    // have to remember to switch on is a mode that is off when it matters.
    const split = units([['k', 'split'], ['t'], ['y'], ['a']]);
    const join = units([['k', 'join'], ['t'], ['y'], ['a']]);
    const plain = units([['k'], ['t'], ['y'], ['a']]);

    expect(transliterateSyllable(plain, 'iast')).toBe('ktya');
    expect(transliterateSyllable(split, 'iast')).toBe(`k${ZWNJ}tya`);
    expect(transliterateSyllable(join, 'iast')).toBe(`k${ZWJ}tya`);

    // And the three are now distinguishable, which is the whole point.
    expect(new Set([
      transliterateSyllable(plain, 'iast'),
      transliterateSyllable(split, 'iast'),
      transliterateSyllable(join, 'iast'),
    ]).size).toBe(3);
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
