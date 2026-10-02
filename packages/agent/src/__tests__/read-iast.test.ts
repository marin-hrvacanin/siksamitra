/**
 * A DEVANĀGARĪ SOURCE, SHOWN IN IAST, FOR THE MODEL TO COPY.
 *
 * A real run (2026-10-02) transliterated vignanam's Devanāgarī by hand into
 * `spaced` and dropped a svara twice, a build each time. `read_witness` with
 * `iast` shows the lines as the program itself reads them — the very letters
 * `spaced` is compared with — so they are copied, not retyped.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, toolsFor } from '../index.js';
import { asIast } from '../letters.js';
import { testHost } from './fixtures.js';

const host = testHost();
const read = toolsFor('deliver', host).find((t) => t.spec.name === 'read_witness')!;
const LINES = ['ओम् ॥ ओ-म्भूमि॑र्भू॒म्ना', 'पि॒तर॑-ञ्च प्र॒यन्-थ्सुवः॑ ॥', 'plain words, not a mantra'];

async function shown(iast?: boolean): Promise<string> {
  const ws = new Workspace();
  ws.keep('https://vignanam.org/x', 'bhū sūktam', LINES);
  return read.run({ witness: 'w1', from: 1, to: 3, ...(iast === undefined ? {} : { iast }) }, { ws, host, review: async () => '' });
}

describe('read_witness with iast', () => {
  it('shows a Devanāgarī line as the program reads it, svaras on their vowels', async () => {
    const out = await shown(true);
    expect(out).toContain('(Devanāgarī shown in IAST)');
    expect(out).toContain(`2| ${asIast(LINES[1]!)}`);
    expect(asIast(LINES[1]!)).toContain('suva̍ḥ');
    expect(asIast(LINES[1]!)).toContain('pi̱tara̍');
  });
  it('and a line that is not Devanāgarī as it is', async () => {
    expect(await shown(true)).toContain(`3| ${LINES[2]}`);
  });
  it('unasked, every line as the page has it', async () => {
    const out = await shown();
    expect(out).toContain(`2| ${LINES[1]}`);
    expect(out).not.toContain('shown in IAST');
  });
});
