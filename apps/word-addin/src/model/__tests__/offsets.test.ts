/**
 * DOES A SELECTION IN WORD LAND ON THE LETTER SOMEBODY POINTED AT?
 *
 * Word counts characters; the model counts letters. An accent, a svarabhakti
 * dot and a raised reading aid are characters in Word and markings in the
 * model, so the two counts diverge by one for every accent earlier in the line.
 * On a Ṛgvedic pāda that is four or five, and a holding applied at Word's
 * number lands four letters early.
 *
 * NOT TAUTOLOGICAL: the check is against the CORPUS. Every holding in the
 * sampled paragraphs is a box somebody drew in Word years ago, over letters the
 * document records. The map is asked where those letters are in the Word text,
 * and the answer must be those letters — a fact neither `offsetMap` nor the
 * decoder computes.
 */
import { describe, expect, it } from 'vitest';
import type { Mark } from '@siksamitra/format';
import { toTextAndMarks } from '@siksamitra/format';
import { decodeRuns, paragraphRuns } from '../paragraph.js';
import { modelRange, offsetMap, toModel, toWord } from '../offsets.js';
import { corpusVerses } from '../../../../../tests/helpers/corpus.js';

/**
 * A sample rather than the whole corpus.
 *
 * The map is built by decoding one prefix per character, which is quadratic in
 * the length of a paragraph — and a paragraph is now a whole verse, since the
 * exporter writes one `Translit` per verse with `<w:br/>` between the pādas.
 * Sixty of them carry six hundred holdings, which is every letter class the
 * corpus has, and runs in a few seconds.
 */
const SAMPLE = 60;

interface Sampled {
  paragraphs: number;
  faults: string[];
  holds: number;
  exact: number;
  prefix: number;
  withoutAid: number;
  exactWithoutAid: number;
}

function sample(): Sampled {
  const out: Sampled = {
    paragraphs: 0, faults: [], holds: 0, exact: 0, prefix: 0,
    withoutAid: 0, exactWithoutAid: 0,
  };
  for (const { doc, verse } of corpusVerses()) {
    if (out.paragraphs >= SAMPLE) break;
    for (const runs of paragraphRuns(toTextAndMarks(verse))) {
      if (out.paragraphs >= SAMPLE) break;
      out.paragraphs += 1;
      const one = decodeRuns(runs);
      const map = offsetMap(runs);

      if (map.model[0] !== 0) out.faults.push(`${doc} ${verse.id}: offset 0 is not model 0`);
      if (map.model[map.wordText.length] !== one.text.length) {
        out.faults.push(`${doc} ${verse.id}: the end of the paragraph is not the end of the text`);
      }
      for (let i = 1; i < map.model.length; i += 1) {
        if ((map.model[i] ?? 0) < (map.model[i - 1] ?? 0)) {
          out.faults.push(`${doc} ${verse.id}: the map goes backwards at ${i}`);
        }
      }

      for (const m of one.marks) {
        if (m.k !== 'hold' || m.from === m.to) continue;
        out.holds += 1;
        const want = one.text.slice(m.from, m.to);
        const got = map.wordText.slice(toWord(map, m.from), toWord(map, m.to));
        if (got === want) out.exact += 1;
        if (got.startsWith(want)) out.prefix += 1;
        /* A raised reading aid is written straight after the letter it belongs
           to, so the range's end runs past it — which is right, the aid is part
           of the letter, and it is the only reason a slice is not exact. */
        const aided = one.marks.some(
          (x: Mark) => x.k === 'sup' && x.from < m.to && x.to > m.from,
        );
        if (!aided) {
          out.withoutAid += 1;
          if (got === want) out.exactWithoutAid += 1;
        }
      }
    }
  }
  return out;
}

const s = sample();

describe('the offset map', () => {
  it('is sound over every paragraph sampled', () => {
    expect(s.paragraphs).toBe(SAMPLE);
    expect(s.faults).toEqual([]);
  });

  /* A floor rather than an exact count: how many verses fit in sixty
     paragraphs is the exporter's business, and it changed once already. What
     must not change is that every holding is found. */
  it('samples several hundred holdings', () => {
    expect(s.holds).toBeGreaterThan(500);
  });

  it('finds every holding starting on its own first letter', () => {
    expect(s.prefix).toBe(s.holds);
  });

  it('finds every holding on exactly its own letters, reading aids aside', () => {
    expect(s.exactWithoutAid).toBe(s.withoutAid);
    expect(s.withoutAid).toBeGreaterThan(0.95 * s.holds);
  });
});

describe('a selection resolved to a range', () => {
  /*
   * `namaḥ` with an anudātta on the `a` — one accent, so the model is one
   * character shorter than the Word text from the accent onwards. Written as
   * runs by hand rather than derived, because the point is what Word sends.
   */
  const runs = [
    { text: 'na', rStyle: null, superscript: false },
    { text: '̱', rStyle: 'Svara', superscript: false },
    { text: 'maḥ', rStyle: null, superscript: false },
  ];
  const map = offsetMap(runs);

  it('sees five letters in six Word characters', () => {
    expect(map.wordText.length).toBe(6);
    expect(map.text).toBe('namaḥ');
  });

  it('puts the accent at no model position of its own', () => {
    /* Word offsets 2 and 3 straddle the combining mark and both mean "after
       `na`" — the accent is a marking, not a letter. */
    expect(toModel(map, 2)).toBe(2);
    expect(toModel(map, 3)).toBe(2);
  });

  it('maps the last three letters past the accent', () => {
    expect(toModel(map, 4)).toBe(3);
    expect(toModel(map, 6)).toBe(5);
  });

  it('orders a range selected backwards', () => {
    expect(modelRange(map, 6, 4)).toEqual([3, 5]);
  });
});
