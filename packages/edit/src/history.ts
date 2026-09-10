/**
 * Undo, as a reverse patch.
 *
 * Each applied command records the sections it touched and the override array
 * as they were, and undo puts them back. The alternative — an analytic inverse
 * per command kind — was rejected deliberately: it makes every new command a
 * fresh opportunity to get undo wrong, and undo is the feature a user trusts
 * most and inspects least. A section is the document's load unit and is small;
 * snapshotting one costs far less than the re-derivation the command has
 * already paid for.
 *
 * COALESCING is the caller's decision, passed in as a key. Twenty keystrokes
 * inside one word are one undo step in Word, and it is a CLOCK that decides
 * that — which a pure function may not read. So the surface passes
 * `coalesce: 'type'` while its own timer says the burst continues, and stops
 * passing it when the burst ends. The rule here is only "same key as the step
 * before ⇒ extend that step".
 */
import type {
  ChantDoc, ChantOverride, ChantProfileRef, ChantRecording, ChantSection,
} from '@siksamitra/format';
import type { Selection } from './caret.js';

export interface Snapshot {
  sections: ChantSection[];
  overrides: ChantOverride[];
  selection: Selection | null;
  /**
   * WHICH RULES GOVERNED THE DOCUMENT.
   *
   * A section carries its own profile and is snapshotted whole, so a change
   * there rides along in `sections`. The DOCUMENT's profile is not in any
   * section, and without it here changing the register and pressing Ctrl+Z
   * put the text back while leaving the new rules in force — the next verse
   * anyone touched would have been re-derived under rules the undo appeared
   * to have withdrawn. `undefined` is a real value here (a document that
   * names no register), so it is always written and always restored.
   */
  profile: ChantProfileRef | undefined;
  /**
   * THE RECORDING'S MAPPING, for the same reason as the profile above.
   *
   * Mapping a take is one action that rewrites every verse's offsets at once.
   * Without it here, Ctrl+Z after a mapping put the text back and left the new
   * offsets in place — and a mapping is precisely the thing somebody tries,
   * listens to, and wants to take back.
   */
  recording: ChantRecording | undefined;
}

export interface Step {
  before: Snapshot;
  after: Snapshot;
  coalesce?: string;
}

export interface History {
  past: Step[];
  future: Step[];
}

export const emptyHistory = (): History => ({ past: [], future: [] });

/**
 * HOW FAR BACK UNDO GOES, and why it has a limit at all.
 *
 * A step holds a snapshot of the section BEFORE and AFTER it, and a section is
 * not small: measured, the largest in Śrī Rudram is 182 kB and the largest in
 * Durgā Sūktam 157 kB. Nothing trimmed the list, so 200 separate edits — a few
 * minutes of typing with pauses — came to 24 MB of history, and an afternoon's
 * work would have come to hundreds. That is a tab that gets slower all day and
 * then stops.
 *
 * A hundred STEPS, not a hundred keystrokes: a burst of typing coalesces into
 * one, so this is a hundred distinct acts — far more than the "about twenty"
 * Word is documented to keep, and about 12 MB at the corpus's worst case.
 *
 * The oldest step is dropped, which is what every editor does. The alternative
 * — refusing to record once full — would make the most recent edit the one you
 * cannot take back, which is exactly the wrong end to lose.
 */
export const HISTORY_DEPTH = 100;

export const snapshot = (
  doc: ChantDoc,
  sectionIds: readonly string[],
  selection: Selection | null,
): Snapshot => ({
  sections: doc.sections.filter((s) => sectionIds.includes(s.id)),
  overrides: [...(doc.overrides ?? [])],
  selection,
  profile: doc.profile,
  recording: doc.recording,
});

/**
 * Put a snapshot back.
 *
 * Sections are matched by id and REPLACED, not spliced by index: an undo that
 * assumed positions would corrupt the document if a command had reordered
 * anything. Overrides are document-level and restored whole, because a mark
 * command can touch letters in several sections at once.
 */
