/**
 * WHAT THE PERSON SENDS — a document, a page of text, a photograph — kept by
 * the host and read by the agent's tools (`tools/attachments.ts`).
 *
 * The owner (2026-10-02): "it should be able to check/verify uploaded
 * documents … be interactive and work with uploads … more multimedial … with
 * a good infrastructure for that", and "should work in the desktop
 * application as well as in the word extension also … Same pipeline".
 *
 * ONE PIPELINE. A host keeps the bytes in an `AttachmentStore` — the bot in an
 * object store on its server's volume (`apps/bot/src/objects.ts`), the app
 * and the add-in in memory (`memoryAttachments`) — and the person's message
 * names the file by its id (`attachedNote`). The tools then open it as the
 * document, keep it as a witness, or show it to a model that sees. Every host
 * offers the same tools; only where the bytes are kept differs.
 */

/** A file the person sent, as the host keeps it. */
export interface Attachment {
  /** Its content's id (`contentId`): the same file sent twice is one. */
  readonly id: string;
  /** As the person named it. */
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly bytes: Uint8Array;
}

/** Where a host keeps what the person sends. */
export interface AttachmentStore {
  put(name: string, mime: string, bytes: Uint8Array): Promise<Attachment>;
  get(id: string): Promise<Attachment | undefined>;
}

/** The largest file a host keeps: Telegram's own limit for what a bot may download, and room for a book. */
export const ATTACHMENT_MAX = 20 * 1024 * 1024;

/**
 * A file's id: the first 32 hex digits of its SHA-256, where the platform has
 * one (`crypto.subtle`: every secure page, Node). A page without it — an
 * http origin, a test's DOM — still needs an id that is the file's own, and
 * gets one from two FNV-1a passes; the same file, the same id, in that host.
 */
export async function contentId(bytes: Uint8Array): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: { digest(alg: string, data: ArrayBuffer): Promise<ArrayBuffer> } } }).crypto?.subtle;
  if (subtle !== undefined) {
    const digest = new Uint8Array(await subtle.digest('SHA-256', bytes as unknown as ArrayBuffer));
    return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }
  const pass = (seed: bigint): string => {
    let h = seed;
    for (const b of bytes) h = BigInt.asUintN(64, (h ^ BigInt(b)) * 0x100000001b3n);
    return h.toString(16).padStart(16, '0');
  };
  return `${pass(0xcbf29ce484222325n)}${pass(0x84222325cbf29ce4n)}`;
}

/** Refused before it is kept: too large, or empty. */
export function attachmentProblem(name: string, size: number): string | null {
  if (size === 0) return `“${name}” is empty`;
  if (size > ATTACHMENT_MAX) return `“${name}” is ${(size / 1024 / 1024).toFixed(1)} MB — at most ${ATTACHMENT_MAX / 1024 / 1024} MB is kept`;
  return null;
}

/** A store in memory: the app's and the add-in's, for as long as the panel is open — and the tests'. */
export function memoryAttachments(): AttachmentStore {
  const kept = new Map<string, Attachment>();
  return {
    async put(name, mime, bytes) {
      const problem = attachmentProblem(name, bytes.length);
      if (problem !== null) throw new Error(problem);
      const id = await contentId(bytes);
      const a: Attachment = { id, name, mime, size: bytes.length, bytes };
      kept.set(id, a);
      return a;
    },
    async get(id) { return kept.get(id); },
  };
}

export type AttachmentKind = 'document' | 'pdf' | 'text' | 'image' | 'other';

/** What kind of file it is, as `open_attachment` treats it: by its name first, its type after. */
export function kindOf(name: string, mime: string): AttachmentKind {
  const ext = /\.([a-z0-9]+)$/iu.exec(name)?.[1]?.toLowerCase() ?? '';
  if (['docx', 'smdoc', 'vuchant'].includes(ext)) return 'document';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) || /^image\/(png|jpeg|webp|gif)$/u.test(mime)) return 'image';
  if (['txt', 'md', 'csv', 'html', 'htm', 'xml', 'itx', 'json'].includes(ext) || mime.startsWith('text/')) return 'text';
  return 'other';
}

const SAID: Readonly<Record<AttachmentKind, string>> = {
  document: 'a document', pdf: 'a PDF', text: 'a text file', image: 'a picture', other: 'a file',
};

const sizeOf = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** The line the person's message carries for each file — what the model reads. */
export function attachedNote(a: Attachment): string {
  return `[sent “${a.name}”, ${SAID[kindOf(a.name, a.mime)]} of ${sizeOf(a.size)} — attachment ${a.id}]`;
}
