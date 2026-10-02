/**
 * WHAT A PARAGRAPH OF HIS IS — the small questions `buildDocument` asks of
 * every one: how many lines it holds, whether it ends a verse, what kind of
 * prose it is — and the last step of the build, which writes each verse's
 * translation onto it. Out of `build-document.ts` when that file passed the
 * 400-line limit.
 */
import type { ChantItem, ChantSection, ChantVerse } from '@siksamitra/format';
import { paraRoleOf, roleOf } from './word-styles.js';
import type { WordParagraph } from './docx-read.js';

/** One thing a section holds, in the order it was read. */
export type Entry = { verse: ChantVerse } | { item: ChantItem };

/** A locus line — "taittirīya saṁhitā 1.5.3", "Ṛgveda 10.90", "TA 3.12". */
const RE_LOCUS = /^[\p{L}\s.'’-]+\s\d+(?:[.,]\d+)*\.?$/u;
/** Prose that tells you to do something. */
const RE_IMPERATIVE = /^(take|offer|ring|sip|place|touch|pour|show|wave|bow|sprinkle|light|put|say|recite|do|repeat|hold)\b/i;

export function classifyProse(text: string): 'source' | 'option' | 'do' | 'note' {
  const t = text.trim();
  if (/^optional(ly)?$/i.test(t)) return 'option';
  if (RE_LOCUS.test(t) && t.length < 90) return 'source';
  if (RE_IMPERATIVE.test(t)) return 'do';
  return 'note';
}

/**
 * A line that ENDS a verse: a DOUBLE daṇḍa, numbered or not (`॥`, `॥ 1॥`), or
 * any daṇḍa with the verse's number after it — in the Devanāgarī daṇḍas a
 * PDF's text layer has or the ASCII bars his Word files type — and its number
 * in any script's digits, `॥ १४ ॥` as `॥ 14 ॥`. A SINGLE daṇḍa
 * with no number is the half-verse: it used to close the verse there, so
 * kanakadhārā's 21 ślokas read as 41 and agnimīḻe's 9 as 19.
 *
 * A NOTE written after the number (`॥ 4॥ p.b. sūryād (with svarita)`) is not
 * part of what is tested: the line still ends the verse.
 */
export const VERSE_END = /(?:॥|\|\|)\s*\p{Nd}*\s*(?:॥|\|\|)?\s*$|(?:[।॥]|\|{1,2})\s*\p{Nd}+\s*(?:[।॥]|\|{1,2})?\s*$/u;

/** How many lines a paragraph holds: its soft breaks, and one. */
export const linesIn = (p: WordParagraph): number =>
  p.runs.map((r) => r.text).join('').replace(/\n+$/, '').split('\n').length;

/** The mantra text of a line, without the notes he wrote on it. */
export const mantraOf = (p: WordParagraph): string =>
  p.runs.filter((r) => roleOf(r.rStyle) !== 'comment').map((r) => r.text).join('').trim();

/**
 * THE TRANSLATIONS, written onto their verses. One that is nothing but empty
 * lines was not a translation: it was space under the verse, and it goes in
 * as that, right after it.
 */
export function writeTranslations(
  translations: ReadonlyMap<ChantVerse, { lines: string[]; paras: number[] }>,
  order: ReadonlyMap<string, Entry[]>,
): void {
  for (const [v, t] of translations) {
    if (t.lines.every((l) => l === '')) {
      for (const list of order.values()) {
        const at = list.findIndex((e) => 'verse' in e && e.verse === v);
        if (at >= 0) list.splice(at + 1, 0, ...t.lines.map(() => ({ item: { t: 'gap' as const, of: 'translation' as const } })));
      }
      continue;
    }
    v.translation = { en: t.lines.join('\n'), ...(t.paras.length > 1 ? { paragraphs: t.paras } : {}) };
  }
}

/**
 * The sections with their contents in the order they were read. Last, so a
 * verse goes in carrying whatever it gained after it was recorded. A section
 * with nothing but verses is left with no `items` at all, which is the shape
 * `itemsOf` reads as "the verses, in order".
 */
export function materialise(sections: readonly ChantSection[], order: ReadonlyMap<string, Entry[]>): ChantSection[] {
  return sections.map((s) => {
    const list = order.get(s.id) ?? [];
    if (!list.some((e) => 'item' in e)) return s;
    return { ...s, items: list.map((e) => ('item' in e ? e.item : { t: 'verse' as const, ...e.verse })) };
  });
}

/**
 * A LINE OF HIS COMMENT FACE, written on a mantra line — a paragraph holding
 * only `Comment` runs: a source, a metre, a note. Not a mantra line, though
 * its style is one, and never offered to be marked.
 */
export const isCommentLine = (p: WordParagraph): boolean =>
  p.runs.some((r) => r.text.trim() !== '') && p.runs.every((r) => r.text.trim() === '' || roleOf(r.rStyle) === 'comment');

/** A line of a mantra: a mantra-line paragraph that is not his comment line. */
export const isMantraLine = (p: WordParagraph): boolean =>
  paraRoleOf(p.pStyle) === 'verse-line' && p.pStyle !== 'Source' && !isCommentLine(p);
