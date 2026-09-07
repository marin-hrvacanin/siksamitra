/**
 * MAPPING A TAKE, in the window.
 *
 * The same three steps the command line runs — find the breaths, work out what
 * share of the time each pāda's syllables are owed, match the two — over the
 * same `@siksamitra/audio`. Only the decoding differs: the browser has a
 * decoder for every format anyone will hand it, so there is no WAV reader here
 * and no ffmpeg.
 *
 * IT DECODES AT 8 kHz MONO ON PURPOSE. The analysis is loudness over 20 ms
 * windows; anything above about 8 kHz cannot change the answer and costs the
 * whole decode. A 40 minute Rudram at 44.1 kHz stereo is 400 MB of floats in a
 * tab, which is how a browser runs out of memory doing arithmetic it did not
 * need to do.
 */
import {
  confidence, detectSilences, mapPadas, padasOf, writeMapping, type MappedPada,
} from '@siksamitra/audio';
import type { ChantDoc } from '@siksamitra/format';

export interface MapResult {
  readonly doc: ChantDoc;
  readonly mapped: readonly MappedPada[];
  readonly confidence: number;
  readonly breaths: number;
  readonly duration: number;
  /** What to say about it, in one sentence. */
  readonly note: string;
}

const ANALYSIS_RATE = 8000;

/** Decode to mono at the rate the analysis actually uses. */
async function decode(file: File): Promise<{ pcm: Float32Array; rate: number }> {
  const bytes = await file.arrayBuffer();
  /* `OfflineAudioContext` resamples as it decodes, which is the cheap way to
     get 8 kHz — `decodeAudioData` on a normal context gives the hardware rate
     and would need resampling afterwards. Its length is a placeholder; nothing
     is rendered. */
  const Ctor = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext })
    .OfflineAudioContext;
  if (Ctor === undefined) throw new Error('this browser cannot decode audio');
  const ctx = new Ctor(1, ANALYSIS_RATE, ANALYSIS_RATE);
  const buffer = await ctx.decodeAudioData(bytes);
  return { pcm: buffer.getChannelData(0), rate: buffer.sampleRate };
}

export async function mapRecording(
  doc: ChantDoc,
  file: File,
  options: { sectionId?: string } = {},
): Promise<MapResult> {
  const { pcm, rate } = await decode(file);
  const duration = pcm.length / rate;
  const gaps = detectSilences(pcm, rate);

  /*
   * A take opens with room tone almost every time — the recorder was running
   * before the voice was. Giving the first pāda that silence drifts every
   * boundary after it, so a leading and trailing gap are trimmed.
   */
  const head = gaps[0];
  const tail = gaps[gaps.length - 1];
  const from = head !== undefined && head.start <= 0.05 ? head.end : 0;
  const to = tail !== undefined && tail.end >= duration - 0.05 ? tail.start : duration;

  const sections = options.sectionId === undefined
    ? doc.sections
    : doc.sections.filter((s) => s.id === options.sectionId);
  const padas = sections.flatMap((s) => padasOf(s));
  if (padas.length === 0) throw new Error('there is nothing chanted here to map');

  const mapped = mapPadas(padas, duration, gaps, { from, to });
  const heard = confidence(mapped);
  const next = writeMapping(doc, file.name, mapped, {
    duration: Math.round(duration * 100) / 100,
  });

  const guessed = mapped.filter((m) => m.from === 'even').length;
  return {
    doc: next,
    mapped,
    confidence: heard,
    breaths: gaps.length,
    duration,
    note: `${file.name}: ${mapped.length} pāda(s) mapped over `
      + `${Math.round(duration)}s. ${Math.round(heard * 100)}% landed on a breath`
      + `${guessed === 0 ? '' : `; ${guessed} evenly spaced, and marked as guesses`}.`,
  };
}
