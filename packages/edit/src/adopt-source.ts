/**
 * GIVING A TRANSCRIBED VERSE A SOURCE LAYER, WITHOUT LOSING THE TRANSCRIPTION.
 *
 * Rule zero says a verse with no `src` has marks that are evidence: someone
 * wrote them by hand in Word, the engine cannot rebuild them, and re-deriving
 * would replace a record with a guess. That rule was enforced by refusing —
 * every path in, including placing a holding by hand. Which made the marking
 * buttons dead on exactly the documents this program exists for: the owner
 * selected letters in Durgā Sūktam, pressed Long, and got a paragraph
 * explaining why nothing had happened.
 *
 * The rule was protecting the right thing by the wrong means. What must never
 * happen is the marks CHANGING. Re-deriving is only dangerous because it might
 * produce something different — so derive, compare, and keep the difference:
 *
 *   1. read the verse's own recited text back out of its tokens;
 *   2. derive marks from that text under the verse's profile;
 *   3. wherever the derivation disagrees with the transcription, write an
 *      override carrying the TRANSCRIBED value, as `source-witness`;
 *   4. derive again and check the WHOLE TOKEN STREAM is identical to what was
 *      there before — not just the letters and their marks, but the pauses,
 *      the spacing, the bracketed text and the syllable division. If any of it
 *      differs, refuse and leave the verse exactly as it was.
 *
 * Step 4 is the whole safety argument. Adoption is output-preserving or it
 * does not happen, so no transcription is ever silently rewritten — and after
 * it, the verse is derivable, markable, and re-derivable like any other.
 *
 * IT IS IDEMPOTENT. Where the engine already agrees with the hand marks it
 * writes no override at all, so a well-derived document adopts cleanly and
 * gains nothing but a `src` layer; running it again does nothing.
 *
 * NO VERSE IN THE SHIPPED CORPUS ADOPTS TODAY, and the reason is worth writing
 * down rather than rediscovering. A transcribed verse stores a space either
 * side of a `¦` bar — `puruṣa · ¦ · eve-daṁ` — and this engine emits none for
 * the same source line, so the streams differ by spacing on almost every
 * verse. The 420 verses that already carry a source layer do NOT have those
 * spaces, which is exactly why they re-derive exactly; the 153 transcribed
 * ones came in by an older path that padded. Relaxing the check to ignore
 * spacing would make adoption succeed by DELETING those spaces from a
 * transcription, which is the thing it exists to prevent. Reconciling the two
 * is `sm attach-src`'s job (see `invert.ts`), and until it is done every
 * transcribed verse marks through `markUnits` instead — which lands the mark
 * and leaves every other byte alone. `npm run check:marking` measures both.
 */
import type {
  ChantOverride, ChantSection, ChantToken, ChantUnit, ChantVerse, ChantProfileRef,
} from '@siksamitra/format';
import { invertVerse } from '@siksamitra/engine';
import { deriveVerse, verseSrcMap } from './derive-verse.js';
import { mergeOverride } from './marks.js';

/**
 * The mark fields an override can carry.
 *
 * `cj` is deliberately absent: a conjunct choice is a property of the script
 * form, not a mark, and there is no override field to carry one. A derivation
 * that disagrees about a `cj` is caught by step four instead, which compares
 * the whole token stream and so sees every field a unit has.
 */
const FIELDS = ['hold', 'svara', 'change', 'sup', 'candra', 'sbhakti'] as const;

/** Every letter of every syllable, in the order the page draws them. */
export function unitsOf(tokens: readonly ChantToken[]): ChantUnit[] {
  const out: ChantUnit[] = [];
  const walk = (list: readonly ChantToken[]): void => {
    for (const t of list) {
      if (t.t === 'syl') out.push(...t.units);
      else if (t.t === 'slot') walk(t.tokens);
    }
  };
  walk(tokens);
  return out;
}

/**
 * Which box each letter belongs to, as a partition rather than as ids.
 *
 * `hg` is a group NUMBER, and two derivations can express the same grouping
 * with different numbers — the engine renumbers from zero per verse, a Word
 * import numbers as it reads. Comparing the numbers reports a difference on
 * every held letter in the document and buries the real ones. What has to
 * match is which letters share a box, so that is what is compared: for each
 * letter, whether it continues the box the letter before it was in.
 */
