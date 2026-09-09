/**
 * The editing session, as React sees it.
 *
 * The document, the caret and the history live here; all of the logic lives in
 * `@siksamitra/edit`, which knows nothing about React. This file is the impure
 * half — state, a clock, and a cache — kept deliberately small, because every
 * line of editing logic that leaks into a hook is a line that can only be
 * tested by rendering something.
 *
 * Two impure things it owns, and they belong here rather than in the pure
 * layer:
 *
 *   THE CLOCK. Twenty keystrokes inside a word are one undo step in Word, and
 *   what decides that is elapsed time. `apply` takes a coalesce key and never
 *   reads a clock; this hook produces the key.
 *
 *   THE SOURCE-MAP CACHE. A source map costs one derivation, and the caret
 *   needs one every time it moves. Cached per verse, keyed by the verse's
 *   source, so an edit invalidates exactly the verse it changed and nothing
 *   else.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChantDoc, ChantProfileKey } from '@siksamitra/format';
import type { ReRunMode, SrcMap } from '@siksamitra/engine';
import {
  apply, emptyHistory, flatten, newState, redo, registerOf, select, sourcesOf, undo,
  type EditCommand, type EditState, type FlatSource, type History, type Selection,
} from '@siksamitra/edit';
import { selectedUnits, type UnitRange } from './selection.js';
import { useMarks, type HoldState, type MarkField } from './useMarks.js';
import { useSourceMaps } from './useSourceMaps.js';
import { useFigures, type Figures } from './useFigures.js';
import { useText } from './useText.js';
import { useRegister } from './useRegister.js';
import { useSetRecording } from './useSetRecording.js';

/** How long a burst of typing stays one undo step. Word's feel, roughly. */
const COALESCE_MS = 900;


/** The mark fields a hand edit may set or withdraw. Mirrors the engine's
 *  `OverrideField`, named here so the toolbar can type its buttons. */
/* The list itself lives with the commands that use it. Re-exported because
   the keymap and the ribbon both name it. */
export type { HoldState, MarkField } from './useMarks.js';

export interface Session {
  doc: ChantDoc;
  /** The section the caret is in. A caret is bounded by one — see `caret.ts`. */
  sectionId: string;
  selection: Selection | null;
  /** The section's source as one string, plus the map back to verse and line.
   *  The surface needs it to turn a click into an offset. */
  flat: FlatSource;
  /** The letters currently selected, per verse. Drives both the highlight and
   *  what a mark command applies to, so they cannot disagree. */
  selected: UnitRange[];
  srcMapOf: (verseId: string) => SrcMap | null;
  /** The same, for a verse in a named section — a click can land in any. */
  srcMapIn: (sectionId: string, verseId: string) => SrcMap | null;
  /** The flat source of any section, for turning a click into an offset. */
  flatFor: (sectionId: string) => FlatSource;
  /**
   * Bumped by every command that changes the document.
   *
   * The paged view re-measures when its content key changes, and that key was
   * built from the document's NAME and the view settings — so it never changed
   * while typing, and the pages kept the heights measured before the edit. 480
   * characters went in and the page count stayed at three.
   */
  revision: number;
  /** True while an IME is composing. Escape must not leave edit mode then. */
  composing: () => boolean;
  setComposing: (on: boolean) => void;

  editing: boolean;
  setEditing: (on: boolean) => void;

  setSelection: (selection: Selection | null, sectionId?: string) => void;

  insert: (text: string) => void;
  remove: (direction: 1 | -1) => void;
  /**
   * Replace an exact range of the section's source.
   *
   * The surface needs this because the BROWSER decides what a word-wise delete
   * covers — it knows the font and where the lines wrapped — and hands us the
   * range in `beforeinput`. Re-deriving that range here would be a second,
   * worse implementation of the browser's own text segmentation.
   */
  replaceRange: (
    from: number,
    to: number,
    text: string,
    /* What kind of burst this belongs to, so consecutive ones become one undo
       step. `drag` is shared by the delete and the drop of a move, which is
       one act however many events the browser sends for it. */
    kind?: 'type' | 'delete' | 'drag',
  ) => void;
  newLine: (verse: boolean) => void;

  mark: (patch: Record<string, unknown>, note?: string) => void;
  unmark: (fields: readonly MarkField[]) => void;
  /**
   * Run the marking rules over the selection, or the whole step.
   *
   * The ONLY thing in the window that invokes the engine. Nothing else does —
   * not typing, not opening a document, not changing the script.
   */
  reapplyRules: (mode: ReRunMode) => void;
  /** What the selection is carrying, so a holding button can show it. */
  holdState: HoldState;
  /** Press a holding button on letters that already have it, and it comes off. */
  toggleHold: (value: 'short' | 'long') => void;

