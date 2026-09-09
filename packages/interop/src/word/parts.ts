/**
 * THE OOXML PACKAGE — where the document rides, and why there.
 *
 * A `.docx` is a zip of parts held together by relationship files. Word does
 * not preserve a part it does not recognise: drop `siksamitra/document.json`
 * into the zip and the first Save deletes it. There is exactly one place in the
 * format for private data that Word is CONTRACTUALLY REQUIRED to keep, and it
 * is the CUSTOM XML DATA STORE — `customXml/item1.xml`, related to
 * `document.xml`, described by an `itemProps` part carrying a GUID. It is what
 * content controls bind to and what the Document Information Panel reads, so it
 * survives an open and a save.
 *
 * THAT CLAIM IS TESTED, NOT ASSUMED. `tools/export/word-survives.ps1` drives a
 * real Word through COM: open the file we wrote, save it, and read the part
 * back out. Its result is recorded in `docs/EXPORT-WORD-PDF.md`. It is not part of
 * `check:export:word`, which has to run on a machine with no Office at all.
 *
 * WHAT IS NOT USED, and why:
 *   docProps/custom.xml   custom document properties are capped at 255
 *                         characters each by Word, so a 120 KB document does
 *                         not fit. Three of them carry the FORMAT, the HASH and
 *                         the STYLE, which is enough for a reader to say "this
 *                         is one of ours and its document is missing".
 *   a bare zip entry      no relationship, so Word discards it on save.
 *   hidden text in body   survives anything, and is available as
 *                         `fallback: 'hidden-text'`. It is not the default
 *                         because it puts the whole base64 payload into the
 *                         document body, where Show/Hide ¶ reveals it.
 */
import { toBase64 } from '../base64.js';
import { xmlEscape } from '../xml.js';
import type { ExportManifest } from '../embed.js';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const OFFICE_NS = 'http://schemas.openxmlformats.org/officeDocument/2006';
const OFFICE_REL = `${OFFICE_NS}/relationships`;
const DS_NS = `${OFFICE_NS}/customXml`;
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006';
const PKG_REL = `${PKG_NS}/relationships`;
/* The core properties' NAMESPACE is not under `/relationships` — that path is
   only the relationship TYPE. Writing `${PKG_REL}/metadata/core-properties` as
   the xmlns made Word 16.0 refuse the whole file as corrupted. */
const CORE_NS = `${PKG_NS}/metadata/core-properties`;

/** The part names, so the writer and the reader cannot spell one differently. */
export const WORD_PARTS = {
  contentTypes: '[Content_Types].xml',
  rootRels: '_rels/.rels',
  document: 'word/document.xml',
  documentRels: 'word/_rels/document.xml.rels',
  styles: 'word/styles.xml',
  settings: 'word/settings.xml',
  item: 'customXml/item1.xml',
  itemProps: 'customXml/itemProps1.xml',
  itemRels: 'customXml/_rels/item1.xml.rels',
  core: 'docProps/core.xml',
  app: 'docProps/app.xml',
  custom: 'docProps/custom.xml',
} as const;

/** The namespace of our custom XML part, and the elements inside it. */
export const SM_NS = 'urn:sikshamitra:document:1';

/**
 * The datastore item's GUID.
 *
 * FIXED, not generated. It identifies the SCHEMA — "this part is a śikṣāmitra
 * document" — and a reader looks for it; a fresh GUID per file would make every
 * export a different kind of thing, and would also make two exports of one
 * document differ in bytes, which the determinism check forbids.
 */
export const SM_ITEM_ID = '{6C5F1B8E-9A42-4D3C-8E17-2F0B7A5D9C41}';

/** The marker a hidden-text fallback is found by. */
export const HIDDEN_MARKER = 'SIKSAMITRA-DOCUMENT-1:';

function relationships(rels: { id: string; type: string; target: string }[]): string {
  return `${XML_HEAD}<Relationships ${REL_NS}>`
    + rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join('')
    + '</Relationships>';
}

