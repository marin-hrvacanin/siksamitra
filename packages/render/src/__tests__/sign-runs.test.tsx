/**
 * WHERE A LINE MAY NOT BREAK — `signRuns`, and the no-break space.
 *
 * His words (2026-10-02): "we have "||" at the end and in the next line "1||"
 * which is just awful in all regards". A daṇḍa never begins a line, and
 * `॥ 1॥` is one sign: the space before it, its signs and the spaces between
 * them are one piece; the space after it is still a place to break.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NBSP, type ChantToken } from '@siksamitra/format';
import { renderToken, signRuns } from '../render/tokens.js';

const syl = { t: 'syl' } as ChantToken;
const sp: ChantToken = { t: 'sp' };
const danda = (s: string): ChantToken => ({ t: 'danda', s });
const num = (s: string): ChantToken => ({ t: 'num', s });

describe('the runs of signs a line does not break inside', () => {
  it('a verse’s end — the space before it, ॥, its number and ॥ — is one run', () => {
    expect(signRuns([syl, syl, sp, danda('॥'), sp, num('1'), danda('॥')])).toEqual([[2, 6]]);
  });

  it('a daṇḍa keeps the space before it, and leaves the one after it free', () => {
    expect(signRuns([syl, sp, danda('।'), sp, syl])).toEqual([[1, 2]]);
  });

  it('a line that opens with a daṇḍa runs from it; each sign of a line is its own run', () => {
    expect(signRuns([danda('॥'), sp, syl, sp, syl, sp, danda('॥')])).toEqual([[0, 0], [5, 6]]);
  });

  it('a line with no signs has no runs', () => {
    expect(signRuns([syl, sp, syl])).toEqual([]);
  });
});

describe('a space', () => {
  it('his no-break space is drawn as one, and an ordinary space is not', () => {
    expect(renderToStaticMarkup(<>{renderToken({ t: 'sp', nb: true }, 0, { script: 'iast' } as never)}</>)).toContain(NBSP);
    expect(renderToStaticMarkup(<>{renderToken(sp, 0, { script: 'iast' } as never)}</>)).not.toContain(NBSP);
  });
});
