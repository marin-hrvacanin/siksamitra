/**
 * Giving a shipped document its source layer back.
 *
 * THE PROBLEM. Every one of the eleven inherited documents is marked tokens
 * with no record of the letters they were derived from — the offline generator
 * kept only its output. By the format's own rule that makes all 573 verses
 * TRANSCRIBED, and the editor is right to refuse to touch them: it re-derives,
 * and there is nothing to re-derive from. Measured: 0 of 573 verses carried a
 * source layer, so the editor could not edit a single verse of the corpus.
 *
 * WHAT THIS DOES, per verse:
 *
 *   1. reconstruct the source (`invertVerse`) and derive from it;
 *   2. if that reproduces the verse, attach the source layer;
 *   3. if only MARKS differ, record those differences as overrides, derive
 *      again, and attach only if it now reproduces the verse EXACTLY;
 *   4. otherwise leave the verse frozen, and say why.
 *
 * Step 3 is the interesting one, and it is not a fudge: the corpus and this
 * engine genuinely disagree about a handful of marks — the word-initial
 * holding box is an open question the owner has not settled (00 §5.6) — and an
 * override is precisely how the format records a mark the rules would not
 * place. The verse becomes editable, the mark is kept as data with a reason,
 * and rule zero protects it from the next rule change.
 *
 * WHAT IT PROVES, PRECISELY. That the pipeline and the inverter are mutual
 * inverses on this verse: re-deriving reproduces it. That is what makes the
 * verse editable and what makes "1:1 in infinite round trips" true of it. It
 * does NOT verify the marks against a printed edition — the witness was
 * reconstructed from the marks themselves, so it cannot. That check needs the
 * edition and a reader, and its outcome belongs in `src.departures`.
 */
import { PROFILES, derive, invertVerse, resolveProfile } from '@siksamitra/engine';
import type { Profile, ProfileKey } from '@siksamitra/engine';
import { withVerses } from '@siksamitra/format';
import type {
  ChantDoc, ChantOverride, ChantProfileRef, ChantVerse,
} from '@siksamitra/format';
import { diffVerse } from './verse-diff.js';

/**
 * The parametrizations worth trying, when a document does not declare one.
 *
 * Not a search space — a list of the DECISIONS a marked text actually makes,
 * each of which the owner has taken differently in different documents: does a
 * bīja take a pause, does a vowel hiatus, does a word-initial consonant take a
 * box. A document that needs one of these is not an exception; it is a
 * document whose profile was never written down, and attaching a source layer
 * is the moment to write it down.
 */
export const CANDIDATE_PATCHES: readonly { label: string; patch: Record<string, unknown> }[] = [
  { label: '', patch: {} },
  { label: ' −bīja-pause', patch: { pauses: { bija: false, hiatus: true } } },
  { label: ' −hiatus-pause', patch: { pauses: { bija: true, hiatus: false } } },
  { label: ' −both-pauses', patch: { pauses: { bija: false, hiatus: false } } },
  { label: ' +initial-box', patch: { holdings: { noInitialBox: false } } },
  { label: ' −bīja-pause +initial-box',
    patch: { pauses: { bija: false, hiatus: true }, holdings: { noInitialBox: false } } },
];

export interface AttachReport {
  /** Verses that now carry a source layer. */
  attached: number;
  /** Of those, how many needed an override to reproduce exactly. */
  withOverrides: number;
  /** How many overrides were written in total. */
  overrides: number;
  /** Of the attached, how many carry an accented witness. */
  withWitness: number;
  /** Verses that already had a source layer and were left alone. */
  already: number;
  /** Verses left frozen, and the first reason each was. */
  refused: { verseId: string; why: string }[];
  /**
   * Verses attached only because the caller accepted the engine's Tamil over
   * the file's, and how many syllables that changed. Counted, never silent.
   */
  tamilReplaced: { verses: number; syllables: number };
}

