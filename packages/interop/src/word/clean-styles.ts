/**
 * HIS STYLES, UNDER THE CLEAN NAMES — the same look, the better vocabulary.
 *
 * The owner's ruling (2026-09-30), replacing "a document with his ids keeps
 * them": EVERY document is written in the clean vocabulary — `Mantra`,
 * `Translation`, `Holding · Short`, `Holding · Long`, `Overline` — and one of
 * his hand-authored documents is TAKEN INTO it rather than kept out of it.
 * "Visually there is literally 0 difference. But better, more precise control."
 *
 * What makes it zero difference is that the clean style takes HIS DEFINITION,
 * not ours: his `Translit` becomes `Mantra` with his `Translit`'s own face,
 * size, leading and indent; his `Long` becomes `Overline` in whatever face his
 * document gives it (Calibri Light in one, Palladio in another). Our sheet is
 * only for a style his document has not got.
 *
 * AND THE ONE PLACE THE CLEAN VOCABULARY IS MORE PRECISE THAN HIS: his files
 * write a replaced visarga in `Anusvara`. The clean vocabulary has `Visarga`
 * for it, and his `Anusvara`'s definition is the one it takes — the same blue
 * italic, now saying what it is.
 */
import { VOCABULARY, inVocabulary } from './vocabulary.js';

const RE_STYLE = /<w:style\b[^>]*\bw:styleId="([^"]+)"[^>]*>[\s\S]*?<\/w:style>/g;
const RE_DEFAULTS = /<w:docDefaults>[\s\S]*?<\/w:docDefaults>/;
const LEGACY = new Set(VOCABULARY.map((e) => e.legacy));

/**
 * His document's `docDefaults`, kept with his styles under this key.
 *
 * MEASURED IN WORD: a package whose `docDefaults` differ from the document's
 * has the difference FOLDED INTO every style it brings — Word keeps the look
 * the package was authored in. So his `Translit`, carried as `Mantra` in a
 * package with OUR defaults, arrived with our `color 000000`, East-Asian face
 * and language added: black where his is automatic, which a dark page shows.
 * A package carrying his styles carries his defaults, and nothing is folded.
 */
export const DOC_DEFAULTS = '#docDefaults';

/**
 * His `<w:styles>` root's namespace declarations, kept under this key.
 *
 * His definitions may use a prefix our sheet does not declare — his
 * Kanakadhārā's defaults carry `<w14:ligatures/>` — and a part with an
 * undeclared prefix is not XML: Word refused every write into that file
 * ("XML markup cannot be inserted in the specified location"). Whatever of
 * his is carried, the declarations it needs are carried with it.
 */
export const NAMESPACES = '#xmlns';

const RE_XMLNS = /\sxmlns:(\w+)="[^"]*"/g;

/** The sheet's root with every declaration of his it lacks and its content uses. */
function declared(sheet: string, his: string | undefined): string {
  if (his === undefined) return sheet;
  const root = /<w:styles\b[^>]*>/.exec(sheet);
  if (root === null) return sheet;
  const have = new Set([...root[0].matchAll(RE_XMLNS)].map((m) => m[1]!));
  const used = new Set([...sheet.matchAll(/<\/?(\w+):|\s(\w+):\w+=/g)].map((m) => m[1] ?? m[2]!));
  const add = [...his.matchAll(RE_XMLNS)].filter((m) => !have.has(m[1]!) && used.has(m[1]!)).map((m) => m[0]).join('');
  return add === '' ? sheet : sheet.replace(root[0], root[0].replace(/>$/, `${add}>`));
}

/**
 * A style of his, as the clean vocabulary writes it: renamed, its `basedOn`
 * renamed with it, and what points at things outside the style sheet taken
 * out — `w:link` (to a linked "…Char" style the package does not carry) and
 * `w:rsid` (an editing session of his).
 */
function cleaned(style: string): string {
  return inVocabulary(style, 'clean')
    .replace(/<w:link\s+w:val="[^"]*"\s*\/>/g, '')
    .replace(/<w:rsid\s+w:val="[^"]*"\s*\/>/g, '');
}

