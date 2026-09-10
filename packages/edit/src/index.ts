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
  VERSE_GAP, addressAt, caretAt, flatten, isCollapsed, lineBreakAt, lineEdge, moveChar,
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

/* A picture in a step: put one in, change one, take one out. */
export {
  applyFigureCommand, figureIdsIn, figureSectionsTouched, insertFigure,
  movedFigureIndex, moveFigure, nextFigureId, removeFigure, updateFigure,
  withFigureDefaults,
} from './figures.js';
export type { FigureApplied, FigureCommand, FigureResult } from './figures.js';

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

export {
  HISTORY_DEPTH, canRedo, canUndo, changesNothing, emptyHistory, record, restore,
  snapshot,
} from './history.js';
export type { History, Snapshot, Step } from './history.js';

export { apply, newState, redo, select, srcMapFor, undo } from './session.js';
export type { Applied, EditCommand, EditState } from './session.js';

// ── which register's rules govern a document ────────────────────────────────
export { registerOf, setProfile } from './set-profile.js';
export type { ProfileChange, ProfileResult } from './set-profile.js';
export {
  attestedInRange, named, refusalForEdit, refusalForMark, refusalForOutside,
} from './rule-zero.js';

/* Running the rules over a document's verses — the `recompute` command's work.
   The rules themselves are `rerun` in `@siksamitra/engine`. */
export { recompute } from './recompute.js';
export type { Recomputed, RecomputeReport } from './recompute.js';

/* A text edit that runs no rule: the markings are carried across it and the
   syllables rebuilt. See `retext.ts`. */
export { retext } from './retext.js';
export type { Retexted } from './retext.js';

/* Placing a marking by hand, straight onto the text — bold's behaviour, over a
   range, on every verse alike. See `mark-text.ts`. */
export { clearText, markText, patchToMark, toggleText } from './mark-text.js';
export type { MarkPatchText, MarkTextResult } from './mark-text.js';
