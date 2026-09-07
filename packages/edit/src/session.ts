/**
 * The edit session — every change to a document goes through here.
 *
 * Pure and synchronous: `apply(state, history, command)` returns new ones. No
 * React, no DOM, no storage. That is what lets the whole editing surface be
 * tested without a browser, and it is the difference from v1, where "what
 * happens when I press this" was answerable only by pressing it.
 *
 * Four commands, and every editing gesture is one of them. Typing, deleting,
 * pasting three verses, splitting a line and joining two verses are all
 * `replace` — one range replacement — so they cannot disagree with each other
 * about what a verse boundary is. Placing a holding is `mark`; withdrawing an
 * opinion is `unmark`; handing the holdings back to the rules is
 * `auto-holdings`.
 *
 * Every branch ends the same way: change the marks, change the source,
 * re-derive what changed, and REPORT what happened — refusals, orphaned
 * recordings, and every hand-placed mark that could not follow the text.
 * A command that reports nothing is a command whose failures are invisible.
 */
import type { ChantDoc, ChantOverride, ChantSection } from '@siksamitra/format';
import type { OverrideField } from '@siksamitra/engine';
import {
  addressAt, flatten, type Selection, type VerseSource,
} from './caret.js';
import { replaceRange } from './range.js';
import {
  attestedInRange, refusalForEdit, refusalForMark, refusalForOutside,
} from './rule-zero.js';
import {
  autoHoldings, clearMarks, markLetters,
  type MarkPatch, type MarkReason, type UnitAddress,
} from './marks.js';
import { verseSrcMap, type VerseReport } from './derive-verse.js';
import {
  changedVerses, rebaseSection, rederive, sourcesOf, writeSources, type LostMark,
} from './sync.js';
import { record, restore, snapshot, type History } from './history.js';
import { setProfile, type ProfileChange } from './set-profile.js';

export type EditCommand =
  /** Replace a flat range of one section's source. Every text change is this. */
  | {
    k: 'replace';
    sectionId: string;
    from: number;
    to: number;
    insert: string;
    /** Ids for verses a paste creates, in order. */
    newIds?: readonly string[];
    /** Same key as the previous command ⇒ one undo step. */
    coalesce?: string;
  }
  /** Place marks on letters by hand. */
  | {
    k: 'mark';
    sectionId: string;
    targets: readonly UnitAddress[];
    patch: MarkPatch;
    why: MarkReason;
    note?: string;
  }
  /** Withdraw an opinion, letting the rules decide again. */
  | {
    k: 'unmark';
    sectionId: string;
    targets: readonly UnitAddress[];
    fields: readonly OverrideField[];
  }
  /** Re-run the holding rules over verses that already carry marks. */
  | {
    k: 'auto-holdings';
    sectionId: string;
    verseIds: readonly string[];
    mode: 'keep' | 'replace';
  }
  /** Change which register's rules govern the document, or one section. */
  | ProfileChange;

export interface EditState {
  doc: ChantDoc;
  /** The caret. A section is its bound — see `caret.ts`. */
  selection: Selection | null;
  /** What the last command did. Shown in the status bar, never guessed at. */
  reports: VerseReport[];
  refusals: string[];
  /** Verses whose recording and word analysis are now orphaned. */
  orphaned: string[];
  /** Hand-placed marks the last command could not keep. Never silent. */
  lostMarks: LostMark[];
}

export interface Applied {
  state: EditState;
  history: History;
}

export const newState = (doc: ChantDoc): EditState => ({
  doc,
  selection: null,
  reports: [],
  refusals: [],
  orphaned: [],
  lostMarks: [],
});

const quiet = (state: EditState): EditState => ({
  ...state, reports: [], refusals: [], orphaned: [], lostMarks: [],
});

const sectionOf = (doc: ChantDoc, id: string): ChantSection | undefined =>
  doc.sections.find((s) => s.id === id);

/** The source map for one verse — how a rendered letter finds its offset. */
export function srcMapFor(
  doc: ChantDoc,
  sectionId: string,
  verseId: string,
): ReturnType<typeof verseSrcMap> {
  const section = sectionOf(doc, sectionId);
  const verse = section?.verses.find((v) => v.id === verseId);
  if (section === undefined || verse === undefined) return null;
  return verseSrcMap(verse, section, doc.profile, doc.overrides ?? []);
}

