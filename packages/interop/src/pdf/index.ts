/**
 * `.pdf` — the printed page that is also a document.
 *
 * Two halves, and the split is where the browser is. Producing the PAGE needs a
 * renderer, and there is exactly one of those in this program: the HTML
 * exporter, printed by the browser the host already has — `tools/export/pdf.mjs`
 * on the command line, the window's own print on the desktop. What is here is
 * the half that is pure bytes: attaching the document to the PDF that came out,
 * and taking it back off.
 */
export { embedInPdf } from './embed.js';

export { importPdf, isSiksamitraPdf } from './import.js';
export type { PdfImport } from './import.js';

export { PDF_ATTACHMENT, PDF_FORMAT, PDF_VERSION, PdfError } from './manifest.js';
export type { PdfManifest } from './manifest.js';