export interface AttachOptions {
  /**
   * Compare the Tamil column. ON by default, and there is no safe way to turn
   * it off — see `DiffOptions.tamil`. A verse whose Tamil the engine would
   * rewrite stays frozen, which costs some verses their source layer and
   * costs no document its text.
   */
  tamil?: boolean;
  /**
   * Try the candidate parametrizations and keep the one that regenerates most
   * of the document, writing it into `doc.profile`.
   *
   * On by default, because the alternative is worse than it sounds: scored
   * under one profile for all eleven documents the corpus reproduces 96.79%,
   * and the shortfall is not noise — it is documents whose own decisions were
   * never written down anywhere.
   */
  fit?: boolean;
  /** Record mark differences as overrides (step 3). On by default. */
  overrides?: boolean;
  /**
   * Accept the engine's Tamil where it is the ONLY difference.
   *
   * OFF by default, and it is a real decision rather than a convenience.
   * Tamil is the one column the contract calls carried rather than verified:
   * neither the corpus's forms nor the transliterator's were ever reviewed by
   * the owner. With this off, a verse whose Tamil the engine would rewrite
   * stays frozen and keeps the forms the file has. With it on, the engine's
   * forms replace them and the count is reported — which is the price of
   * making the verse editable at all.
   */
  rewriteTamil?: boolean;
}

const empty = (): AttachReport => ({
  attached: 0, withOverrides: 0, overrides: 0, withWitness: 0, already: 0,
  refused: [], tamilReplaced: { verses: 0, syllables: 0 },
});

/** How many syllables' Tamil the derivation would change. */
function countTamil(
  want: readonly import('@siksamitra/format').ChantToken[],
  got: readonly import('@siksamitra/format').ChantToken[],
): number {
  const a = want.filter((t) => t.t === 'syl');
  const b = got.filter((t) => t.t === 'syl');
  let n = 0;
  a.forEach((x, i) => {
    const y = b[i];
    if (x.t !== 'syl' || y === undefined || y.t !== 'syl') return;
    if (x.tam !== undefined && x.tam !== y.tam) n += 1;
  });
  return n;
}

/** One pass with one profile. Pure: it neither searches nor prints. */
function attachWith(
  doc: ChantDoc,
  profile: Profile,
  opts: Required<Pick<AttachOptions, 'tamil' | 'overrides' | 'rewriteTamil'>>,
): { doc: ChantDoc; report: AttachReport } {
  const report = empty();
  const collected: ChantOverride[] = [...(doc.overrides ?? [])];

  const sections = doc.sections.map((section) => {
    const verses = section.verses.map((verse): ChantVerse => {
      if (verse.src !== undefined) {
        report.already += 1;
        return verse;
      }
      const source = invertVerse(verse.tokens);
      if (source.lines.length === 0) {
        report.refused.push({ verseId: verse.id, why: 'no letters to invert' });
        return verse;
      }

      /*
       * An accented witness only where there are accents. Giving a prose text
       * one would claim a source that does not exist, and would put the verse
       * into the attested register, where a positional preset may never be
       * applied to it.
       */
      const withWitness = source.accents > 0;
      const src = withWitness
        ? { lines: source.lines, accented: source.accented }
        : { lines: source.lines };

      const run = (overrides: readonly ChantOverride[]) => derive(src, profile, {
        verseId: verse.id,
        verseN: verse.n ?? null,
        trace: false,
        overrides,
      });

      const first = run(collected);
      let diff = diffVerse(verse.tokens, first.tokens, { tamil: opts.tamil });
      let tokens = first.tokens;
      const added: ChantOverride[] = [];

      if (diff.kind === 'marks' && opts.overrides) {
        for (const d of diff.diffs) {
          const span = first.srcMap.units[d.unit];
          if (span === undefined) continue;
          added.push({
            at: { verse: verse.id, line: span.line, letter: span.start },
            set: d.set,
            // Not `owner-hand`: nobody placed these by hand today. They are
            // what the document already said, kept because the engine does not
            // reproduce it — either an unsettled rule or a defect — and
            // `source-witness` is the honest label for "the file says so".
            why: 'source-witness',
            /*
             * THE WITNESS COMES FROM THE SOURCE, not from the token.
             *
             * `MarkDiff.ch` is the RECITED letter, and the rebase checks the
             * SOURCE at that offset — and for a letter produced by anusvāra or
             * visarga sandhi those are different letters. An override recorded
             * `ś` at an offset holding `ḥ`, and the rebase then correctly
             * refused to move a mark it could not verify. Reading it from the
             * same string the offset indexes makes the two agree by
             * construction.
             */
            ch: first.srcMap.lines[span.line]?.slice(span.start, span.end) ?? '',
            note: 'recorded by attach-src: the shipped document carries this mark '
              + 'and the rules do not place it',
          });
        }
        const second = run([...collected, ...added]);
        diff = diffVerse(verse.tokens, second.tokens, { tamil: opts.tamil });
        tokens = second.tokens;
      }

      /*
       * A Tamil-only difference, when the caller has accepted it: the verse is
       * attached and the syllables the engine rewrote are counted. Everything
       * else is still refused.
       */
      let tamilOnly = 0;
      if (diff.kind === 'text' && diff.tamilOnly && opts.rewriteTamil) {
        tamilOnly = countTamil(verse.tokens, tokens);
        report.tamilReplaced.verses += 1;
        report.tamilReplaced.syllables += tamilOnly;
        diff = { kind: 'same' };
      }

      if (diff.kind !== 'same') {
        report.refused.push({
          verseId: verse.id,
          why: diff.kind === 'text' ? diff.why : `${diff.diffs.length} marks still differ`,
        });
        return verse;
      }

      collected.push(...added);
      report.attached += 1;
      report.overrides += added.length;
      if (added.length > 0) report.withOverrides += 1;
      if (withWitness) report.withWitness += 1;

      /*
       * The DERIVED tokens, whole. There was a merge here that kept the file's
       * unreviewed Tamil by copying it back by token index — and the index
       * drifted, so 239 verses ended up with a neighbouring syllable's Tamil.
       * Either a verse reproduces in every field or it stays frozen; there is
       * no third option that does not risk this.
       */
      return {
        ...verse,
        tokens,
        src,
        ...(withWitness ? { svaraRegister: 'attested' as const } : {}),
      };
    });
    // `withVerses`, not a spread: a composed section stores its verses inside
    // `items` as well, and `normalizeChantDoc` rebuilds `verses` from those —
    // so writing only `verses` throws the work away on the next load.
    return withVerses(section, verses);
  });

  const next: ChantDoc = { ...doc, sections };
  if (collected.length > 0) next.overrides = collected;
  return { doc: next, report };
}