/**
 * His document's own styles, as clean ones — keyed by the CLEAN id.
 *
 * Only the vocabulary's: his headings and `Normal` are Word's built-ins and
 * stay his by being left alone.
 */
export function hisStylesAsClean(stylesXml: string): Map<string, string> {
  const out = new Map<string, string>();
  let anusvara: string | undefined;
  for (const m of stylesXml.matchAll(RE_STYLE)) {
    const id = m[1]!;
    if (!LEGACY.has(id)) continue;
    /* Where his id IS the clean one (`Anusvara`, `Svara`, `Virama`…) his NAME
       stays too. Word matches an inserted style by name: under ours
       (`Anusvāra`) it found none, made a second style beside his, and gave it
       an id of its own (`Anusvra`) — a duplicate in his Styles pane, and runs
       the reader no longer knew (`style-names.ts`). */
    const keepsName = VOCABULARY.some((e) => e.legacy === id && e.clean === id);
    const style = keepsName
      ? cleaned(m[0]).replace(/<w:name\s+w:val="[^"]*"\s*\/>/, /<w:name\s+w:val="[^"]*"\s*\/>/.exec(m[0])?.[0] ?? '$&')
      : cleaned(m[0]);
    const cleanId = /w:styleId="([^"]+)"/.exec(style)![1]!;
    out.set(cleanId, style);
    if (id === 'Anusvara') anusvara = style;
  }
  const defaults = RE_DEFAULTS.exec(stylesXml)?.[0];
  if (out.size > 0 && defaults !== undefined) out.set(DOC_DEFAULTS, defaults);
  const root = /<w:styles\b[^>]*>/.exec(stylesXml)?.[0];
  if (out.size > 0 && root !== undefined) out.set(NAMESPACES, root);
  /* `Visarga` from his `Anusvara`, where he has no `Visarga` of his own. */
  if (anusvara !== undefined && !out.has('Visarga')) {
    out.set('Visarga', anusvara
      .replace('w:styleId="Anusvara"', 'w:styleId="Visarga"')
      .replace(/<w:name\s+w:val="[^"]*"\s*\/>/, '<w:name w:val="Visarga"/>'));
  }
  return out;
}

/**
 * A clean style sheet with his definitions in it: every style of `sheet` his
 * document has is his, and the styles those are based on come with them — so
 * `VedicAnusvara` based on `Anusvara` resolves to his `Anusvara`, not ours.
 */
export function withHisDefinitions(sheet: string, his: ReadonlyMap<string, string>): string {
  if (his.size === 0) return sheet;
  const present = new Set([...sheet.matchAll(RE_STYLE)].map((m) => m[1]!));
  /* The styles the sheet's styles are based on, his ones, that it lacks. */
  const needed = new Set<string>();
  const visit = (id: string): void => {
    const s = his.get(id);
    const base = s === undefined ? undefined : /<w:basedOn\s+w:val="([^"]+)"/.exec(s)?.[1];
    if (base === undefined || present.has(base) || needed.has(base) || !his.has(base)) return;
    needed.add(base);
    visit(base);
  };
  for (const id of present) visit(id);
  const defaults = his.get(DOC_DEFAULTS);
  const replaced = sheet.replace(RE_STYLE, (all, id: string) => his.get(id) ?? all)
    .replace(RE_DEFAULTS, (ours) => defaults ?? ours);
  const extra = [...needed].map((id) => his.get(id)!).join('');
  return declared(extra === '' ? replaced : replaced.replace('</w:styles>', `${extra}</w:styles>`), his.get(NAMESPACES));
}

/** The ids of his vocabulary a document still uses or defines. */
export function legacyStylesIn(xml: string): string[] {
  const out = new Set<string>();
  for (const m of xml.matchAll(/\bw:styleId="([^"]+)"|<w:(?:pStyle|rStyle)\s+w:val="([^"]+)"/g)) {
    const id = m[1] ?? m[2]!;
    const e = VOCABULARY.find((x) => x.legacy === id);
    if (e !== undefined && e.legacy !== e.clean) out.add(id);
  }
  return [...out];
}
