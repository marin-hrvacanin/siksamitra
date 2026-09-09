/**
 * `@vedaunion/shared/interop` — everything that moves a chant document in or
 * out of Veda Union.
 *
 * One entry point for both formats, because the client, the server, the CLI and
 * the desktop app all reach for the same two things and none of them should
 * have to know which file a symbol lives in.
 *
 *   Word `.docx`   — `importDocx` / `exportDocx`, over the ONE style table in
 *                    `word-styles.ts`, measured off the owner's own file.
 *   `.vuchant`     — `pack` / `unpack`, the portable package (01 §4).
 */
export {
  documentXml, exportDocx, importDocx, mergeRuns, readParagraphs, tokensFromRuns,
} from './docx.js';
export type { DocxImport, ImportReport, WordParagraph, WordRun } from './docx.js';

export {
  PACKAGE_FORMAT, PACKAGE_VERSION, PackageError,
  documentBytes, pack, readManifest, sha256Hex, unpack,
} from './package.js';
export type {
  ChantPackage, ChantPackageManifest, PackOptions,
} from './package.js';

/*
 * ── the OLD document: `.smdoc` v1 ──────────────────────────────────────────
 *
 * Exported because back compatibility is a promise, and a promise nothing can
 * call is not kept: the reader existed, was tested by hand against the owner's
 * own Library, and was reachable from no application code at all — so `Open`
 * on a years-old file would have thrown.
 */
export {
  SMDOC_LIMITS, SmdocError, SmdocHtmlError, importSmdoc, parseSmdocContent,
  readSmdoc, smdocFlavour, tokenizeSmdocHtml,
} from './smdoc/index.js';
export type {
  ImportOptions, ImportResult, SmdocBlock, SmdocFile, SmdocFlavour, SmdocInflate,
  SmdocLine, SmdocMark, SmdocNode,
} from './smdoc/index.js';

// ── the native document: `.smdoc` v2, the zip container ─────────────────────
export {
  DOCUMENT_FORMAT, DOCUMENT_VERSION, documentFlavour, fattenDocument, leanDocument,
  packDocument, unpackDocument, verifyDocumentFile,
} from './document.js';
export type { DocumentFile, DocumentManifest, SaveOptions } from './document.js';

/*
 * ── the self-contained page: `.html` ────────────────────────────────────────
 *
 * The only export that is also an import. A `.docx` looks the same and cannot
 * be read back without loss; this carries the document itself alongside the
 * page, so one file is both what you send someone and what you open tomorrow.
 */
export {
  CLIP_SELECTOR, FONT_BACKSTOP, HTML_FORMAT, HTML_SLOTS, HTML_VERSION, HtmlError,
  RASTER_ATTR, chooseFaces, codepointsIn, exportHtml, faceRule, facesNeeded,
  fromBase64, importHtml, isSiksamitraHtml, parseFaceCss, svgDocument, toBase64,
} from './html/index.js';
export type {
  DeclaredFace, FaceChoice, FaceStack, HtmlExportInput, HtmlImport, HtmlManifest,
  SvgParts,
} from './html/index.js';

export {
  CHAR_STYLE_BY_ID, PARA_STYLE_BY_ID, REFERENCE_COUNTS, SVARA_BY_CHAR, SVARA_CHAR,
  WORD_CHAR_STYLES, WORD_PARA_STYLES, paraRoleOf, roleOf,
} from './word-styles.js';
export type {
  WordCharStyle, WordMarkRole, WordParaRole, WordParaStyle,
} from './word-styles.js';

// ── package boundary hardening ──────────────────────────────────────────────
export {
  LIMITS, badEntryNames, entryNameProblem, formatBytes,
} from './entry-name.js';
export type { BadEntryName } from './entry-name.js';