  /**
   * THE PICTURES — which one is selected, and every change to one.
   *
   * A whole object rather than eight more members, because a picture is its
   * own subject: the ribbon group takes this and needs nothing else, and the
   * rest of the session does not have to grow when a picture gains an axis.
   */
  figures: Figures;

  /**
   * WHICH REGISTER'S RULES GOVERN THE TEXT.
   *
   * `null` scope-wide means "name none here and follow what is above".
   * Returns the sentence to show, because the caller is the only one that
   * knows where a sentence goes and this command's whole point is that it
   * says how much it moved.
   */
  register: ChantProfileKey | null;
  sectionRegister: ChantProfileKey | null;
  setRegister: (scope: 'document' | 'section', preset: ChantProfileKey | null) => string;

  /**
   * Put a mapping of the recitation into the document, as one undoable step.
   *
   * Takes a whole document rather than the mapping alone because that is what
   * `writeMapping` returns, and re-deriving the difference here would be a
   * second implementation of something already done correctly once.
   */
  setRecording: (next: ChantDoc) => void;

  /**
   * Bumped to make React BUILD THE DOCUMENT AGAIN rather than patch it.
   *
   * Needed exactly once, and the reason is worth stating because it looks like
   * a hack and is not. While an IME composes, the browser writes its own text
   * into the page — that is what an inline candidate is — and React knows
   * nothing about it. Re-rendering then PATCHES a tree it has a stale picture
   * of, and the browser's characters survive beside the model's: composing
   * "na" and committing it left "nana" on the page.
   *
   * A remount throws the browser's work away and rebuilds from the document,
   * which is the only source of truth there is. It is expensive and it happens
   * once per composition, at human speed.
   */
  remount: number;
  rebuild: () => void;

  undoEdit: () => void;
  redoEdit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** The history, for the one thing that needs a POSITION in it and not a
   *  yes/no: unsaved changes. The arithmetic is in `shell/doc-file.ts`. */
  history: History;

  /** What the last command did. Never inferred, always reported. */
  refusals: string[];
  lostMarks: EditState['lostMarks'];
  orphaned: string[];
}

/**
 * The document and its history, in ONE piece of state.
 *
 * Two `useState`s would be a stale-closure trap: a command reads the history
 * to record its step, and with the two stored separately a second command in
 * the same tick reads the history as it was before the first — which loses an
 * undo step, silently, only under fast typing. One object, one update.
 */
interface Live {
  state: EditState;
  history: History;
}

