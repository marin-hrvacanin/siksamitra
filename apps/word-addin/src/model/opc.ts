/**
 * THE FLAT OPC PACKAGE — the only way to put a character border into Word from
 * an add-in that also has to work in Word on the web.
 *
 * WHY NOT THE OBJECT MODEL. Word's JavaScript API grew a border surface, but it
 * is `Word.Font.borders` in requirement set **WordApiDesktop 1.3** — Windows
 * 2507 and Mac 16.99.2 and later, and NOT available in Word on the web, on
 * iPad, or in perpetual Office at all. `Range.insertOoxml` / `Range.getOoxml`
 * are **WordApi 1.1**: Word 2016 desktop, Mac, iPad and the web. A holding box
 * is the whole point of this add-in, so the box has to be drawn by the
 * mechanism that exists everywhere.
 *
 * WHAT A FLAT OPC PACKAGE IS. A `.docx` is a zip of XML parts; the same parts
 * written as one XML document, each inside a `<pkg:part>`, is what `insertOoxml`
 * takes and what `getOoxml` returns. There is no `[Content_Types].xml` — each
 * part states its own content type.
 *
 * TWO RULES, both from Microsoft's OOXML guide, both of which cost a silent
 * failure if broken:
 *   - every part must have a relationship, and every relationship must have its
 *     part. A relationship pointing at a part that is not in the package is an
 *     error, which is why the minimal set here is exactly four parts rather
 *     than a trimmed copy of `packages/interop/src/word/parts.ts` (that one is
 *     for a zip and declares the settings, the properties and the datastore).
 *   - a `w:rStyle` naming a style the package does not define and the
 *     destination document has not got is IGNORED — no error, no box. So
 *     `styles.xml` travels with every insertion.
 */
import { xmlEscape } from '@siksamitra/interop';

const PKG_NS = 'http://schemas.microsoft.com/office/2006/xmlPackage';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WML = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
const RELS_TYPE = 'application/vnd.openxmlformats-package.relationships+xml';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function part(name: string, contentType: string, xml: string): string {
  return `<pkg:part pkg:name="${name}" pkg:contentType="${contentType}">`
    + `<pkg:xmlData>${xml}</pkg:xmlData></pkg:part>`;
}

function rels(list: { id: string; type: string; target: string }[]): string {
  return `<Relationships xmlns="${REL_NS}">`
    + list.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join('')
    + '</Relationships>';
}

/**
 * The package to hand `insertOoxml`.
 *
 * `body` is the `<w:p>` sequence — what `paragraphsXml` returns. `styles` is a
 * whole `word/styles.xml`, which the caller gets from `stylesXml()` in
 * `@siksamitra/interop` rather than writing: that generator is what the `.docx`
 * exporter uses, so the box Word draws here is the box the exporter prints.
 */
export function flatPackage(body: string, styles: string): string {
  return `${XML_HEAD}<pkg:package xmlns:pkg="${PKG_NS}">`
    + part('/_rels/.rels', RELS_TYPE, rels([
      { id: 'rId1', type: `${OFFICE_REL}/officeDocument`, target: 'word/document.xml' },
    ]))
    + part('/word/_rels/document.xml.rels', RELS_TYPE, rels([
      { id: 'rId1', type: `${OFFICE_REL}/styles`, target: 'styles.xml' },
    ]))
    + part('/word/document.xml', `${WML}.document.main+xml`,
      `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`)
    /* The declaration is stripped: a processing instruction inside `pkg:xmlData`
       is not well-formed, and `stylesXml` writes one because its other caller
       is writing a standalone part into a zip. */
    + part('/word/styles.xml', `${WML}.styles+xml`, styles.replace(/^<\?xml[^?]*\?>/, ''))
    + '</pkg:package>';
}

/**
 * The `word/document.xml` out of a package Word handed back.
 *
 * Matched on the part NAME rather than by position: `getOoxml` returns
 * whatever the range dragged in with it — themes, fonts, numbering, settings,
 * the lot — and the document part is not first.
 */
export function documentPartOf(pkg: string): string {
  const re = /<[A-Za-z0-9_]+:part\b[^>]*:name="\/word\/document\.xml"[^>]*>([\s\S]*?)<\/[A-Za-z0-9_]+:part>/;
  const inner = re.exec(pkg)?.[1];
  if (inner === undefined) {
    throw new Error('the OOXML Word returned has no /word/document.xml part');
  }
  const data = /<[A-Za-z0-9_]+:xmlData\b[^>]*>([\s\S]*)<\/[A-Za-z0-9_]+:xmlData>/.exec(inner);
  if (data === null) throw new Error('the /word/document.xml part carries no xmlData');
  return data[1] ?? '';
}

/**
 * One paragraph of literal text, in a style, as `<w:p>`.
 *
 * For the parts of the task pane that write something that is not a marked
 * line — a heading, a source note. `documentXml` writes those too, but only as
 * part of a whole document, and a heading is not worth building one for.
 */
export function textParagraph(style: string | null, text: string): string {
  return '<w:p>'
    + (style === null ? '' : `<w:pPr><w:pStyle w:val="${xmlEscape(style)}"/></w:pPr>`)
    + `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`
    + '</w:p>';
}

/**
 * The paragraph style on an emitted `<w:p>`, replaced.
 *
 * `documentXml` writes a mantra line as whatever `word-styles.ts` says a verse
 * is — `Translit` today. A paragraph read out of the user's document may be
 * something else, and rewriting a `Heading3` as a mantra because somebody
 * marked a word in it would restyle their heading. So the style the paragraph
 * arrived with is put back; a paragraph that had none keeps the verse style,
 * because marking a line with holdings is what makes it a mantra.
 */
export function restyle(paragraphXml: string, style: string | null): string {
  if (style === null) return paragraphXml;
  return paragraphXml.replace(
    /<w:pStyle w:val="[^"]*"\/>/g,
    `<w:pStyle w:val="${xmlEscape(style)}"/>`,
  );
}
