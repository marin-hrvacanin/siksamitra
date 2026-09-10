/**
 * RUNNING THE RULES OVER A DOCUMENT'S VERSES, because a person asked.
 *
 * The engine is not invoked by typing, by opening a file, by changing the
 * script or by any other side effect. It runs here, from the `recompute`
 * command, over the verses named and the stages named, keeping or replacing
 * what was placed by hand.
 *
 * NO RULE LIVES HERE. `rerun` in `@siksamitra/engine` is the whole of it —
 * `recompute(range, stages, mode)` from `openspec/changes/text-and-marks` §4.2
 * — and the Word add-in's task pane calls the same function. This adds the
 * document around it: which verses, and putting the answer back.
 *
 * ROUND TRIP, NOT PATCH. A verse's markings are read off its tokens, re-run,
 * and the tokens rebuilt from the result. That is three conversions where one
 * mutation would do, and it is deliberate while both shapes exist: the tokens
 * are what everything still draws, and a patch that edited them in place would
 * be a second implementation of what `toTokens` already does. It becomes one
 * assignment when the editor works on text and markings directly.
 */
import {
  encodeMarks, toTextAndMarks,
  type ChantSection, type ChantVerse, type Mark, type Stage,
} from '@siksamitra/format';
import { hydrateVerse, rerun, type Profile, type ReRunMode } from '@siksamitra/engine';

/**
 * A comparable form of a marking list.
 *
 * Sorted, because two runs may produce the same markings in a different order
 * and "different" would then mean "reordered". Only the four fields that say
 * WHAT the marking is — a re-run rewrites `by` and `stage` on every marking it
 * touches even when the marking itself is identical, and treating that as a
 * change would make every re-run a change.
 */
const markKey = (marks: readonly Mark[]): string =>
  [...marks]
    .map((m) => `${m.k}:${m.from}:${m.to}:${m.v ?? ''}`)
    .sort()
    .join('|');

export interface RecomputeReport {
  verseId: string;
  /** What the run did, in words — shown in the status bar. */
  note: string;
  /** Markings placed by hand that the re-derivation could not carry. */
  lost: number;
  warnings: string[];
  /**
   * Did the verse actually come out different?
   *
   * A RE-RUN THAT CHANGES NOTHING IS NOT AN UNDO STEP, and telling that apart
   * needs the engine's own answer rather than a guess: running the rules over
   * a verse they already agree with rewrites the same text and the same
   * markings. Without this, pressing the button on a settled document filled
   * the undo history with steps that restore an identical document — so
   * Ctrl+Z appeared to do nothing, repeatedly, which is how "undo is broken"
   * gets reported.
   *
   * It is also worth saying to the person: "nothing changed" is a better
   * answer than silence.
   */
  changed: boolean;
}

export interface Recomputed {
  section: ChantSection;
  reports: RecomputeReport[];
  /** Verses that were asked for and could not be run, with the reason. */
  refusals: string[];
}

/**
 * One verse, re-run.
 *
 * Over the WHOLE verse: `rerun` takes a character range, and a range that is
 * the whole text is the case a person means by "this verse". A narrower range
 * is what the selection will pass once the surface addresses characters.
 */
function recomputeVerse(
  verse: ChantVerse,
  stages: readonly Stage[],
  mode: ReRunMode,
  profile: Profile,
): { verse: ChantVerse; report: RecomputeReport } | { refused: string } {
  if (verse.tokens.length === 0) {
    return { refused: `verse "${verse.id}" has no text to run the rules over` };
  }
  const tm = toTextAndMarks(verse);
  const out = rerun(tm, {
    stages, mode, from: 0, to: tm.text.length, profile, verseN: verse.n ?? null,
  });

  /*
   * A RE-RUN MAY REWRITE THE LETTERS, and that is what running the rules
   * means: the substitutions are a stage. What it may NOT do is charge more
   * for it than the change costs.
   *
   * This used to refuse any verse whose letters would move — 151 of 573 —
   * because `rerun` treated the whole range as replaced and discarded every
   * marking in it. Pressing the button on Durgā Sūktam took 75 of the owner's
   * holdings and 112 syllables, over two spaces nobody could see. `rerun`
   * shifts by the MINIMAL change now, so only markings on letters that
   * actually moved are lost, and those are reported by name.
   */

  /* Through the codec, because `hydrateVerse` reads the STORED shape. One
     encoder and one decoder, wherever markings cross that boundary. */
  const next = hydrateVerse({ ...verse, text: out.text, marks: encodeMarks(out.marks) });
  /* Compared against what went IN, on the text and the markings — the two
     things a verse is. Cheap: one string compare and one walk of a list that
     is at most a few hundred long. */
  const wasMarks = markKey(tm.marks);
  return {
    verse: next,
    report: {
      verseId: verse.id,
      note: out.note,
      lost: out.lost.length,
      warnings: out.warnings,
      changed: out.text !== tm.text || markKey(out.marks) !== wasMarks,
    },
  };
}

/** Every named verse of a section, re-run. */
export function recompute(
  section: ChantSection,
  verseIds: readonly string[],
  stages: readonly Stage[],
  mode: ReRunMode,
  profileOf: (verse: ChantVerse) => Profile,
): Recomputed {
  const wanted = new Set(verseIds);
  const reports: RecomputeReport[] = [];
  const refusals: string[] = [];
  const verses = section.verses.map((v) => {
    if (!wanted.has(v.id)) return v;
    const done = recomputeVerse(v, stages, mode, profileOf(v));
    if ('refused' in done) { refusals.push(done.refused); return v; }
    reports.push(done.report);
    return done.verse;
  });
  return { section: { ...section, verses }, reports, refusals };
}
