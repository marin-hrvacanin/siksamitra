/**
 * A chant document as ONE `.docx` that can be opened again exactly.
 *
 * WHY THIS IS NOW THE LOSSLESS ONE. The old exporter's own header said Word was
 * lossy by construction — the marks travel as character styles, but the source
 * layer, the overrides, the register and the recording map have nowhere to go —
 * and that was true of the BODY. It is not true of the PACKAGE. A `.docx` is a
 * zip of parts, and one of those parts can be the document itself: the same
 * canonical JSON a `.smdoc` carries, base64 in a custom XML data store part
 * that Word preserves across an open and a save. `importWord` reads it back and
 * `tools/export/gate-word.mjs` proves the round trip is exact, field for field,
 * over all eleven corpus documents.
 *
 * SO THE FILE IS TWO THINGS AT ONCE, exactly as the `.html` export is: the
 * finished Word document someone edits and prints, and the file you open again
 * tomorrow with nothing lost. If a reader edits the text in Word, the body and
 * the embedded document disagree — and the importer SAYS SO, because it checks
 * the hash and reports `intact`. It never silently prefers one.
 *
 * THE BODY IS `documentXml`'s, unchanged. There is one writer of Word runs in
 * this program and it is the one the owner's own file was reverse-engineered
 * into. What this file adds is the package around it: a `styles.xml` generated
 * from the export style, a section that is the same A4 sheet `pageGeometry`
 * gives the page exporter, and the parts in `parts.ts`.
 */
import { zipSync, strToU8 } from 'fflate';
import { DEFAULT_PAGE, pageGeometry, type PageGeometry } from '@siksamitra/layout';
import type { ExportStyle } from '@siksamitra/tokens/export-styles';
import { documentThemeOf } from '@siksamitra/tokens/export-styles';
import { documentXml } from './body.js';
import { embedded, type EmbedInput } from '../embed.js';
import {
  contentTypes, coreProps, appProps, customProps, customXmlPart, documentRels, hiddenPayload,
  itemProps, itemRels, rootRels, settings, WORD_PARTS,
} from './parts.js';
import { WORD_FORMAT, WORD_VERSION } from './manifest.js';
import { sectPr, stylesXml } from './styles.js';

export interface WordExportInput extends Omit<EmbedInput, 'style'> {
  style: ExportStyle;
  /** The theme's reading stack and the chrome's interface stack, resolved by
   *  the caller exactly as `buildExportPage` resolves them for the page. */
  textStack: string;
  uiStack: string;
  /** The sheet. Defaults to A4 with his 25 mm margins. */
  page?: PageGeometry;
  /**
   * Also write the payload as hidden text in the body.
   *
   * Off by default — see `parts.ts` for the four places this was considered and
   * why the datastore won. Turn it on for a file that is going to be edited by
   * a chain of unknown programs.
   */
  fallback?: 'hidden-text';
}

/**
 * A fixed mtime so the same document always produces the same bytes.
 *
 * 1980-01-01 UTC, the zip epoch. `0` is not usable — fflate rejects it — and
 * "now" would mean two exports of one document never compare equal, which is
 * the property a "has this changed?" check depends on.
 */
const FIXED_MTIME = 315532800000;

/** Write the file. */
export async function exportWord(input: WordExportInput): Promise<Uint8Array> {
  const { manifest, json } = await embedded(WORD_FORMAT, WORD_VERSION, {
    ...input, style: input.style.id,
  });
  const assets = input.assets ?? {};
  const item = customXmlPart(manifest, json, assets);
  const page = input.page ?? pageGeometry(DEFAULT_PAGE);
  const theme = documentThemeOf(input.style);

  const tail = (input.fallback === 'hidden-text' ? hiddenPayload(item) : '') + sectPr(page);
  const parts: Record<string, Uint8Array> = {
    [WORD_PARTS.contentTypes]: strToU8(contentTypes()),
    [WORD_PARTS.rootRels]: strToU8(rootRels()),
    [WORD_PARTS.document]: strToU8(documentXml(input.doc, tail)),
    [WORD_PARTS.documentRels]: strToU8(documentRels()),
    [WORD_PARTS.styles]: strToU8(stylesXml({
      theme, mode: input.style.mode, textStack: input.textStack, uiStack: input.uiStack,
    })),
    [WORD_PARTS.settings]: strToU8(settings()),
    [WORD_PARTS.item]: strToU8(item),
    [WORD_PARTS.itemProps]: strToU8(itemProps()),
    [WORD_PARTS.itemRels]: strToU8(itemRels()),
    [WORD_PARTS.core]: strToU8(coreProps(manifest)),
    [WORD_PARTS.app]: strToU8(appProps(manifest)),
    [WORD_PARTS.custom]: strToU8(customProps(manifest)),
  };
  return zipSync(parts, { level: 6, mtime: FIXED_MTIME });
}
