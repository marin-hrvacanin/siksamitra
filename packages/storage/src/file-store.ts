/**
 * The local store: documents are `.vuchant` files on disk.
 *
 * This is the one that makes the program a TOOL — it needs no account, no
 * network and no server, and a file the operating system hands over opens
 * through exactly the same interface as one chosen inside the app.
 *
 * The filesystem is injected rather than imported. The same store then runs
 * under the desktop shell, under Node in the CLI and in tests against an
 * in-memory disk, which is what keeps it testable without a temp directory and
 * keeps `@siksamitra/storage` free of a hard dependency on `node:fs` for
 * consumers that have no filesystem at all.
 */

import type { ChantDoc, ChantSection } from '@siksamitra/format';
import { canonicalJson, writeChantFile } from '@siksamitra/format';
import { pack, unpack } from '@siksamitra/interop';
import {
  ConflictError, type ChantStore, type DocumentHead, type DocumentRef,
  type SectionIndexEntry,
} from './store.js';

/**
 * What the store needs from a disk.
 *
 * `writeAtomic` is not a convenience. A save interrupted midway must leave the
 * PREVIOUS document intact and readable: a truncated `.vuchant` is a lost
 * document, and the interruption people actually hit is closing the lid.
 * Implementations write a sibling temp file and rename, because rename is the
 * only widely available atomic primitive.
 */
export interface FileSystem {
  read(path: string): Promise<Uint8Array>;
  writeAtomic(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ modifiedAt: string; writable: boolean }>;
}

/** `sha256` over the canonical bytes, as everything else in this system uses. */
async function hashOf(section: ChantSection): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(section));
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function measure(section: ChantSection): { verseCount: number; syllables: number } {
  const verses = section.verses ?? [];
  let syllables = 0;
  for (const v of verses) for (const t of v.tokens) if (t.t === 'syl') syllables += 1;
  return { verseCount: verses.length, syllables };
}

async function indexOf(doc: ChantDoc): Promise<readonly SectionIndexEntry[]> {
  return Promise.all(doc.sections.map(async (s) => {
    const { verseCount, syllables } = measure(s);
    return {
      id: s.id,
      ...(s.n !== undefined ? { n: s.n } : {}),
      title: s.title ?? s.label ?? s.id,
      verseCount,
      syllables,
      hash: await hashOf(s),
    };
  }));
}

/** The filename, without directory or extension. */
function slugOf(ref: DocumentRef): string {
  const base = ref.split(/[\\/]/).pop() ?? ref;
  return base.replace(/\.vuchant$/i, '');
}

/**
 * A filename for a document that has never been saved.
 *
 * Titles here are Sanskrit in IAST, so the diacritics are stripped rather than
 * dropped: `Śrī Rudram` becomes `sri-rudram` and not `r-rudram`.
 */
function slugify(title: string): string {
  const slug = title.toLowerCase().normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'untitled' : slug;
}

export class FileStore implements ChantStore {
  readonly origin = 'local' as const;

  /**
   * The last document read, kept so that reading a second section does not
   * unpack the file again.
   *
   * Deliberately ONE entry. A cache of many is a cache with an eviction policy
   * and a staleness question, and the access pattern this serves — an author
   * moving between sections of the document they have open — is satisfied
   * completely by one.
   */
  #open: { ref: DocumentRef; doc: ChantDoc; modifiedAt: string } | null = null;

  /**
   * @param engine stamped into every package it writes, so a document can say
   *   which engine produced it and a reader can explain a divergent
   *   re-derivation instead of just disagreeing.
   */
  constructor(private readonly fs: FileSystem, private readonly engine: string) {}

  async #load(ref: DocumentRef): Promise<ChantDoc> {
    const stat = await this.fs.stat(ref);
    if (this.#open?.ref === ref && this.#open.modifiedAt === stat.modifiedAt) {
      return this.#open.doc;
    }
    const pkg = await unpack(await this.fs.read(ref));
    // NOT normalised. `normalizeChantDoc` fills `items` from `verses`, so
    // serialising a round-tripped document writes every verse twice and a
    // 122 KB file becomes 210 KB. The package's own `document.json` is already
    // the canonical shape; keeping it is what makes a save byte-stable.
    const doc = pkg.doc;
    this.#open = { ref, doc, modifiedAt: stat.modifiedAt };
    return doc;
  }

  async open(ref: DocumentRef): Promise<DocumentHead> {
    const doc = await this.#load(ref);
    const stat = await this.fs.stat(ref);
    return {
      ref,
      slug: slugOf(ref),
      title: doc.title ?? slugOf(ref),
      ...(doc.profile !== undefined ? { profile: doc.profile } : {}),
      origin: 'local',
      writable: stat.writable,
      modifiedAt: stat.modifiedAt,
      sections: await indexOf(doc),
    };
  }

  async readSection(
    ref: DocumentRef,
    sectionId: string,
  ): Promise<{ section: ChantSection; hash: string }> {
    const doc = await this.#load(ref);
    const section = doc.sections.find((s) => s.id === sectionId);
    if (section === undefined) throw new Error(`no section "${sectionId}" in ${ref}`);
    return { section, hash: await hashOf(section) };
  }

  async writeSection(
    ref: DocumentRef,
    section: ChantSection,
    baseHash: string,
  ): Promise<{ hash: string }> {
    const doc = await this.#load(ref);
    const at = doc.sections.findIndex((s) => s.id === section.id);
    if (at === -1) throw new Error(`no section "${section.id}" in ${ref}`);

    const current = doc.sections[at]!;
    const currentHash = await hashOf(current);
    if (currentHash !== baseHash) {
      // Someone wrote since this edit began. Refuse, hand back what is there,
      // and let the caller decide. Merging by guess loses work silently, which
      // is worse than an error a person can answer.
      throw new ConflictError(
        `"${section.id}" changed on disk since it was opened.`,
        { section: current, hash: currentHash },
      );
    }

    const sections = [...doc.sections];
    sections[at] = section;
    await this.#save(ref, { ...doc, sections });
    return { hash: await hashOf(section) };
  }

  async patchDocument(ref: DocumentRef, patch: Partial<ChantDoc>): Promise<void> {
    const doc = await this.#load(ref);
    // `recording` is keyed by verse id across the WHOLE document, so a patch
    // carrying one section's timings must merge into what is there. Replacing
    // it deletes every other section's — the defect this method exists to make
    // impossible.
    const recording = patch.recording === undefined ? doc.recording : {
      ...doc.recording,
      ...patch.recording,
      byVerse: { ...doc.recording?.byVerse, ...patch.recording.byVerse },
    };
    await this.#save(ref, {
      ...doc,
      ...patch,
      ...(recording === undefined ? {} : { recording }),
      sections: doc.sections,
    });
  }

  async create(doc: ChantDoc, at?: DocumentRef): Promise<DocumentRef> {
    const ref = at ?? `${slugify(doc.title)}.vuchant`;
    if (await this.fs.exists(ref)) throw new Error(`${ref} already exists`);
    await this.#save(ref, doc);
    return ref;
  }

  async #save(ref: DocumentRef, doc: ChantDoc): Promise<void> {
    const bytes = await pack(doc, {
      slug: slugOf(ref),
      engine: this.engine,
      // Hand `pack` the exact bytes rather than letting it re-serialise: the
      // hash in the manifest is taken over these, and "the same bytes the
      // document is served as" is the format's own requirement.
      documentBytes: new TextEncoder().encode(writeChantFile(doc)),
    });
    await this.fs.writeAtomic(ref, bytes);
    this.#open = { ref, doc, modifiedAt: (await this.fs.stat(ref)).modifiedAt };
  }
}
