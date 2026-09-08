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
 *   rebase    keeping those marks attached when the text moves, in FLAT
 *             coordinates — one arithmetic pass that cannot double-count
 *   holdings  the box invariants, checked and repaired
 *   caret     addressing: a flat section offset ↔ (verse, line, column)
 *
 * There was a `diff` module here that aligned old lines to new ones and
 * recovered the edit by comparing them. It is gone: the alignment was a
 * heuristic, and two separate defects came out of it — pasting a line above
 * four marked lines collapsed all four marks onto one, and replacing a whole
 * section kept every verse id so three recordings silently re-pointed at
 * unrelated text. An edit's RANGE is known exactly at the point it is applied,
 * so nothing needs to be inferred from the result.
 */

export {
  VERSE_GAP, addressAt, caretAt, flatten, isCollapsed, lineEdge, moveChar,
  moveLine, moveWord, offsetOf, offsetOrStart, selectAll, selectionRange,
  versesInSelection,
} from './caret.js';
export type { CaretAddress, FlatSource, LineStart, Selection, VerseSource } from './caret.js';

export { assertHoldings, holdingProblems, normaliseHoldings } from './holdings.js';
export type { HoldingProblem } from './holdings.js';

export { canonicalInsert, editLine, rebaseFlat } from './rebase.js';
export type { FlatEdit, RebaseResult } from './rebase.js';

export {
  isEmpty, pruneEmpty, replaceRange, splitLine, splitVerse, verseExtents,
} from './range.js';
export type { RangeEdit, RangeResult } from './range.js';

export {
  autoHoldings, clearMarks, markLetters, overridesFor, sourceAddress,
} from './marks.js';
export type { MarkPatch, MarkReason, UnitAddress } from './marks.js';

export { adoptSource, unitsOf } from './adopt-source.js';
export { markUnits } from './mark-tokens.js';
export { tokenSrcMap } from './token-src-map.js';
export type { AdoptResult } from './adopt-source.js';

export { deriveVerse, profileChain, verseSrcMap } from './derive-verse.js';
export type { DeriveVerseResult, VerseReport } from './derive-verse.js';

export {
  changedVerses, linesFromTokens, rebaseSection, rederive, sourcesOf, writeSources,
} from './sync.js';
export type { LostMark, WriteResult } from './sync.js';

export { accentsIn, carryWitness, editWitness } from './witness.js';

export { canRedo, canUndo, emptyHistory, record, restore, snapshot } from './history.js';
export type { History, Snapshot, Step } from './history.js';

export { apply, newState, redo, select, srcMapFor, undo } from './session.js';
export type { Applied, EditCommand, EditState } from './session.js';

// ── which register's rules govern a document ────────────────────────────────
export { registerOf, setProfile } from './set-profile.js';
export type { ProfileChange, ProfileResult } from './set-profile.js';
export {
  attestedInRange, named, refusalForEdit, refusalForMark, refusalForOutside,
} from './rule-zero.js';
