/**
 * A PART OF A DOCUMENT WITH RULES OF ITS OWN — in Word, a content control.
 *
 * One document may hold chants from different traditions — a Taittirīya
 * sūkta, then a Ṛgvedic one, then a stotra — and each is marked by its own
 * register's rules. The app keeps that per SECTION (`profile`); in Word a part
 * is a CONTENT CONTROL, Word's own way of marking off a region: a block-level
 * `<w:sdt>` around the part's paragraphs, whose tag says it is ours and which
 * register it is marked in, and whose title shows the register's name when
 * the caret is inside it.
 *
 * Outside every part, the document's own register applies, so a document of
 * one tradition needs no part at all, and every document written before parts
 * existed reads as it always did.
 *
 * ONE DEFINITION, three readers: the add-in makes and reads parts in a live
 * Word, `importDocx` reads them into sections with a profile, and `exportWord`
 * writes a section marked by other rules as one. THE TAG IS VERSIONED (`v1`)
 * because it is stored in people's files: a later format must still read it.
 */
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES, type ChantProfileKey } from '@siksamitra/format';
import { DEFAULT_PROFILE_KEY } from '@siksamitra/engine';
import { xmlEscape, xmlText } from '../xml.js';

const PREFIX = 'siksamitra:part:v1:';

/** What a part records. */
export interface PartRules {
  register: ChantProfileKey;
}

/** The content control's tag for these rules. */
export const partTag = (r: PartRules): string => `${PREFIX}${r.register}`;

/** The rules a tag records, or `null` when the tag is not one of ours. */
export function partOf(tag: string | null | undefined): PartRules | null {
  if (tag === null || tag === undefined || !tag.startsWith(PREFIX)) return null;
  const register = tag.slice(PREFIX.length);
  return (CHANT_PROFILE_KEYS as readonly string[]).includes(register)
    ? { register: register as ChantProfileKey } : null;
}

/** What the part's title bar says: which rules mark it. */
export const partTitle = (r: PartRules): string => `${CHANT_PROFILE_NOTES[r.register].name} — śikṣāmitra`;

const attr = (s: string): string => xmlEscape(s).replace(/"/g, '&quot;');

/**
 * Paragraphs as one part, the way Word writes a content control around them.
 * `id` must be unique in the document — Word renumbers a clash, but a reader
 * that trusted the id would be wrong until it did.
 */
export const partXml = (paragraphs: string, rules: PartRules, id: number): string =>
  `<w:sdt><w:sdtPr><w:alias w:val="${attr(partTitle(rules))}"/><w:tag w:val="${attr(partTag(rules))}"/>`
  + `<w:id w:val="${id}"/></w:sdtPr><w:sdtContent>${paragraphs}</w:sdtContent></w:sdt>`;

/** A stretch of written paragraphs, `[from, to)`, and the register that marks it. */
export interface Region {
  from: number;
  to: number;
  register: ChantProfileKey | null;
}

/** The first id this writer gives a part — far from what Word numbers its own. */
const FIRST_ID = 470100;

/**
 * The paragraphs, with every stretch marked by a register OTHER than the
 * default made a part — consecutive stretches of one register one part, as a
 * person selecting them in Word and pressing New part would have made it.
 * Marked by the default, a stretch needs no part: outside every part, that is
 * what the add-in marks by.
 */
export function withParts(paragraphs: readonly string[], regions: readonly Region[]): string {
  const other = (r: Region): ChantProfileKey | null =>
    (r.register === null || r.register === DEFAULT_PROFILE_KEY ? null : r.register);
  let out = '';
  let at = 0;
  let id = FIRST_ID;
  for (let i = 0; i < regions.length; i += 1) {
    const register = other(regions[i]!);
    if (register === null) continue;
    let last = i;
    while (last + 1 < regions.length && other(regions[last + 1]!) === register) last += 1;
    const from = regions[i]!.from;
    const to = regions[last]!.to;
    out += paragraphs.slice(at, from).join('') + partXml(paragraphs.slice(from, to).join(''), { register }, id);
    id += 1;
    at = to;
    i = last;
  }
  return out + paragraphs.slice(at).join('');
}


/**
 * THE DOCUMENT'S OWN REGISTER — the one outside every part — as the add-in
 * records it: in the document's settings (`Office.context.document.settings`),
 * which Word keeps in the file, in the add-in's `webextension` part, as a
 * JSON value. Read by the add-in in a live Word, and by `importDocx` from the
 * file, so the app marks a document by what its author chose there.
 */
export const REGISTER_SETTING = 'siksamitra.register';

/** The register a `word/webextensions/webextension*.xml` part records, or `null`. */
export function recordedRegisterIn(webextensionXml: string): ChantProfileKey | null {
  for (const m of webextensionXml.matchAll(/<we:property\s+name="([^"]*)"\s+value="([^"]*)"\s*\/>/g)) {
    if (m[1] !== REGISTER_SETTING) continue;
    try {
      const v: unknown = JSON.parse(xmlText(m[2] ?? ''));
      if (typeof v === 'string' && (CHANT_PROFILE_KEYS as readonly string[]).includes(v)) return v as ChantProfileKey;
    } catch { /* not a value this program wrote */ }
  }
  return null;
}
