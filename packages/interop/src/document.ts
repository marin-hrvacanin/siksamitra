/**
 * `.smdoc` — the native document, v2.
 *
 * THE EXTENSION IS KEPT ON PURPOSE. A person with twenty years of `.smdoc`
 * files should double-click one and have it open; the program that owns the
 * extension is śikṣāmitra, and which internal shape a given file has is the
 * program's problem, not theirs. So:
 *
 *   reading   v1 (`SMDI` xz · `SMDC` zlib · bare JSON) is read forever, and
 *             imported — see `smdoc/import.ts`. That is a promise, not a
 *             transition period.
 *   writing   v2 is a zip, the same container as `.vuchant`, told apart by
 *             `manifest.json`'s `format`. One implementation of packing, one
 *             hardening story, one place where zip-slip and zip-bombs are
 *             refused.
 *
 * WHAT MAKES IT MINIMAL, and both of these are measured rather than asserted:
 *
 *   1. NOTHING IS INLINED. v1 base64'd its audio into the JSON, which is why
 *      Puruṣa Sūktam is a 39 MB document; base64 costs 33% over the bytes and
 *      re-compressing an MP3 gains nothing. Here audio is a STORED zip entry.
 *   2. A DERIVED VERSE STORES ITS SOURCE, NOT ITS TOKENS. Tokens are output:
 *      four script forms and a mark record per letter. The source is a line of
 *      text. Dropping the tokens where they can be recomputed is the format's
 *      own rule ("derived fields are outputs") taken seriously, and it is
 *      roughly a twenty-fold reduction on a marked text.
 *
 * AND IT IS VERIFIED BEFORE ANYTHING IS DROPPED. `packDocument` re-derives
 * every verse it intends to slim and compares the result with the document it
 * was given; a verse that does not reproduce keeps its tokens. So a lean file
 * cannot lose a mark — the worst case is that it is larger than hoped.
 *
 * An attested verse never loses its tokens: they are the record. Rule zero.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { canonicalJson, withVerses } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import type { ChantDoc, ChantVerse } from '@siksamitra/format';
import { deriveVerse } from '@siksamitra/edit';
import { LIMITS, entryNameProblem, formatBytes } from './entry-name.js';

export const DOCUMENT_FORMAT = 'sikshamitra.document';
export const DOCUMENT_VERSION = 2;

/** The zip epoch, so the same document always produces the same bytes. */
const FIXED_MTIME = 315532800000;

export interface DocumentManifest {
  format: typeof DOCUMENT_FORMAT;
  /** 2 for every file this program writes. v1 files are not this format. */
  version: number;
  slug: string;
  title: string;
  /** The engine that wrote it. A lean file re-derives on open, so a reader
   *  can say "written by an older engine; a mark may have moved". */
  engine: string;
  savedAt: string;
  /** `sha256(canonicalJson(document))` of the FULL document — the one with
   *  its tokens — so a lean file and a fat file of the same document hash the
   *  same and the identity of a document does not depend on how it was saved. */
  docHash: string;
  /** Whether tokens were dropped where they are derivable. */
  lean: boolean;
  contents: {
    documentBytes: number;
    assets: number;
    assetBytes: number;
    /** How many verses store source instead of tokens. */
    leanVerses: number;
    verses: number;
  };
}

export interface DocumentFile {
  manifest: DocumentManifest;
  doc: ChantDoc;
  assets: Record<string, Uint8Array>;
  /** Editor state — view, zoom, appearance. Never part of the document, and
   *  ignored by any other reader. */
  editor: Record<string, unknown>;
  /** What re-derivation had to do on open, if the file was lean. */
  report: { rederived: number; refused: string[] };
}

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const bytesOf = (doc: ChantDoc): Uint8Array =>
  strToU8(`${canonicalJson(doc)}\n`);

/** Is this a v2 document, or a v1 one? Four bytes decide. */
export function documentFlavour(bytes: Uint8Array): 'v2' | 'v1' {
  // A zip starts `PK\x03\x04`. Everything else — SMDI, SMDC, a bare `{` — is v1.
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
    ? 'v2'
    : 'v1';
}

/**
 * Drop what can be recomputed, and verify that it can be.
 *
 * Returns the slimmed document and the ids of the verses that were slimmed.
 * A verse is slimmed only when re-deriving it reproduces its tokens EXACTLY —
 * so the check is the same one `sm attach-src` makes, applied at save time to
 * this particular document rather than to the corpus.
 */
export function leanDocument(doc: ChantDoc): { doc: ChantDoc; lean: string[] } {
  const lean: string[] = [];
  const overrides = doc.overrides ?? [];

  const sections = doc.sections.map((section) => {
    const verses = section.verses.map((verse): ChantVerse => {
      // Rule zero: an attested verse's tokens ARE the record.
      if (verse.src === undefined) return verse;

      const result = deriveVerse(verse, section, doc.profile, overrides);
      if (!result.ok) return verse;
      if (canonicalJson(result.verse.tokens) !== canonicalJson(verse.tokens)) return verse;

      lean.push(verse.id);
      const { tokens: _dropped, ...rest } = verse;
      return { ...rest, tokens: [] };
    });
    return withVerses(section, verses);
  });

  return { doc: { ...doc, sections }, lean };
}

/** Put back what a lean file left out. */
export function fattenDocument(doc: ChantDoc): {
  doc: ChantDoc; rederived: number; refused: string[];
} {
  let rederived = 0;
  const refused: string[] = [];
  const overrides = doc.overrides ?? [];

  const sections = doc.sections.map((section) => {
    const verses = section.verses.map((verse): ChantVerse => {
      if (verse.tokens.length > 0 || verse.src === undefined) return verse;
      const result = deriveVerse(verse, section, doc.profile, overrides);
      if (!result.ok) {
        refused.push(`${verse.id}: ${result.why}`);
        return verse;
      }
      rederived += 1;
      return result.verse;
    });
    return withVerses(section, verses);
  });

  return { doc: { ...doc, sections }, rederived, refused };
}

