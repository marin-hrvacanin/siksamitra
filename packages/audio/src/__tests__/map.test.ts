/**
 * Mapping a recitation onto a text.
 *
 * These are about the two halves keeping their promises: the arithmetic gets
 * the PROPORTIONS right whatever the recording does, the snapping gets the
 * SECONDS right where there is a breath to get them from, and neither is ever
 * allowed to produce a segment that runs backwards — which is the one failure
 * a reader turns into audio that plays for ever.
 */
import { describe, expect, it } from 'vitest';
import { confidence, mapPadas, type Pada } from '../map.js';
import { detectSilences, middleOf } from '../silence.js';

const pada = (verseId: string, line: number, weight: number): Pada => ({ verseId, line, weight });

/** Four equal pādas, so every expected boundary is a round number. */
const four: Pada[] = [
  pada('v-1', 0, 8), pada('v-1', 1, 8), pada('v-2', 0, 8), pada('v-2', 1, 8),
];

describe('mapping by weight', () => {
  it('divides the time in proportion to the syllables', () => {
    const out = mapPadas(four, 40);
    expect(out.map((m) => [m.start, m.end])).toEqual([[0, 10], [10, 20], [20, 30], [30, 40]]);
  });

  it('gives a long pāda more of the recording than a short one', () => {
    const out = mapPadas([pada('v-1', 0, 4), pada('v-1', 1, 12)], 32);
    expect(out[0]!.end).toBe(8);
    expect(out[1]!.end - out[1]!.start).toBe(24);
  });

  it('starts and ends where the recitation does, not where the file does', () => {
    const out = mapPadas(four, 60, [], { from: 10, to: 50 });
    expect(out[0]!.start).toBe(10);
    expect(out[out.length - 1]!.end).toBe(50);
  });

  it('covers the whole span with no gap and no overlap', () => {
    const out = mapPadas(
      [pada('a', 0, 5), pada('a', 1, 9), pada('b', 0, 3), pada('b', 1, 11), pada('b', 2, 7)],
      97.3,
    );
    for (let i = 1; i < out.length; i += 1) expect(out[i]!.start).toBe(out[i - 1]!.end);
    expect(out[0]!.start).toBe(0);
    expect(out[out.length - 1]!.end).toBeCloseTo(97.3, 2);
  });

  it('has nothing to say about an empty text or a zero-length recording', () => {
    expect(mapPadas([], 40)).toEqual([]);
    expect(mapPadas(four, 0)).toEqual([]);
    expect(mapPadas(four, 40, [], { from: 30, to: 10 })).toEqual([]);
  });
});

describe('snapping to the breaths', () => {
  it('pulls a boundary onto a real silence, and says it did', () => {
    /* The arithmetic wants 10, 20, 30; the singer breathed at 10.6 and 20.4. */
    const out = mapPadas(four, 40, [
      { start: 10.4, end: 10.8 }, { start: 20.2, end: 20.6 },
    ]);
    expect(out[0]!.end).toBe(10.6);
    expect(out[1]!.end).toBe(20.4);
    expect(out[1]!.from).toBe('breath');
    expect(out[2]!.from).toBe('breath');
  });

  it('leaves a boundary where the arithmetic put it when no breath is near', () => {
    const out = mapPadas(four, 40, [{ start: 3, end: 3.4 }]);
    expect(out[1]!.end).toBe(20);
    expect(out[1]!.from).toBe('even');
  });

  it('will not let a boundary jump to the next pāda’s breath', () => {
    /* A silence 6 s away is somebody else's boundary, whatever it is nearest to. */
    const out = mapPadas(four, 40, [{ start: 15.8, end: 16.2 }], { snapWithin: 1.2 });
    expect(out[0]!.end).toBe(10);
  });

  it('never produces a pāda that ends before it starts', () => {
    /* Two seams snapping to one breath is the way this happens in the wild:
       a very short pāda between two long silences. */
    const out = mapPadas(
      [pada('a', 0, 20), pada('a', 1, 1), pada('a', 2, 20)],
      41,
      [{ start: 19.6, end: 20.4 }, { start: 20.0, end: 20.8 }],
    );
    for (const m of out) expect(m.end, JSON.stringify(m)).toBeGreaterThan(m.start);
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]!.start).toBeGreaterThanOrEqual(out[i - 1]!.start);
    }
  });

  it('reports how much of the mapping was heard rather than guessed', () => {
    expect(confidence([])).toBe(0);
    const heard = mapPadas(four, 40, [
      { start: 9.9, end: 10.1 }, { start: 19.9, end: 20.1 }, { start: 29.9, end: 30.1 },
    ]);
    expect(confidence(heard)).toBe(1);
    expect(confidence(mapPadas(four, 40, []))).toBe(0);
  });

  it('rounds to a hundredth of a second, which nobody can hear and bytes can', () => {
    const out = mapPadas([pada('a', 0, 1), pada('a', 1, 2)], 1 / 3);
    for (const m of out) {
      expect(Number.isInteger(m.start * 100)).toBe(true);
      expect(Number.isInteger(m.end * 100)).toBe(true);
    }
  });
});

