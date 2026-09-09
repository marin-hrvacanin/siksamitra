/**
 * WHAT AN EXPORT SAYS ABOUT ITSELF, and the bytes it carries to be openable.
 *
 * Three formats now embed the document — `.html` in a `<script>` block, `.docx`
 * in a custom XML part, `.pdf` in an embedded file stream — and all three
 * answer the same four questions: what wrote this, of which document, in which
 * style, and does it still hash to what was recorded. Writing that shape down
 * three times would be three things to keep in step, and the first time they
 * drifted a reader would be able to open one of our files and not another.
 *
 * THE PAYLOAD IS `documentBytes`, NOT A SECOND SERIALISATION. The canonical
 * JSON is produced in exactly one place (`package.ts`), so a `.smdoc`, an
 * `.html`, a `.docx` and a `.pdf` of one document all carry the same bytes and
 * all hash to the same `docHash`. That identity is the whole of "lossless": the
 * importer's job is to hand those bytes back, and a gate compares the document
 * that comes out with the document that went in.
 *
 * `savedAt` is passed in rather than read from the clock so a gate can export
 * the same document twice and compare the bytes. The `.docx` exporter's
 * determinism check found a real bug that way.
 */
import type { ChantDoc } from '@siksamitra/format';
import { documentBytes, sha256Hex } from './package.js';

/**
 * The manifest every embedding format writes.
 *
 * Deliberately the same shape as `DocumentManifest` in `document.ts` — same
 * `format`/`version`/`docHash` triple, same `contents` counts — because a
 * reader that can identify a `.smdoc` should be able to identify any of these
 * without learning a second vocabulary.
 */
export interface ExportManifest {
  /** `sikshamitra.html`, `sikshamitra.docx`, `sikshamitra.pdf`. */
  format: string;
  version: number;
  slug: string;
  title: string;
  /** What wrote it. A reader can then say "written by an older engine". */
  engine: string;
  savedAt: string;
  /** `sha256(canonicalJson(document))`, lower-case hex. */
  docHash: string;
  /** The `EXPORT_STYLES` id the file was set in. */
  style: string;
  /** The script the text is written in — `iast`, `devanagari`, and so on. */
  script: string;
  /** A `ChantSelection` expression, when only part of the document was taken. */
  select?: string;
  contents: {
    documentBytes: number;
    assets: number;
    assetBytes: number;
    verses: number;
  };
}

/** What a caller supplies; everything else in the manifest is computed. */
export interface EmbedInput {
  doc: ChantDoc;
  slug: string;
  /** What wrote the file. */
  engine: string;
  /** An `EXPORT_STYLES` id. */
  style: string;
  script: string;
  select?: string;
  savedAt?: string;
  /** Recordings and any other bytes the document refers to, by name. */
  assets?: Record<string, Uint8Array>;
}

/**
 * The document's bytes and the manifest that describes them.
 *
 * Async because the identity is a SHA-256 and `crypto.subtle` is. The same hash
 * function as `packDocument`, so a `.smdoc` and a `.docx` of one document agree
 * on what that document is.
 */
export async function embedded(
  format: string, version: number, input: EmbedInput,
): Promise<{ manifest: ExportManifest; json: Uint8Array }> {
  const json = documentBytes(input.doc);
  const assets = input.assets ?? {};
  const names = Object.keys(assets).sort();
  const manifest: ExportManifest = {
    format,
    version,
    slug: input.slug,
    title: input.doc.title,
    engine: input.engine,
    savedAt: input.savedAt ?? new Date().toISOString(),
    docHash: await sha256Hex(json),
    style: input.style,
    script: input.script,
    ...(input.select === undefined ? {} : { select: input.select }),
    contents: {
      documentBytes: json.length,
      assets: names.length,
      assetBytes: names.reduce((n, k) => n + assets[k]!.length, 0),
      verses: input.doc.sections.reduce((n, s) => n + s.verses.length, 0),
    },
  };
  return { manifest, json };
}
