/**
 * MAPPING A TAKE, in the window.
 *
 * The same three steps the command line runs — find the breaths, work out what
 * share of the time each pāda's syllables are owed, match the two — over the
 * same `@siksamitra/audio`, so `sm audio map` and the Map it button produce
 * the same mapping from the same recording. Only the decoding differs, and
 * that is not here either: `take.ts` owns it, because the waveform wants the
 * same samples and decoding a 40 minute take twice is 400 MB of floats through
 * a tab for nothing.
 */
import {
  confidence, mapPadas, padasOf, writeMapping, type MappedPada,
} from '@siksamitra/audio';
import type { ChantDoc } from '@siksamitra/format';
import type { Take } from './take.js';

export interface MapResult {
  readonly doc: ChantDoc;
  readonly mapped: readonly MappedPada[];
  readonly confidence: number;
  readonly breaths: number;
  readonly duration: number;
  /** What to say about it, in one sentence. */
  readonly note: string;
}

/**
 * Where the recitation begins and ends inside the file.
 *
 * A take opens with room tone almost every time — the recorder was running
 * before the voice was. Giving the first pāda that silence drifts every
 * boundary after it, so a leading and trailing gap are trimmed. The same rule
 * as `audio-commands.ts`, and it has to be: the window and the command line
 * must not disagree about where a chant starts.
 */
export function boundsOf(take: Take): { from: number; to: number } {
  const head = take.gaps[0];
  const tail = take.gaps[take.gaps.length - 1];
  return {
    from: head !== undefined && head.start <= 0.05 ? head.end : 0,
    to: tail !== undefined && tail.end >= take.duration - 0.05 ? tail.start : take.duration,
  };
}

export function mapRecording(
  doc: ChantDoc,
  take: Take,
  options: { sectionId?: string } = {},
): MapResult {
  const { duration, gaps } = take;
  const { from, to } = boundsOf(take);

  const sections = options.sectionId === undefined
    ? doc.sections
    : doc.sections.filter((s) => s.id === options.sectionId);
  const padas = sections.flatMap((s) => padasOf(s));
  if (padas.length === 0) throw new Error('there is nothing chanted here to map');

  const mapped = mapPadas(padas, duration, gaps, { from, to });
  const heard = confidence(mapped);
  const next = writeMapping(doc, take.file.name, mapped, {
    duration: Math.round(duration * 100) / 100,
  });

  const guessed = mapped.filter((m) => m.from === 'even').length;
  return {
    doc: next,
    mapped,
    confidence: heard,
    breaths: gaps.length,
    duration,
    note: `${take.file.name}: ${mapped.length} pāda(s) mapped over `
      + `${Math.round(duration)}s. ${Math.round(heard * 100)}% landed on a breath`
      + `${guessed === 0 ? '' : `; ${guessed} evenly spaced, and marked as guesses`}.`,
  };
}
