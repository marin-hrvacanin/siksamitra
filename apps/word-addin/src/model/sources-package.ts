/**
 * WHICH SOURCE EACH LINE IS — rewritten in a stretch of the document's XML.
 *
 * A line's source (the śākhā whose rules mark it) is kept invisibly: a run of
 * lines whose source is not the document's own sits inside a content control
 * of ours, tagged with it, with no frame (`word/rule-parts.ts` in interop
 * reads the tag). The person never meets the control — they select lines and
 * choose a source, and this module puts the record in order: every control of
 * ours in the stretch is taken apart, and each run of lines with the same
 * source is put back inside one. Lines of the document's own source carry no
 * record at all. Controls that are not ours are left as they are.
 *
 * Pure: a package in, a package out, so it is tested without Word.
 */
import type { ChantProfileKey } from '@siksamitra/format';
import { partOf, partTag, partTitle } from '@siksamitra/interop';

const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A top-level piece of the body: a paragraph, a table, a control — what Word counts paragraphs in. */
interface Unit {
  readonly xml: string;
  /** The source its control of ours gave it, or `null` for the document's own. */
  readonly source: ChantProfileKey | null;
  /** How many of Word's paragraphs it holds — a table holds its cells'. */
  readonly paragraphs: number;
}

const PARAS = /<w:p[\s>/]/g;
const countParas = (xml: string): number => (xml.match(PARAS) ?? []).length;

/** The element starting at `at` — `<w:NAME …>…</w:NAME>` with its own kind nested inside — or a self-closing one. */
function element(xml: string, at: number): { name: string; end: number } | null {
  const open = /^<(w:[A-Za-z]+)\b[^>]*?(\/?)>/.exec(xml.slice(at));
  if (open === null) return null;
  const name = open[1]!;
  if (open[2] === '/') return { name, end: at + open[0].length };
  const tag = new RegExp(`<(/?)${name}\\b[^>]*?(/?)>`, 'g');
  tag.lastIndex = at;
  let depth = 0;
  for (let m = tag.exec(xml); m !== null; m = tag.exec(xml)) {
    if (m[2] === '/') continue;
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return { name, end: m.index + m[0].length };
  }
  return null;
}

/** The body's pieces, in order; a control of ours is opened into its lines. */
function unitsOf(body: string): Unit[] {
  const out: Unit[] = [];
  let at = 0;
  while (at < body.length) {
    const next = body.indexOf('<w:', at);
    if (next === -1) break;
    const el = element(body, next);
    if (el === null) break;
    const xml = body.slice(next, el.end);
    at = el.end;
    if (el.name === 'w:sdt') {
      const tag = /<w:sdtPr>[\s\S]*?<w:tag w:val="([^"]*)"/.exec(xml)?.[1];
      const rules = partOf(tag);
      const content = /<w:sdtContent>([\s\S]*)<\/w:sdtContent>/.exec(xml)?.[1];
      if (rules !== null && content !== undefined) {
        for (const inner of unitsOf(content)) out.push({ ...inner, source: rules.register });
        continue;
      }
    }
    out.push({ xml, source: null, paragraphs: countParas(xml) });
  }
  return out;
}

const wrap = (source: ChantProfileKey, inner: string): string => {
  const rules = { register: source };
  return `<w:sdt><w:sdtPr><w:alias w:val="${esc(partTitle(rules))}"/><w:tag w:val="${esc(partTag(rules))}"/>`
    + `<w15:appearance w15:val="hidden"/></w:sdtPr><w:sdtContent>${inner}</w:sdtContent></w:sdt>`;
};

/**
 * The package's body with each piece given the source `choose` says.
 *
 * `choose(old, paragraphs)` is asked once per piece with the source it has now
 * and the indexes of Word's paragraphs it holds, counted from the stretch's
 * first; it answers the source the piece is to have, `null` being the
 * document's own. `dropLast` takes off the empty paragraph Word's `getOoxml`
 * adds after a range's own.
 */
export function withSources(
  pkg: string,
  choose: (old: ChantProfileKey | null, paragraphs: readonly number[]) => ChantProfileKey | null,
  dropLast = false,
): string {
  return pkg.replace(/(<w:document\b[^>]*>)([\s\S]*?<w:body>)([\s\S]*)(<\/w:body>)/, (_all, root: string, head: string, body: string, close: string) => {
    const tail = /(<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>)\s*$/.exec(body);
    let units = unitsOf(tail === null ? body : body.slice(0, tail.index));
    if (dropLast) {
      const last = units[units.length - 1];
      if (last !== undefined && last.source === null && /^<w:p\b/.test(last.xml) && !/<w:t\b/.test(last.xml)) units = units.slice(0, -1);
    }
    let para = 0;
    const placed = units.map((u) => {
      const indexes = Array.from({ length: u.paragraphs }, (_, k) => para + k);
      para += u.paragraphs;
      return { xml: u.xml, source: choose(u.source, indexes) };
    });
    let out = '';
    for (let i = 0; i < placed.length;) {
      const source = placed[i]!.source;
      let j = i;
      let inner = '';
      while (j < placed.length && placed[j]!.source === source) { inner += placed[j]!.xml; j += 1; }
      out += source === null ? inner : wrap(source, inner);
      i = j;
    }
    const withW15 = root.includes('xmlns:w15=') ? root : root.replace(/>$/, ` xmlns:w15="${W15}">`);
    return `${withW15}${head}${out}${tail?.[1] ?? ''}${close}`;
  });
}

/** How many of Word's paragraphs a package's body holds — what a rewrite must keep. */
export const bodyParagraphs = (pkg: string): number => {
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(pkg)?.[1] ?? '';
  return countParas(body);
};