/**
 * The media types a picture part may declare, by its file extension.
 *
 * A `.docx` with a `word/media/image1.png` and no `<Default Extension="png">`
 * is a package Word opens with "unreadable content", so this list and
 * `EXTENSIONS` in `drawing.ts` have to agree — they are the two halves of one
 * decision, which is why the extension travels ON the media rather than being
 * worked out twice.
 */
const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

/** @param extensions the picture extensions the package actually contains. */
export function contentTypes(extensions: readonly string[] = []): string {
  const wml = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  const over = (part: string, type: string): string =>
    `<Override PartName="/${part}" ContentType="${type}"/>`;
  const media = [...new Set(extensions)].sort()
    .filter((e) => MEDIA_TYPES[e] !== undefined)
    .map((e) => `<Default Extension="${e}" ContentType="${MEDIA_TYPES[e]!}"/>`)
    .join('');
  return `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" '
    + 'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + media
    + over(WORD_PARTS.document, `${wml}.document.main+xml`)
    + over(WORD_PARTS.styles, `${wml}.styles+xml`)
    + over(WORD_PARTS.settings, `${wml}.settings+xml`)
    + over(
      WORD_PARTS.itemProps,
      'application/vnd.openxmlformats-officedocument.customXmlProperties+xml',
    )
    + over(WORD_PARTS.core, 'application/vnd.openxmlformats-package.core-properties+xml')
    + over(WORD_PARTS.app, 'application/vnd.openxmlformats-officedocument.extended-properties+xml')
    + over(WORD_PARTS.custom, 'application/vnd.openxmlformats-officedocument.custom-properties+xml')
    + '</Types>';
}

export function rootRels(): string {
  return relationships([
    { id: 'rId1', type: `${OFFICE_REL}/officeDocument`, target: 'word/document.xml' },
    { id: 'rId2', type: `${PKG_REL}/metadata/core-properties`, target: 'docProps/core.xml' },
    { id: 'rId3', type: `${OFFICE_REL}/extended-properties`, target: 'docProps/app.xml' },
    { id: 'rId4', type: `${OFFICE_REL}/custom-properties`, target: 'docProps/custom.xml' },
  ]);
}

/**
 * The first relationship id a picture may take.
 *
 * Three are spent below. Named rather than counted at the call site, because
 * a picture whose `r:embed` names the styles part is a picture Word draws as
 * an error frame and nothing in the file says why.
 */
export const FIRST_MEDIA_REL = 4;

/** @param media the pictures in the package: their rel id and their target. */
export function documentRels(
  media: readonly { relId: string; target: string }[] = [],
): string {
  return relationships([
    { id: 'rId1', type: `${OFFICE_REL}/styles`, target: 'styles.xml' },
    { id: 'rId2', type: `${OFFICE_REL}/settings`, target: 'settings.xml' },
    /* The relationship is what makes the custom part part of the DOCUMENT
       rather than loose in the zip. Without it Word has no reason to keep it. */
    { id: 'rId3', type: `${OFFICE_REL}/customXml`, target: '../customXml/item1.xml' },
    ...media.map((m) => ({ id: m.relId, type: `${OFFICE_REL}/image`, target: m.target })),
  ]);
}

export function itemRels(): string {
  return relationships([
    { id: 'rId1', type: `${OFFICE_REL}/customXmlProps`, target: 'itemProps1.xml' },
  ]);
}

export function itemProps(): string {
  return `${XML_HEAD}<ds:datastoreItem ds:itemID="${SM_ITEM_ID}" xmlns:ds="${DS_NS}">`
    + `<ds:schemaRefs><ds:schemaRef ds:uri="${SM_NS}"/></ds:schemaRefs></ds:datastoreItem>`;
}

/**
 * The custom XML part: the manifest, the document and its assets, base64.
 *
 * BASE64 RATHER THAN THE JSON ITSELF. Word parses this part into its datastore
 * and writes it out again, and an XML round trip is free to renormalise
 * whitespace, reorder attributes and change the line endings. None of that can
 * touch a single text node of `[A-Za-z0-9+/=]`, so the bytes that come back are
 * the bytes that went in — which is the whole requirement.
 */
export function customXmlPart(
  manifest: ExportManifest, json: Uint8Array, assets: Record<string, Uint8Array>,
): string {
  const names = Object.keys(assets).sort();
  const encoded: Record<string, string> = {};
  for (const name of names) encoded[name] = toBase64(assets[name]!);
  const b64 = (s: string): string => toBase64(new TextEncoder().encode(s));
  return `${XML_HEAD}<sm:document xmlns:sm="${SM_NS}">`
    + `<sm:manifest>${b64(JSON.stringify(manifest))}</sm:manifest>`
    + `<sm:body>${toBase64(json)}</sm:body>`
    + `<sm:assets>${b64(JSON.stringify(encoded))}</sm:assets>`
    + '</sm:document>';
}

/**
 * One hidden paragraph carrying the same payload.
 *
 * `w:vanish` is Word's hidden text: not printed, not shown unless the reader
 * turns on formatting marks. Body text is the one thing Word cannot lose, so
 * this is the fallback if the datastore ever stops being reliable — and the
 * reader tries it whether or not the writer was asked for it.
 */
export function hiddenPayload(part: string): string {
  const text = xmlEscape(HIDDEN_MARKER + toBase64(new TextEncoder().encode(part)));
  return '<w:p><w:pPr><w:rPr><w:vanish/></w:rPr></w:pPr>'
    + `<w:r><w:rPr><w:vanish/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

export function settings(): string {
  return `${XML_HEAD}<w:settings `
    + 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    /* Word 2013 layout rules. Without a compatibility mode Word picks one from
       the file's age and can change line breaking on open. */
    + '<w:compat><w:compatSetting w:name="compatibilityMode" '
    + 'w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>'
    + '</w:settings>';
}

/**
 * The core properties, in the schema's own order.
 *
 * created, creator, lastModifiedBy, modified, title — an `xs:sequence`, not a
 * set. Written title-first, which reads better and is invalid, Word 16.0 opens
 * the file with "The file appears to be corrupted" and no further detail. That
 * cost an afternoon; the order is the fix.
 */
export function coreProps(manifest: ExportManifest): string {
  const when = xmlEscape(manifest.savedAt);
  const who = xmlEscape(manifest.engine);
  return `${XML_HEAD}<cp:coreProperties `
    + `xmlns:cp="${CORE_NS}" `
    + 'xmlns:dc="http://purl.org/dc/elements/1.1/" '
    + 'xmlns:dcterms="http://purl.org/dc/terms/" '
    + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created>`
    + `<dc:creator>${who}</dc:creator>`
    + `<cp:lastModifiedBy>${who}</cp:lastModifiedBy>`
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified>`
    + `<dc:title>${xmlEscape(manifest.title)}</dc:title>`
    + '</cp:coreProperties>';
}

export function appProps(manifest: ExportManifest): string {
  return `${XML_HEAD}<Properties `
    + `xmlns="${OFFICE_NS}/extended-properties" xmlns:vt="${OFFICE_NS}/docPropsVTypes">`
    + `<Application>${xmlEscape(manifest.engine)}</Application>`
    + '</Properties>';
}

/**
 * The three custom properties.
 *
 * NOT the document — Word caps a custom property at 255 characters. These say
 * what the file is and what its document should hash to, so a reader looking at
 * a `.docx` whose datastore has been stripped can name the loss precisely
 * instead of reporting "not one of ours".
 */
export function customProps(manifest: ExportManifest): string {
  const FMT_ID = '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}';
  const prop = (pid: number, name: string, value: string): string =>
    `<property fmtid="${FMT_ID}" pid="${pid}" name="${name}">`
    + `<vt:lpwstr>${xmlEscape(value)}</vt:lpwstr></property>`;
  return `${XML_HEAD}<Properties xmlns="${OFFICE_NS}/custom-properties" `
    + `xmlns:vt="${OFFICE_NS}/docPropsVTypes">`
    + prop(2, 'SiksamitraFormat', `${manifest.format}/${manifest.version}`)
    + prop(3, 'SiksamitraDocHash', manifest.docHash)
    + prop(4, 'SiksamitraStyle', manifest.style)
    + '</Properties>';
}
