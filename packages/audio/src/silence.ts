/**
 * WHERE THE VOICE STOPS.
 *
 * A recitation recording is not continuous: there is a breath between pādas
 * and a longer one between verses, and those gaps are where a mapping belongs.
 * Finding them needs no model and no network — it is the loudness of the
 * signal over time, and a threshold — which is the whole reason this exists
 * rather than a forced aligner.
 *
 * A FORCED ALIGNER IS BETTER AND IS NOT ALWAYS THERE. `mms-300m` gives
 * syllable-accurate boundaries and needs Python, a GPU to be quick, and half a
 * gigabyte of weights. That belongs in the alignment toolkit, not in an editor
 * somebody installs to mark a text. So this is the floor: good enough to place
 * every pāda within a breath of where it belongs, always available, and
 * arranged so a better answer can replace it (see `map.ts`, which takes
 * boundaries from anywhere).
 *
 * The numbers here are in SECONDS and SAMPLES, never in "frames" — a frame
 * size is an implementation detail of the analysis and leaks nothing but
 * confusion into the rest of the program.
 */

export interface Span {
  /** Seconds from the start of the recording. */
  readonly start: number;
  readonly end: number;
}

export interface SilenceOptions {
  /**
   * How quiet counts as silence, in decibels below the recording's own peak.
   *
   * RELATIVE, not absolute: a phone recording in a hall and a studio take of
   * the same chant differ by 30 dB of noise floor, and a fixed -50 dBFS finds
   * every gap in one and none in the other. 32 dB below peak is a breath in
   * both, measured against the Puruṣa Sūktam takes.
   */
  readonly belowPeakDb?: number;
  /** A gap shorter than this is a stop consonant, not a breath. Seconds. */
  readonly minSilence?: number;
  /** The analysis window. 20 ms is one pitch period at the lowest chanted
   *  register, so a window this size never straddles a syllable. */
  readonly window?: number;
}

const DEFAULTS = { belowPeakDb: 32, minSilence: 0.18, window: 0.02 } as const;

/** The loudness of each window, as a ratio of the loudest one. */
function envelope(pcm: Float32Array, rate: number, window: number): Float32Array {
  const size = Math.max(1, Math.round(rate * window));
  const count = Math.max(1, Math.ceil(pcm.length / size));
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const from = i * size;
    const to = Math.min(pcm.length, from + size);
    let sum = 0;
    for (let j = from; j < to; j += 1) sum += pcm[j]! * pcm[j]!;
    /* Root mean square, not peak: a single click should not make a window
       loud, and a click is exactly what a microphone bump is. */
    out[i] = Math.sqrt(sum / Math.max(1, to - from));
  }
  return out;
}

/**
 * Every stretch of quiet in a recording, in order.
 *
 * The head and tail count: a take that starts with two seconds of room tone
 * has a silence at 0, and the mapping needs to know so the first verse does
 * not begin before the voice does.
 */
export function detectSilences(
  pcm: Float32Array,
  rate: number,
  options: SilenceOptions = {},
): Span[] {
  const { belowPeakDb, minSilence, window } = { ...DEFAULTS, ...options };
  if (pcm.length === 0 || rate <= 0) return [];

  const env = envelope(pcm, rate, window);
  let peak = 0;
  for (const v of env) if (v > peak) peak = v;
  if (peak === 0) return [{ start: 0, end: pcm.length / rate }];

  const floor = peak * 10 ** (-belowPeakDb / 20);
  const seconds = (i: number) => (i * Math.round(rate * window)) / rate;

  const out: Span[] = [];
  let from: number | null = null;
  for (let i = 0; i < env.length; i += 1) {
    const quiet = env[i]! < floor;
    if (quiet && from === null) from = i;
    if (!quiet && from !== null) {
      if (seconds(i) - seconds(from) >= minSilence) out.push({ start: seconds(from), end: seconds(i) });
      from = null;
    }
  }
  if (from !== null) {
    const end = pcm.length / rate;
    if (end - seconds(from) >= minSilence) out.push({ start: seconds(from), end });
  }
  return out;
}

/**
 * The moment inside a silence that a boundary should sit on.
 *
 * THE MIDDLE, not the start. Put it at the start and the previous pāda is cut
 * on its final consonant's release, which sounds clipped; put it at the end
 * and the next one begins with the tail of the last breath. Halfway is
 * inaudible on both sides, which is what a boundary should be.
 */
export const middleOf = (gap: Span): number => (gap.start + gap.end) / 2;

/**
 * The breaths of a recording as bare seconds, in order.
 *
 * Sorted, because both callers binary-search it: `map.ts` to snap a boundary
 * onto a breath, `seams.ts` to say afterwards whether a boundary is sitting on
 * one. They must agree about what "a breath" is down to the sample, so there
 * is one list and not two.
 */
export const breathsIn = (gaps: readonly Span[]): number[] =>
  gaps.map(middleOf).sort((a, b) => a - b);
