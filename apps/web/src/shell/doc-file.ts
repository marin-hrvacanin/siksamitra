/**
 * The document's life as a file: is it dirty, what is it called, and what has
 * to be asked before it is thrown away.
 *
 * Pure, and that is the point. Every one of these decisions used to be
 * unreachable except by clicking: whether a save had actually made the
 * document clean, whether Cancel really cancelled, what the window bar should
 * say. None of it needs React, a disk or a dialog to be wrong.
 *
 * DIRTY IS DERIVED FROM THE UNDO HISTORY, never tracked beside it.
 *
 * A second boolean set by every command is a second thing that can disagree
 * with the document — and it disagrees in exactly the case that matters:
 * typing a word, saving, pressing Ctrl+Z twice and Ctrl+Y twice leaves a
 * document identical to the one on disk, which a flag would still call
 * modified, and a document one keystroke different, which it would call
 * modified too. The history already records where in the edit sequence we are;
 * a save records that position, and dirty is "we are somewhere else".
 *
 * THE POSITION IS A DEPTH *AND* A STEP, and the step is not redundant. Depth
 * alone is wrong on a branch: save at depth 3, undo twice, type something —
 * the redo future is discarded and the new step lands at depth 3 again, so a
 * depth comparison calls a document with different text clean. The `Step`
 * objects are created fresh by `record`, so comparing the one on top catches
 * it: same depth, different step, still dirty.
 */
import type { ChantDoc } from '@siksamitra/format';
import type { History, Step } from '@siksamitra/edit';
import type { RecentKind } from './recents.js';

/** Where in the edit sequence the document on disk was written from. */
export interface SavePoint {
  readonly depth: number;
  /** The step that produced it, or `null` at the start of the history. */
  readonly step: Step | null;
}

/** The point the history is at now — what a save records. */
export const savePointOf = (history: History): SavePoint => ({
  depth: history.past.length,
  step: history.past[history.past.length - 1] ?? null,
});

/** Has the document moved since it was last written? */
export function isDirty(history: History, saved: SavePoint): boolean {
  if (history.past.length !== saved.depth) return true;
  return (history.past[history.past.length - 1] ?? null) !== saved.step;
}

/* ==========================================================================
   The guard
   ========================================================================== */

/**
 * What somebody asked for while the document had unsaved changes.
 *
 * Held whole rather than as a callback, because it has to survive the round
 * trip through the dialog: the answer arrives from a button press one render
 * later, and by then nothing remembers which of the four ways out of the
 * document was taken unless it was written down.
 */
export type PendingAction =
  | { readonly k: 'new' }
  | { readonly k: 'open' }
  /** A document that ships with the program, or a row in Recent. The kind
   *  travels with the ref because only it says who can read one: a slug is
   *  fetched, a path is read off the disk. */
  | { readonly k: 'switch'; readonly ref: string; readonly kind: RecentKind }
  /** A document an importer has already produced — a `.smdoc`, a `.docx`. It
   *  travels inside the action because by the time the question is asked the
   *  file has been read, and reading it again after the answer would ask the
   *  operating system for a file the person chose a dialog ago. */
  | { readonly k: 'import'; readonly doc: ChantDoc; readonly name: string }
  | { readonly k: 'close' };

export type GuardAnswer = 'save' | 'discard' | 'cancel';

export interface GuardPlan {
  /** Write the document before doing anything else. */
  readonly save: boolean;
  /** Carry out the action that was held. */
  readonly proceed: boolean;
}

/**
 * What an answer means.
 *
 * Cancel proceeds with NOTHING — not "proceed without saving", which is what a
 * two-state boolean turns it into and is the bug this whole module exists to
 * make impossible. Discard is the destructive answer and is the only one that
 * proceeds without writing.
 */
export function planFor(answer: GuardAnswer): GuardPlan {
  if (answer === 'save') return { save: true, proceed: true };
  if (answer === 'discard') return { save: false, proceed: true };
  return { save: false, proceed: false };
}

/**
 * What happens once the question is answered.
 *
 * Shown under the buttons, because "Save the changes?" alone does not say what
 * the person is about to lose the document TO — and the four ways out are not
 * interchangeable: one of them closes the window.
 */
export function guardOutcome(action: PendingAction): string {
  switch (action.k) {
    case 'new': return 'A new document will open in its place.';
    case 'open': return 'Another document will open in its place.';
    case 'switch': return 'Another document will open in its place.';
    case 'import': return `${action.name} will open in its place.`;
    case 'close': return 'The window will then close.';
  }
}

/* ==========================================================================
   Names
   ========================================================================== */

/** What a document that has never been saved is called. */
export const UNTITLED = 'Untitled';

/**
 * The window's title.
 *
 * The bullet before the name, which is what VS Code, Sublime and TextMate all
 * do, rather than "(modified)" after it: the name is the thing being scanned
 * in a task bar, and a suffix is the half that gets truncated away.
 */
export const windowTitle = (name: string, dirty: boolean): string =>
  `${dirty ? '• ' : ''}${name === '' ? UNTITLED : name} — śikṣāmitra`;

/**
 * A file name that is safe on all three platforms, from a document's title.
 *
 * Titles here are Sanskrit in IAST, so anything that is a letter or a digit in
 * ANY script survives — `\p{L}` rather than `[a-z]`, or `Śrī Rudram` would be
 * saved as `_r_ _udram`. Everything a filesystem objects to becomes `_`.
 */
export const fileNameFor = (title: string, ext: string): string =>
  `${(title.trim() === '' ? 'document' : title).replace(/[^\p{L}\p{N} .-]/gu, '_')}.${ext}`;

/**
 * The name of a document at a ref, for the title bar.
 *
 * A ref is a path on the desktop and a slug in the browser, and both arrive as
 * one opaque string — so the separator is whichever of the two appears, not
 * the one this platform happens to use. A file picked on Windows and reopened
 * from a recents list synced to a Mac still has backslashes in it.
 */
export const baseNameOf = (ref: string): string => ref.split(/[\\/]/).pop() ?? ref;
