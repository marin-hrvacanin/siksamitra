/**
 * A LINE'S TRAILING SPACES, TRIMMED — and a pause among them kept.
 */
import { describe, expect, it } from 'vitest';
import { mark } from '../mark.js';
import { trimLineEnds } from '../trim-lines.js';

const pauseAt = (at: number) => mark({ k: 'pause', from: at, to: at, v: 'short' });

describe('a line’s end', () => {
  it('loses its trailing spaces', () => {
    expect(trimLineEnds({ text: 'nābhir  \nviyad', marks: [] }).text).toBe('nābhir\nviyad');
  });
  it('keeps a pause at its very end, and the space before it', () => {
    const out = trimLineEnds({ text: 'vareṇyam \nbhargo', marks: [pauseAt(9)] });
    expect(out.text).toBe('vareṇyam \nbhargo');
    expect(out.marks.map((m) => [m.k, m.from])).toEqual([['pause', 9]]);
  });
  it('keeps a pause written between two spaces, and trims only what follows it', () => {
    /* The rules write `sp · pause · sp` before a line break at a yati. */
    const out = trimLineEnds({ text: 'nābhir  \nviyad', marks: [pauseAt(7)] });
    expect(out.text).toBe('nābhir \nviyad');
    expect(out.marks.map((m) => [m.k, m.from])).toEqual([['pause', 7]]);
  });
});
