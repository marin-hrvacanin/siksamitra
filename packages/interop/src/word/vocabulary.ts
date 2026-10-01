/**
 * TWO NAMES FOR EVERY STYLE: HIS, AND CLEAN ONES. Chosen per document, read always.
 *
 * LEGACY is the owner's vocabulary — `Translit`, `Prijevod`, `Holding`,
 * `2Holding`, `Long` — the ids his files have used for years and that his
 * colleagues' documents are full of. CLEAN is English with the IAST term, for
 * a document that has never met his: `Mantra`, `Translation`, `Holding · Short`.
 * The owner's ruling: "if the document already contains the legacy style names,
 * then keep them, but if not, then import clean style names."
 *
 * EVERYTHING INSIDE THE PROGRAM SPEAKS LEGACY. The style table in
 * `word-styles.ts`, the writers and the readers all use his ids, and this file
 * is the one place the other vocabulary exists: a document is READ through
 * `canonicalStyleId`, which maps a clean id to his, and WRITTEN through
 * `inVocabulary`, which maps his to clean when the document is clean. One
 * table, both directions — so a style cannot be renamed on the way out and not
 * recognised on the way back in.
 *
 * Ids stay ASCII in both, because an id is what `w:pStyle` and `w:rStyle` name
 * and what other tools search for; the NAME is what a person reads in the
 * Styles pane, and carries the diacritics. See the change `word-addin-complete`,
 * design D1.
 */

export type Vocabulary = 'legacy' | 'clean';

interface Entry {
  /** His id, and the program's. */
  legacy: string;
  clean: string;
  /** What the Styles pane shows in a clean document. */
  name: string;
}

export const VOCABULARY: readonly Entry[] = [
  { legacy: 'Translit', clean: 'Mantra', name: 'Mantra' },
  { legacy: 'Prijevod', clean: 'Translation', name: 'Translation' },
  { legacy: 'Holding', clean: 'HoldingShort', name: 'Holding · Short' },
  { legacy: '2Holding', clean: 'HoldingLong', name: 'Holding · Long' },
  { legacy: 'HoldingChange', clean: 'HoldingShortChange', name: 'Holding · Short · Change' },
  { legacy: '2HoldingChange', clean: 'HoldingLongChange', name: 'Holding · Long · Change' },
  { legacy: 'Svara', clean: 'Svara', name: 'Svara' },
  { legacy: 'Virama', clean: 'Virama', name: 'Virāma' },
  { legacy: 'Anusvara', clean: 'Anusvara', name: 'Anusvāra' },
  { legacy: 'Visarga', clean: 'Visarga', name: 'Visarga' },
  { legacy: 'VedicAnusvara', clean: 'VedicAnusvara', name: 'Vedic Anusvāra' },
  { legacy: 'Long', clean: 'Overline', name: 'Overline' },
  { legacy: 'Pause', clean: 'Pause', name: 'Pause' },
  { legacy: 'Comment', clean: 'Comment', name: 'Comment' },
  { legacy: 'Reference', clean: 'Reference', name: 'Reference' },
  { legacy: 'Insert', clean: 'Insert', name: 'Insert' },
  /* His Devanāgarī's, under his own names: Word matches a style by name, and a
     name of ours beside his would be a second style (`style-names.ts`). */
  { legacy: 'Devanagari', clean: 'Devanagari', name: 'Devanagari' },
  { legacy: 'Hold', clean: 'Hold', name: 'Hold' },
  { legacy: 'Phonetic', clean: 'Phonetic', name: 'Phonetic' },
];

const TO_CLEAN: ReadonlyMap<string, Entry> = new Map(VOCABULARY.map((e) => [e.legacy, e]));
const FROM_CLEAN: ReadonlyMap<string, string> = new Map(VOCABULARY.map((e) => [e.clean, e.legacy]));

/** The ids that exist ONLY in his vocabulary — their presence decides. */
const LEGACY_ONLY: ReadonlySet<string> = new Set(
  VOCABULARY.filter((e) => e.legacy !== e.clean).map((e) => e.legacy),
);

/** A clean id as his, or the id unchanged. */
export function fromClean(id: string): string {
  return FROM_CLEAN.get(id) ?? id;
}

const RE_ID_USE = /\bw:styleId="([^"]+)"|<w:(?:pStyle|rStyle)\s+w:val="([^"]+)"/g;

/**
 * Which vocabulary a document speaks, from its package (or any part of it).
 *
 * LEGACY when any of his own ids is defined or used; CLEAN otherwise, which is
 * also what an empty document gets. A document holding both is legacy: its
 * owner's styles win. Decided from the document and never from a setting, so
 * one file is written the same way on every machine.
 */
export function vocabularyOf(xml: string): Vocabulary {
  for (const m of xml.matchAll(RE_ID_USE)) {
    if (LEGACY_ONLY.has(m[1] ?? m[2] ?? '')) return 'legacy';
  }
  return 'clean';
}

const RE_REF = /(<w:(?:pStyle|rStyle|basedOn|next|link)\s+w:val=")([^"]+)(")/g;
const RE_STYLE = /(<w:style\b[^>]*\bw:styleId=")([^"]+)("[^>]*>)([\s\S]*?)(<\/w:style>)/g;
const RE_NAME = /(<w:name\s+w:val=")[^"]*(")/;

/**
 * A substituted candrabindu, as the writer writes one: `m` and U+0310 in
 * `Anusvara`. Matched on the writer's own shape, which is the only one it has.
 */
const RE_CANDRA_RUN = /<w:r><w:rPr><w:rStyle w:val="Anusvara"\/><\/w:rPr><w:t xml:space="preserve">m\u0310<\/w:t><\/w:r>/g;

/**
 * HIS CANDRABINDU, in a document that is his.
 *
 * Every one of the 176 candrabindus in the mantra lines of his six reference
 * documents is U+F141 — URW Palladio ITU's own `m̐`, a private-use character —
 * in his `VedicAnusvara`, and none is `m` + U+0310. So a line of his written
 * back with the Unicode pair drew a different `m` with a different candra. In
 * his documents it is written his way.
 *
 * Only there. U+F141 is drawn by URW Palladio ITU and by nothing else: in a
 * new document, on Word on the web or on a Mac without the font, it is an
 * empty box — and Palladio has no U+0310, so `VedicAnusvara` cannot carry the
 * portable pair either. A clean document keeps the Unicode letter.
 */
export const withHisCandrabindu = (xml: string): string => xml.replace(RE_CANDRA_RUN,
  '<w:r><w:rPr><w:rStyle w:val="VedicAnusvara"/></w:rPr><w:t xml:space="preserve">\uf141</w:t></w:r>');

/**
 * XML written in his vocabulary, in the one asked for.
 *
 * Every id a style is defined under or referenced by, and the name each
 * renamed definition shows. Legacy keeps every id, and writes his
 * candrabindu (`inHisGlyphs`).
 */
export function inVocabulary(xml: string, vocabulary: Vocabulary): string {
  if (vocabulary === 'legacy') return withHisCandrabindu(xml);
  return xml
    .replace(RE_STYLE, (all, open: string, id: string, rest: string, inner: string, close: string) => {
      const e = TO_CLEAN.get(id);
      if (e === undefined) return all;
      return `${open}${e.clean}${rest}${inner.replace(RE_NAME, `$1${e.name}$2`)}${close}`;
    })
    .replace(RE_REF, (all, open: string, id: string, close: string) => {
      const e = TO_CLEAN.get(id);
      return e === undefined ? all : `${open}${e.clean}${close}`;
    });
}
