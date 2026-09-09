/**
 * `.html` — the export that is also a document.
 *
 * One entry point, the same shape as the other two formats in this package:
 * something that writes, something that reads, and the manifest that says what
 * was written. See `export.ts` for why HTML is the lossless one.
 *
 * The two host-shaped pieces are here as well — which faces to embed
 * (`fonts.ts`) and what a picture of a page is a picture of (`frame.ts`) —
 * because the command line and the window both ask those questions and there
 * has to be one answer.
 */
export { exportHtml } from './export.js';
export type { HtmlExportInput } from './export.js';

export { importHtml, isSiksamitraHtml } from './import.js';
export type { HtmlImport } from './import.js';

export {
  HTML_FORMAT, HTML_SLOTS, HTML_VERSION, HtmlError, escapeHtml, fromBase64,
  jsonForScript, toBase64,
} from './manifest.js';
export type { HtmlManifest } from './manifest.js';

export {
  FONT_BACKSTOP, chooseFaces, codepointsIn, faceRule, facesNeeded, parseFaceCss,
  parseUnicodeRange,
} from './fonts.js';
export type { DeclaredFace, FaceChoice, FaceStack } from './fonts.js';

export { CLIP_SELECTOR, RASTER_ATTR, svgDocument } from './frame.js';
export type { SvgParts } from './frame.js';