/* ── the two halves, joined ─────────────────────────────────────────────── */

/** A recitation: bursts of tone with silence between them. */
function fakeTake(rate: number, parts: { seconds: number; loud: boolean }[]): Float32Array {
  const total = parts.reduce((n, p) => n + p.seconds, 0);
  const pcm = new Float32Array(Math.round(total * rate));
  let at = 0;
  for (const part of parts) {
    const n = Math.round(part.seconds * rate);
    for (let i = 0; i < n; i += 1) {
      pcm[at + i] = part.loud ? Math.sin((2 * Math.PI * 220 * i) / rate) * 0.5 : 0;
    }
    at += n;
  }
  return pcm;
}

describe('end to end, on a recording', () => {
  const rate = 8000;
  /* Four pādas of unequal length, with a breath between each. */
  const take = fakeTake(rate, [
    { seconds: 3, loud: true }, { seconds: 0.5, loud: false },
    { seconds: 5, loud: true }, { seconds: 0.5, loud: false },
    { seconds: 2, loud: true }, { seconds: 0.5, loud: false },
    { seconds: 4, loud: true },
  ]);

  it('finds the breaths, and only the breaths', () => {
    const gaps = detectSilences(take, rate);
    expect(gaps).toHaveLength(3);
    expect(middleOf(gaps[0]!)).toBeCloseTo(3.25, 1);
    expect(middleOf(gaps[1]!)).toBeCloseTo(8.75, 1);
    expect(middleOf(gaps[2]!)).toBeCloseTo(11.25, 1);
  });

  it('lands every boundary inside its own breath', () => {
    const gaps = detectSilences(take, rate);
    /* Weights roughly matching the durations — which is what a real text does,
       since a longer pāda has more syllables. */
    const padas = [pada('v-1', 0, 6), pada('v-1', 1, 10), pada('v-2', 0, 4), pada('v-2', 1, 8)];
    const out = mapPadas(padas, take.length / rate, gaps, { snapWithin: 1.5 });
    expect(out.every((m) => m.from === 'breath')).toBe(true);
    for (const [i, gap] of gaps.entries()) {
      const seam = out[i]!.end;
      expect(seam, `boundary ${i}`).toBeGreaterThanOrEqual(gap.start);
      expect(seam, `boundary ${i}`).toBeLessThanOrEqual(gap.end);
    }
  });

  it('hears nothing in silence, and says the whole file is a gap', () => {
    expect(detectSilences(new Float32Array(rate), rate)).toEqual([{ start: 0, end: 1 }]);
    expect(detectSilences(new Float32Array(0), rate)).toEqual([]);
  });

  it('is not fooled by a quiet recording — the threshold is relative to its peak', () => {
    const quiet = take.map((v) => v * 0.01) as Float32Array;
    expect(detectSilences(quiet, rate)).toHaveLength(3);
  });
});
