/**
 * `.vuchant` — the portable package.
 *
 * A zip, and deliberately the inverse of `.smdoc`, which base64-embedded its
 * audio into the JSON and produced a 52 MB Puruṣa Sūktam that no editor could
 * open twice. Here **no asset is ever inlined**: `document.json` is the same
 * bytes the web serves, and audio and figures sit beside it as files.
 *
 *     <slug>.vuchant
 *     ├── manifest.json     what this is, what made it, and the document hash
 *     ├── document.json     the canonical ChantDoc — byte-identical to the web's
 *     ├── source/           the authored source, present iff the doc is derived
 *     ├── assets/           audio/*.mp3, figures/*.png — referenced, never inlined
 *     └── originals/        the .docx / .pdf it was imported from, if any
 *
 * Same module in the browser, the CLI and the desktop app: this is what
 * download, upload, and the web→desktop handoff all move.
 *
 * See specs/chant-editor/01-FORMAT.md §4.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { LIMITS, entryNameProblem, formatBytes } from './entry-name.js';
import { canonicalJson, normalizeChantDoc } from '@siksamitra/format';
import type { ChantDoc } from '@siksamitra/format';

export const PACKAGE_FORMAT = 'vedaunion.chant.package';
export const PACKAGE_VERSION = 1;

/**
 * A fixed mtime so the same document always produces the same bytes.
 *
 * 1980-01-01 UTC, the zip epoch. `0` is not usable — fflate rejects it — and
 * "now" would mean two packs of one document never compare equal, which is the
 * property the whole `docHash` contract depends on.
 */
const FIXED_MTIME = 315532800000;

export interface ChantPackageManifest {
  format: typeof PACKAGE_FORMAT;
  version: number;
  slug: string;
  title: string;
  /** The engine that wrote it — a package made by an older engine still opens,
   *  but a re-derivation may legitimately differ and the reader should say so. */
  engine: string;
  /** The document's profile reference, hoisted so a reader can show it without
   *  parsing the document. */
  profile?: unknown;
  createdAt: string;
  /** `sha256(canonicalJson(document))`, lower-case hex. The one integrity
   *  check: a package whose document does not hash to this has been edited
   *  outside the tools. */
  docHash: string;
  /** Byte counts by area, so a UI can explain a 40 MB file before opening it. */
  contents: { documentBytes: number; assets: number; assetBytes: number };
}

export interface ChantPackage {
  manifest: ChantPackageManifest;
  doc: ChantDoc;
  /** `document.json` verbatim — what the hash was taken over, and what a
   *  writer must put back if it is to keep hashing the same. */
  documentBytes: Uint8Array;
  /** `source/…` — the authored YAML, if the document is derived. */
  source: Record<string, string>;
  /** `assets/…` — path relative to `assets/`, to bytes. */
  assets: Record<string, Uint8Array>;
  /** `originals/…` — the .docx or .pdf it came from. */
  originals: Record<string, Uint8Array>;
}

export interface PackOptions {
  slug: string;
  engine: string;
  /**
   * The exact bytes to store as `document.json`.
   *
   * Pass the file's own bytes when packaging a document that already exists:
   * `normalizeChantDoc` fills `items` from `verses`, so serialising a
   * round-tripped document writes every verse twice and a 122 KB file becomes
   * 210 KB. The spec's requirement is that `document.json` be *the same bytes
   * the web serves*, and only the caller knows what those are.
   */
  documentBytes?: Uint8Array;
  source?: Record<string, string>;
  assets?: Record<string, Uint8Array>;
  originals?: Record<string, Uint8Array>;
  createdAt?: string;
}

/** SHA-256 as lower-case hex. Uses WebCrypto, which Node 22 and every target
 *  browser have; the one async step in this module, and the reason `pack` is
 *  async at all. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const view = new Uint8Array(bytes).buffer;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', view);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The exact bytes of a document inside a package — and the bytes the web
 *  serves. One definition, so `docHash` means the same thing everywhere. */
export function documentBytes(doc: ChantDoc): Uint8Array {
  return strToU8(`${canonicalJson(doc)}\n`);
}

export async function pack(doc: ChantDoc, opts: PackOptions): Promise<Uint8Array> {
  const json = opts.documentBytes ?? documentBytes(doc);
  const assets = opts.assets ?? {};
  const files: Record<string, [Uint8Array, { mtime: number; level?: 0 | 9 }]> = {};
  const add = (path: string, bytes: Uint8Array, compress = true): void => {
    files[path] = [bytes, { mtime: FIXED_MTIME, ...(compress ? {} : { level: 0 }) }];
  };

  add('document.json', json);
  for (const [name, text] of Object.entries(opts.source ?? {})) {
    add(`source/${name}`, strToU8(text));
  }
  // Audio and images are already compressed; deflating them again costs time
  // and gains nothing, so they are STORED.
  for (const [name, bytes] of Object.entries(assets)) add(`assets/${name}`, bytes, false);
  for (const [name, bytes] of Object.entries(opts.originals ?? {})) {
    add(`originals/${name}`, bytes, false);
  }

  const manifest: ChantPackageManifest = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    slug: opts.slug,
    title: doc.title,
    engine: opts.engine,
    ...(doc.profile === undefined ? {} : { profile: doc.profile }),
    createdAt: opts.createdAt ?? new Date().toISOString(),
    docHash: await sha256Hex(json),
    contents: {
      documentBytes: json.length,
      assets: Object.keys(assets).length,
      assetBytes: Object.values(assets).reduce((n, b) => n + b.length, 0),
    },
  };
  // Written last but placed FIRST in the archive, so a reader can identify a
  // package from its opening bytes without inflating anything.
  const ordered: Record<string, [Uint8Array, { mtime: number; level?: 0 | 9 }]> = {
    'manifest.json': [strToU8(`${JSON.stringify(manifest, null, 2)}\n`), { mtime: FIXED_MTIME }],
    ...files,
  };
  return zipSync(ordered, { mtime: FIXED_MTIME });
}

