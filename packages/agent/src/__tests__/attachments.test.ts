/**
 * WHAT THE PERSON SENDS, OPENED — one pipeline for the bot, the app and the
 * add-in (the owner, 2026-10-02: "check/verify uploaded documents … Same
 * pipeline"). The store keeps a file by its content; the tools make it the
 * document, a witness, or a picture the model sees; `verify` says how a
 * document of theirs stands against the rules, without changing it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readChantFile, type ChantToken } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { packDocument } from '@siksamitra/interop';
import { ATTACHMENT_MAX, attachedNote, kindOf, memoryAttachments } from '../attachments.js';
import { Workspace, toolsFor, type Host } from '../index.js';
import { documentOf } from '../build.js';
import { markAll } from '../tools/document.js';

const durga = () => {
  const r = readChantFile(readFileSync('corpus/chants/durga-suktam.json', 'utf8'));
  if (!r.ok) throw new Error(r.error);
  return openChantDoc(r.doc);
};
const store = memoryAttachments();
const host: Host = { attachments: store };
const tools = toolsFor('deliver', host);
const shown: { caption: string; mime: string | undefined }[] = [];
const call = (ws: Workspace, name: string, args: Record<string, unknown>) =>
  tools.find((t) => t.spec.name === name)!.run(args, { ws, host, review: async () => '', show: (_b, caption, mime) => { shown.push({ caption, mime }); } });

describe('the store', () => {
  it('keeps a file by its content: sent twice, it is one', async () => {
    const a = await store.put('a.txt', 'text/plain', new TextEncoder().encode('oṁ'));
    const b = await store.put('again.txt', 'text/plain', new TextEncoder().encode('oṁ'));
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{32}$/u);
    expect((await store.get(a.id))?.size).toBe(3 + 1);
  });

  it('refuses one too large, or empty', async () => {
    await expect(store.put('big.pdf', 'application/pdf', new Uint8Array(ATTACHMENT_MAX + 1))).rejects.toThrow(/at most 20 MB/);
    await expect(store.put('none.txt', 'text/plain', new Uint8Array(0))).rejects.toThrow(/empty/);
  });

  it('says what each file is, by its name first', () => {
    expect([kindOf('x.docx', ''), kindOf('x.pdf', ''), kindOf('scan', 'image/jpeg'), kindOf('t.itx', ''), kindOf('x.zip', '')])
      .toEqual(['document', 'pdf', 'image', 'text', 'other']);
  });

  it('and names it to the agent in one line', async () => {
    const bytes = new TextEncoder().encode('jātavedase');
    const a = await store.put('durgā sūktam.txt', 'text/plain', bytes);
    expect(attachedNote(a)).toBe(`[sent “durgā sūktam.txt”, a text file of ${bytes.length} B — attachment ${a.id}]`);
  });
});

describe('a file, opened', () => {
  it('a document of ours becomes the open document, as its author made it', async () => {
    const bytes = await packDocument(durga(), { slug: 'durga.smdoc', engine: 'test' });
    const a = await store.put('durgā sūktam.smdoc', 'application/zip', bytes);
    const ws = new Workspace();
    expect(await call(ws, 'open_attachment', { attachment: a.id })).toMatch(/^opened “durgā sūktam\.smdoc” as the document, as its author made it/);
    expect(ws.origin).toBe('author');
    expect(ws.need().title).toBe(durga().title);
  });

  it('a text is kept as a witness, its HTML taken off', async () => {
    const a = await store.put('page.html', 'text/html', new TextEncoder().encode('<html><body><p>जा॒तवे॑दसे</p><p>सुनवाम</p></body></html>'));
    const ws = new Workspace();
    expect(await call(ws, 'open_attachment', { attachment: a.id })).toMatch(/^w1: “page\.html”/);
    expect(ws.witnesses.get('w1')!.lines.join('\n')).toContain('जा॒तवे॑दसे');
  });

  it('a picture is shown to the model, as what it is', async () => {
    const a = await store.put('page.jpg', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 1]));
    const ws = new Workspace();
    expect(await call(ws, 'open_attachment', { attachment: a.id })).toMatch(/view_attachment shows it/);
    expect(await call(ws, 'view_attachment', { attachment: a.id })).toMatch(/shown to you as a picture/);
    expect(shown.at(-1)).toEqual({ caption: '(the person\'s picture “page.jpg”)', mime: 'image/jpeg' });
  });

  it('a file never sent is said to be so', async () => {
    await expect(call(new Workspace(), 'open_attachment', { attachment: '0'.repeat(32) })).rejects.toThrow(/no such attachment/);
  });

  it('and a host that keeps no files is offered none of this', () => {
    const names = toolsFor('deliver', {}).map((t) => t.spec.name);
    expect(names).not.toContain('open_attachment');
    expect(names).not.toContain('view_attachment');
    expect(names).toContain('verify');
  });
});

/* A document the rules marked — `verify` has nothing to say of it until a mark is moved. */
const marked = () => {
  const ws = new Workspace();
  ws.open(documentOf({ title: 'durgā sūktam', locus: 'taittirīya āraṇyaka 10.2', sections: [{ verses: [
    { lines: ["jā̱tave̍dase sunavāma̱ soma̍marātīya̱to nida̍hāti̱ veda̍ḥ ।", "sa na̍ḥ parṣa̱dati̍ du̱rgāṇi̱ viśvā̍ nā̱veva̱ sindhu̍ṁ duri̱tā'tya̱gniḥ ॥"] },
  ] }] }));
  markAll(ws, 'replace-all');
  return ws.need();
};

describe('verify', () => {
  it('a document the rules marked: nothing to say', async () => {
    const ws = new Workspace();
    ws.open(marked(), 'author');
    expect(await call(ws, 'verify', {})).toMatch(/^its marks: all 1 verse\(s\) as the rules make them/);
  });

  it('nor of spacing: a space before a daṇḍa is no letter', async () => {
    const ws = new Workspace();
    ws.open(durga(), 'author');
    expect(await call(ws, 'verify', {})).not.toMatch(/letters otherwise: “[^”]*” → “[^”]* ॥/u);
  });

  it('a mark taken away is found — and the document is not changed', async () => {
    const doc = marked();
    const v = doc.sections[0]!.verses[0]!;
    type Syl = Extract<ChantToken, { t: 'syl' }>;
    const held = v.tokens.find((t): t is Syl => t.t === 'syl' && t.units.some((u) => u.hold !== undefined))!;
    for (const u of held.units) delete u.hold;
    const ws = new Workspace();
    ws.open(doc, 'author');
    const said = await call(ws, 'verify', {});
    expect(said).toMatch(new RegExp(`${v.id}: .*the rules put hold`, 'u'));
    expect(ws.need().sections[0]!.verses[0]!.tokens.find((t): t is Syl => t.t === 'syl' && t === held)!.units.every((u) => u.hold === undefined)).toBe(true);
  });
});
