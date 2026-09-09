/**
 * The edit session — every change to a document goes through here.
 *
 * Pure and synchronous: `apply(state, history, command)` returns new ones. No
 * React, no DOM, no storage. That is what lets the whole editing surface be
 * tested without a browser, and it is the difference from v1, where "what
 * happens when I press this" was answerable only by pressing it.
 *
 * Five commands, and every editing gesture is one of them. Typing, deleting,
 * pasting three verses, splitting a line and joining two verses are all
 * `replace` — one range replacement — so they cannot disagree about what a
 * verse boundary is. A holding is `mark`; withdrawing one is `unmark`; running
 * the rules is `recompute`, and nothing else runs them; and everything done to
 * a picture — insert, replace, resize, align, caption, delete — is `figure`.
 *
 * Every branch ends the same way: change the marks, change the source,
 * re-derive what changed, and REPORT what happened — refusals, orphaned
 * recordings, and every hand-placed mark that could not follow the text.
 * A command that reports nothing is a command whose failures are invisible.
 */
import type { ChantDoc, ChantOverride, ChantSection } from '@siksamitra/format';
import { resolveProfile } from '@siksamitra/engine';
import {
  addressAt, flatten, type Selection, type VerseSource,
} from './caret.js';
import { replaceRange } from './range.js';
import { clearText, markText, patchToMark } from './mark-text.js';
import { tokenSrcMap } from './token-src-map.js';
import {
  refusalForOutside,
} from './rule-zero.js';
import { profileChain, verseSrcMap, type VerseReport } from './derive-verse.js';
import { recompute } from './recompute.js';
import {
  changedVerses, rederive, sourcesOf, writeSources, type LostMark,
} from './sync.js';
import { record, restore, snapshot, type History, type Snapshot } from './history.js';
import { setProfile } from './set-profile.js';
import { applyFigureCommand, figureSectionsTouched } from './figures.js';

import type { EditCommand } from './command.js';

export type { EditCommand } from './command.js';

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
  /*
   * A TRANSCRIBED VERSE IS STILL ADDRESSABLE.
   *
   * `verseSrcMap` answers null for one, because there is no source to derive
   * from — and every caller read that as "these letters have no addresses",
   * so a drag across the first verse of Durgā Sūktam produced no selection at
   * all and the holding button had nothing to mark. The letters are on the
   * page and can be pointed at; `tokenSrcMap` maps them onto the same recited
   * text the caret already uses.
   */
  return verseSrcMap(verse, section, doc.profile, doc.overrides ?? [])
    ?? tokenSrcMap(verse);
}