function boxRuns(units: readonly ChantUnit[]): boolean[] {
  return units.map((u, i) => {
    const prev = units[i - 1];
    if (i === 0 || prev === undefined) return false;
    if (u.hold === undefined || prev.hold === undefined) return false;
    return u.hold === prev.hold && u.hg !== undefined && u.hg === prev.hg;
  });
}

/**
 * The verse's token stream as a string, with only the box NUMBERING removed.
 *
 * THE ORACLE FOR STEP FOUR, and it is the whole stream rather than the letters
 * because checking the letters let a great deal through. The first version
 * compared `unitsOf` — a flat list of letters and their marks — and `unitsOf`
 * walks straight past every token that is not a syllable. So adoption passed
 * its own safety check while deleting things it had never looked at: the
 * brackets around an instruction (`[ oṁ … ]` in ganeśa-aṣṭottara n-17 became
 * `oṁ …`), and the recitation pauses, which it did not merely drop but MOVED
 * and re-weighted — 31 of the 89 verses that adopted had their pauses changed,
 * 33 lost and 5 invented. A pause is an instruction to a reciter, on a verse
 * whose entire status is that someone wrote it down by hand.
 *
 * `hg` is normalised away because a group id is a private numbering with no
 * meaning beyond telling two touching boxes apart; the engine renumbers from
 * zero and a Word import numbers as it reads. Which letters share a box is
 * still compared, by `boxRuns`.
 */
function streamSignature(tokens: readonly ChantToken[]): string {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value === null || typeof value !== 'object') return value;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (key === 'hg') continue;
      out[key] = strip((value as Record<string, unknown>)[key]);
    }
    return out;
  };
  return JSON.stringify(strip(tokens));
}

export type AdoptResult =
  /** Already derivable. Nothing to do, and nothing was done. */
  | { ok: true; changed: false; verse: ChantVerse; overrides: readonly ChantOverride[] }
  | {
    ok: true;
    changed: true;
    verse: ChantVerse;
    overrides: readonly ChantOverride[];
    /** Letters where the engine had to be told what the transcription says. */
    witnessed: number;
    /** Letters the engine reproduced by itself. */
    agreed: number;
  }
  | { ok: false; why: string };

/** Do the two letters carry the same marks, in the fields an override can hold? */
const sameMarks = (a: ChantUnit, b: ChantUnit): boolean =>
  FIELDS.every((f) => a[f] === b[f]);

/**
 * Derive a source layer for a verse that has none, preserving its marks exactly.
 *
 * `overrides` is the section's current override list; the returned list is it
 * plus whatever this verse needed. The verse is returned unchanged, with the
 * same overrides, when it already has a source layer.
 */
