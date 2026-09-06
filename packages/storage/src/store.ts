/**
 * The storage contract.
 *
 * The editor talks to this and to nothing else about where documents live. Two
 * implementations exist: local files, and the platform API when a reader has
 * signed in. Online mode is therefore a STORE SWAP, not a second editor — which
 * is the whole reason this interface is worth having.
 *
 * Two properties the shape is built around, both learned from measurement:
 *
 *   SECTION AT A TIME. Opening reads the manifest and the section index only.
 *   The platform serves a 1.73 MB document this way and it opens instantly; the
 *   same document read whole is a visible stall. A save writes ONE section, and
 *   document-level data keyed across sections MERGES rather than replaces — a
 *   write carrying only the edited section's recordings would delete every
 *   other section's timings.
 *
 *   NO CATALOGUE ASSUMED. `list` is optional. A tool whose documents are files
 *   is handed paths by the operating system, and a store that could only work
 *   through a browser UI would force a browser UI to exist. Whether this
 *   program wants a Library at all is an open question, and this interface does
 *   not answer it.
 */

import type { ChantDoc, ChantSection } from '@siksamitra/format';

/** Where a document lives, opaque to the editor. A path, a slug, a URL. */
export type DocumentRef = string;

/** Enough to show a document without reading it. */
export interface DocumentHead {
  readonly ref: DocumentRef;
  readonly slug: string;
  readonly title: string;
  /** The profile the marks were produced under, for display only. */
  readonly profile?: unknown;
  /** Where it lives, so a mixed list can say which is which. */
  readonly origin: 'local' | 'platform';
  readonly writable: boolean;
  readonly modifiedAt?: string;
  readonly sections: readonly SectionIndexEntry[];
}

export interface SectionIndexEntry {
  readonly id: string;
  readonly n?: string | null;
  readonly title: string;
  readonly verseCount: number;
  readonly syllables: number;
  /**
   * Identifies the stored bytes of this section.
   *
   * Passed back on write. If it no longer matches, someone else has written
   * since this was read, and the write is REFUSED — never merged by guess and
   * never silently overwritten.
   */
  readonly hash: string;
}

export class ConflictError extends Error {
  constructor(
    message: string,
    readonly current: { section: ChantSection; hash: string },
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ReadOnlyError extends Error {
  constructor(readonly ref: DocumentRef, readonly why: string) {
    super(`${ref} is read-only: ${why}`);
    this.name = 'ReadOnlyError';
  }
}

export interface ChantStore {
  readonly origin: 'local' | 'platform';

  /**
   * Everything this store knows about, if it can enumerate.
   *
   * OPTIONAL on purpose. A store fed by the operating system has nothing to
   * enumerate, and nothing in the editor may require that it does.
   */
  list?(): Promise<readonly DocumentHead[]>;

  /** The manifest and section index. Never the section bodies. */
  open(ref: DocumentRef): Promise<DocumentHead>;

  /** One section's contents, with the hash that identifies these bytes. */
  readSection(
    ref: DocumentRef,
    sectionId: string,
  ): Promise<{ section: ChantSection; hash: string }>;

  /**
   * Write one section.
   *
   * `baseHash` is the hash this edit started from. A store rejects the write
   * with `ConflictError` if the stored bytes have moved on, and hands back what
   * is there now so the caller can offer a choice. The local copy is never
   * discarded on the caller's behalf.
   */
  writeSection(
    ref: DocumentRef,
    section: ChantSection,
    baseHash: string,
  ): Promise<{ hash: string }>;

  /**
   * Merge document-level fields — recordings, timings, metadata.
   *
   * Separate from `writeSection` because this data is keyed by verse ACROSS the
   * whole document. Writing it wholesale from one section's editor is how every
   * other section's timings get deleted.
   */
  patchDocument(ref: DocumentRef, patch: Partial<ChantDoc>): Promise<void>;

  /** Create a document and return where it now lives. */
  create(doc: ChantDoc, at?: DocumentRef): Promise<DocumentRef>;

  /** Read an asset — audio, a figure — by the id the document references. */
  readAsset?(ref: DocumentRef, assetId: string): Promise<Uint8Array>;
  writeAsset?(ref: DocumentRef, assetId: string, bytes: Uint8Array): Promise<void>;
}
