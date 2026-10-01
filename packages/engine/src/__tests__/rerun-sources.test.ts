/**
 * A LINE RE-MARKED FROM ONE SOURCE TO ANOTHER, AND BACK — in every direction.
 *
 * Each step undoes what the line's current source made (`previous`) and marks
 * it by the new one, so any path that ends in a source gives what that source
 * makes of the plain line. The fault this holds: Smārta PLACES svaras (the
 * śloka's, by its metre), and re-marked as Ṛgveda those were read as the
 * text's own accents — kept, and lengthened into dīrgha-svaritas.
 */
import { describe, expect, it } from 'vitest';
import type { TextAndMarks } from '@siksamitra/format';
import { STAGES, placesSvaras, rerun, resolveProfile } from '../index.js';

type Key = 'taittiriya' | 'rigveda' | 'sukla-yajurveda' | 'smarta';
const KEYS: readonly Key[] = ['taittiriya', 'rigveda', 'sukla-yajurveda', 'smarta'];
const P = (k: Key) => resolveProfile([{ preset: k }]);
const LINES = [
  'yā devī sarvabhūteṣu śaktirūpeṇa saṁsthitā',
  'tryaśītitamaṁ sūktam',
  'agnim īḻe purohitaṁ yajñasya devam ṛtvijam',
];

const mark = (tm: TextAndMarks, to: Key, from?: Key): TextAndMarks => {
  const out = rerun(tm, {
    stages: STAGES, mode: 'keep-hand', profile: P(to), from: 0, to: tm.text.length,
    ...(from === undefined ? {} : { previous: P(from) }),
  });
  return { text: out.text, marks: out.marks };
};

describe('switching a line’s source', () => {
  it('Smārta places svaras; the Vedic sources read them', () => {
    expect(placesSvaras(P('smarta'))).toBe(true);
    for (const k of ['taittiriya', 'rigveda', 'sukla-yajurveda'] as const) expect(placesSvaras(P(k))).toBe(false);
  });

  for (const text of LINES) {
    it(`any source to any other gives what the other makes of the plain line — ${text}`, () => {
      const plain = { text, marks: [] };
      for (const a of KEYS) {
        for (const b of KEYS) {
          const direct = mark(plain, b);
          const via = mark(mark(plain, a), b, a);
          expect(via, `${a} → ${b}`).toEqual(direct);
        }
      }
    });

    it(`and a long way round comes back exactly — ${text}`, () => {
      const plain = { text, marks: [] };
      let tm = mark(plain, 'rigveda');
      const first = tm;
      let at: Key = 'rigveda';
      for (const k of ['taittiriya', 'smarta', 'sukla-yajurveda', 'smarta', 'rigveda'] as const) {
        tm = mark(tm, k, at);
        at = k;
      }
      expect(tm).toEqual(first);
    });
  }

  it('an ACCENTED line keeps its own accents under Smārta, and gets them back in any Vedic source', () => {
    /* sa̱hasra̍śīrṣā̱ puru̍ṣaḥ — the text's accents, as marks. */
    const text = 'sahasraśīrṣā puruṣaḥ sahasrākṣaḥ sahasrapāt';
    const accents = [[1, 2, 'anudatta'], [5, 6, 'svarita'], [11, 12, 'anudatta'], [16, 17, 'svarita']] as const;
    const accented: TextAndMarks = { text, marks: accents.map(([from, to, v]) => ({ k: 'svara' as const, from, to, v, by: 'hand' as const })) };
    const svaras = (tm: TextAndMarks) => tm.marks.filter((m) => m.k === 'svara').map((m) => `${m.from}:${m.v}`);
    const asSmarta = mark(accented, 'smarta');
    expect(svaras(asSmarta)).toEqual(svaras(accented));
    for (const k of ['taittiriya', 'sukla-yajurveda'] as const) {
      expect(svaras(mark(asSmarta, k, 'smarta')), k).toEqual(svaras(mark(accented, k)));
    }
  });
});
