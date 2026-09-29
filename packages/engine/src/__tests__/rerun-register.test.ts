/**
 * CHANGING A LINE'S REGISTER, AND CHANGING IT BACK.
 *
 * A person selects a Taittirīya line and chooses the Ṛgveda: the rules run
 * under it. They choose the Taittirīya again: the line is what it was. And
 * pressing the same register twice changes nothing the second time. Each case
 * is a line of the owner's, in the shape the Word add-in and the app read a
 * marked line in.
 */
import { describe, expect, it } from 'vitest';
import { toTextAndMarks, type TextAndMarks } from '@siksamitra/format';
import { STAGES, derive, rerun, resolveProfile, showsLengthening } from '../index.js';

const P = (preset: string, patch?: object) => resolveProfile([{ preset, ...(patch ? { patch } : {}) } as never]);
const run = (tm: TextAndMarks, preset: string, previous?: string) => rerun(tm, {
  stages: STAGES, mode: 'keep-hand', profile: P(preset), from: 0, to: tm.text.length,
  ...(previous === undefined ? {} : { previous: P(previous) }),
});
/* `by` is not compared: Word cannot store it, and a document read out of Word
   calls every marking hand. What is compared is what the page shows. */
const shown = (tm: TextAndMarks): string => JSON.stringify([tm.text,
  tm.marks.map(({ by: _by, ...m }) => JSON.stringify(m)).sort()]);
/** A line as a document holds it: typed accents, marked under `preset`. */
const line = (accented: string, preset = 'taittiriya'): TextAndMarks => toTextAndMarks({
  id: 'v',
  tokens: derive({ lines: [accented.replace(/[̱̍̎]/g, '')], accented: [accented] }, P(preset), { trace: false }).tokens,
} as never);

const LINES = [
  'agni̱mī̍ḻe pu̱rohi̍taṁ ya̱jñasya̍ de̱vamṛ̱tvija̍m',
  'sa devān eha vakṣati',
  'tvā̍ yu̍vase',
  'saṁsa̱midyu̍vase vṛṣa̱nna-gne̱ viśvā̍nya̱-rya ā',
  'dakṣi̍ṇena',
];

describe('Taittirīya → Ṛgveda → Taittirīya gives back the line', () => {
  for (const acc of LINES) {
    it(acc, () => {
      const t = line(acc);
      const r = run(t, 'rigveda', 'taittiriya');
      expect(shown(run(r, 'taittiriya', 'rigveda'))).toBe(shown(t));
    });
  }
});

describe('the same register twice changes nothing the second time', () => {
  for (const acc of LINES) {
    it(`Ṛgveda: ${acc}`, () => {
      const r = run(line(acc), 'rigveda', 'taittiriya');
      expect(shown(run(r, 'rigveda'))).toBe(shown(r));
    });
    it(`Taittirīya: ${acc}`, () => {
      const t = line(acc);
      expect(shown(run(t, 'taittiriya'))).toBe(shown(t));
    });
  }
});

describe('what the switch actually does', () => {
  it('the Ṛgveda lengthens a svarita on a long vowel — its svara rules RUN on a re-run', () => {
    const r = run(line('tvā̍ yu̍vase'), 'rigveda', 'taittiriya');
    expect(r.marks).toContainEqual(expect.objectContaining({ k: 'svara', v: 'dirgha-svarita', from: 2, to: 3 }));
    expect(r.text).toContain('u̅');
  });
  it('the anunāsika appears, and goes when the register goes', () => {
    const r = run(line('sa devān eha'), 'rigveda', 'taittiriya');
    expect(r.text).toContain('devām̐');
    expect(run(r, 'taittiriya', 'rigveda').text).toBe('sa devān eha');
  });
  it('and it survives a second Ṛgveda run: it was an n, not an anusvāra', () => {
    const r = run(line('sa devān eha'), 'rigveda', 'taittiriya');
    const twice = run(r, 'rigveda');
    expect(twice.text).toBe(r.text);
    expect(twice.marks).toContainEqual(expect.objectContaining({ k: 'was', v: 'n' }));
  });
  it('a Ṛgvedic text with lengthening OFF keeps its typed dīrgha-svarita — the control', () => {
    const off = rerun(line('tvā̎'), {
      stages: STAGES, mode: 'keep-hand', profile: P('rigveda', { svara: { lengthening: false } }),
      from: 0, to: 3,
    });
    expect(off.marks).toContainEqual(expect.objectContaining({ k: 'svara', v: 'dirgha-svarita' }));
  });
});

describe('a line that shows it was lengthened', () => {
  it('the overline says so', () => {
    expect(showsLengthening(run(line('tvā̍ yu̍vase'), 'rigveda', 'taittiriya'))).toBe(true);
  });
  it('an accent moved onto a nasal says so', () => {
    expect(showsLengthening(run(line('ditsa̍ntam'), 'rigveda', 'taittiriya'))).toBe(true);
  });
  it('a Taittirīya line does not, whatever its accents — the control', () => {
    for (const acc of LINES) expect(showsLengthening(line(acc)), acc).toBe(false);
  });
  it('a dīrgha-svarita on a long vowel alone does not: the Taittirīya types those', () => {
    expect(showsLengthening(line('tvā̎'))).toBe(false);
  });
});
