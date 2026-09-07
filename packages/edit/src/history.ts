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
  ChantDoc, ChantOverride, ChantProfileRef, ChantSection,
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

export const snapshot = (
  doc: ChantDoc,
  sectionIds: readonly string[],
  selection: Selection | null,
): Snapshot => ({
  sections: doc.sections.filter((s) => sectionIds.includes(s.id)),
  overrides: [...(doc.overrides ?? [])],
  selection,
  profile: doc.profile,
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
  return { past: [...history.past, step], future: [] };
}

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;
