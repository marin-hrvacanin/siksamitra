/**
 * A `FileSystem` over `node:fs`, for the desktop shell and the CLI.
 *
 * The only part with any thought in it is `writeAtomic`. A save that is
 * interrupted must leave the previous document intact: writing in place
 * truncates first, so an interruption there is a lost document, and the
 * interruption people actually hit is closing the lid. Write a sibling, fsync,
 * rename — rename being the one widely available atomic primitive.
 *
 * The temp file is a SIBLING rather than in a temp directory, because rename is
 * only atomic within a filesystem and a temp directory is often on another one.
 */

import { constants } from 'node:fs';
import { access, open, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FileSystem } from './file-store.js';

export function nodeFileSystem(): FileSystem {
  return {
    async read(path) {
      const fh = await open(path, 'r');
      try { return new Uint8Array(await fh.readFile()); } finally { await fh.close(); }
    },

    async writeAtomic(path, bytes) {
      const tmp = join(dirname(path), `.${Date.now()}.${process.pid}.tmp`);
      const fh = await open(tmp, 'wx');
      try {
        await fh.writeFile(bytes);
        // Durability before visibility: rename can otherwise become visible
        // while the contents are still only in the page cache.
        await fh.sync();
      } finally {
        await fh.close();
      }
      try {
        await rename(tmp, path);
      } catch (e) {
        await unlink(tmp).catch(() => undefined);
        throw e;
      }
    },

    async exists(path) {
      try { await access(path, constants.F_OK); return true; } catch { return false; }
    },

    async stat(path) {
      const st = await stat(path);
      let writable = true;
      try { await access(path, constants.W_OK); } catch { writable = false; }
      return { modifiedAt: st.mtime.toISOString(), writable };
    },
  };
}