const refuse = (state: EditState, history: History, why: string): Applied => ({
  state: { ...quiet(state), refusals: [why] },
  history,
});

/** Group mark targets by verse, since a source map is per verse. */
function byVerse(targets: readonly UnitAddress[]): Map<string, UnitAddress[]> {
  const out = new Map<string, UnitAddress[]>();
  for (const t of targets) out.set(t.verseId, [...(out.get(t.verseId) ?? []), t]);
  return out;
}

export function apply(state: EditState, history: History, command: EditCommand): Applied {
  /*
   * A REGISTER CHANGE IS NOT A SECTION EDIT, so it is dispatched before the
   * section is looked up: `document` scope has no section to name, and the
   * command re-derives across all of them.
   */
  if (command.k === 'profile') {
    const done = setProfile(state.doc, history, command);
    if (done === null) {
      return refuse(state, history, `no section "${command.sectionId ?? ''}"`);
    }
    return {
      state: {
        ...quiet(state),
        doc: done.doc,
        reports: done.reports,
        refusals: done.refusals,
      },
      history: done.history,
    };
  }

  const section = sectionOf(state.doc, command.sectionId);
  if (section === undefined) {
    return refuse(state, history, `no section "${command.sectionId}"`);
  }

  const before = snapshot(state.doc, [section.id], state.selection);
  const sources = sourcesOf(section);
  let overrides: readonly ChantOverride[] = state.doc.overrides ?? [];
  let nextSources: readonly VerseSource[] = sources;
  let selection = state.selection;
  const lostMarks: LostMark[] = [];
  const orphaned: string[] = [];
  const blockedMarks: string[] = [];
  let touched = new Set<string>();

  if (command.k === 'replace') {
    const blocked = attestedInRange(section, sources, command.from, command.to);
    if (blocked.length > 0) {
      return refuse(
        state,
        history,
        /*
         * SAID PLAINLY. This read "whose marks are evidence rather than
         * output — edit the transcription itself, or give the verse a source
         * layer first", which is this program's private vocabulary and told
         * the person nothing they could act on. What they need to know is
         * what the verse IS and why the keystroke did nothing.
         */
        refusalForEdit(section, blocked),
      );
    }

    const result = replaceRange(sources, {
      from: command.from,
      to: command.to,
      insert: command.insert,
      ...(command.newIds === undefined ? {} : { newIds: command.newIds }),
      /*
       * Every id in the DOCUMENT, not just this section. An override is
       * addressed `{verse, line, letter}` and applied document-wide, so a
       * minted id that collided with a verse in another section made the new
       * verse inherit that verse's hand-placed holding — a box the author
       * never drew, on text they never marked.
       */
      taken: state.doc.sections.flatMap((s) => s.verses.map((v) => v.id)),
    });
    nextSources = result.verses;
    orphaned.push(...result.removed);

    const rebased = rebaseSection(overrides, sources, nextSources, {
      from: command.from,
      to: command.to,
    });
    overrides = rebased.overrides;
    lostMarks.push(...rebased.lost);

    touched = changedVerses(sources, nextSources);
    for (const id of result.added) touched.add(id);

    const at = addressAt(flatten(nextSources), result.caret);
    selection = at === null ? null : { anchor: at, head: at };
  } else if (command.k === 'mark' || command.k === 'unmark') {
    const groups = byVerse(command.targets);
    touched = new Set(groups.keys());
    for (const [verseId, targets] of groups) {
      const map = srcMapFor(state.doc, section.id, verseId);
      if (map === null) {
        /*
         * No source map means no source layer: a transcribed verse. An
         * override addresses a letter in a source that does not exist, so
         * there is nowhere to put this mark — and the marks already on the
         * verse are the transcription itself. Refused by name rather than
         * dropped, because a mark button that silently does nothing is the
         * worst of the three possible behaviours.
         */
        touched.delete(verseId);
        blockedMarks.push(refusalForMark(section, verseId));
        continue;
      }
      overrides = command.k === 'mark'
        ? markLetters(overrides, map, targets, command.patch, command.why, command.note).overrides
        : clearMarks(overrides, map, targets, command.fields);
    }
  } else {
    /*
     * The verses must be in the named section. `autoHoldings` in `replace` mode
     * DELETES hold overrides for the ids it is given, and it was given them
     * unchecked: naming another section's verse deleted an `owner-hand`
     * decision there, silently, while that section's tokens — not being
     * re-derived — went on drawing a box no override justified.
     */
    const here = new Set(section.verses.map((v) => v.id));
    const outside = command.verseIds.filter((id) => !here.has(id));
    if (outside.length > 0) {
      return refuse(
        state,
        history,
        refusalForOutside(section, outside),
      );
    }
    overrides = autoHoldings(overrides, command.verseIds, command.mode);
    touched = new Set(command.verseIds);
  }

  /*
   * A transcribed verse is never derived, so it is never "touched".
   *
   * It has no source, so `sourcesOf` stands in its RECITED text — and
   * `replaceRange` normalises every line it returns, which makes that stand-in
   * differ from itself and look changed. The result was a refusal for every
   * transcribed verse in the section on every keystroke anywhere in it: five
   * warnings for an edit that was perfectly legal. The guard in `deriveVerse`
   * stays; this stops asking it the question.
   */
  const frozen = new Set(
    section.verses.filter((v) => v.src === undefined).map((v) => v.id),
  );
  for (const id of frozen) touched.delete(id);

  // Source first, then tokens: the derivation reads the source, so writing it
  // second would derive the text as it was before the edit.
  const written = writeSources(section, nextSources);
  const withSource = written.section;
  for (const cost of written.accentsLost) {
    blockedMarks.push(
      `${cost.count} transcribed accent(s) in verse "${cost.verseId}" were on `
      + 'letters this edit replaced, and went with them',
    );
  }
  for (const drop of written.refused) {
    blockedMarks.push(
      `verse "${drop.verseId}" is transcribed and cannot hold source text, so `
      + `${drop.lines.join(' / ').slice(0, 60)}… was NOT written. The edit that `
      + 'produced it should have been refused.',
    );
  }
  /*
   * An empty `overrides` is OMITTED, not written.
   *
   * Absent and empty mean the same thing to a reader and different things to
   * `canonicalJson` — so writing `"overrides": []` onto a document that had no
   * such key changes its bytes and therefore its `docHash`. A no-op edit was
   * producing a different document.
   */
  const staged: ChantDoc = {
    ...state.doc,
    sections: state.doc.sections.map((s) => (s.id === section.id ? withSource : s)),
  };
  if (overrides.length > 0) staged.overrides = [...overrides];
  else delete staged.overrides;

  const { section: derived, reports, refusals } = rederive(
    staged, withSource, touched, overrides,
  );
  const doc: ChantDoc = {
    ...staged,
    sections: staged.sections.map((s) => (s.id === section.id ? derived : s)),
  };

  for (const r of reports) lostMarks.push(...r.unplaced);

  const next: EditState = {
    doc,
    selection,
    reports,
    refusals: [...blockedMarks, ...refusals],
    orphaned,
    lostMarks,
  };
  return {
    state: next,
    history: record(history, {
      before,
      after: snapshot(doc, [section.id], selection),
      ...(command.k === 'replace' && command.coalesce !== undefined
        ? { coalesce: command.coalesce }
        : {}),
    }),
  };
}

/** Move the caret. Not a document change, so not an undo step. */
export const select = (state: EditState, selection: Selection | null): EditState =>
  ({ ...state, selection });

/** Undo one step: the sections, the overrides, then the caret. */
export function undo(state: EditState, history: History): Applied {
  const step = history.past[history.past.length - 1];
  if (step === undefined) return { state, history };
  return {
    state: {
      ...quiet(state),
      doc: restore(state.doc, step.before),
      selection: step.before.selection,
    },
    history: { past: history.past.slice(0, -1), future: [step, ...history.future] },
  };
}

/** Redo one step. */
export function redo(state: EditState, history: History): Applied {
  const step = history.future[0];
  if (step === undefined) return { state, history };
  return {
    state: {
      ...quiet(state),
      doc: restore(state.doc, step.after),
      selection: step.after.selection,
    },
    history: { past: [...history.past, step], future: history.future.slice(1) },
  };
}