export interface SaveOptions {
  slug: string;
  engine: string;
  /** Store source instead of tokens where that is verifiably lossless. */
  lean?: boolean;
  assets?: Record<string, Uint8Array>;
  editor?: Record<string, unknown>;
}

/** Write a `.smdoc` (v2). */
export async function packDocument(
  doc: ChantDoc,
  opts: SaveOptions,
): Promise<Uint8Array> {
  const full = bytesOf(doc);
  const hash = await sha256(full);
  const lean = opts.lean !== false;
  const slim = lean ? leanDocument(doc) : { doc, lean: [] };
  const json = lean ? bytesOf(slim.doc) : full;

  const files: Record<string, [Uint8Array, { mtime: number; level?: 0 | 9 }]> = {};
  // Text deflates well and is read once; assets are already compressed and
  // deflating an MP3 costs time for nothing.
  files['document.json'] = [json, { mtime: FIXED_MTIME, level: 9 }];
  for (const [name, bytes] of Object.entries(opts.assets ?? {})) {
    files[`assets/${name}`] = [bytes, { mtime: FIXED_MTIME, level: 0 }];
  }
  if (opts.editor !== undefined && Object.keys(opts.editor).length > 0) {
    files['editor.json'] = [
      strToU8(`${JSON.stringify(opts.editor, null, 2)}\n`),
      { mtime: FIXED_MTIME, level: 9 },
    ];
  }

  const assets = Object.values(opts.assets ?? {});
  const manifest: DocumentManifest = {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    slug: opts.slug,
    title: doc.title,
    engine: opts.engine,
    savedAt: new Date().toISOString(),
    docHash: hash,
    lean,
    contents: {
      documentBytes: json.byteLength,
      assets: assets.length,
      assetBytes: assets.reduce((n, a) => n + a.byteLength, 0),
      leanVerses: slim.lean.length,
      verses: doc.sections.reduce((n, s) => n + s.verses.length, 0),
    },
  };
  files['manifest.json'] = [
    strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    { mtime: FIXED_MTIME, level: 9 },
  ];

  return zipSync(files, { mtime: FIXED_MTIME });
}

/**
 * Read a `.smdoc` (v2).
 *
 * Hardened at the boundary exactly as `.vuchant` is — the same entry-name and
 * size rules, refused from the zip header before anything is inflated — because
 * this is a file that arrives by double-click.
 */
export function unpackDocument(bytes: Uint8Array): DocumentFile {
  let entries: Record<string, Uint8Array>;
  let count = 0;
  let total = 0;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        const problem = entryNameProblem(file.name);
        if (problem !== null) throw new Error(`refused entry "${file.name}": ${problem}`);
        count += 1;
        if (count > LIMITS.entryCount) {
          throw new Error(`more than ${LIMITS.entryCount} entries`);
        }
        if (file.originalSize > LIMITS.entryBytes) {
          throw new Error(
            `entry "${file.name}" declares ${formatBytes(file.originalSize)}, over the limit`,
          );
        }
        total += file.originalSize;
        if (total > LIMITS.totalBytes) {
          throw new Error(`the archive declares more than ${formatBytes(LIMITS.totalBytes)}`);
        }
        return true;
      },
    });
  } catch (e) {
    throw new Error(`not a readable śikṣāmitra document: ${(e as Error).message}`);
  }

  const manifestBytes = entries['manifest.json'];
  const documentBytes = entries['document.json'];
  if (manifestBytes === undefined) throw new Error('no manifest.json');
  if (documentBytes === undefined) throw new Error('no document.json');

  const manifest = JSON.parse(strFromU8(manifestBytes)) as DocumentManifest;
  if (manifest.format !== DOCUMENT_FORMAT) {
    throw new Error(
      `this is a "${String(manifest.format)}" package, not a śikṣāmitra document`,
    );
  }

  const stored = openChantDoc(JSON.parse(strFromU8(documentBytes)) as ChantDoc);
  const { doc, rederived, refused } = manifest.lean
    ? fattenDocument(stored)
    : { doc: stored, rederived: 0, refused: [] };

  const assets: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(entries)) {
    if (name.startsWith('assets/')) assets[name.slice('assets/'.length)] = value;
  }
  const editorBytes = entries['editor.json'];
  const editor = editorBytes === undefined
    ? {}
    : (JSON.parse(strFromU8(editorBytes)) as Record<string, unknown>);

  return { manifest, doc, assets, editor, report: { rederived, refused } };
}

/**
 * Does a lean file read back as the document that was saved?
 *
 * The property the format lives or dies by, and a caller can check it before
 * trusting a save. `packDocument` already verifies per verse; this verifies the
 * whole file, through the zip, which is the thing the user actually has.
 */
export async function verifyDocumentFile(
  original: ChantDoc,
  bytes: Uint8Array,
): Promise<{ ok: boolean; why?: string }> {
  const back = unpackDocument(bytes);
  const want = canonicalJson(original);
  const got = canonicalJson(back.doc);
  if (want === got) return { ok: true };
  const hash = await sha256(strToU8(`${got}\n`));
  return {
    ok: false,
    why: `the file reads back as a different document (${hash.slice(0, 12)} `
      + `against ${back.manifest.docHash.slice(0, 12)}); `
      + `${back.report.refused.length} verses would not re-derive`,
  };
}
