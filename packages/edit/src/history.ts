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
import type { ChantDoc, ChantOverride, ChantSection } from '@siksamitra/format';
import type { Selection } from './caret.js';

export interface Snapshot {
  sections: ChantSection[];
  overrides: ChantOverride[];
  selection: Selection | null;
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
});

/**
 * Put a snapshot back.
 *
 * Sections are matched by id and REPLACED, not spliced by index: an undo that
 * assumed positions would corrupt the document if a command had reordered
 * anything. Overrides are document-level and restored whole, because a mark
 * command can touch letters in several sections at once.
 */
export const restore = (doc: ChantDoc, snap: Snapshot): ChantDoc => ({
  ...doc,
  sections: doc.sections.map((s) => snap.sections.find((x) => x.id === s.id) ?? s),
  overrides: snap.overrides,
});

/** Record a step, extending the last one when the coalesce keys match. */
export function record(history: History, step: Step): History {
  const last = history.past[history.past.length - 1];
  if (step.coalesce !== undefined && last?.coalesce === step.coalesce) {
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
