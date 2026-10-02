/**
 * THE BOT'S OBJECT STORE — what people send it, kept on the server's volume.
 *
 * Content-addressed, so the same file sent twice is kept once:
 *
 *   /data/objects/ab/abcdef….bin    the bytes
 *   /data/objects/ab/abcdef….json   what they were: name, type, size, when
 *
 * The id is what the person's message names to the agent (`attachedNote`),
 * and the agent's tools read it back from here (`open_attachment`). The same
 * shape as the app's and the add-in's store (`memoryAttachments`); only where
 * the bytes are kept differs. Mounted with the rest of `/data`, so a
 * conversation can open again tomorrow what was sent today.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachmentProblem, contentId, type Attachment, type AttachmentStore } from '@siksamitra/agent';

interface Meta { readonly name: string; readonly mime: string; readonly size: number; readonly at: string }

export function fileAttachments(dir: string): AttachmentStore {
  const where = (id: string): { folder: string; bytes: string; meta: string } => {
    const folder = join(dir, id.slice(0, 2));
    return { folder, bytes: join(folder, `${id}.bin`), meta: join(folder, `${id}.json`) };
  };
  return {
    async put(name, mime, bytes) {
      const problem = attachmentProblem(name, bytes.length);
      if (problem !== null) throw new Error(problem);
      const id = await contentId(bytes);
      const at = where(id);
      mkdirSync(at.folder, { recursive: true });
      if (!existsSync(at.bytes)) writeFileSync(at.bytes, bytes);
      const meta: Meta = { name, mime, size: bytes.length, at: new Date().toISOString() };
      writeFileSync(at.meta, JSON.stringify(meta));
      return { id, name, mime, size: bytes.length, bytes };
    },
    async get(id) {
      if (!/^[0-9a-f]{32}$/u.test(id)) return undefined;
      const at = where(id);
      if (!existsSync(at.bytes) || !existsSync(at.meta)) return undefined;
      const meta = JSON.parse(readFileSync(at.meta, 'utf8')) as Meta;
      const a: Attachment = { id, name: meta.name, mime: meta.mime, size: meta.size, bytes: new Uint8Array(readFileSync(at.bytes)) };
      return a;
    },
  };
}
