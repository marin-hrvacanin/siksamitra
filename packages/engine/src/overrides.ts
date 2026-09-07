/**
 * Overrides — the author's hand, applied after every rule has had its say.
 *
 * RULE ZERO, IN CODE. `ChantOverride` has been in the format since v4 and was
 * applied by nothing: the format declared that a hand-placed mark survives
 * re-derivation, and the pipeline quietly recomputed over it. A guarantee no
 * code enforces is a comment.
 *
 * An override is addressed in SOURCE coordinates — line, and the character
 * offset of the letter within the normalised line — so it survives a rule
 * change, which is the whole point. It does NOT survive an arbitrary edit to
 * the text before it, and cannot: the letter it named may be gone. That is what
 * `rebase` in `@siksamitra/edit` is for, and why an override records `why` — a
 * rebase that cannot place `owner-hand` must report it rather than drop it.
 *
 * Applied AFTER svara, because svara is the last rule stage and an override has
 * to be able to overrule it: a transcribed anudātta the engine's positional
 * plan disagrees with is evidence, not a defect.
 */
import type { ChantOverride, ChantSvara } from '@siksamitra/format';
import type { Elem } from './lex.js';
import type { RuleCtx } from './rules/types.js';

/** The mark fields an override may set. `dirgha` is an elem flag, not a mark. */
const FIELDS = [
  'hold', 'hg', 'svara', 'change', 'sup', 'candra', 'sbhakti', 'dirgha',
] as const;

export type OverrideField = (typeof FIELDS)[number];

export interface OverrideResult {
  /** How many overrides found their letter and were applied. */
  applied: number;
  /** Overrides that matched no letter, with the reason. */
  unplaced: { override: ChantOverride; why: string }[];
}

/** Is this a field an override may set? Guards data read off the wire. */
export const isOverrideField = (k: string): k is OverrideField =>
  (FIELDS as readonly string[]).includes(k);

/**
 * Find the letter an override addresses.
 *
 * `at.letter` is the character offset of the letter's START in the normalised
 * line — `elem.src.start`. Not an ordinal: a digraph (`ai`, `kh`) is one
 * element spanning two characters, and the gum run is one element spanning
 * several, so counting elements and counting characters give different answers
 * and only one of them is recoverable from the stored source text.
 *
 * An offset that lands INSIDE a letter's span still matches it. An importer
 * reading a hand-marked Word file knows which glyph carried the box, not which
 * of the two characters IAST spells it with.
 */
function letterAt(elems: readonly Elem[], line: number, letter: number): Elem | undefined {
  for (const e of elems) {
    if (e.kind !== 'letter') continue;
    if (e.src.line !== line) continue;
    if (letter >= e.src.start && letter < e.src.end) return e;
  }
  // An offset exactly at the end of the last letter of a line is the common
  // off-by-one from a half-open span written down as inclusive; accept it
  // rather than silently discarding the author's mark.
  for (const e of elems) {
    if (e.kind === 'letter' && e.src.line === line && letter === e.src.end) return e;
  }
  return undefined;
}

const SVARAS: ReadonlySet<string> = new Set<ChantSvara>([
  'anudatta', 'svarita', 'dirgha-svarita',
]);

/**
 * Coerce one override value onto one elem field.
 *
 * `null` means SUPPRESS — remove the mark the engine placed. That is a distinct
 * instruction from "set it to something", and the format says so, so a reader
 * that treats `null` as falsy-and-therefore-skip gets it exactly backwards.
 *
 * Anything unrecognised is refused rather than cast. An override is authored
 * data that may have come from an importer, and writing `hold: 'medium'` into
 * a token would produce a document no renderer can draw.
 */
function set(elem: Elem, field: OverrideField, value: unknown): string | null {
  if (value === null) {
    delete elem[field];
    return null;
  }
  switch (field) {
    case 'hold':
      if (value !== 'short' && value !== 'long') return `hold must be short|long`;
      elem.hold = value;
      return null;
    case 'hg':
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'hg must be an integer';
      elem.hg = value;
      return null;
    case 'svara':
      if (typeof value !== 'string' || !SVARAS.has(value)) return 'unknown svara';
      elem.svara = value as ChantSvara;
      return null;
    case 'sup':
      if (typeof value !== 'string') return 'sup must be a string';
      elem.sup = value;
      return null;
    case 'change':
    case 'candra':
    case 'sbhakti':
    case 'dirgha':
      if (typeof value !== 'boolean') return `${field} must be a boolean`;
      elem[field] = value;
      return null;
  }
}

/**
 * Apply this verse's overrides to the lexed elements.
 *
 * Only the ones addressed to `verseId`: a document's overrides are stored in
 * one flat array at document level (format v4 §2.4) precisely so that a verse
 * can be re-derived alone while the author's corrections stay where they were
 * written down.
 */
export function applyOverrides(
  elems: Elem[],
  overrides: readonly ChantOverride[],
  verseId: string,
  ctx?: Pick<RuleCtx, 'trace' | 'warn'>,
): OverrideResult {
  const result: OverrideResult = { applied: 0, unplaced: [] };

  for (const ov of overrides) {
    if (ov.at.verse !== verseId) continue;
    const elem = letterAt(elems, ov.at.line, ov.at.letter);
    if (elem === undefined) {
      result.unplaced.push({ override: ov, why: 'no letter at that offset' });
      ctx?.warn(
        'override.unplaced',
        `an ${ov.why} override at line ${ov.at.line}, letter ${ov.at.letter} `
        + 'addresses no letter — the text moved under it',
      );
      continue;
    }

    const problems: string[] = [];
    for (const [key, value] of Object.entries(ov.set)) {
      if (!isOverrideField(key)) {
        problems.push(`${key} is not an overridable field`);
        continue;
      }
      const problem = set(elem, key, value);
      if (problem !== null) problems.push(`${key}: ${problem}`);
    }

    if (problems.length > 0) {
      result.unplaced.push({ override: ov, why: problems.join('; ') });
      ctx?.warn('override.invalid', `override on "${elem.ch}": ${problems.join('; ')}`);
      continue;
    }

    result.applied += 1;
    const index = elems.indexOf(elem);
    if (index !== -1) {
      ctx?.trace(
        index,
        `${ov.why}: ${Object.keys(ov.set).join(', ')}${ov.note === undefined ? '' : ` — ${ov.note}`}`,
        'override',
      );
    }
  }

  /*
   * A holding needs a group id.
   *
   * An override sets `hold` and deliberately not `hg` — the group id is a
   * LABEL whose only job is to tell apart two boxes that touch, and asking the
   * author to choose one would be asking about an implementation detail. But a
   * letter with `hold` and no `hg` is a shape the eleven shipped documents
   * never contain, and it made the holding normaliser rewrite a verse it had
   * no business rewriting. So the label is assigned here, once, past every id
   * already in use, and joined to the run it belongs to.
   */
  let next = 1;
  for (const e of elems) if (e.hg !== undefined && e.hg >= next) next = e.hg + 1;
  elems.forEach((e, i) => {
    if (e.kind !== 'letter' || e.hold === undefined || e.hg !== undefined) return;
    const prev = elems[i - 1];
    // Adjacent letters of the same length are ONE box, so the id is shared
    // rather than minted — the "adjacent same-type merged" invariant, upheld
    // where the mark is placed rather than repaired afterwards.
    if (prev !== undefined && prev.kind === 'letter' && prev.hold === e.hold && prev.hg !== undefined) {
      e.hg = prev.hg;
      return;
    }
    e.hg = next;
    next += 1;
  });

  return result;
}
