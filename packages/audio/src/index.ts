/**
 * Audio: mapping a recitation onto a marked text, and back.
 *
 * The reader has always been able to PLAY a mapping — a verse, a pāda, with
 * the line lit as it is sung. Nothing could ever MAKE one, so every recording
 * in the corpus was mapped by hand or not at all. This package is that missing
 * half, and it is deliberately kept in separable pieces:
 *
 *   silence.ts   where the voice stops — signal only, no text
 *   map.ts       matching the text's proportions to those stops
 *   document.ts  reading pādas out of a document and writing a mapping in
 *   seams.ts     the boundaries as a person moves them, one at a time
 *
 * so that a better source of boundaries — a forced aligner, a person tapping
 * along — replaces exactly one of them.
 */
export { breathsIn, detectSilences, middleOf } from './silence.js';
export type { SilenceOptions, Span } from './silence.js';

export {
  confidence, DEFAULT_SNAP, mapPadas, nearestTo, roundSeconds,
} from './map.js';
export type { MapOptions, MappedPada, Pada } from './map.js';

export {
  limitsOf, mainFile, mappedIn, MIN_PADA, moveSeam, nearestSeam, seamKinds, seamsOf,
} from './seams.js';
export type { SeamPada } from './seams.js';

export { checkMapping, padasOf, rowFor, writeMapping } from './document.js';
export type { MappingProblem, RecordingRow } from './document.js';

export { decodeWav } from './wav.js';
export type { Decoded } from './wav.js';
