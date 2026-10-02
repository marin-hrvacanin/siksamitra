/**
 * WHAT KIND OF PAGE A WITNESS IS — said when it is read, so a website is not
 * taken for a source because it has the text on it.
 *
 * His words (2026-10-02): "it's treating the websites themselves as sources,
 * while it should … find the actual source text, always … not all websites
 * provide equally accurate information. It should have some deep
 * understanding on how to do such research, not be naive." The manyu sūktam
 * he was sent had been compared against two pages of machine-written
 * commentary ("Certainly. Let's explore Rig Veda Book 10, Hymn 83…").
 *
 * And the WHOLE EDITION, read for one passage: a saṁhitā is many megabytes, a
 * page the bot once refused, so a passage's first words find it and only the
 * lines around them are kept.
 */
import { findLines } from './tools/sources.js';

export type PageKind = 'edition' | 'collection' | 'compilation' | 'commentary';

/** Scholarly editions: a base text, and their numbering is a locus. */
const EDITIONS = /(?:^|\.)(?:gretil\.sub\.uni-goettingen\.de|titus\.uni-frankfurt\.de|titus\.fkidg1\.uni-frankfurt\.de|vedicheritage\.gov\.in|ambuda\.org)$/iu;
/** Collections of transcriptions, mostly of printed editions — to be checked. */
const COLLECTIONS = /(?:^|\.)(?:sanskritdocuments\.org|vishvasa\.github\.io|wisdomlib\.org|sacred-texts\.com|archive\.org)$/iu;

/** What machine-written commentary says, and an edition never does. */
const MACHINE = [
  /^\s*(?:certainly|absolutely|of course)[!.,]/iu,
  /\blet(?:'|’)s (?:explore|unfold|delve)\b/iu,
  /\blet us (?:explore|unfold|delve)\b/iu,
  /\bin essence[,:]/iu,
  /\bkey (?:deities|concepts|themes|symbols)\b/iu,
  /\bthis (?:verse|hymn|mantra) (?:teaches|reminds|invites|encourages) us\b/iu,
  /\bdeeper (?:philosophical|spiritual)\b/iu,
  /\bunfold(?:s|ing)? the wisdom\b/iu,
  /\bfor today(?:'|’)s\b/iu,
  /\bhonou?ring its sacredness\b/iu,
];

export function kindOfPage(url: string, lines: readonly string[]): PageKind {
  const said = new Set<number>();
  for (const line of lines) MACHINE.forEach((re, i) => { if (re.test(line)) said.add(i); });
  if (said.size >= 2) return 'commentary';
  let host = '';
  try { host = new URL(url).hostname; } catch { /* a page the host could fetch has a URL */ }
  if (EDITIONS.test(host)) return 'edition';
  if (COLLECTIONS.test(host)) return 'collection';
  return 'compilation';
}

/** What the agent is told each kind of page is good for. */
export const KIND_SAID: Readonly<Record<PageKind, string>> = {
  edition: 'a scholarly edition: a base text, and its numbering is the locus to cite',
  collection: 'a collection of transcriptions, mostly of printed editions: check its accents against an edition before building from it',
  compilation: 'a devotional compilation: it shows a text\'s extent and how it is recited — never its letters, its accents or its locus',
  commentary: 'MACHINE-WRITTEN COMMENTARY: no source of the text at all — do not build from it, compare with it or cite it',
};

/** The lines around a passage of a whole edition: where its first words are, and on either side. */
export function passageOf(lines: readonly string[], find: string, radius = 300):
  { readonly lines: readonly string[]; readonly from: number; readonly total: number } | null {
  const at = findLines({ id: 'edition', origin: '', title: '', lines }, find, 1)[0];
  if (at === undefined) return null;
  const from = Math.max(1, at - 20);
  const to = Math.min(lines.length, at + radius);
  return { lines: lines.slice(from - 1, to), from, total: lines.length };
}
