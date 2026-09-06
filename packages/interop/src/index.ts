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

export {
  CHAR_STYLE_BY_ID, PARA_STYLE_BY_ID, REFERENCE_COUNTS, SVARA_BY_CHAR, SVARA_CHAR,
  WORD_CHAR_STYLES, WORD_PARA_STYLES, paraRoleOf, roleOf,
} from './word-styles.js';
export type {
  WordCharStyle, WordMarkRole, WordParaRole, WordParaStyle,
} from './word-styles.js';