export function restore(doc: ChantDoc, snap: Snapshot): ChantDoc {
  const out: ChantDoc = {
    ...doc,
    sections: doc.sections.map((s) => snap.sections.find((x) => x.id === s.id) ?? s),
  };
  /*
   * An empty `overrides` is OMITTED, exactly as `apply` omits it.
   *
   * Absent and empty mean the same thing to a reader and different things to
   * `canonicalJson`, so writing `"overrides": []` back onto a document that
   * never had the key changes its bytes and its `docHash`. `apply` took care
   * over this and `restore` undid it: measured, 5 of the 11 shipped documents
   * were NOT byte-identical after an edit and its undo, and the test that
   * claimed otherwise had hard-coded one of the six that were.
   */
  if (snap.overrides.length > 0) out.overrides = snap.overrides;
  else delete out.overrides;
  /* Absent and present-but-undefined differ to `canonicalJson`, for the same
     reason the overrides do — see above. */
  if (snap.profile !== undefined) out.profile = snap.profile;
  else delete out.profile;
  if (snap.recording !== undefined) out.recording = snap.recording;
  else delete out.recording;
  return out;
}

const sectionIds = (snap: Snapshot): string => snap.sections.map((s) => s.id).sort().join(',');

/**
 * Record a step, extending the last one when the coalesce keys match.
 *
 * THE KEYS MATCHING IS NOT ENOUGH: the two steps must also cover the same
 * sections. A merged step keeps the FIRST command's `before`, and that snapshot
 * only contains the sections that command touched — so coalescing a step in
 * section A with one in section B produced an undo that restored A and left B's
 * edit applied, permanently, with no way back. Reachable from the surface,
 * because the coalesce key is a kind plus a timestamp and says nothing about
 * where the caret was.
 */
export function record(history: History, step: Step): History {
  const last = history.past[history.past.length - 1];
  const mergeable = step.coalesce !== undefined
    && last?.coalesce === step.coalesce
    && sectionIds(last.before) === sectionIds(step.before);
  if (mergeable && last !== undefined) {
    // One undo step: keep the ORIGINAL `before`, take the newer `after`.
    return {
      past: [...history.past.slice(0, -1), { ...step, before: last.before }],
      future: [],
    };
  }
  /* Capped from the OLD end — see `HISTORY_DEPTH`. */
  const past = [...history.past, step];
  return {
    past: past.length > HISTORY_DEPTH ? past.slice(past.length - HISTORY_DEPTH) : past,
    future: [],
  };
}

/**
 * WHAT AN APPLIED COMMAND DID, in the three numbers that decide whether it was
 * a change at all.
 */
export interface Effect {
  /** How many verses the command changed or added. */
  readonly touched: number;
  /** How many it removed. */
  readonly removed: number;
  /** Whether it replaced the document's override array. */
  readonly overridesReplaced: boolean;
}

/**
 * DID THIS COMMAND CHANGE NOTHING? Then it is not an undo step.
 *
 * MEASURED: four of five degenerate commands recorded one. A `replace` of
 * nothing over nothing, a `replace` of a range with the text it already had, a
 * `mark` with no targets, an `unmark` with no targets and a `recompute` of no
 * verses each left the document byte-identical and each pushed a step.
 *
 * WHAT THAT IS FROM THE OUTSIDE. Press a marking button with nothing selected
 * and Ctrl+Z afterwards appears to do nothing — it restores an identical
 * document — so a person presses it again, and again, each press spending a
 * no-op, until they finally reach the edit they wanted back. "Undo does
 * nothing" is the report, and the history is the reason.
 *
 * AND IT IS MEMORY: see `HISTORY_DEPTH` for what 200 steps came to.
 *
 * THE TESTS ARE THE COMMAND'S OWN ARGUMENTS AND THE WORK ALREADY DONE, not a
 * comparison of two documents. `canonicalJson` of one section costs 7-11 ms —
 * as much as the edit itself — so comparing on every keystroke would double
 * the cost of typing. A `replace` reports which verses it changed, added and
 * removed; a command with no targets has nothing to do by inspection.
 *
 * AND A RE-RUN THAT REWROTE NOTHING is caught too, from the engine's own
 * answer rather than a guess: `RecomputeReport.changed` compares the text and
 * the markings a verse went in with against the ones it came out with, so
 * pressing the button on a settled document is not an undo step either.
 */
export function changesNothing(
  command: { readonly k: string; readonly targets?: readonly unknown[]; readonly verseIds?: readonly unknown[] },
  effect: Effect,
): boolean {
  if (command.k === 'replace') {
    return effect.touched === 0 && effect.removed === 0 && !effect.overridesReplaced;
  }
  if (command.k === 'mark' || command.k === 'unmark') return (command.targets ?? []).length === 0;
  /* A re-run reports which verses it actually rewrote — see `touched`. */
  if (command.k === 'recompute') return effect.touched === 0;
  return false;
}

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;
