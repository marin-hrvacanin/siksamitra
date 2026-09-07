/**
 * Reading a document: variants, canonical JSON, normalisation, and slicing.
 *
 * The functions rather than the types. `canonicalJson` is the one the
 * interchange contract is defined in terms of (docs/INTERCHANGE.md §9), and
 * `sliceChantDoc` is what lets a document embed three verses of another
 * without copying them.
 */
import type { ChantToken, ChantWordGram } from './chant-tokens.js';
import type { ChantVerse } from './chant-verse.js';
import type { ChantDoc, ChantItem, ChantSection } from './chant-structure.js';

/* ==========================================================================
   Variable VERSES — the deity, and anything else that re-voices a rite
   ========================================================================== */

/**
 * Why a whole verse and not the substituted word.
 *
 * A holding and an anusvāra/visarga change-mark are decided by the NEIGHBOURING
 * letters, and a saṁyukta run is not broken by a word space — so substituting
 * the deity changes the marks of the FIXED words around it:
 *
 *     devaṁ dhyāyāmi        → devan dhyāyāmi         (ṁ assimilates to n)
 *     mahālakṣmīṁ dhyāyāmi  → mahālakṣmīn dhyāyāmi   (and the holding on dh
 *                                                     becomes LONG, after ī)
 *
 * Splicing a pre-marked fragment into a pre-marked line therefore cannot be
 * right: the join is never derived. The generator instead substitutes into the
 * plain IAST and marks the whole line through the ordinary pipeline, offline.
 *
 * The unit is the verse rather than a one-word window because `words[]` is
 * indexed per verse under the invariant word-count == syl-run-count: splicing a
 * token range at runtime would force that alignment to be recomputed in the
 * browser, which is exactly what "no runtime marking engine" forbids. A verse is
 * also provably self-contained — a daṇḍa ends a cluster run, so no dependency
 * can cross a verse boundary.
 */
export interface ChantVariantOption {
  key: string;
  label: string;
  iast?: string;
  labelForms?: Record<string, string>;
  /** URL of the variant file. */
  file: string;
  /** Every verse this option replaces. A variant that covers only some of them
   *  is invalid WHOLESALE — a half-substituted rite (āvāhana naming Lakṣmī,
   *  udvāsana releasing "deva") is worse than none. */
  verses: string[];
}

export interface ChantVariantIndex {
  format: 'vedaunion.chant.variants';
  version: number;
  doc: string;
  slot: string;
  /** The key that means "the document's own base wording". */
  default: string;
  options: ChantVariantOption[];
}

export interface ChantVariantVerse {
  /** Hash of the BASE verse's token stream this was generated against. A
   *  mismatch means the base was edited without regenerating: render the base
   *  rather than a reading the two files disagree about. */
  baseHash: string;
  tokens: ChantToken[];
  words?: ChantWordGram[];
  translation?: { en: string };
}

export interface ChantVariantFile {
  format: 'vedaunion.chant.variant';
  version: number;
  doc: string;
  slot: string;
  value: string;
  verses: Record<string, ChantVariantVerse>;
}

/** Canonical JSON — keys sorted, no spaces. Must match the generator's
 *  `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
 *  byte for byte, or `baseHash` can never validate. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

/** The highest format version this build renders. */
export const CHANT_FORMAT_VERSION = 3;

/* ==========================================================================
   Normalising a loaded document
   ========================================================================== */

/** Does this step stand on instructions / figures / embeds alone? */
export function isTextlessStep(s: ChantSection): boolean {
  return !s.verses.length && !s.module && !!s.items?.length;
}

/**
 * Bring a loaded document to the v3 in-memory shape, so every consumer sees ONE
 * model: `items` always present and always in step with `verses`, `title`
 * always set. Pure, idempotent, and additive — a v2 document (the other three
 * chants) comes through unchanged in meaning.
 */
