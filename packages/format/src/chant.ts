/**
 * Marked text — the ONE contract for every śikṣā-marked Sanskrit text in Veda
 * Union.
 *
 * A "marked document" is a title + sections + verses whose text is a stream of
 * TOKENS: syllables built from letter-level units carrying holdings / svara /
 * anusvāra-visarga change colour, plus spaces, pauses, daṇḍas, verse numbers,
 * free-text fills and variable slots. Every syllable carries its form in all
 * four scripts, so the reader is script-agnostic.
 *
 * Three kinds of source satisfy this contract, and the reader renders all three
 * identically:
 *
 *   1. a **static chant JSON** (`corpus/chants/*.json`, generated offline
 *      by `tools/chant/`) — the whole document;
 *   2. a **slice** of one (`ChantSelection` — sections, verses, or a range),
 *      so a document can embed just the Gaṇeśa stotram, or three of its verses;
 *   3. a **variable module** that composes its sections at render time — the
 *      saṅkalpa (`shared/src/sankalpa.ts`) builds a `ChantDoc` from precomputed
 *      fragment marks + the day's pañcāṅga coordinates.
 *
 * There is NO runtime marking engine anywhere. Marks are emitted offline by
 * `tools/chant/gen_marks.py` and shipped as data (see docs/MARKING-RULES.md).
 *
 * THIS FILE IS THE BARREL. The contract is split across five modules by what
 * each one is about — see their headers — and re-exported here, so every
 * import path in the program and in the platform stays exactly what it was.
 * It was split because it reached 800 lines, and a file nobody can hold in
 * their head is a file where two contradictory rules can live for a year.
 *
 *   chant-tokens      a syllable, its letters, and what is between them
 *   chant-parts       directions, illustrations, embeds
 *   chant-verse       a verse, and whether it may be re-derived
 *   chant-structure   items, groups, sections, the document
 *   chant-select      canonical JSON, normalisation, slicing, variants
 */

import type { ChantProfileKey, ChantProfileRef } from './profile-ref.js';

export type { ChantProfileKey, ChantProfileRef };

export type {
  ChantScriptKey, ChantSvara, ChantUnit, ChantSyllable, ChantText, ChantSlot,
  ChantToken, ChantGram, ChantWordGram, ChantBreakPolicy,
} from './chant-tokens.js';

export type {
  ChantVerseSource, ChantSvaraRegister, ChantMeterKey, ChantOverride, ChantVerse,
} from './chant-verse.js';

export type {
  ChantInstructionKind, ChantInstruction, ChantFigureFlow, ChantFigureSize,
  ChantFigure, ChantEmbedSrc, ChantEmbedFallback, ChantEmbed, ChantEmbedProblem,
} from './chant-parts.js';

export type {
  ChantItem, ChantGroup, ChantSectionAudio, ChantSectionModule, ChantSection,
  ChantRecording, ChantFeatures, ChantDoc,
} from './chant-structure.js';

export {
  canonicalJson, CHANT_FORMAT_VERSION, isTextlessStep, normalizeChantDoc,
  parseChantSelect, isEmptySelection, sliceChantDoc, fillChantSlots, withVerses,
} from './chant-select.js';

export type {
  ChantVariantOption, ChantVariantIndex, ChantVariantVerse, ChantVariantFile,
  ChantSelection,
} from './chant-select.js';
