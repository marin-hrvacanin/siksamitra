/**
 * A CITED LOCUS, HELD AGAINST HOW THE WITNESS NUMBERS THE LINES.
 *
 * The bot cited taittirīya āraṇyaka 10.35 for a passage that is not there —
 * the owner found it, 10.35 is the Gāyatrī āvāhana. The source it built from
 * prints its own numbers at a passage's end; the check now reads them and
 * says when the locus is not one of them.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, checkDocument, toolsFor, type Host } from '../index.js';

const host: Host = { exporters: {} as never };
const build = toolsFor('deliver', host).find((t) => t.spec.name === 'build_document')!;
const TA = ['तत्स॑वि॒तुर्वरे᳚ण्य॒म् ।', 'भर्गो॑ दे॒वस्य॑ धीमहि ॥ ०। १। ११। ४९॥'];
const made = async (locus: string) => {
  const ws = new Workspace();
  ws.keep('https://sanskritdocuments.org/doc_veda/taittirIyaAraNyaka.html', 'Taittiriya AraNyaka', TA);
  await build.run({ title: 'gāyatrī mantra', locus, source: 'taittiriya', sections: [{ verses: [{ witness: 'w1', at: '1-2' }] }] },
    { ws, host, review: async () => '' });
  return checkDocument(ws).filter((f) => f.what.includes('locus'));
};

describe('the locus of a text built from a witness', () => {
  it('is questioned when the witness numbers the lines otherwise', async () => {
    const said = await made('taittirīya āraṇyaka 10.35');
    expect(said).toHaveLength(1);
    expect(said[0]!.what).toContain('it prints 1.11.49');
  });
  it('and not when it agrees, to the anuvāka or to the verse', async () => {
    expect(await made('taittirīya āraṇyaka 1.11')).toEqual([]);
    expect(await made('taittirīya āraṇyaka 1.11.49')).toEqual([]);
  });
  it('a locus with no numbers, or a witness that prints none, is not judged', async () => {
    expect(await made('taittirīya āraṇyaka')).toEqual([]);
  });
});
