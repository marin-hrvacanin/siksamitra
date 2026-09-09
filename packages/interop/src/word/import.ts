/**
 * Reading a `.docx` this program wrote back into a document.
 *
 * An export that cannot be opened again is a printout with extra steps, so the
 * reader is part of the format rather than a later idea. It ignores the body
 * entirely — the paragraphs, the styles, the section — and takes the document
 * out of the custom XML data store part that `exportWord` put there.
 *
 * IT DOES NOT REPLACE `importDocx`. That reader transcribes marks out of the
 * character styles of files the OWNER wrote in Word, which have no embedded
 * document and never will; this one recovers a document we ourselves wrote.
 * `isSiksamitraDocx` is how a caller chooses between them, and choosing wrong
 * is the difference between an exact document and a re-derived lookalike.
 *
 * THREE PLACES ARE TRIED, in the order they are trustworthy: the datastore
 * part, then the hidden-text paragraph, then — for a file whose datastore some
 * other program has stripped — the custom document properties, which cannot
 * carry the document but can say what it should have hashed to. The third case
 * throws with the hash in the message, because "your document is missing and
 * here is its fingerprint" is a usable error and "not one of ours" is not.
 *
 * The hash is CHECKED and reported, never used to decide what the document is.
 * `intact` says whether the document that came out still hashes to what the
 * manifest recorded — a file whose body was edited in Word is readable and
 * honestly flagged, rather than refused or silently trusted.
 */
import { strFromU8, unzipSync } from 'fflate';
import { normalizeChantDoc, type ChantDoc } from '@siksamitra/format';
import { fromBase64 } from '../base64.js';
import { documentBytes, sha256Hex } from '../package.js';
import { xmlText } from '../xml.js';
import type { ExportManifest } from '../embed.js';
import { HIDDEN_MARKER, WORD_PARTS } from './parts.js';
import { WORD_FORMAT, WordError, type WordManifest } from './manifest.js';

export interface WordImport {
  manifest: WordManifest;
  doc: ChantDoc;
  assets: Record<string, Uint8Array>;
  /** Whether the document still hashes to the manifest's `docHash`. */
  intact: boolean;
  /** The hash of the document that came back, whether or not it matches. */
  docHash: string;
  /** Which of the two payload locations the document was found in. */
  from: 'custom-xml' | 'hidden-text';
}

/** Is this one of ours? Reads two parts, not the whole 4 MB file. */
export function isSiksamitraDocx(bytes: Uint8Array): boolean {
  try {
    const zip = unzipSync(bytes, {
      filter: (f) => f.name === WORD_PARTS.item || f.name === WORD_PARTS.custom,
    });
    const item = zip[WORD_PARTS.item];
    if (item !== undefined) return strFromU8(item).includes('<sm:body>');
    const custom = zip[WORD_PARTS.custom];
    return custom !== undefined && strFromU8(custom).includes('SiksamitraFormat');
  } catch {
    return false;
  }
}

/** One element's text, from the custom XML part. */
function element(xml: string, name: string): string | null {
  const found = new RegExp(`<sm:${name}>([\\s\\S]*?)</sm:${name}>`).exec(xml);
  return found === null ? null : found[1]!;
}

const decode = (b64: string): string => new TextDecoder().decode(fromBase64(b64));

/** The hidden paragraph's payload, if the writer was asked for one. */
function hiddenPart(documentXml: string): string | null {
  const at = documentXml.indexOf(HIDDEN_MARKER);
  if (at === -1) return null;
  /* The marker and the base64 that follows sit in one `<w:t>`; Word may split
     the run but not the text element it holds. */
  const from = at + HIDDEN_MARKER.length;
  const end = documentXml.indexOf('<', from);
  return decode(xmlText(documentXml.slice(from, end === -1 ? undefined : end)));
}

/**
 * The document inside one custom XML part, given the part's own XML.
 *
 * FOR A CALLER THAT IS ALREADY INSIDE WORD. The add-in reads
 * `Word.Document.customXmlParts` (WordApi 1.4) and gets the part as a string,
 * never as a zip, so it cannot go through `importWord` — and writing a second
 * decoder for it would be two answers to what "the embedded document" means.
 * `customXmlPart` in `parts.ts` is the inverse and is what the add-in writes
 * back, which is what makes an in-Word round trip exact rather than body-only.
 */
export async function documentFromCustomXml(
  xml: string,
): Promise<Omit<WordImport, 'from'>> {
  const rawManifest = element(xml, 'manifest');
  const rawBody = element(xml, 'body');
  if (rawManifest === null || rawBody === null) {
    throw new WordError('this custom XML part is not a śikṣāmitra document');
  }
  const manifest = JSON.parse(decode(rawManifest)) as ExportManifest;
  const doc = normalizeChantDoc(JSON.parse(decode(rawBody)) as ChantDoc);
  const assets: Record<string, Uint8Array> = {};
  const rawAssets = element(xml, 'assets');
  if (rawAssets !== null) {
    const named = JSON.parse(decode(rawAssets)) as Record<string, string>;
    for (const [name, b64] of Object.entries(named)) assets[name] = fromBase64(b64);
  }
  const docHash = await sha256Hex(documentBytes(doc));
  return { manifest, doc, assets, docHash, intact: docHash === manifest.docHash };
}

/** Read one back. */
export async function importWord(bytes: Uint8Array): Promise<WordImport> {
  const zip = unzipSync(bytes, {
    filter: (f) => f.name === WORD_PARTS.item
      || f.name === WORD_PARTS.document
      || f.name === WORD_PARTS.custom,
  });

  const item = zip[WORD_PARTS.item];
  const body = zip[WORD_PARTS.document];
  let part = item === undefined ? null : strFromU8(item);
  let from: WordImport['from'] = 'custom-xml';
  if (part === null && body !== undefined) {
    part = hiddenPart(strFromU8(body));
    from = 'hidden-text';
  }

  if (part === null) {
    const custom = zip[WORD_PARTS.custom];
    const hash = custom === undefined
      ? null
      : /name="SiksamitraDocHash"><vt:lpwstr>([0-9a-f]+)</.exec(strFromU8(custom))?.[1] ?? null;
    throw new WordError(
      hash === null
        ? 'not a śikṣāmitra .docx: no customXml/item1.xml part. Only a file this '
          + 'program wrote can be opened this way; a Word file the owner typed '
          + 'has the text but not the document, and goes through importDocx.'
        : `this .docx was written by śikṣāmitra but its document part is gone — `
          + `some program stripped customXml/item1.xml. The document it should `
          + `hold hashes to ${hash}.`,
    );
  }

  const read = await documentFromCustomXml(part);
  if (read.manifest.format !== WORD_FORMAT) {
    throw new WordError(
      `unexpected format "${String(read.manifest.format)}" — expected ${WORD_FORMAT}`,
    );
  }
  return { ...read, from };
}
