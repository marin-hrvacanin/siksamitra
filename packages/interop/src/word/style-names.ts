/**
 * A BUILT-IN STYLE'S ID IS TRANSLATED; ITS NAME IS NOT.
 *
 * Word gives its built-in styles an id in the language of the Word that made
 * the document. Measured in a Croatian Word on the web, with the add-in's own
 * specimen inserted: `Heading1` came back as `w:styleId="Naslov1"`, `Header` as
 * `Zaglavlje`, `Caption` as `Opisslike` — while `w:name` stayed `heading 1`,
 * `header`, `caption`. A German Word writes `Überschrift1`, a French one
 * `Titre1`. The name is the identity Word itself keys a built-in on; the id is
 * a local spelling of it.
 *
 * Everything that read a paragraph's role from its id — the importer, the
 * add-in's reader, the pane's "which styles are missing" — therefore saw no
 * heading at all in any Word that is not English, and the pane reported six
 * styles missing that the document was visibly using.
 *
 * So a document's ids are read THROUGH ITS OWN STYLE TABLE: an id whose style
 * is named like a built-in is taken as that built-in's English id, which is the
 * vocabulary the rest of the program speaks. Custom styles (`Translit`,
 * `Holding`, …) carry `w:customStyle="1"`, are never translated, and pass
 * through unchanged.
 */

import { VOCABULARY, fromClean } from './vocabulary.js';

/*
 * AND OUR OWN STYLES ARE KNOWN BY NAME TOO — measured in real Word.
 *
 * Word matches a style an insertion brings by its NAME. His documents name
 * theirs `Anusvara`, `Virama`, `VedicAnusvara`; ours are `Anusvāra`,
 * `Virāma`, `Vedic Anusvāra`, under the SAME ids. So a write into one of his
 * files found no style named `Anusvāra`, made one, and — the id `Anusvara`
 * being his — gave it one derived from the name: `Anusvra`. Read by id, every
 * short pause in it came back as a plain `|` and every replaced anusvāra lost
 * what it replaced; a register changed over it then turned `saṁ` into `sam`.
 * A style of the vocabulary is therefore known by its name as well as its id,
 * whatever id Word chose for it.
 */
const OURS: ReadonlyMap<string, string> = new Map(VOCABULARY.flatMap((e) => [
  [e.name.toLowerCase(), e.clean] as const, [e.clean.toLowerCase(), e.clean] as const, [e.legacy.toLowerCase(), e.clean] as const,
]));

/** The built-in names this program uses, and the English id each one has. */
const BUILT_IN: ReadonlyMap<string, string> = new Map([
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`heading ${n}`, `Heading${n}`] as const),
  ['normal', 'Normal'],
  ['title', 'Title'],
  ['subtitle', 'Subtitle'],
  ['header', 'Header'],
  ['footer', 'Footer'],
  ['caption', 'Caption'],
]);

const RE_STYLE = /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g;
const RE_ID = /\bw:styleId="([^"]*)"/;
const RE_NAME = /<w:name\s+w:val="([^"]*)"/;

/**
 * From a style table (or any package containing one), each LOCAL id that
 * names a built-in, mapped to the built-in's English id. Ids that are already
 * English map to themselves, so the map is complete for every built-in the
 * table defines.
 */
export function builtInStyleIds(stylesXml: string): Map<string, string> {
  const out = new Map<string, string>();
  RE_STYLE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_STYLE.exec(stylesXml)) !== null) {
    const id = RE_ID.exec(m[1] ?? '')?.[1];
    const name = RE_NAME.exec(m[2] ?? '')?.[1];
    if (id === undefined || name === undefined) continue;
    const english = BUILT_IN.get(name.toLowerCase()) ?? (/w:customStyle="1"/.test(m[1] ?? '') ? OURS.get(name.toLowerCase()) : undefined);
    if (english !== undefined) out.set(id, english);
  }
  return out;
}

/**
 * A style id in the program's vocabulary: the English id of a built-in, his id
 * for a clean one (`Mantra` is `Translit` — see `vocabulary.ts`), or itself.
 */
export function canonicalStyleId(
  id: string | null,
  table: ReadonlyMap<string, string> | undefined,
): string | null {
  if (id === null) return id;
  return fromClean(table?.get(id) ?? id);
}
