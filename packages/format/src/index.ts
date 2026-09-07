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
export * from './chant-doc.js';
export * from './chant-vars.js';
