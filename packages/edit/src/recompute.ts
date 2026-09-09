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
  type ChantSection, type ChantVerse, type Stage,
} from '@siksamitra/format';
import { hydrateVerse, rerun, type Profile, type ReRunMode } from '@siksamitra/engine';

export interface RecomputeReport {
  verseId: string;
  /** What the run did, in words — shown in the status bar. */
  note: string;
  /** Markings placed by hand that the re-derivation could not carry. */
  lost: number;
  warnings: string[];
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
   * A RE-RUN PLACES MARKINGS. IT DOES NOT REWRITE THE VERSE.
   *
   * `rerun` will change the letters if the rules produce different ones, and
   * when it does, nothing addressed at the old letters can follow: every
   * marking in range is discarded. Pressing the button on Durgā Sūktam v-1
   * threw away 75 of the owner's own holdings and shortened the verse, and the
   * whole difference was two trailing spaces before a line break — an artefact
   * of the token stream, which ends a line with a space token, against
   * `derive`, which trims each line.
   *
   * Losing somebody's work to that is not a trade this command may make on its
   * own. So it refuses the verse and says so. Re-running the letters
   * themselves is a real operation and it needs its own answer — what the new
   * text is, what it costs, and a person agreeing to it — which is
   * `text-and-marks` §6.7, not a silent side effect of a button labelled
   * "re-apply rules".
   */
  if (out.text !== tm.text) {
    return {
      refused: `verse "${verse.id}": the rules would rewrite its letters, not just`
        + ` its markings — ${out.lost.length} marking(s) placed by hand would go with`
        + ' them, so nothing was changed',
    };
  }
  /* Through the codec, because `hydrateVerse` reads the STORED shape. One
     encoder and one decoder, wherever markings cross that boundary. */
  const next = hydrateVerse({ ...verse, text: out.text, marks: encodeMarks(out.marks) });
  return {
    verse: next,
    report: {
      verseId: verse.id,
      note: out.note,
      lost: out.lost.length,
      warnings: out.warnings,
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