export function useSession(doc: ChantDoc): Session {
  const [live_, setLive] = useState<Live>(() => ({
    state: newState(doc), history: emptyHistory(),
  }));
  const [sectionId, setSectionId] = useState<string>(() => doc.sections[0]?.id ?? '');
  /*
   * OPEN READY TO WRITE.
   *
   * It opened read-only, and the cost was two complaints in one sitting: half
   * the ribbon greyed out with no way to tell why, and "writing and editing
   * text doesn't work at all" — because keystrokes went nowhere until you
   * found the mode switch. A word processor opens ready to type.
   *
   * The safety that matters is not the mode: it is rule zero, which refuses an
   * edit that reaches a transcribed verse, by name, whatever the mode says.
   * `Read` is still there for proofing, one click away.
   */
  const [editing, setEditing] = useState(true);
  const [remount, setRemount] = useState(0);
  const [revision, setRevision] = useState(0);
  const composing = useRef(false);

  // A new document replaces everything, history included: an undo across two
  // documents would restore a section into the wrong one.
  const opened = useRef(doc);
  if (opened.current !== doc) {
    /*
     * The state update FIRST, the ref second. React may discard a render, and
     * the ref write would survive it while the state update would not — so the
     * new document would silently never install.
     */
    setLive({ state: newState(doc), history: emptyHistory() });
    setSectionId(doc.sections[0]?.id ?? '');
    opened.current = doc;
  }

  const state = live_.state;
  const live = state.doc;
  const section = useMemo(
    () => live.sections.find((s) => s.id === sectionId) ?? live.sections[0],
    [live, sectionId],
  );
  const flat = useMemo(
    () => flatten(section === undefined ? [] : sourcesOf(section)),
    [section],
  );

  /* Flattening a section and deriving a verse's source map are the two things
     the caret asks for on every pointer move — cached, in `useSourceMaps`. */
  const { flatFor, srcMapIn, srcMapOf } = useSourceMaps(live, sectionId);

  const selected = useMemo(
    () => (state.selection === null ? [] : selectedUnits(flat, state.selection, srcMapOf)),
    [flat, state.selection, srcMapOf],
  );

  const run = useCallback((command: EditCommand) => {
    setLive((current) => apply(current.state, current.history, command));
    setRevision((n) => n + 1);
  }, []);

  /**
   * SAY WHY NOTHING HAPPENED.
   *
   * A command that finds nothing to do used to return in silence, and the
   * commonest way to meet that is also the least obvious: five of Durgā
   * Sūktam's nine verses are copied from a marked source, so a selection made
   * anywhere in most of the document reaches no editable letter. The page
   * showed a highlight, the button did nothing, and the program said nothing —
   * which reads as broken rather than as refused.
   *
   * It is not a document change, so it is not an undo step; it only replaces
   * what the status bar is saying.
   */
  const refuse = useCallback((why: string) => {
    setLive((current) => ({
      ...current,
      state: { ...current.state, refusals: [why], reports: [], lostMarks: [] },
    }));
  }, []);

  const setSelection = useCallback((selection: Selection | null, id?: string) => {
    if (id !== undefined && id !== sectionId) setSectionId(id);
    setLive((current) => ({ ...current, state: select(current.state, selection) }));
  }, [sectionId]);

  /*
   * MOTION IS THE BROWSER'S NOW, so there is none here.
   *
   * There was a `moveCaret` — arrows, word motion, line ends, with a
   * remembered goal column for moving down through a short pāda. It was
   * correct and it is gone, because the page is `contenteditable` and the
   * browser already knows where a line wrapped and what a word is in this
   * font. Keeping ours as well meant both ran: the model advanced and the
   * visible caret did not, and the next letter typed appeared somewhere the
   * caret had never been.
   */

  /** The coalesce key, and the clock that decides it. */
  const burst = useRef({ key: '', at: 0 });
  const coalesceKey = useCallback((kind: string): string => {
    const now = Date.now();
    if (burst.current.key.startsWith(kind) && now - burst.current.at < COALESCE_MS) {
      burst.current.at = now;
      return burst.current.key;
    }
    burst.current = { key: `${kind}-${now}`, at: now };
    return burst.current.key;
  }, []);

  /* Changing the text — see `useText`. Four commands that all reduce to one
     range replacement, kept together because the coalescing rule that makes a
     burst of typing one undo step has to be the same for all of them. */
  const { replace, insert, remove, newLine } = useText({
    run, section, flat, selection: state.selection, coalesceKey,
  });

  /* Placing marks by hand is its own small module — see `useMarks`. It is the
     one part of this hook that is about the MARKING rather than about the
     text, and it is the part a reader comes looking for. */
  const {
    mark, unmark, reapplyRules, holdState, toggleHold,
  } = useMarks({
    run, refuse, section, selected, selection: state.selection, srcMapOf,
  });

  const undoEdit = useCallback(() => {
    setLive((current) => undo(current.state, current.history));
    setRevision((n) => n + 1);
  }, []);

  const redoEdit = useCallback(() => {
    setLive((current) => redo(current.state, current.history));
    setRevision((n) => n + 1);
  }, []);

  /* A picture is a section ITEM, so it needs the section the caret is in and
     the verse it is in — that is where a new one lands. */
  const figures = useFigures({
    run,
    doc: live,
    sectionId: section?.id ?? '',
    verseId: state.selection?.head.verseId,
  });

  const setRegister = useRegister(setLive, setRevision, sectionId);
  const setRecording = useSetRecording(setLive, setRevision);

  return {
    doc: live,
    sectionId: section?.id ?? '',
    selection: state.selection,
    flat,
    selected,
    srcMapOf,
    srcMapIn,
    flatFor,
    revision,
    composing: () => composing.current,
    setComposing: (on: boolean) => { composing.current = on; },
    editing,
    setEditing,
    setSelection,
    insert,
    remove,
    replaceRange: (from, to, text, kind) => replace(from, to, text, kind),
    newLine,
    mark,
    unmark,
    reapplyRules,
    holdState,
    toggleHold,
    figures,
    register: registerOf(live),
    sectionRegister: section === undefined ? null : registerOf(live, section),
    setRegister,
    setRecording,
    remount,
    rebuild: () => setRemount((n) => n + 1),
    undoEdit,
    redoEdit,
    canUndo: live_.history.past.length > 0,
    canRedo: live_.history.future.length > 0,
    history: live_.history,
    refusals: state.refusals,
    lostMarks: state.lostMarks,
    orphaned: state.orphaned,
  };
}