export function adoptSource(
  verse: ChantVerse,
  section: Pick<ChantSection, 'profile'> | undefined,
  docProfile: ChantProfileRef | undefined,
  overrides: readonly ChantOverride[],
): AdoptResult {
  if (verse.src !== undefined) {
    return { ok: true, changed: false, verse, overrides };
  }

  /*
   * `invertVerse`, NOT `linesFromTokens`.
   *
   * They look interchangeable and are not. `linesFromTokens` is the caret's
   * stand-in: the text as DRAWN, so that a selection can cross a frozen verse.
   * Deriving from it feeds the engine its own output — a danda comes back as
   * the glyph the page shows rather than the `|` the author typed, and the
   * next derivation reads that glyph as a letter. Measured over the corpus:
   * three extra letters in Durgā Sūktam's first verse, and 93% of transcribed
   * verses refusing to adopt for a reason that had nothing to do with their
   * marks. `invertVerse` is the real inverse — it undoes the anusvāra and
   * visarga substitutions, drops the pauses the engine places itself, and
   * writes the structure back in the authoring syntax.
   */
  const inverted = invertVerse(verse.tokens);
  const lines = inverted.lines;
  if (lines.length === 0 || lines.every((l) => l.trim() === '')) {
    return { ok: false, why: 'the verse has no text to derive from' };
  }
  const want = unitsOf(verse.tokens);
  if (want.length === 0) {
    return { ok: false, why: 'the verse has no marked letters' };
  }

  /* A candidate source layer. Nothing is committed until step 4 agrees. */
  const probe: ChantVerse = {
    ...verse,
    src: {
      lines,
      /* The accented witness only where there is one to record: giving a prose
         text an `accented` layer claims a witness that does not exist. */
      ...(inverted.accents > 0 ? { accented: inverted.accented } : {}),
    },
  };

  const first = deriveVerse(probe, section, docProfile, overrides);
  if (!first.ok) return { ok: false, why: first.why };

  const got = unitsOf(first.verse.tokens);
  if (got.length !== want.length) {
    return {
      ok: false,
      why: `reading the text back gave ${got.length} letters where the `
        + `transcription has ${want.length}`,
    };
  }
  const wrong = want.findIndex((u, i) => u.c !== got[i]?.c);
  if (wrong >= 0) {
    return {
      ok: false,
      why: `letter ${wrong + 1} reads "${got[wrong]?.c ?? ''}" where the `
        + `transcription has "${want[wrong]?.c ?? ''}"`,
    };
  }

  const map = verseSrcMap(probe, section, docProfile, overrides);
  if (map === null) return { ok: false, why: 'the derivation produced no source map' };

  /*
   * One override per letter the engine got wrong, carrying what the
   * transcription says. `source-witness` is precisely what these are: not the
   * owner's decision taken now, but a record of what a marked source shows.
   */
  let next = [...overrides];
  let witnessed = 0;
  const runsWant = boxRuns(want);
  const runsGot = boxRuns(got);

  for (const [i, mine] of want.entries()) {
    const theirs = got[i];
    if (theirs === undefined) continue;
    const marksDiffer = !sameMarks(mine, theirs);
    const boxDiffers = runsWant[i] !== runsGot[i];
    if (!marksDiffer && !boxDiffers) continue;

    const span = map.units[i];
    if (span === undefined) {
      return { ok: false, why: `letter ${i + 1} has no place in the source` };
    }
    const set: Record<string, unknown> = {};
    for (const f of FIELDS) {
      /* `null` means "suppress what the engine would place here" — which is
         what a transcription showing no mark against a derived one says. */
      if (mine[f] !== theirs[f]) set[f] = (mine[f] as unknown) ?? null;
    }
    if (boxDiffers) set['hg'] = mine.hg ?? null;
    if (Object.keys(set).length === 0) continue;

    const line = map.lines[span.line] ?? '';
    next = mergeOverride(next, {
      at: { verse: verse.id, line: span.line, letter: span.start },
      set: set as ChantOverride['set'],
      why: 'source-witness',
      ch: line.slice(span.start, span.end),
      note: 'from the marked source this verse was transcribed from',
    });
    witnessed += 1;
  }

  /*
   * STEP FOUR. Derive again with the witnesses in place and require the result
   * to be the marks that were there before. This is the only reason adopting a
   * source layer is safe at all, so it is a check and not a comment.
   */
  const settled = deriveVerse(probe, section, docProfile, next);
  if (!settled.ok) return { ok: false, why: settled.why };
  const after = unitsOf(settled.verse.tokens);
  if (after.length !== want.length) {
    return { ok: false, why: 're-deriving changed the number of letters' };
  }
  const runsAfter = boxRuns(after);
  const bad = want.findIndex(
    (u, i) => after[i] === undefined
      || u.c !== after[i]?.c
      || !sameMarks(u, after[i]!)
      || runsWant[i] !== runsAfter[i],
  );
  if (bad >= 0) {
    return {
      ok: false,
      why: `the marks on letter ${bad + 1} ("${want[bad]?.c ?? ''}") could not `
        + 'be reproduced, so the transcription was left as it is',
    };
  }

  /*
   * AND THE REST OF THE VERSE, which the letters do not cover: the pauses, the
   * spaces, the daṇḍas, the bracketed text, and how the letters divide into
   * syllables. See `streamSignature` for what got through while this was not
   * checked. A verse the engine cannot reproduce token for token is exactly a
   * verse that must stay transcribed — `markUnits` then writes the mark onto
   * the letter and leaves every other byte alone.
   */
  if (streamSignature(settled.verse.tokens) !== streamSignature(verse.tokens)) {
    return {
      ok: false,
      why: 'the verse is more than its letters — its pauses, spacing or '
        + 'syllable division came back different, so the transcription was '
        + 'left as it is',
    };
  }

  return {
    ok: true,
    changed: true,
    verse: settled.verse,
    overrides: next,
    witnessed,
    agreed: want.length - witnessed,
  };
}
