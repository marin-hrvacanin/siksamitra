/**
 * `@siksamitra/edit` — what an edit IS, with no opinion about what draws it.
 *
 * Pure: no React, no DOM, no storage, no clock. A keystroke is a value, a
 * document change is a function of two values, and undo is a recorded pair of
 * them. That is what lets the editing surface be tested without a browser —
 * and it is the whole difference from v1, where the answer to "what does this
 * key do" was inside a 720 KB file and a Quill delta.
 *
 * The layering, outermost first:
 *
 *   session   one command in, a new document and a report out
 *   sync      keeping source, marks and tokens in step, in that order
 *   range     the only function that alters a verse's source text
 *   marks     hand-placed marks, as overrides in source coordinates
 *   rebase    keeping those marks attached when the text moves
 *   holdings  the four box invariants, checked and repaired
 *   caret     addressing: a flat section offset ↔ (verse, line, column)
 *   diff      recovering what an edit did, so a rebase can be exact
 */

export {
  VERSE_GAP, addressAt, caretAt, flatten, isCollapsed, lineEdge, moveChar,
  moveLine, moveWord, offsetOf, selectAll, selectionRange, versesInSelection,
} from './caret.js';
export type { CaretAddress, FlatSource, LineStart, Selection, VerseSource } from './caret.js';

export { alignArrays, contiguousDiff } from './diff.js';
export type { Replacement } from './diff.js';

export { assertHoldings, holdingProblems, normaliseHoldings } from './holdings.js';
export type { HoldingProblem } from './holdings.js';

export { canonicalInsert, editLine, rebase, rebaseLines } from './rebase.js';
export type { LineEdit, RebaseResult } from './rebase.js';

export { replaceRange, splitLine, splitVerse } from './range.js';
export type { RangeEdit, RangeResult } from './range.js';

export {
  autoHoldings, clearMarks, markLetters, overridesFor, sourceAddress,
} from './marks.js';
export type { MarkPatch, MarkReason, UnitAddress } from './marks.js';

export { deriveVerse, profileChain, verseSrcMap } from './derive-verse.js';
export type { DeriveVerseResult, VerseReport } from './derive-verse.js';

export {
  changedVerses, linesFromTokens, rebaseSection, rederive, sourcesOf, writeSources,
} from './sync.js';
export type { LostMark } from './sync.js';

export { canRedo, canUndo, emptyHistory, record, restore, snapshot } from './history.js';
export type { History, Snapshot, Step } from './history.js';

export { apply, newState, redo, select, srcMapFor, undo } from './session.js';
export type { Applied, EditCommand, EditState } from './session.js';
