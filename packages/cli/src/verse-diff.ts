/**
 * Comparing a verse with its own re-derivation, and saying WHAT KIND of
 * difference it is.
 *
 * The distinction this module exists to make, because everything downstream
 * turns on it:
 *
 *   `same`   the derivation reproduces the verse. It can be given a source
 *            layer and edited.
 *   `marks`  the letters, the syllables and the script forms all agree, and
 *            only MARKS differ. Those differences are data — the author's
 *            hand, or a rule this program has not settled — so they can be
 *            recorded as overrides, and then the verse also reproduces.
 *   `text`   the letters themselves disagree. Nothing may be recorded, and the
 *            verse stays frozen: the two sides do not agree about what the
 *            text IS, and a mark cannot paper over that.
 *
 * Two comparisons are deliberately loosened, both measured rather than assumed:
 *
 *   HOLDING-GROUP IDS are labels, not identities. All `hg` has to do is tell
 *   apart two boxes that touch, and the corpus reuses an id in a later
 *   syllable 537 times. Comparing ids literally reported every one of those as
 *   a divergence.
 *
 *   KEY ORDER is not content. `JSON.stringify` keeps insertion order, and the
 *   corpus was written by a different emitter, so `{c, change, candra, sup}`
 *   compared as different from `{c, change, sup, candra}`.
 */
import type { ChantSyllable, ChantToken, ChantUnit } from '@siksamitra/format';

/** The mark fields an override may carry — `hg` excluded, being a label. */
export const MARK_FIELDS = [
  'hold', 'svara', 'change', 'sup', 'candra', 'sbhakti',
] as const;

export type MarkField = (typeof MARK_FIELDS)[number];

/** One letter's marks, as they differ. `null` = the file has no mark here. */
export interface MarkDiff {
  /** Unit index within the verse, in token order — indexes `SrcMap.units`. */
  unit: number;
  /** The letter, as a witness for the override. */
  ch: string;
  set: Partial<Record<MarkField, unknown>>;
}

export type VerseDiff =
  | { kind: 'same' }
  | { kind: 'marks'; diffs: MarkDiff[] }
  | { kind: 'text'; why: string };

const sylsOf = (tokens: readonly ChantToken[]): ChantSyllable[] =>
  tokens.filter((t): t is ChantSyllable => t.t === 'syl');

/** A unit as a string with its keys in a fixed order and `hg` dropped. */
const stable = (u: ChantUnit): string => {
  const entries = Object.entries(u)
    .filter(([k]) => k !== 'hg')
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(Object.fromEntries(entries));
};

/**
 * The structural tokens — spaces excluded.
 *
 * `sp` IS NOT COMPARED, and the reason is that it is not authored. `emit`
 * produces one for every word boundary in the source and its own on each side
 * of a daṇḍa; the older generator that wrote the corpus spaced daṇḍas
 * slightly differently, and comparing spaces froze verses over whitespace that
 * draws nothing. What is compared is the structure a reader can see: line
 * breaks, daṇḍas, pauses, pāda bars, verse numbers, and text.
 *
 * The consequence is stated plainly because it is a real one: where the two
 * disagree about spacing, the DERIVED spacing wins, since it is what this
 * program's one renderer draws everywhere else.
 */
function shape(tokens: readonly ChantToken[]): string {
  return tokens.filter((t) => t.t !== 'syl' && t.t !== 'sp').map((t) => t.t).join(',');
}

export interface DiffOptions {
  /** Compare Tamil. Off means a Tamil-only difference is not a difference —
   *  the corpus's Tamil is unreviewed, so the caller decides. */
  tamil: boolean;
}

/** Compare a verse's tokens with a derivation of them. */
export function diffVerse(
  want: readonly ChantToken[],
  got: readonly ChantToken[],
  opts: DiffOptions,
): VerseDiff {
  const a = sylsOf(want);
  const b = sylsOf(got);
  if (a.length !== b.length) {
    return {
      kind: 'text',
      why: `${a.length} syllables in the file, ${b.length} derived`,
    };
  }
  if (shape(want) !== shape(got)) {
    return {
      kind: 'text',
      why: `the structure differs: ${shape(want)} in the file, ${shape(got)} derived`,
    };
  }

  const scripts = opts.tamil
    ? (['iast', 'deva', 'tel', 'tam'] as const)
    : (['iast', 'deva', 'tel'] as const);

  const diffs: MarkDiff[] = [];
  let unit = 0;

  for (const [i, x] of a.entries()) {
    const y = b[i]!;
    for (const field of scripts) {
      // A column the file does not carry is not a divergence: the older
      // fragment tables shipped without `tel` and `tam`.
      const mine = x[field];
      if (mine === undefined || mine === y[field]) continue;
      return {
        kind: 'text',
        why: `syllable ${i + 1} ${field}: "${mine}" in the file, `
          + `"${String(y[field])}" derived`,
      };
    }
    if (x.units.length !== y.units.length) {
      return {
        kind: 'text',
        why: `syllable ${i + 1} "${x.iast}": ${x.units.length} letters, `
          + `${y.units.length} derived`,
      };
    }

    for (const [k, u] of x.units.entries()) {
      const v = y.units[k]!;
      if (u.c !== v.c) {
        return {
          kind: 'text',
          why: `syllable ${i + 1} letter ${k + 1}: "${u.c}" in the file, "${v.c}" derived`,
        };
      }
      // The conjunct choice is authored, not a mark: it decides how the Indic
      // scripts SHAPE the letter, so a difference there is textual.
      if (u.cj !== v.cj) {
        return {
          kind: 'text',
          why: `syllable ${i + 1} letter ${k + 1} "${u.c}": conjunct `
            + `${String(u.cj)} in the file, ${String(v.cj)} derived`,
        };
      }
      if (stable(u) !== stable(v)) {
        const set: Partial<Record<MarkField, unknown>> = {};
        for (const field of MARK_FIELDS) {
          if (u[field] === v[field]) continue;
          // `null` says "there is no mark here", which is a different
          // instruction from "I have no opinion" — see `clearMarks`.
          set[field] = u[field] ?? null;
        }
        diffs.push({ unit: unit + k, ch: u.c, set });
      }
    }
    unit += x.units.length;
  }

  return diffs.length === 0 ? { kind: 'same' } : { kind: 'marks', diffs };
}