export function normalizeChantDoc(doc: ChantDoc): ChantDoc {
  let touched = false;
  const sections = doc.sections.map((s) => {
    const verses = s.verses ?? [];
    const items: ChantItem[] = s.items
      ? s.items
      : verses.map((v) => ({ t: 'verse' as const, ...v }));
    const title = s.title ?? s.label ?? '';
    // `items` is authoritative when authored; keep `verses` derived from it so
    // audio lookup, deep links and the practice cursor need no new code path.
    const fromItems = s.items
      ? s.items.filter((it): it is { t: 'verse' } & ChantVerse => it.t === 'verse')
          .map(({ t: _t, ...v }) => v as ChantVerse)
      : verses;
    if (s.items || !s.title || s.verses !== fromItems) touched = true;
    return { ...s, title, items, verses: fromItems };
  });
  if (!touched) return doc;
  return { ...doc, sections };
}

/**
 * Write a new verse list into a section, keeping `items` in step.
 *
 * THE TRAP THIS EXISTS TO CLOSE. A section stores its verses twice: in
 * `verses`, and — when the section is composed — inside `items`, where they sit
 * interleaved with instructions and figures. `normalizeChantDoc` treats
 * `items` as authoritative and REBUILDS `verses` from it. So a writer that
 * updates only `verses` has its work silently discarded the next time the
 * document is opened.
 *
 * Measured: `sm attach-src` wrote a source layer onto all 573 verses of the
 * corpus and every one was thrown away on load, because ten of the eleven
 * documents are composed. The editor had the same defect, and it would have
 * eaten an author's edits rather than a generator's output.
 *
 * One fact in two places is the underlying problem and the format has it; this
 * is the one function allowed to know that.
 */
export function withVerses(section: ChantSection, verses: ChantVerse[]): ChantSection {
  if (section.items === undefined) return { ...section, verses };

  const byId = new Map(verses.map((v) => [v.id, v]));
  const used = new Set<string>();
  const items: ChantItem[] = [];

  for (const item of section.items) {
    if (item.t !== 'verse') {
      items.push(item);
      continue;
    }
    const next = byId.get(item.id);
    // A verse the edit removed takes its item with it.
    if (next === undefined) continue;
    used.add(next.id);
    items.push({ t: 'verse', ...next });
  }

  /*
   * Verses the items did not account for — a paste added them. They go after
   * the last verse item rather than at the end of the section, so a closing
   * instruction stays closing.
   */
  const added = verses.filter((v) => !used.has(v.id));
  if (added.length > 0) {
    let at = items.length;
    for (const [i, item] of items.entries()) if (item.t === 'verse') at = i + 1;
    items.splice(at, 0, ...added.map((v): ChantItem => ({ t: 'verse', ...v })));
  }

  return { ...section, items, verses };
}

/* ==========================================================================
   `select` grammar for an embed (docs/DOCUMENT-COMPOSITION.md §4.3)

     #<sectionId>                                    one section
     #<sectionId>/<verseId>                          one verse
     #<sec>/<verse>..#<sec>/<verse>                  inclusive verse range
     #<sec>..#<sec>                                  inclusive section range
     (absent)                                        the whole document

   Ids are the TARGET's own — the same ids the deep-link fragment uses. No
   indices: an index breaks the moment the target gains a verse, and this format
   is regenerated often.
   ========================================================================== */

/** Parse a `select` string into a `ChantSelection`. Returns null when the string
 *  is malformed (the caller reports it as an authoring error, cause `anchor`). */
export function parseChantSelect(select: string | undefined | null): ChantSelection | null {
  if (!select || !select.trim()) return {};
  const parts = select.trim().split('..');
  if (parts.length > 2) return null;
  const one = (raw: string): { section: string; verse?: string } | null => {
    const m = /^#([^/\s]+)(?:\/([^/\s]+))?$/.exec(raw.trim());
    if (!m) return null;
    return { section: m[1]!, verse: m[2] };
  };
  const a = one(parts[0]!);
  if (!a) return null;
  if (parts.length === 1) {
    return a.verse ? { sections: [a.section], verses: [a.verse] } : { sections: [a.section] };
  }
  const b = one(parts[1]!);
  if (!b) return null;
  if (!!a.verse !== !!b.verse) return null;
  if (a.verse && b.verse) return { from: a.verse, to: b.verse };
  return { sectionFrom: a.section, sectionTo: b.section };
}

/* ==========================================================================
   Selecting part of a marked document
   ========================================================================== */