const refuse = (state: EditState, history: History, why: string): Applied => ({
  state: { ...quiet(state), refusals: [why] },
  history,
});

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

  /* A picture is not text — it changes `items`, no verse — so it goes before
     rule zero, the source writing and the re-derivation. See `figures.ts`. */
  if (command.k === 'figure') {
    const done = applyFigureCommand(state.doc, section, command);
    /* A drag can move a picture into ANOTHER step, and an undo step that
       snapshotted only the one it left would put the picture back without
       taking it out of where it landed — two of it. */
    const touched = figureSectionsTouched(command);
    const snap = (d: ChantDoc): Snapshot => snapshot(d, touched, state.selection);
    const step = { before: snap(state.doc), after: snap(done.doc) };
    return {
      state: { ...quiet(state), doc: done.doc, refusals: [...done.notes] },
      history: done.changed ? record(history, step) : history,
    };
  }

  const before = snapshot(state.doc, [section.id], state.selection);
  /*
   * The section as this command is building it.
   *
   * Marking a transcribed verse gives it a source layer first (see
   * `adoptSource`), which changes the verse — and everything downstream
   * writes sources and re-derives against THIS, not against the section as it
   * arrived.
   */
  let working: ChantSection = section;
  const sources = sourcesOf(section);
  let overrides: readonly ChantOverride[] = state.doc.overrides ?? [];
  let nextSources: readonly VerseSource[] = sources;
  let selection = state.selection;
  const lostMarks: LostMark[] = [];
  const orphaned: string[] = [];
  const blockedMarks: string[] = [];
  let touched = new Set<string>();

  if (command.k === 'replace') {
    /*
     * NO VERSE REFUSES AN EDIT. A verse used to be either derived, and
     * editable, or transcribed, and frozen — `attestedInRange` declined the
     * keystroke by name. That distinction was the owner's "what are these
     * layers you are talking about?", and it is gone: every verse is one text
     * and a list of markings, and the caret edits the text that is shown.
     */
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

    /*
     * THE OVERRIDES ARE NOT REBASED, because they are not in this coordinate
     * system any more.
     *
     * An override addresses `{verse, line, letter}` in the verse's SOURCE, and
     * the caret addresses the text that is shown. Rebasing one against the
     * other reported a hand marking as lost on a no-op edit — an insert of the
     * empty string, in a document nobody had touched.
     *
     * Nothing writes an override now: a marking placed by hand is a range over
     * the text. What the corpus still carries is inert except when `recompute`
     * hands it to the engine, and its effect is already in the markings the
     * migration read off the tokens. They go with the rest of the old model in
     * `text-and-marks` §10.1.
     */
    touched = changedVerses(sources, nextSources);
    for (const id of result.added) touched.add(id);

    const at = addressAt(flatten(nextSources), result.caret);
    selection = at === null ? null : { anchor: at, head: at };
  } else if (command.k === 'mark' || command.k === 'unmark') {
    /*
     * STRAIGHT ONTO THE TEXT — see `mark-text.ts`.
     *
     * A marking used to be an OVERRIDE addressed into the verse's source, and
     * it reached the page only when the verse was next derived. So pressing a
     * button ran the engine, and a verse with no source layer could not hold
     * one at all — which is what made the holding button answer with a
     * paragraph about evidence instead of drawing a box.
     */
    if (command.k === 'unmark') {
      const kinds = command.fields
        .map((f) => patchToMark(f, null))
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .map((m) => m.k);
      const done = clearText(working, command.targets, kinds);
      working = done.section;
      touched = done.touched;
      blockedMarks.push(...done.refusals);
    } else {
      for (const [field, value] of Object.entries(command.patch)) {
        const patch = patchToMark(field, value);
        if (patch === null) continue;
        const done = markText(working, command.targets, patch);
        working = done.section;
        for (const id of done.touched) touched.add(id);
        blockedMarks.push(...done.refusals);
      }
    }
    /*
     * THE SOURCES, AS THE VERSES NOW HOLD THEM.
     *
     * A mark changes no text, so this is not an edit — but adopting a source
     * layer changes how a verse's text is WRITTEN DOWN. `sourcesOf` had
     * already stood the rendered text in for the verse (`linesFromTokens`),
     * and `writeSources` then compared that against the real source the verse
     * had just acquired, decided the text had changed, and charged the edit
     * two transcribed accents it never touched.
     */
    nextSources = sourcesOf(working);
  } else if (command.k === 'recompute') {
    /*
     * THE ONLY PLACE A MARKING RULE RUNS. See `recompute.ts`.
     *
     * It is not an edit to the text, so nothing is rebased and nothing is
     * re-derived afterwards: `recompute` returns the verses already rebuilt.
     * `touched` stays empty on purpose — handing these to `rederive` would run
     * the whole engine over them a second time and undo the mode the person
     * chose.
     */
    const here = new Set(section.verses.map((v) => v.id));
    const outside = command.verseIds.filter((id) => !here.has(id));
    if (outside.length > 0) return refuse(state, history, refusalForOutside(section, outside));

    const done = recompute(
      working,
      command.verseIds,
      command.stages,
      command.mode,
      (v) => resolveProfile(profileChain(v, section, state.doc.profile)),
    );
    working = done.section;
    nextSources = sourcesOf(working);
    blockedMarks.push(...done.refusals);
    for (const r of done.reports) {
      if (r.lost > 0) {
        blockedMarks.push(
          `verse "${r.verseId}": ${r.lost} marking(s) placed by hand could not be `
          + 'carried — the rules rewrote the letters they were on',
        );
      }
      for (const w of r.warnings) blockedMarks.push(`verse "${r.verseId}": ${w}`);
    }
  }

  /*
   * The text, and the markings carried across it. NO RULE RUNS HERE — see
   * `retext.ts`. Typing used to re-derive, and a derivation is the rules.
   */
  const written = writeSources(working, nextSources);
  const withSource = written.section;
  for (const cost of written.accentsLost) {
    blockedMarks.push(
      `${cost.count} marking(s) in verse "${cost.verseId}" were on letters this `
      + 'edit replaced, and went with them',
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

  /*
   * NOTHING IS RE-DERIVED. `touched` used to be handed to `rederive`, which
   * ran the whole engine over every verse an edit had reached — so one
   * keystroke put thirteen holdings back on a verse somebody had just
   * cleared. The rules run from `recompute` and from nowhere else, which is
   * why this is called with an empty set rather than not called: `rederive`
   * still returns the section, and removing it is §10.1's business.
   */
  const { section: derived, reports, refusals } = rederive(
    staged, withSource, new Set<string>(), overrides,
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
