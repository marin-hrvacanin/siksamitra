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

/* A picture in a document — the vocabularies, the byte rules and the walk that
   finds every one. See `figure.ts` for why the bytes are inside the file. */
export {
  documentFigureFaults, figureBytes, figureFaults, figuresOf, imageDataUri,
  imageMediaType, isEmbeddedImage,
  FIGURE_CAPTION_AT, FIGURE_CROPS, FIGURE_DEFAULTS, FIGURE_FLOWS, FIGURE_FRAMES,
  FIGURE_MAX_BYTES, FIGURE_MEDIA_TYPES, FIGURE_SIZES,
} from './figure.js';
export type { FigureAt, FigureCaptionAt, FigureCrop, FigureFrame } from './figure.js';

/*
 * ONE TEXT AND MARKINGS ON IT — see `openspec/changes/text-and-marks`.
 *
 * The model that replaces `src` + `tokens`. It is exported alongside the old
 * shape rather than in place of it, because the corpus migrates under a gate
 * that compares the two and the comparison needs both.
 */
export {
  assertMarks, compareMarks, mark, markFaults,
  MERGING_KINDS, POINT_KINDS, sameValue, STAGE_OF,
} from './mark.js';
export type { Mark, MarkFault, MarkInput, MarkKind, Stage } from './mark.js';
export {
  applyMark, coverage, marksAt, marksIn, normalise, removeMark, shiftForEdit, toggleMark,
} from './mark-ops.js';
export type { TextEdit } from './mark-ops.js';
/* The stored form of a marking. One encoder, one decoder — see `mark-codec.ts`
   for what it omits and why, and for the measurements behind the tuple. */
export { decodeMark, decodeMarks, encodeMark, encodeMarks } from './mark-codec.js';
export type { StoredMark } from './mark-codec.js';

/* Tokens ⇄ text and markings, and the round trip that proves it loses nothing. */
export { toTextAndMarks, toTokens } from './migrate.js';
/* `TokenHelp` is on the surface because `toTokens` cannot be called without
   it: a caller has to supply the letter division and the other scripts, and
   both belong to the engine, which sits above this package. It was internal,
   so the conversion was reachable only from code that could re-declare the
   type — the audit tool and nothing else. */
export type { TextAndMarks, TokenHelp } from './migrate.js';

/* The edits between two texts, so markings can be moved across a change that
   is not one contiguous replacement. See `text-diff.ts`. */
export { textEdits } from './text-diff.js';
export type { TextEdit3 } from './text-diff.js';
export { splitsCharacter } from './mark.js';
export { figureBlockers, figureNudges } from './figure.js';
export { FIGURE_MAX_PCT, FIGURE_MIN_PCT } from './figure.js';
