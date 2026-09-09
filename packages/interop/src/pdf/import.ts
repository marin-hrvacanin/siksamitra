/**
 * Reading a `.pdf` this program wrote back into a document.
 *
 * It does not parse the PDF. It finds the two attachments `embedInPdf` appended
 * and reads their streams, which is a much smaller job than understanding a
 * page: an embedded file is an uncompressed stream of base64 between `stream`
 * and `endstream`, and its `/Filespec` names it. Everything that draws — the
 * fonts, the glyph runs, the page tree — is skipped entirely.
 *
 * WHY NOT WALK THE CROSS-REFERENCE TABLE. Because the file may have been
 * through a program that rewrote it, and the offsets in the table we appended
 * would then be wrong while the objects themselves are still there under the
 * same names. Searching for the `/Filespec` by name recovers the document from
 * a file our own writer could no longer navigate — which is the case that
 * matters, since a PDF nobody has touched can always be re-exported.
 *
 * The hash is CHECKED and reported, never used to decide what the document is.
 * `intact` says whether the document that came out still hashes to what the
 * manifest recorded.
 */
import type { ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { fromBase64 } from '../base64.js';
import { documentBytes, sha256Hex } from '../package.js';
import { PDF_ATTACHMENT, PDF_FORMAT, PdfError, type PdfManifest } from './manifest.js';

export interface PdfImport {
  manifest: PdfManifest;
  doc: ChantDoc;
  assets: Record<string, Uint8Array>;
  /** Whether the document still hashes to the manifest's `docHash`. */
  intact: boolean;
  /** The hash of the document that came back, whether or not it matches. */
  docHash: string;
}

const latin1 = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

/** Is this one of ours? Reads the tail, where the appended objects are. */
export function isSiksamitraPdf(bytes: Uint8Array): boolean {
  const text = latin1(bytes);
  return text.includes('/AFRelationship /Source') && text.includes(PDF_ATTACHMENT.document);
}

/** One object's raw body, by number. */
function objectBody(text: string, num: number): string | null {
  const found = new RegExp(`(?:^|[^0-9])${num}\\s+0\\s+obj\\b`).exec(text);
  if (found === null) return null;
  const from = found.index + found[0].length;
  const end = text.indexOf('endobj', from);
  return end === -1 ? null : text.slice(from, end);
}

/**
 * The stream data of the embedded file a `/Filespec` names.
 *
 * The LAST `/Filespec` with that name wins. An incremental update supersedes an
 * object by appending a new one, so a file exported, edited and exported again
 * carries both — and the one further down the file is the current one.
 */
function attachment(text: string, name: string): string | null {
  let ref: number | null = null;
  const spec = new RegExp(
    `/Type\\s*/Filespec[^>]*?\\(${name.replace('.', '\\.')}\\)[\\s\\S]*?/EF\\s*<<\\s*/F\\s+(\\d+)\\s+0\\s+R`,
    'g',
  );
  for (const m of text.matchAll(spec)) ref = Number(m[1]);
  if (ref === null) return null;

  const body = objectBody(text, ref);
  if (body === null) return null;
  const at = body.indexOf('stream');
  if (at === -1) return null;
  /* `stream` is followed by CRLF or LF and nothing else — the spec is explicit,
     and a reader that skipped whitespace generally would eat the first base64
     character of a payload that happened to start with a space. */
  const from = body.startsWith('\r\n', at + 6) ? at + 8 : at + 7;
  const end = body.indexOf('endstream', from);
  return end === -1 ? null : body.slice(from, end).trim();
}

/** Read one back. */
export async function importPdf(bytes: Uint8Array): Promise<PdfImport> {
  const text = latin1(bytes);
  const payload = attachment(text, PDF_ATTACHMENT.document);
  const sidecar = attachment(text, PDF_ATTACHMENT.manifest);
  if (payload === null || sidecar === null) {
    /* The XMP packet is the second place the hash is written, so a file whose
       attachments some tool has dropped can still be named precisely. */
    const hash = /<sm:docHash>([0-9a-f]+)<\/sm:docHash>/.exec(text)?.[1];
    throw new PdfError(
      hash === undefined
        ? 'not a śikṣāmitra PDF: no embedded document.json. Only a file this '
          + 'program wrote can be opened; a PDF printed from anything else has '
          + 'the page but not the document.'
        : 'this PDF was written by śikṣāmitra but its attachments are gone — '
          + `some program rewrote it. The document it should hold hashes to ${hash}.`,
    );
  }

  const side = JSON.parse(sidecar) as {
    manifest: PdfManifest; assets: Record<string, string>;
  };
  if (side.manifest.format !== PDF_FORMAT) {
    throw new PdfError(
      `unexpected format "${String(side.manifest.format)}" — expected ${PDF_FORMAT}`,
    );
  }

  /*
   * NORMALISED ON THE WAY IN, exactly as `readChantFile` and `unpackDocument`
   * do it. Not doing so is how a v2 document arrives with `items` missing and
   * every consumer downstream has to remember to check.
   */
  const json = new TextDecoder().decode(fromBase64(payload));
  const doc = openChantDoc(JSON.parse(json) as ChantDoc);

  const assets: Record<string, Uint8Array> = {};
  for (const [name, b64] of Object.entries(side.assets ?? {})) assets[name] = fromBase64(b64);

  const docHash = await sha256Hex(documentBytes(doc));
  return {
    manifest: side.manifest, doc, assets, docHash,
    intact: docHash === side.manifest.docHash,
  };
}
