/**
 * MAPPING A RECORDING ONTO A TEXT.
 *
 * The problem: one file, one recitation, and a document of verses and pādas.
 * Which second is which line?
 *
 * The answer has two halves and they are kept apart on purpose.
 *
 *   1. WHAT THE TEXT EXPECTS. A pāda's share of the time is its share of the
 *      syllables — that is what a recitation at an even pace means, and it is
 *      the only thing the text itself can say. This half is arithmetic and is
 *      always right about proportions and always wrong about the exact second.
 *
 *   2. WHERE THE VOICE ACTUALLY STOPS. The breaths, from `silence.ts` or from
 *      a forced aligner or from a person tapping along. This half knows the
 *      seconds and knows nothing about the text.
 *
 * Mapping is matching the second to the first: each expected boundary snaps to
 * the nearest real silence, but only if there is one close enough to be the
 * same event. A boundary with no breath near it stays where the arithmetic put
 * it, and says so — an honest guess beats a confident wrong one, and the
 * editor draws the two differently.
 *
 * BOUNDARIES COME FROM ANYWHERE. `snap` takes a list of seconds; it does not
 * care whether silence detection, `mms-300m` or a human produced them. That is
 * the seam that lets a better aligner replace the floor without touching the
 * mapping.
 */
import type { Span } from './silence.js';

export interface Pada {
  readonly verseId: string;
  /** Which line of the verse — 0 for the first pāda. */
  readonly line: number;
  /** What the pace is proportional to. Syllables, not characters. */
  readonly weight: number;
}

export interface MappedPada extends Span {
  readonly verseId: string;
  readonly line: number;
  /**
   * Where this boundary came from.
   *
   *   'breath'  it landed on a silence in the recording
   *   'even'    nothing was near enough; it is the arithmetic's guess
   *
   * Kept per pāda because a recording is usually clean for most of a chant and
   * murky in two places, and the editor should say WHICH two rather than
   * grading the whole mapping.
   */
  readonly from: 'breath' | 'even';
}

export interface MapOptions {
  /** Where the recitation begins, if it is not the start of the file. */
  readonly from?: number;
  /** Where it ends. Defaults to the file's duration. */
  readonly to?: number;
  /**
   * How far a boundary may move to reach a breath, in seconds.
   *
   * Wide enough to cross the drift that accumulates over a long verse, narrow
   * enough that a pāda boundary cannot jump to its neighbour's breath. 1.2 s
   * is roughly two syllables at a chanted pace.
   */
  readonly snapWithin?: number;
}

const DEFAULT_SNAP = 1.2;

/**
 * Split a duration between pādas by weight, then pull each seam to a breath.
 *
 * The endpoints do not move: the first pāda starts where the recitation
 * starts and the last ends where it ends, because those are given rather than
 * inferred, and letting them float was how a mapping quietly lost the last
 * syllable of a chant.
 */
export function mapPadas(
  padas: readonly Pada[],
  duration: number,
  silences: readonly Span[] = [],
  options: MapOptions = {},
): MappedPada[] {
  if (padas.length === 0) return [];
  const from = options.from ?? 0;
  const to = options.to ?? duration;
  const within = options.snapWithin ?? DEFAULT_SNAP;
  if (!(to > from)) return [];

  const total = padas.reduce((n, p) => n + Math.max(1, p.weight), 0);
  /* The seams, in order: `padas.length + 1` of them, first and last fixed. */
  const seams: number[] = [from];
  let run = 0;
  for (const p of padas.slice(0, -1)) {
    run += Math.max(1, p.weight);
    seams.push(from + ((to - from) * run) / total);
  }
  seams.push(to);

  const breaths = silences.map((s) => (s.start + s.end) / 2).sort((a, b) => a - b);
  const snapped = seams.map((t, i) => {
    if (i === 0 || i === seams.length - 1) return { at: t, from: 'even' as const };
    const near = nearest(breaths, t);
    if (near === null || Math.abs(near - t) > within) return { at: t, from: 'even' as const };
    return { at: near, from: 'breath' as const };
  });

  /*
   * MONOTONIC, WHATEVER THE SNAPPING DID.
   *
   * Two seams can snap to the same breath when a pāda is very short, and then
   * a pāda ends before it starts — which the reader turns into a segment that
   * plays for ever. Sorting is not enough (it would silently reorder the
   * text); the seam that moved is pushed back to where the arithmetic had it.
   */
  for (let i = 1; i < snapped.length; i += 1) {
    const prev = snapped[i - 1] as { at: number; from: 'breath' | 'even' };
    const here = snapped[i] as { at: number; from: 'breath' | 'even' };
    if (here.at <= prev.at) {
      snapped[i] = { at: Math.min(seams[i] as number, to), from: 'even' };
      if ((snapped[i] as { at: number }).at <= prev.at) {
        snapped[i] = { at: Math.min(prev.at + 0.01, to), from: 'even' };
      }
    }
  }

  return padas.map((p, i) => ({
    verseId: p.verseId,
    line: p.line,
    start: round(snapped[i]!.at),
    end: round(snapped[i + 1]!.at),
    /* A pāda is "from a breath" when the boundary it STARTS at is — the one it
       ends at belongs to the pāda after it. The first pāda takes the quality
       of the boundary that ends it, since its start is fixed. */
    from: i === 0 ? snapped[1]!.from : snapped[i]!.from,
  }));
}

/** Two decimal places: a hundredth of a second is below what anyone can hear
 *  a boundary move, and it keeps the document's bytes stable. */
const round = (t: number): number => Math.round(t * 100) / 100;

function nearest(sorted: readonly number[], t: number): number | null {
  if (sorted.length === 0) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid] as number) < t) lo = mid + 1;
    else hi = mid;
  }
  const a = sorted[lo] as number;
  const b = sorted[Math.max(0, lo - 1)] as number;
  return Math.abs(a - t) <= Math.abs(b - t) ? a : b;
}

/**
 * How much of the mapping is guessed rather than heard.
 *
 * Reported rather than judged. A recording of a fast chant genuinely has no
 * breath at most pāda ends, and a mapping that is 60% arithmetic may still be
 * exactly right — so this hands the number to whoever is looking at it instead
 * of deciding for them.
 */
export const confidence = (mapped: readonly MappedPada[]): number => (mapped.length === 0
  ? 0
  : mapped.filter((m) => m.from === 'breath').length / mapped.length);