/**
 * Attach a source layer to every verse a derivation reproduces, choosing the
 * parametrization that regenerates most of the document.
 */
export function attachSource(
  doc: ChantDoc,
  base: Profile,
  options: AttachOptions = {},
): { doc: ChantDoc; report: AttachReport; profile: ChantProfileRef | null } {
  const opts = {
    tamil: options.tamil !== false,
    overrides: options.overrides !== false,
    rewriteTamil: options.rewriteTamil === true,
  };
  if (options.fit === false) {
    return { ...attachWith(doc, base, opts), profile: null };
  }

  let best: {
    doc: ChantDoc; report: AttachReport; profile: ChantProfileRef | null;
  } | null = null;

  for (const preset of Object.keys(PROFILES) as ProfileKey[]) {
    for (const candidate of CANDIDATE_PATCHES) {
      const ref: ChantProfileRef = { preset, patch: candidate.patch as never };
      const result = attachWith(doc, resolveProfile([ref]), opts);
      /*
       * More verses regenerated wins. A tie goes to FEWER OVERRIDES — a
       * profile that explains the document is better than one that records the
       * same facts letter by letter — and then to the simpler patch, so a
       * document is not left declaring a decision it never made.
       */
      const better = best === null
        || result.report.attached > best.report.attached
        || (result.report.attached === best.report.attached
          && result.report.overrides < best.report.overrides)
        || (result.report.attached === best.report.attached
          && result.report.overrides === best.report.overrides
          && JSON.stringify(candidate.patch).length
            < JSON.stringify(best.profile?.patch ?? {}).length);
      if (better) best = { ...result, profile: ref };
    }
  }

  if (best === null) return { ...attachWith(doc, base, opts), profile: null };

  // The winning parametrization is RECORDED on the document. Without it the
  // source layer regenerates the verse only for whoever happens to pass the
  // same profile, which is not a property of the file.
  const withProfile: ChantDoc = best.report.attached > 0 && best.profile !== null
    ? { ...best.doc, profile: best.profile }
    : best.doc;
  return { doc: withProfile, report: best.report, profile: best.profile };
}
