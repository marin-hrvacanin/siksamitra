/**
 * `@siksamitra/storage` — where documents live.
 *
 * One interface, two implementations. The editor depends on the interface and
 * never on a transport, which is what makes signing in a store swap rather than
 * a second editor.
 */

export type {
  ChantStore, DocumentHead, DocumentRef, SectionIndexEntry,
} from './store.js';
export { ConflictError, ReadOnlyError } from './store.js';
export { FileStore, type FileSystem } from './file-store.js';
export { nodeFileSystem } from './node-fs.js';
