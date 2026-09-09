/**
 * What an exported `.pdf` says about itself, and where it keeps it.
 *
 * The manifest shape is the shared one in `embed.ts`, so a reader that can
 * identify a `.smdoc`, an `.html` or a `.docx` can identify one of these
 * without learning a second vocabulary.
 */
import type { ExportManifest } from '../embed.js';

export const PDF_FORMAT = 'sikshamitra.pdf';
export const PDF_VERSION = 1;

/**
 * The two attachments, by the names they appear under in a reader's
 * Attachments pane.
 *
 * TWO, not one, because they answer different questions and one of them has to
 * stay small: `document.json` is the document itself, base64, and can be 200 KB
 * of it, while `siksamitra.json` says what wrote the file, of which document
 * and in which style, and is the thing a person double-clicks first.
 */
export const PDF_ATTACHMENT = {
  document: 'document.json',
  manifest: 'siksamitra.json',
} as const;

export type PdfManifest = ExportManifest;

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfError';
  }
}
