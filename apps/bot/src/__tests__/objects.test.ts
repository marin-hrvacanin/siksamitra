/**
 * THE BOT'S OBJECT STORE — what people send, on the server's volume, by its
 * content: the bytes and what they were, side by side, one folder per first
 * two digits of the id.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ATTACHMENT_MAX } from '@siksamitra/agent';
import { fileAttachments } from '../objects.js';

const dir = mkdtempSync(join(tmpdir(), 'objects-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const store = fileAttachments(dir);
const bytes = new TextEncoder().encode('jātavedase sunavāma somam');

describe('the object store', () => {
  it('keeps the bytes and what they were, under the id', async () => {
    const a = await store.put('durgā sūktam.txt', 'text/plain', bytes);
    const folder = join(dir, a.id.slice(0, 2));
    expect(readFileSync(join(folder, `${a.id}.bin`))).toEqual(Buffer.from(bytes));
    expect(JSON.parse(readFileSync(join(folder, `${a.id}.json`), 'utf8'))).toMatchObject({ name: 'durgā sūktam.txt', mime: 'text/plain', size: bytes.length });
  });

  it('gives back what it kept, and nothing for an id it never had or that is no id', async () => {
    const a = await store.put('x.txt', 'text/plain', bytes);
    const back = await store.get(a.id);
    expect(back?.bytes).toEqual(bytes);
    expect(back?.name).toBe('x.txt');
    expect(await store.get('f'.repeat(32))).toBeUndefined();
    expect(await store.get('../../etc/passwd')).toBeUndefined();
  });

  it('keeps a file sent twice once', async () => {
    const a = await store.put('one.txt', 'text/plain', bytes);
    const b = await store.put('two.txt', 'text/plain', bytes);
    expect(b.id).toBe(a.id);
    expect(existsSync(join(dir, a.id.slice(0, 2), `${a.id}.bin`))).toBe(true);
  });

  it('refuses one too large', async () => {
    await expect(store.put('big.pdf', 'application/pdf', new Uint8Array(ATTACHMENT_MAX + 1))).rejects.toThrow(/at most/);
  });
});
