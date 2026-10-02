/**
 * HIS OWN DOCUMENTS IN THE LIBRARY — delivered as his files, or read as examples.
 *
 * His concern, in his words (2026-10-02): "I don't want it to misinterpret
 * something as being found in the library and by doing so sends something
 * wrong, but it is nice as an example in many ways." So a text of his is
 * shown with what tells it from a namesake — its first words — and sent as his
 * own bytes only while it is untouched and in the format he made it; and an
 * example is read, never opened, so it cannot be sent.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, documentOf, toolsFor, type Delivered, type Host, type Library } from '../index.js';

const DOC = documentOf({ title: 'bhū sūktam', sections: [{ verses: [{ lines: ['bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā ।', 'u̱pasthe̍ te devya-dite̱ ॥'] }] }] });
const HIS_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3]);

function hostWith(delivered: Delivered[]): Host {
  const library: Library = {
    find: async () => [{ id: 'his:bhu-suktam-v1-1', title: 'bhū sūktam v1.1', kind: 'reference', source: 'kṛṣṇa yajurvedīya', note: 'his own document, in IAST, 1 verses', first: 'bhūmir bhūmnā dyaur' }],
    load: async () => ({ doc: DOC, kind: 'reference' }),
    original: async (id) => (id === 'his:bhu-suktam-v1-1' ? { name: 'bhū sūktam v1.1.pdf', bytes: HIS_PDF } : null),
  };
  const made = (format: 'pdf' | 'docx') => async (_doc: unknown, name: string): Promise<Delivered> =>
    ({ name: `${name}.${format}`, mime: '', bytes: new Uint8Array([9, 9]), format });
  return { library, exporters: { pdf: made('pdf'), docx: made('docx') }, deliver: async (f) => { delivered.push(f); } };
}

const tool = (host: Host, name: string) => toolsFor('deliver', host).find((t) => t.spec.name === name)!;
const run = (host: Host, ws: Workspace, name: string, args: Record<string, unknown>) => tool(host, name).run(args, { ws, host, review: async () => '' });

describe('a text of his, found', () => {
  it('is shown as his own, with its tradition and its first words', async () => {
    const host = hostWith([]);
    const said = await run(host, new Workspace(), 'find_text', { query: 'bhu suktam' });
    expect(said).toBe('his:bhu-suktam-v1-1 · bhū sūktam v1.1 · his own · kṛṣṇa yajurvedīya · his own document, in IAST, 1 verses · begins "bhūmir bhūmnā dyaur"');
  });
});

describe('his own file, as he made it', () => {
  it('opened and untouched, asked for in its own format: his bytes are what is sent', async () => {
    const delivered: Delivered[] = [];
    const host = hostWith(delivered);
    const ws = new Workspace();
    await run(host, ws, 'open_text', { id: 'his:bhu-suktam-v1-1' });
    const said = await run(host, ws, 'deliver', { format: 'pdf' });
    expect(said).toMatch(/^delivered his own file, bhū sūktam v1\.1\.pdf/);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.name).toBe('bhū sūktam v1.1.pdf');
    expect([...delivered[0]!.bytes]).toEqual([...HIS_PDF]);
    expect(delivered[0]!.summary).toBeDefined();
  });

  it('in another format, it is made from the document', async () => {
    const delivered: Delivered[] = [];
    const host = hostWith(delivered);
    const ws = new Workspace();
    await run(host, ws, 'open_text', { id: 'his:bhu-suktam-v1-1' });
    await run(host, ws, 'deliver', { format: 'docx' });
    expect([...delivered[0]!.bytes]).toEqual([9, 9]);
  });

  it('changed since it was opened, it is his no longer, and is made from the document', async () => {
    const delivered: Delivered[] = [];
    const host = hostWith(delivered);
    const ws = new Workspace();
    await run(host, ws, 'open_text', { id: 'his:bhu-suktam-v1-1' });
    await run(host, ws, 'set_field', { path: 'title', value: 'bhū sūktam, as asked' });
    expect(ws.need()).not.toBe(ws.opened!.doc);
    await run(host, ws, 'deliver', { format: 'pdf' });
    expect([...delivered[0]!.bytes]).toEqual([9, 9]);
  });

  it('and a document built in its place is never his file', async () => {
    const delivered: Delivered[] = [];
    const host = hostWith(delivered);
    const ws = new Workspace();
    await run(host, ws, 'open_text', { id: 'his:bhu-suktam-v1-1' });
    ws.open(DOC);
    expect(ws.opened).toBeNull();
  });
});

describe('a text of his, read as an example', () => {
  it('is shown as an example, and is not opened', async () => {
    const host = hostWith([]);
    const ws = new Workspace();
    const said = await run(host, ws, 'read_example', { id: 'his:bhu-suktam-v1-1', verses: '1' });
    expect(said).toMatch(/^AN EXAMPLE, not the document: "bhū sūktam" — verses 1-1 of 1/);
    expect(said).toContain('bhūmi̍r bhū̱mnā dyaur');
    expect(ws.doc).toBeNull();
    expect(ws.opened).toBeNull();
  });
  it('asked for no verses, it is shown whole as its shape: each part, how many verses, numbered or not', async () => {
    const host = hostWith([]);
    const said = await run(host, new Workspace(), 'read_example', { id: 'his:bhu-suktam-v1-1' });
    expect(said).toMatch(/^AN EXAMPLE, not the document — the structure of "bhū sūktam"/);
    expect(said).toMatch(/s-1 \(no heading\) — 1 verse\(s\), (?:un)?numbered: “bhūmi̍r bhū̱mnā dyaur/u);
  });
  it('one part of it in full, by the id its structure gives', async () => {
    const host = hostWith([]);
    const said = await run(host, new Workspace(), 'read_example', { id: 'his:bhu-suktam-v1-1', section: 's-1' });
    expect(said).toMatch(/^AN EXAMPLE, not the document: "bhū sūktam" — verses 1-1 of 1/);
    expect(said).toContain('bhūmi̍r bhū̱mnā dyaur');
    await expect(run(host, new Workspace(), 'read_example', { id: 'his:bhu-suktam-v1-1', section: 's-9' })).rejects.toThrow(/no section "s-9"/);
  });
  it('at most eight verses at a time', async () => {
    const many = documentOf({ title: 'x', sections: [{ verses: Array.from({ length: 20 }, (_, i) => ({ lines: [`ve̍rse a̱nyat ॥ ${i + 1}॥`] })) }] });
    const host: Host = { library: { find: async () => [], load: async () => ({ doc: many, kind: 'reference' }) } };
    const said = await run(host, new Workspace(), 'read_example', { id: 'x', verses: '3-19' });
    expect(said).toMatch(/verses 3-10 of 20/);
  });
});