export class PackageError extends Error {}

export async function unpack(bytes: Uint8Array): Promise<ChantPackage> {
  let entries: Record<string, Uint8Array>;
  let count = 0;
  let total = 0;
  try {
    // The filter runs BEFORE an entry is inflated, and a zip records each
    // entry's uncompressed size in its own header — so a bomb is refused while
    // it is still a few kilobytes on disk. Inflating first and measuring after
    // is measuring the damage.
    entries = unzipSync(bytes, {
      filter: (file) => {
        count += 1;
        if (count > LIMITS.entryCount) {
          throw new PackageError(`more than ${LIMITS.entryCount} entries`);
        }
        const problem = entryNameProblem(file.name);
        if (problem !== null) {
          throw new PackageError(`entry "${file.name}": ${problem}`);
        }
        if (file.originalSize !== undefined) {
          if (file.originalSize > LIMITS.entryBytes) {
            throw new PackageError(
              `entry "${file.name}" declares ${formatBytes(file.originalSize)},`
              + ` over the ${formatBytes(LIMITS.entryBytes)} limit`,
            );
          }
          total += file.originalSize;
          if (total > LIMITS.totalBytes) {
            throw new PackageError(
              `entries total more than ${formatBytes(LIMITS.totalBytes)} uncompressed`,
            );
          }
        }
        return true;
      },
    });
  } catch (e) {
    // A refusal from the filter is a real diagnosis and must not be flattened
    // into "not a zip", which would send someone looking for the wrong problem.
    if (e instanceof PackageError) throw e;
    throw new PackageError('not a zip — a .vuchant is a zip archive');
  }

  const manifestBytes = entries['manifest.json'];
  if (manifestBytes === undefined) throw new PackageError('no manifest.json');
  let manifest: ChantPackageManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as ChantPackageManifest;
  } catch {
    throw new PackageError('manifest.json is not JSON');
  }
  if (manifest.format !== PACKAGE_FORMAT) {
    throw new PackageError(`not a chant package — format is "${String(manifest.format)}"`);
  }
  if (manifest.version > PACKAGE_VERSION) {
    throw new PackageError(
      `package version ${manifest.version} — this build reads up to ${PACKAGE_VERSION}`,
    );
  }

  const docBytes = entries['document.json'];
  if (docBytes === undefined) throw new PackageError('no document.json');
  if (docBytes.length > LIMITS.documentBytes) {
    throw new PackageError(
      `document.json is ${formatBytes(docBytes.length)}, over the`
      + ` ${formatBytes(LIMITS.documentBytes)} limit — it is parsed into objects`,
    );
  }
  const hash = await sha256Hex(docBytes);
  if (hash !== manifest.docHash) {
    // Refused rather than repaired: a document that does not match its hash was
    // edited outside the tools, and silently accepting it would let a
    // hand-patched file circulate as though the engine had produced it.
    throw new PackageError(
      `document.json does not match the manifest hash (${hash.slice(0, 12)}…`
      + ` vs ${String(manifest.docHash).slice(0, 12)}…) — the package was edited outside the tools`,
    );
  }
  let doc: ChantDoc;
  try {
    doc = normalizeChantDoc(JSON.parse(strFromU8(docBytes)) as ChantDoc);
  } catch {
    throw new PackageError('document.json is not a chant document');
  }

  const source: Record<string, string> = {};
  const assets: Record<string, Uint8Array> = {};
  const originals: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(entries)) {
    if (path.startsWith('source/')) source[path.slice(7)] = strFromU8(content);
    else if (path.startsWith('assets/')) assets[path.slice(7)] = content;
    else if (path.startsWith('originals/')) originals[path.slice(10)] = content;
  }
  return { manifest, doc, documentBytes: docBytes, source, assets, originals };
}

/** Read a package's manifest alone — enough to list a file without inflating
 *  its audio. */
export async function readManifest(bytes: Uint8Array): Promise<ChantPackageManifest> {
  const only = unzipSync(bytes, { filter: (f) => f.name === 'manifest.json' });
  const m = only['manifest.json'];
  if (m === undefined) throw new PackageError('no manifest.json');
  return JSON.parse(strFromU8(m)) as ChantPackageManifest;
}
