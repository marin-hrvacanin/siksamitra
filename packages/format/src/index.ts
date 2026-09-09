/**
 * `@siksamitra/format` — the document format, and nothing else.
 *
 * This is the package vedaunion.org is allowed to depend on. It carries the
 * document model, its schemas, and the pure functions that read, slice,
 * normalise and hash a document. It carries NO rules: nothing here decides
 * where a holding goes or which anusvara treatment a recension takes. That is
 * `@siksamitra/engine`, and the platform must not have it.
 *
 * The test of whether something belongs here is simple: could a program that
 * only DISPLAYS a finished document need it? If yes it is format. If it is only
 * needed to PRODUCE a document, it is engine.
 */

// ── the profile reference a document carries ────────────────────────────────
export type { ChantProfileKey, ChantProfileRef, ChantProfileNote } from './profile-ref.js';
export { CHANT_PROFILE_NOTES, CHANT_PROFILE_KEYS } from './profile-ref.js';

// ── what a document SAYS: the conformance surface ───────────────────────────
export {
  recitationText, syllablesOf, syllableCount, holdingSpans, resolveSource,
  isAttested,
} from './text.js';
export type { HoldingSpan } from './text.js';

// ── the document model ──────────────────────────────────────────────────────
export * from './chant.js';

// ── a document as a file: read it, write it, or start an empty one ──────────
export {
  CHANT_FILE_FORMAT, blankChantDoc, readChantFile, writeChantFile,
} from './chant-file.js';
export type { ChantFileRead } from './chant-file.js';
export * from './chant-doc.js';
export * from './chant-vars.js';

/*
 * ONE TEXT AND MARKINGS ON IT — see `openspec/changes/text-and-marks`.
 *
 * The model that replaces `src` + `tokens`. It is exported alongside the old
 * shape rather than in place of it, because the corpus migrates under a gate
 * that compares the two and the comparison needs both.
 */
export {
  applyMark, assertMarks, compareMarks, coverage, mark, markFaults, marksAt,
  marksIn, normalise, POINT_KINDS, removeMark, shiftForEdit, STAGE_OF, toggleMark,
} from './mark.js';
export type { Mark, MarkFault, MarkInput, MarkKind, Stage, TextEdit } from './mark.js';
