/**
 * Word surfaces and their analyses — the one definition, shared by the reader,
 * the editor, the validator and the CLI.
 *
 * A SURFACE is a maximal run of `syl` tokens; a `slot` counts as exactly one
 * surface however many syllables fill it. `words[]` has one entry per surface
 * and the counts must be equal, because `words[]` is indexed POSITIONALLY: a
 * drift of one makes every popover after it describe the wrong word. That
 * invariant is what this file exists to keep, so nothing computes it twice.
 *
 * Three cases occur in the corpus and all three are real:
 *
 *   1. one surface, one entry — the majority.
 *   2. one surface, MANY entries — sandhi fused two words into one written
 *      surface (`svastira-stu` is `svasti` + `astu`). 54 in Puruṣa Sūktam,
 *      75 in Gaṇapati Atharvaśīrṣa, 129 in Pūjā Vidhi.
 *   3. MANY surfaces, ONE analysis — one word written with a space, or split by
 *      the gum (`tuṣṭuvāṁsas`). Stored on the wire by DUPLICATING the identical
 *      entries onto each member, which is what the shipped files contain.
 *
 * Case 3 is `join: 'prev'` while editing and duplicated bytes on the wire, so
 * a document can be opened and re-saved without changing.
 *
 * See specs/chant-editor/04-EDITOR.md §4A.
 */
import type { ChantGram, ChantToken, ChantVerse, ChantWordGram } from '@siksamitra/format';

/** One surface: where it is, and what it reads. */
export interface Surface {
  /** Its index in `words[]`. */
  index: number;
  /** The IAST of its syllables, joined. A `slot`'s own tokens, for a slot. */
  iast: string;
  /** The token range it covers, `[from, to)`. */
  from: number;
  to: number;
  /** True for a variable slot — it can never be joined to a neighbour. */
  slot: boolean;
}

/**
 * The surfaces of a verse, in order.
 *
 * The chunking rule is the reader's `chunkVerse`, stated once: a run of `syl`
 * ends at any non-`syl` token, and a `slot` is one surface on its own.
 */
export function surfacesOf(tokens: readonly ChantToken[]): Surface[] {
  const out: Surface[] = [];
  let run: string[] = [];
  let from = -1;
  const flush = (to: number): void => {
    if (run.length === 0) return;
    out.push({ index: out.length, iast: run.join(''), from, to, slot: false });
    run = [];
    from = -1;
  };
  tokens.forEach((t, i) => {
    if (t.t === 'syl') {
      if (from < 0) from = i;
      run.push(t.iast);
      return;
    }
    flush(i);
    if (t.t === 'slot') {
      const inner = t.tokens
        .filter((x): x is Extract<ChantToken, { t: 'syl' }> => x.t === 'syl')
        .map((x) => x.iast)
        .join('');
      out.push({ index: out.length, iast: inner, from: i, to: i + 1, slot: true });
    }
  });
  flush(tokens.length);
  return out;
}

/** Does `words[]` line up with the surfaces? Invariant V05. */
export function wordsAlign(verse: Pick<ChantVerse, 'tokens' | 'words'>): {
  ok: boolean; surfaces: number; words: number;
} {
  const surfaces = surfacesOf(verse.tokens).length;
  const words = verse.words?.length ?? 0;
  return { ok: verse.words === undefined || words === surfaces, surfaces, words };
}

