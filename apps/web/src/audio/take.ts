/**
 * A TAKE, opened in the window: decoded once, analysed once, kept.
 *
 * Three things want the same recording and used to ask for it separately — the
 * mapper wants samples, the waveform wants samples, and the transport wants a
 * URL to play. Decoding a 40 minute Rudram at 48 kHz costs 460 MB of floats,
 * and doing it twice costs that again for no reason, so it is decoded HERE and
 * everything else is handed the result.
 *
 * 8 kHz MONO ON PURPOSE. The analysis is loudness over 20 ms windows, so
 * anything above about 8 kHz cannot change the answer and costs the whole
 * decode. The waveform is drawn from the same samples, and at 8 kHz a 900 px
 * strip of a two-minute take still has 1 000 samples behind every column.
 *
 * NO WORKER, and that is measured rather than assumed. On this machine
 * `detectSilences` over 19.2M samples — 40 minutes at 8 kHz, longer than
 * anything in the corpus — takes 31 ms, and `decodeAudioData` is already off
 * the main thread. A worker would add a copy of the whole buffer to save a
 * third of a frame.
 */
import { detectSilences, type Span } from '@siksamitra/audio';

export interface Take {
  /** The file itself, kept so the transport can make a URL from it. */
  readonly file: File;
  /** Mono, −1..1, at `rate`. */
  readonly pcm: Float32Array;
  readonly rate: number;
  readonly duration: number;
  /** Where the voice stops. Every boundary question is answered from these. */
  readonly gaps: readonly Span[];
}

/**
 * What the program is doing, for somebody watching it do it.
 *
 * STAGES, NOT A PERCENTAGE. `decodeAudioData` reports no progress and there is
 * no way to ask it — a bar that filled itself on a timer would be a lie, and
 * the one thing a person needs to know while a 40 minute take is opening is
 * that it has not hung. So the label says which of three real steps is
 * running, and the last two are fast enough (31 ms at 40 minutes) that only
 * the decode is ever seen.
 */
export type Stage = 'reading' | 'decoding' | 'listening' | 'matching';

export const STAGE_SAYS: Record<Stage, string> = {
  reading: 'Reading the file…',
  decoding: 'Decoding the audio…',
  listening: 'Listening for the breaths…',
  matching: 'Matching the pādas…',
};

const ANALYSIS_RATE = 8000;

export async function openTake(
  file: File,
  onStage: (stage: Stage) => void = () => {},
): Promise<Take> {
  onStage('reading');
  const bytes = await file.arrayBuffer();

  onStage('decoding');
  /* `OfflineAudioContext` resamples as it decodes, which is the cheap way to
     get 8 kHz — `decodeAudioData` on a normal context gives the hardware rate
     and would need resampling afterwards. Its length is a placeholder; nothing
     is rendered. */
  const Ctor = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext })
    .OfflineAudioContext;
  if (Ctor === undefined) throw new Error('this browser cannot decode audio');
  const buffer = await new Ctor(1, ANALYSIS_RATE, ANALYSIS_RATE).decodeAudioData(bytes);
  const pcm = buffer.getChannelData(0);

  onStage('listening');
  /* A frame, so the label above is painted before the arithmetic blocks. Two
     nested rAFs: one gets the state into the DOM, the second runs after it has
     been drawn. */
  await painted();
  return {
    file,
    pcm,
    rate: buffer.sampleRate,
    duration: pcm.length / buffer.sampleRate,
    gaps: detectSilences(pcm, buffer.sampleRate),
  };
}

const painted = (): Promise<void> => new Promise((done) => {
  if (typeof requestAnimationFrame !== 'function') { done(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => done()));
});
