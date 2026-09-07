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
import type { ChantDoc } from '@siksamitra/format';
import type { SrcMap } from '@siksamitra/engine';
import {
  apply, caretAt, emptyHistory, flatten, isCollapsed, lineEdge, moveChar, moveLine,
  moveWord, newState, redo, select, selectionRange, sourcesOf, srcMapFor, undo,
  type EditCommand, type EditState, type FlatSource, type History, type Selection,
} from '@siksamitra/edit';
import { selectedUnits, unitAddresses, unitAtCaret, type UnitRange } from './selection.js';

/** How long a burst of typing stays one undo step. Word's feel, roughly. */
const COALESCE_MS = 900;

export type Move = 'char' | 'word' | 'line' | 'lineEdge';

/** The mark fields a hand edit may set or withdraw. Mirrors the engine's
 *  `OverrideField`, named here so the toolbar can type its buttons. */
export type MarkField =
  | 'hold' | 'hg' | 'svara' | 'change' | 'sup' | 'candra' | 'sbhakti' | 'dirgha';

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

  editing: boolean;
  setEditing: (on: boolean) => void;

  setSelection: (selection: Selection | null, sectionId?: string) => void;
  moveCaret: (move: Move, direction: 1 | -1, extend: boolean) => void;

  insert: (text: string) => void;
  remove: (direction: 1 | -1) => void;
  newLine: (verse: boolean) => void;

  mark: (patch: Record<string, unknown>, note?: string) => void;
  unmark: (fields: readonly MarkField[]) => void;
  autoHoldings: (mode: 'keep' | 'replace') => void;

  undoEdit: () => void;
  redoEdit: () => void;
  canUndo: boolean;
  canRedo: boolean;

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
  const [editing, setEditing] = useState(false);

  // A new document replaces everything, history included: an undo across two
  // documents would restore a section into the wrong one.
  const opened = useRef(doc);
  if (opened.current !== doc) {
    opened.current = doc;
    setLive({ state: newState(doc), history: emptyHistory() });
    setSectionId(doc.sections[0]?.id ?? '');
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

  /** Source maps, cached by the verse's source text. */
  const cache = useRef(new Map<string, { key: string; map: SrcMap | null }>());
  const srcMapOf = useCallback((verseId: string): SrcMap | null => {
    const verse = section?.verses.find((v) => v.id === verseId);
    if (section === undefined || verse === undefined) return null;
    const key = (verse.src?.lines ?? []).join('\n');
    const hit = cache.current.get(verseId);
    if (hit !== undefined && hit.key === key) return hit.map;
    const map = srcMapFor(live, section.id, verseId);
    cache.current.set(verseId, { key, map });
    return map;
  }, [live, section]);

  const selected = useMemo(
    () => (state.selection === null ? [] : selectedUnits(flat, state.selection, srcMapOf)),
    [flat, state.selection, srcMapOf],
  );

  const run = useCallback((command: EditCommand) => {
    setLive((current) => apply(current.state, current.history, command));
  }, []);

  const setSelection = useCallback((selection: Selection | null, id?: string) => {
    if (id !== undefined && id !== sectionId) setSectionId(id);
    setLive((current) => ({ ...current, state: select(current.state, selection) }));
  }, [sectionId]);

  const moveCaret = useCallback((move: Move, direction: 1 | -1, extend: boolean) => {
    setLive(({ state: current, history }) => {
      if (current.selection === null) return { state: current, history };
      const head = current.selection.head;
      const next = move === 'char' ? moveChar(flat, head, direction)
        : move === 'word' ? moveWord(flat, head, direction)
          : move === 'line' ? moveLine(flat, head, direction, goal.current ?? head.column)
            : lineEdge(flat, head, direction === 1 ? 'end' : 'start');
      // The goal column is remembered ACROSS vertical moves only: moving
      // sideways sets it, moving down keeps it. Word's behaviour, and the
      // reason arrow-down through a one-syllable pāda comes back out again.
      goal.current = move === 'line' ? (goal.current ?? head.column) : next.column;
      return {
        history,
        state: select(
          current,
          extend ? { anchor: current.selection.anchor, head: next } : caretAt(next),
        ),
      };
    });
  }, [flat]);
  const goal = useRef<number | null>(null);

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

  const replace = useCallback((from: number, to: number, insert: string, kind?: string) => {
    if (section === undefined) return;
    run({
      k: 'replace',
      sectionId: section.id,
      from,
      to,
      insert,
      ...(kind === undefined ? {} : { coalesce: coalesceKey(kind) }),
    });
  }, [run, section, coalesceKey]);

  const insert = useCallback((text: string) => {
    if (state.selection === null) return;
    const { from, to } = selectionRange(flat, state.selection);
    replace(from, to, text, text.includes('\n') ? undefined : 'type');
  }, [flat, state.selection, replace]);

  const remove = useCallback((direction: 1 | -1) => {
    if (state.selection === null) return;
    const range = selectionRange(flat, state.selection);
    if (!isCollapsed(state.selection)) {
      replace(range.from, range.to, '', 'delete');
      return;
    }
    // A collapsed caret deletes the character beside it. `from === to === 0`
    // with Backspace deletes nothing rather than wrapping to the end.
    const from = direction === -1 ? Math.max(0, range.from - 1) : range.from;
    const to = direction === -1 ? range.from : Math.min(flat.text.length, range.to + 1);
    if (from === to) return;
    replace(from, to, '', 'delete');
  }, [flat, state.selection, replace]);

  const newLine = useCallback((verse: boolean) => {
    if (state.selection === null) return;
    const { from, to } = selectionRange(flat, state.selection);
    replace(from, to, verse ? '\n\n' : '\n');
  }, [flat, state.selection, replace]);

  const targets = useCallback(() => {
    if (state.selection === null || section === undefined) return [];
    if (selected.length > 0) return unitAddresses(selected);
    const one = unitAtCaret(state.selection, srcMapOf(state.selection.head.verseId));
    return one === null ? [] : [one];
  }, [state.selection, section, selected, flat, srcMapOf]);

  const mark = useCallback((patch: Record<string, unknown>, note?: string) => {
    const where = targets();
    if (where.length === 0 || section === undefined) return;
    run({
      k: 'mark',
      sectionId: section.id,
      targets: where,
      patch,
      why: 'owner-hand',
      ...(note === undefined ? {} : { note }),
    });
  }, [run, section, targets]);

  const unmark = useCallback((fields: readonly MarkField[]) => {
    const where = targets();
    if (where.length === 0 || section === undefined) return;
    run({ k: 'unmark', sectionId: section.id, targets: where, fields });
  }, [run, section, targets]);

  const autoHoldings = useCallback((mode: 'keep' | 'replace') => {
    if (section === undefined) return;
    const verseIds = selected.length > 0
      ? [...new Set(selected.map((r) => r.verseId))]
      : section.verses.filter((v) => v.src !== undefined).map((v) => v.id);
    run({ k: 'auto-holdings', sectionId: section.id, verseIds, mode });
  }, [run, section, selected]);

  const undoEdit = useCallback(() => {
    setLive((current) => undo(current.state, current.history));
  }, []);

  const redoEdit = useCallback(() => {
    setLive((current) => redo(current.state, current.history));
  }, []);

  return {
    doc: live,
    sectionId: section?.id ?? '',
    selection: state.selection,
    flat,
    selected,
    srcMapOf,
    editing,
    setEditing,
    setSelection,
    moveCaret,
    insert,
    remove,
    newLine,
    mark,
    unmark,
    autoHoldings,
    undoEdit,
    redoEdit,
    canUndo: live_.history.past.length > 0,
    canRedo: live_.history.future.length > 0,
    refusals: state.refusals,
    lostMarks: state.lostMarks,
    orphaned: state.orphaned,
  };
}