/** Two analyses are the same analysis. Field order must not matter. */
function sameEntries(a: readonly ChantGram[], b: readonly ChantGram[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const key = (g: ChantGram): string => JSON.stringify(
    Object.fromEntries(Object.entries(g).sort(([x], [y]) => x.localeCompare(y))),
  );
  return a.every((g, i) => key(g) === key(b[i]!));
}

/**
 * Mark the continuation surfaces of a shared analysis — the editing view.
 *
 * Adjacent surfaces carrying an identical, non-empty `entries` array are one
 * word written in two pieces. Recovering that on read is what lets the editor
 * treat them as one target while the wire format keeps the duplication.
 *
 * A slot is never a continuation and never has one: its content is substituted
 * at render time, so a word cannot span into or out of it.
 */
export function detectJoins(
  words: readonly ChantWordGram[],
  surfaces: readonly Surface[],
): ChantWordGram[] {
  return words.map((w, i) => {
    const prev = words[i - 1];
    const joinable =
      prev !== undefined
      && surfaces[i]?.slot !== true
      && surfaces[i - 1]?.slot !== true
      && sameEntries(w.entries, prev.entries);
    const { join: _drop, ...rest } = w as ChantWordGram & { join?: 'prev' };
    return joinable ? { ...rest, join: 'prev' as const } : rest;
  });
}

/**
 * The inverse — what goes on the wire.
 *
 * Every member of a joined run carries the group's entries, so the output is
 * byte-compatible with the eleven shipped files and a re-save changes nothing.
 * `join` itself is dropped: it is derived, and storing it would make the same
 * fact true in two places.
 */
export function expandJoins(words: readonly ChantWordGram[]): ChantWordGram[] {
  const out: ChantWordGram[] = [];
  let lead: readonly ChantGram[] | null = null;
  for (const w of words) {
    const { join, ...rest } = w as ChantWordGram & { join?: 'prev' };
    // Bound to a const before the callback: narrowing `lead` and then reading
    // it inside a closure is not something TypeScript keeps, and it errored
    // under a partial build while passing under a full one.
    const from = lead;
    if (join === 'prev' && from !== null) {
      out.push({ ...rest, entries: from.map((g) => ({ ...g })) });
      continue;
    }
    lead = w.entries;
    out.push(rest);
  }
  return out;
}

/** The run of surfaces one analysis covers, given any member's index. */
export function joinRun(words: readonly ChantWordGram[], at: number): number[] {
  const has = (i: number): boolean =>
    (words[i] as (ChantWordGram & { join?: 'prev' }) | undefined)?.join === 'prev';
  let start = at;
  while (start > 0 && has(start)) start -= 1;
  let end = start;
  while (end + 1 < words.length && has(end + 1)) end += 1;
  return Array.from({ length: end - start + 1 }, (_, k) => start + k);
}

/** Which fields a grammar type actually has — the form is driven from here, so
 *  an author cannot enter a nonsensical parse (04 §4A.5). */
export const GRAM_FIELDS: Readonly<Record<ChantGram['type'], readonly (keyof ChantGram)[]>> = {
  subanta: ['lemma', 'gender', 'vibhakti', 'vacana', 'stem', 'meaning', 'note'],
  // A pronoun declines like a noun; it is its own class because its paradigm
  // is irregular, not because it takes different fields.
  'sarvanāma': ['lemma', 'gender', 'vibhakti', 'vacana', 'stem', 'meaning', 'note'],
  tinanta: ['root', 'gana', 'lakara', 'purusha', 'vacana', 'meaning', 'note'],
  avyaya: ['lemma', 'meaning', 'note'],
  upasarga: ['lemma', 'meaning', 'note'],
  other: ['lemma', 'meaning', 'note'],
};

/** A fresh entry of a given type, with only the keys that type uses. */
export function blankEntry(type: ChantGram['type']): ChantGram {
  return type === 'tinanta'
    ? { type, root: '', lemma: '', meaning: '' }
    : { type, lemma: '', meaning: '' };
}

/**
 * Drop the keys a type does not use, and the empty ones.
 *
 * Changing `subanta` to `tinanta` in the form must not leave a `vibhakti`
 * behind: the reader renders whatever is present, so a stale key shows as a
 * wrong parse rather than as no parse.
 */
export function pruneEntry(g: ChantGram): ChantGram {
  // An unknown type keeps everything: a document written by a later build
  // must not have its analysis stripped by an older one.
  const fields = GRAM_FIELDS[g.type] as readonly string[] | undefined;
  if (fields === undefined) return g;
  const keep = new Set<string>([...fields, 'type', 'forms']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) {
    if (!keep.has(k)) continue;
    if (v === '' || v === undefined || v === null) continue;
    out[k] = v;
  }
  out.type = g.type;
  return out as unknown as ChantGram;
}

/** The headword a dictionary link and the derived `forms` use: the root for a
 *  finite verb, the lemma otherwise. */
export function headword(g: ChantGram): string {
  return (g.type === 'tinanta' ? g.root : g.lemma) ?? g.lemma ?? '';
}

/** Monier-Williams at ambuda.org, keyed on the IAST headword whatever script
 *  the reader is showing. Verified: this is the dictionary the owner uses. */
export function dictionaryUrl(g: ChantGram): string | null {
  const w = headword(g).trim();
  if (w === '') return null;
  return `https://ambuda.org/tools/dictionaries/mw/${encodeURIComponent(w)}`;
}
