/**
 * A PAGE WHOSE ROMANISATION IS ITS OWN, SAID WHEN IT IS READ.
 *
 * vignanam's "English" bhū sūktam writes ch for c and ē, ō for e, o. A real
 * run built from it as IAST and had its `ca` refused against the page's `cha`
 * twice (2026-10-02); ch is an IAST letter too, so no fold can undo it.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, toolsFor, type Host } from '../index.js';

const pageOf = (text: string): Host => ({
  research: { search: async () => [], fetch: async (url) => ({ title: url, text }) },
} as unknown as Host);

async function fetched(text: string): Promise<string> {
  const host = pageOf(text);
  const fetch = toolsFor('deliver', host).find((t) => t.spec.name === 'fetch_page')!;
  return fetch.run({ url: 'https://vignanam.org/english/bhu-suktam.html' }, { ws: new Workspace(), host, review: async () => '' });
}

describe('a romanised page', () => {
  it('that writes ch for c is said to be its own romanisation, and the Devanāgarī pointed to', async () => {
    const out = await fetched([
      'a̠sya prā̠ṇāda̍pāna̠tya̍ntaścha̍rati rōcha̠nā ।',
      'vya̍khya-nmahi̠ṣa-ssuva̍ḥ ॥',
      'pi̠tara̍-ñcha pra̠yan-thsuva̍ḥ ॥',
    ].join('\n'));
    /* And it is said to be romanised: its daṇḍas once made it "Devanāgarī". */
    expect(out).toMatch(/lines 1-3: IAST \(3\)/);
    expect(out).toMatch(/romanisation is its own, not IAST \(ch for c, and ē, ō for e, o\)/);
    expect(out).toMatch(/Devanāgarī witness, read with iast: true/);
  });
  it('but IAST, with its own c, is not', async () => {
    const out = await fetched(['a̱sya prā̱ṇāda̍pāna̱tya̍ntaśca̍rati roca̱nā ।', 'vya̍khyan mahi̱ṣas suva̍ḥ ॥', 'tac chro̱ṇai'].join('\n'));
    expect(out).not.toMatch(/romanisation is its own/);
  });
});
