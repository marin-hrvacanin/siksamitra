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
  /**
   * The letters themselves disagree.
   *
   * `tamilOnly` says the ONLY disagreement is the Tamil column. That is worth
   * separating because Tamil is the one field the contract calls carried
   * rather than verified (INTERCHANGE §9.8): the corpus's forms were never
   * reviewed by the owner, and neither were the transliterator's. Taking one
   * over the other is a decision for a person, and a caller that makes it must
   * be able to count how often it did.
   */
  | { kind: 'text'; why: string; tamilOnly: boolean };

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
 * The structural tokens, with space RUNS collapsed and line edges trimmed.
 *
 * Not a loosening — a measurement. `.pada` is `white-space: normal`, and three
 * adjacent `<span class="sp"> </span>` render at exactly the same width as one
 * (55.8 px, measured in the browser), while a space at the end of a line draws
 * nothing at all. So a run of spaces and a single space are the same document,
 * and the corpus disagrees with itself about which it writes: bhāgya sets
 * `naḥ · sp · ।` and Rudram sets `… · sp · sp · । · sp · sp`, because they were
 * written by different generator versions.
 *
 * What this still catches, and what a version of this function that ignored
 * `sp` altogether did not: ZERO spaces against ONE. `॥3॥` and `॥ 3 ॥` are
 * different documents, and 176 verses were quietly turned into the second by
 * an emitter that added a space after every daṇḍa.
 */
function shape(tokens: readonly ChantToken[]): string {
  const kinds: string[] = [];
  for (const token of tokens) {
    if (token.t === 'syl') continue;
    if (token.t === 'sp' && kinds[kinds.length - 1] === 'sp') continue;
    kinds.push(token.t);
  }
  while (kinds[0] === 'sp') kinds.shift();
  while (kinds[kinds.length - 1] === 'sp') kinds.pop();
  return kinds.join(',');
}

export interface DiffOptions {
  /**
   * Compare Tamil.
   *
   * ON is the only safe setting, and the reason is worth recording. Holding
   * Tamil out meant the caller had to copy the file's Tamil back over the
   * derived tokens, and it did that BY TOKEN INDEX — which drifts the moment
   * the two streams differ in any token, which is exactly when the hold-out
   * matters. Measured: 239 verses had their Tamil column overwritten with a
   * neighbouring syllable's. A field worth not checking is a field worth
   * leaving the verse frozen over.
   */
  tamil: boolean;
}

/** Compare a verse's tokens with a derivation of them. */
export function diffVerse(
  want: readonly ChantToken[],
  got: readonly ChantToken[],
  opts: DiffOptions,
): VerseDiff {
  const fail = (why: string, tamilOnly = false): VerseDiff =>
    ({ kind: 'text', why, tamilOnly });
  /** Set when a Tamil form differs; cleared the moment anything else does. */
  let tamil: string | null = null;
  const a = sylsOf(want);
  const b = sylsOf(got);
  if (a.length !== b.length) {
    return fail(`${a.length} syllables in the file, ${b.length} derived`);
  }
  if (shape(want) !== shape(got)) {
    return fail(`the structure differs: ${shape(want)} in the file, ${shape(got)} derived`);
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
      const why = `syllable ${i + 1} ${field}: "${mine}" in the file, `
        + `"${String(y[field])}" derived`;
      // A Tamil difference is remembered and the walk CONTINUES: only if
      // nothing else differs may the caller treat it as a Tamil-only case.
      if (field === 'tam') { tamil ??= why; continue; }
      return fail(why);
    }
    if (x.units.length !== y.units.length) {
      return fail(`syllable ${i + 1} "${x.iast}": ${x.units.length} letters, `
        + `${y.units.length} derived`);
    }

    for (const [k, u] of x.units.entries()) {
      const v = y.units[k]!;
      if (u.c !== v.c) {
        return fail(
          `syllable ${i + 1} letter ${k + 1}: "${u.c}" in the file, "${v.c}" derived`,
        );
      }
      // The conjunct choice is authored, not a mark: it decides how the Indic
      // scripts SHAPE the letter, so a difference there is textual.
      if (u.cj !== v.cj) {
        return fail(`syllable ${i + 1} letter ${k + 1} "${u.c}": conjunct `
          + `${String(u.cj)} in the file, ${String(v.cj)} derived`);
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

  /*
   * MARKS FIRST. A Tamil difference is only "Tamil only" when nothing else
   * differs — and returning it while mark differences were also found threw
   * those away: 21 attested svaras in one verse of Śiva Saṅkalpa Sūktam went
   * unrecorded, the caller accepted the verse for its Tamil, and the accents
   * vanished from the document.
   *
   * With the marks returned first, the caller records them as overrides and
   * derives again; the second pass then reports the Tamil alone, and only then
   * is it a decision about Tamil.
   */
  if (diffs.length > 0) return { kind: 'marks', diffs };
  if (tamil !== null) return fail(tamil, true);
  return { kind: 'same' };
}
