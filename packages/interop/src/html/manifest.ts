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

import type { ExportManifest } from '../embed.js';

export const HTML_FORMAT = 'sikshamitra.html';
export const HTML_VERSION = 1;

/** The element ids the document, its manifest and its assets are written to. */
export const HTML_SLOTS = {
  manifest: 'siksamitra-manifest',
  document: 'siksamitra-document',
  assets: 'siksamitra-assets',
} as const;

/**
 * What an exported page says about itself.
 *
 * The SHARED shape, not a copy of it. `.docx` and `.pdf` embed the same
 * document with the same four questions to answer, and three copies of this
 * interface would be three things to keep in step — see `embed.ts`.
 */
export type HtmlManifest = ExportManifest;

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

/**
 * The base64 codec, from the one place all three embedding formats read it.
 *
 * It used to live here, and then the `.docx` and the `.pdf` needed exactly the
 * same thing. See `base64.ts` for why it is hand-rolled.
 */
export { fromBase64, toBase64 } from '../base64.js';
