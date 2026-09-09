/**
 * What an exported `.html` says about itself, and the two codecs it needs.
 *
 * The manifest is deliberately the same shape as `DocumentManifest` in
 * `document.ts` — same `format`/`version`/`docHash` triple, same `contents`
 * counts — because a reader that can identify a `.smdoc` should be able to
 * identify one of these without learning a second vocabulary. `docHash` means
 * exactly what it means there: `sha256(canonicalJson(document))` of the whole
 * document, so the same chant saved as a `.smdoc` and as an `.html` has the
 * same identity.
 */

export const HTML_FORMAT = 'sikshamitra.html';
export const HTML_VERSION = 1;

/** The element ids the document, its manifest and its assets are written to. */
export const HTML_SLOTS = {
  manifest: 'siksamitra-manifest',
  document: 'siksamitra-document',
  assets: 'siksamitra-assets',
} as const;

export interface HtmlManifest {
  format: typeof HTML_FORMAT;
  version: number;
  slug: string;
  title: string;
  /** What wrote it. A reader can then say "written by an older engine". */
  engine: string;
  savedAt: string;
  /** `sha256(canonicalJson(document))` — see above. */
  docHash: string;
  /** The `EXPORT_STYLES` id the page was set in. */
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

export class HtmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HtmlError';
  }
}

/**
 * Text that is safe inside an HTML attribute or between two tags.
 *
 * Only the five characters that can end an attribute or open a tag. The
 * document's own text goes nowhere near this — it is rendered by React, which
 * escapes it — so this is for the title, the language and the generator line.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;'
      : c === '<' ? '&lt;'
        : c === '>' ? '&gt;'
          : c === '"' ? '&quot;'
            : '&#39;'
  ));
}

/**
 * JSON that can sit inside a `<script>` element without ending it.
 *
 * EVERY `<` is escaped, not just the ones in `</script`. Two reasons, and the
 * second is the one that bites: the HTML parser also ends a script's data at
 * `<!--`, and a comment inside a document's title would then truncate the
 * embedded document with no error anywhere. `<` is an ordinary JSON string
 * escape, so `JSON.parse` gives back the original character — the round trip is
 * exact, which the export gate checks rather than assumes.
 */
export function jsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c');
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Bytes to base64, without `btoa`.
 *
 * `btoa(String.fromCharCode(...bytes))` is the one-liner and it throws on a
 * real recording: spreading a 4 MB `Uint8Array` into an argument list exceeds
 * the engine's argument limit, and the failure is a `RangeError` at export
 * time rather than anything a reader could diagnose. Three bytes at a time
 * costs nothing measurable next to writing the file.
 */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const left = bytes.length - i;
  if (left === 1) {
    const n = bytes[i]! << 16;
    out += `${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}==`;
  } else if (left === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += `${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}${B64[(n >> 6) & 63]!}=`;
  }
  return out;
}

/** Base64 back to bytes. Refuses anything that is not base64 rather than
 *  returning a shorter array than it was given. */
export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
    throw new HtmlError('an embedded asset is not base64');
  }
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let at = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]!) << 18) | (B64.indexOf(clean[i + 1]!) << 12)
      | ((B64.indexOf(clean[i + 2]!) & 63) << 6) | (B64.indexOf(clean[i + 3]!) & 63);
    if (at < out.length) out[at++] = (n >> 16) & 255;
    if (at < out.length) out[at++] = (n >> 8) & 255;
    if (at < out.length) out[at++] = n & 255;
  }
  return out;
}
