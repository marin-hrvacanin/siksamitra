/**
 * What an exported `.docx` says about itself.
 *
 * The shape is the shared one in `embed.ts` — the same `format`/`version`/
 * `docHash` triple every export writes — so a reader that can identify a
 * `.smdoc` or an `.html` can identify one of these without learning a second
 * vocabulary. `docHash` means what it means everywhere else:
 * `sha256(canonicalJson(document))`, so the same chant saved as a `.smdoc`, an
 * `.html`, a `.docx` and a `.pdf` has one identity.
 */
import type { ExportManifest } from '../embed.js';

export const WORD_FORMAT = 'sikshamitra.docx';
export const WORD_VERSION = 1;

export type WordManifest = ExportManifest;

export class WordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordError';
  }
}
