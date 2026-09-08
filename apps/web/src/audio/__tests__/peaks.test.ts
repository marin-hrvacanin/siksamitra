/**
 * The waveform's columns.
 *
 * The expected numbers are read off the fixture by eye, never computed the way
 * `peaksOf` computes them — the point of the test is that a column covers the
 * samples it claims to and reports both extremes of them, and a test that
 * re-ran the same arithmetic could only agree with itself.
 *
 * The case that matters is the one that made the strip go blank: zoomed in
 * past one sample per pixel, the stride between columns falls below 1.
 */
import { describe, expect, it } from 'vitest';
import { peaksOf } from '../peaks.js';

/** Eight samples, every one distinct, so a column cannot be confused. */
const eight = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5, -0.6, 0.7, -0.8]);

describe('peaks over a range', () => {
  it('reports the highest and lowest sample of each column', () => {
    const { lo, hi } = peaksOf(eight, 0, 8, 4);
    expect([...hi]).toEqual([0.1, 0.3, 0.5, 0.7].map(Math.fround));
    expect([...lo]).toEqual([-0.2, -0.4, -0.6, -0.8].map(Math.fround));
  });

  it('keeps a signal that never crosses zero off the axis', () => {
    /* An average would put a column of constant 0.5 at 0.5 and a column of
       loud oscillation at 0 — the wrong way round, which is why this is
       min/max. */
    const { lo, hi } = peaksOf(new Float32Array([0.5, 0.5, 0.5, 0.5]), 0, 4, 2);
    expect([...lo]).toEqual([0.5, 0.5].map(Math.fround));
    expect([...hi]).toEqual([0.5, 0.5].map(Math.fround));
  });

  it('reads only the range it was given', () => {
    const { hi, lo } = peaksOf(eight, 4, 8, 1);
    expect(hi[0]).toBe(Math.fround(0.7));
    expect(lo[0]).toBe(Math.fround(-0.8));
  });

  it('gives every column a sample when there are fewer samples than columns', () => {
    const { lo, hi } = peaksOf(eight, 2, 4, 6);
    /* Two samples, 0.3 and −0.4, spread over six columns: every column must
       hold one of them, and none may be the empty 0/0 that drew a blank. */
    const real = [0.3, -0.4].map(Math.fround);
    for (let c = 0; c < 6; c += 1) {
      expect(real).toContain(hi[c]);
      expect(hi[c]).toBe(lo[c]);
    }
  });

  it('is empty rather than wrong when there is nothing to draw', () => {
    expect([...peaksOf(new Float32Array(0), 0, 0, 3).hi]).toEqual([0, 0, 0]);
    expect([...peaksOf(eight, 6, 2, 2).hi]).toEqual([0, 0]);
    expect(peaksOf(eight, 0, 8, 0).hi).toHaveLength(1);
  });

  it('clamps a range that runs past the end of the recording', () => {
    const { hi } = peaksOf(eight, 6, 400, 1);
    expect(hi[0]).toBe(Math.fround(0.7));
  });
});
