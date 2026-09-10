/**
 * `.docx` — the export that is also a document.
 *
 * One entry point, the same shape as the other formats in this package:
 * something that writes, something that reads, and the manifest that says what
 * was written. See `export.ts` for what makes a Word file lossless, and
 * `parts.ts` for the one place in the format Word cannot throw away.
 */
export { documentXml, styledParagraph, styledRun } from './body.js';

export { exportWord } from './export.js';
export type { WordExportInput } from './export.js';

export { documentFromCustomXml, importWord, isSiksamitraDocx } from './import.js';
export type { WordImport } from './import.js';

export { WORD_FORMAT, WORD_VERSION, WordError } from './manifest.js';
export type { WordManifest } from './manifest.js';

export {
  HIDDEN_MARKER, SM_ITEM_ID, SM_NS, WORD_PARTS, customXmlPart,
} from './parts.js';

export {
  PARA_STYLE_OF, familiesOf, roleColor, sectPr, stylesXml, wordFamily,
} from './styles.js';
export { charStyles, holdStroke } from './char-styles.js';
export type { StyleSheetInput } from './styles.js';
