/**
 * `.smdoc` v1 — the format the owner's existing documents are in.
 *
 * Four modules, in the order a file passes through them:
 *
 *   `container.ts`  the envelope: `SMDI` (xz), `SMDC` (zlib) or bare JSON,
 *                   with a refusal for each way it can be wrong.
 *   `html.ts`       a strict tokeniser over the CLOSED vocabulary Quill wrote.
 *                   Strict on purpose: anything outside that set is a file we
 *                   do not understand, and guessing at it would invent marks.
 *   `content.ts`    those nodes as blocks and marks — the v1 class vocabulary,
 *                   measured across his Library rather than assumed.
 *   `import.ts`     the blocks as a v2 document, DERIVED rather than
 *                   translated: the result has a source layer, so it can be
 *                   re-derived, edited and checked like anything else.
 *
 * One barrel, so the package's own index does not have to know the shape of
 * this subtree.
 */

export {
  SMDOC_LIMITS, SmdocError, readSmdoc, smdocFlavour,
} from './container.js';
export type { SmdocFile, SmdocFlavour, SmdocInflate } from './container.js';

export { SmdocHtmlError, tokenizeSmdocHtml } from './html.js';
export type { SmdocNode } from './html.js';

export { parseSmdocContent } from './content.js';
export type { SmdocBlock, SmdocLine, SmdocMark } from './content.js';

export { documentBytesOf, importSmdoc } from './import.js';
export type { ImportOptions, ImportResult } from './import.js';