/**
 * Which part of a marked document to render. All fields are optional and are
 * applied in this order, so they compose:
 *
 *   sections → exclude → verses → from/to
 *
 * `from`/`to` are VERSE ids and delimit an inclusive range over the document's
 * verses in reading order; either end may be omitted. Empty selection (no
 * fields, or nothing matched) renders the whole document — a slice that
 * silently renders nothing would be worse than one that renders everything.
 */
export interface ChantSelection {
  /** Keep only these section ids (in the document's own order). */
  sections?: string[];
  /** Drop these section ids. */
  exclude?: string[];
  /** Keep only these verse ids. */
  verses?: string[];
  /** Inclusive verse-id range over the flattened verse order. */
  from?: string;
  to?: string;
  /** Inclusive SECTION-id range, in document order. */
  sectionFrom?: string;
  sectionTo?: string;
}

export function isEmptySelection(sel?: ChantSelection | null): boolean {
  if (!sel) return true;
  return (
    !sel.sections?.length && !sel.exclude?.length && !sel.verses?.length &&
    !sel.from && !sel.to && !sel.sectionFrom && !sel.sectionTo
  );
}

/** Apply a selection. Pure; returns the same object when nothing is selected. */
export function sliceChantDoc(doc: ChantDoc, sel?: ChantSelection | null): ChantDoc {
  if (isEmptySelection(sel) || !sel) return doc;

  // A step's `items` array is authoritative, so every verse filter has to cut
  // BOTH lists or the two drift apart (and a dropped verse would still render
  // out of `items`). One helper, used by every branch below.
  const keepVerses = (s: ChantSection, keep: Set<string>): ChantSection => ({
    ...s,
    verses: s.verses.filter((v) => keep.has(v.id)),
    ...(s.items
      ? { items: s.items.filter((it) => it.t !== 'verse' || keep.has(it.id)) }
      : {}),
  });

  let sections = doc.sections;
  if (sel.sections?.length) {
    const keep = new Set(sel.sections);
    sections = sections.filter((s) => keep.has(s.id));
  }
  if (sel.exclude?.length) {
    const drop = new Set(sel.exclude);
    sections = sections.filter((s) => !drop.has(s.id));
  }
  if (sel.sectionFrom || sel.sectionTo) {
    const order = sections.map((s) => s.id);
    const start = sel.sectionFrom ? order.indexOf(sel.sectionFrom) : 0;
    const end = sel.sectionTo ? order.indexOf(sel.sectionTo) : order.length - 1;
    if (start >= 0 && end >= 0 && end >= start) sections = sections.slice(start, end + 1);
  }
  if (sel.verses?.length) {
    const keep = new Set(sel.verses);
    sections = sections.map((s) => keepVerses(s, keep));
  }
  if (sel.from || sel.to) {
    const order = sections.flatMap((s) => s.verses.map((v) => v.id));
    const start = sel.from ? order.indexOf(sel.from) : 0;
    const end = sel.to ? order.indexOf(sel.to) : order.length - 1;
    if (start >= 0 && end >= 0 && end >= start) {
      const keep = new Set(order.slice(start, end + 1));
      sections = sections.map((s) => keepVerses(s, keep));
    }
  }
  // Keep a step that has text left, a composed module, or that never had any
  // mantra to begin with (prāṇāyāma stands on its instructions alone).
  sections = sections.filter((s) => s.verses.length > 0 || !!s.module || isTextlessStep(s));
  // A selection that matched nothing is a bad id, not an instruction to render
  // an empty page: fall back to the whole document rather than a blank card.
  if (!sections.length) return doc;
  return { ...doc, sections };
}

/** Substitute variable slots. Pure. `slots` maps a slot name to its tokens. */
export function fillChantSlots(
  tokens: ChantToken[],
  slots?: Record<string, ChantToken[] | undefined> | null,
): ChantToken[] {
  if (!tokens.some((t) => t.t === 'slot')) return tokens;
  const out: ChantToken[] = [];
  for (const tk of tokens) {
    if (tk.t !== 'slot') { out.push(tk); continue; }
    const replacement = slots?.[tk.name];
    out.push(...(replacement && replacement.length ? replacement : tk.tokens));
  }
  return out;
}
