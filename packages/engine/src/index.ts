/**
 * `@vedaunion/shared/marking` — the one marking engine.
 *
 * Pure, isomorphic TypeScript: the browser, Node, the CLI and the desktop app
 * all run this same code. No I/O, no mutable module state, no document-specific
 * branches. If a text needs different behaviour that is a `Profile` field or a
 * rule flag — never an `if (slug === …)`.
 *
 * Specification: specs/chant-editor/02-ENGINE.md and 02A-MARKS.md.
 * The rules themselves are transcribed from docs/MARKING-RULES.md, which cites
 * Śikṣāmitra's `sanskrit_rules.js` line by line.
 *
 * This surface is deliberately small. Internals stay internal so they can be
 * refactored without breaking callers.
 */

// ── derivation ──────────────────────────────────────────────────────────────
export { derive, mark } from './pipeline.js';
export type { Derivation, DeriveSource, DeriveOptions, SrcMap } from './pipeline.js';

// ── recovering a source from the marks ─────────────────────────────────────
export { invertVerse } from './invert.js';
export type { InvertedSource } from './invert.js';

// ── the author's hand, over the rules ───────────────────────────────────────
export { applyOverrides, isOverrideField } from './overrides.js';
export type { OverrideField, OverrideResult } from './overrides.js';

// ── parametrization ─────────────────────────────────────────────────────────
export { PROFILES, DEFAULT_PROFILE, resolveProfile } from './profile.js';
export type {
  Profile, ProfileKey, ChantProfileRef, Recension, MeterKey, SvaraRegister,
} from './profile.js';

// ── the rules, as data ──────────────────────────────────────────────────────
export { RULES, STAGE_ORDER, isEnabled } from './rules/index.js';
export type { Rule, Stage, RuleCtx, Trace, Warning } from './rules/types.js';
export { SVARA_PLANS, parsePlan, formatPlan } from './rules/svara.js';
export { witnessLine } from './rules/witness.js';
export type { SvaraPlan, SvaraPosition } from './rules/svara.js';

// ── text ────────────────────────────────────────────────────────────────────
export { normalize, norm } from './normalize.js';
export type { Normalisation, NormalizeResult } from './normalize.js';
export { lex } from './lex.js';
export type { Elem, ElemKind, SrcSpan, LexResult } from './lex.js';
export { syllabify, nucleusCount } from './syllable.js';
export { emit, emitWithSpans, unitOf } from './emit.js';
export type { EmitResult } from './emit.js';

// ── word surfaces and their analyses ────────────────────────────────────────
export {
  GRAM_FIELDS, blankEntry, detectJoins, dictionaryUrl, expandJoins, headword,
  joinRun, pruneEntry, surfacesOf, wordsAlign,
} from './words.js';
export type { Surface } from './words.js';

// ── scripts ─────────────────────────────────────────────────────────────────
export {
  transliterate, transliterateSyllable, toIast, detectScript,
  ambiguitiesIn, isLosslessScript, hasSelectors, stripSelectors,
  PHONEMES, VOWEL_SIGNS, VIRAMA, PRANAVA_FORMS,
} from './script/index.js';
export type { ScriptKey, ScriptOptions, ToIastResult, ScriptUnit } from './script/index.js';

// ── the script registry ─────────────────────────────────────────────────────
// Exported because the design says a host may install or replace a writing
// system at run time. It could not: none of this was on the package surface,
// so "a plug-in rather than a release" was a docstring over a private map.
export {
  registerScript, validateScriptModule, ScriptModuleError,
  getScript, requireScript, isRegistered, partitionScripts,
  registeredScripts, registeredScriptIds, authorableScripts, verifiedScripts,
  onScriptReplaced,
} from './script/registry.js';
export { formOf, signOf } from './script/module.js';
export type { ScriptModule, ScriptId, ScriptKind } from './script/module.js';
export { PHONEME_INVENTORY, PHONEME_BY_ID, NUCLEUS_IDS } from './script/phonemes.js';
export type { Phoneme, PhonemeId, PhonemeType, Varga } from './script/phonemes.js';
export { sequenceAmbiguitiesIn } from './script/lossless.js';

// ── geometry ────────────────────────────────────────────────────────────────
export {
  MARK_GEOMETRY, holdBoxEm, holdStrokeCss,
} from './geometry.js';
export type { InkMetrics, HoldBoxEdges } from './geometry.js';

// ── the alphabet, for the on-screen keyboards and the validator ─────────────
export {
  ANU, VIS, CANDRA, ZWNJ, ZWJ, CJ_SPLIT_ASCII, CJ_JOIN_ASCII,
  DIGRAPHS, LONG_VOWELS, SHORT_VOWELS, VOWELS, CONSONANTS, SKIP, SIBILANTS,
  BIJA, PRANAVA, VIRAMA_TICK, isVowel, isConsonant, parseLetters,
} from './alphabet.js';
