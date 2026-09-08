/**
 * A WAVEFORM'S COLUMNS: the loudest and quietest sample behind each pixel.
 *
 * MIN AND MAX, NOT AN AVERAGE. A recitation is a signal that swings either way
 * of zero, so averaging a column of 1 000 samples gives approximately zero for
 * loud audio and for silence alike — the picture is a flat line and the
 * breaths, which are the only thing anybody is looking for in it, are
 * invisible. The pair of extremes is what a waveform IS.
 *
 * RE-SCANNED PER VIEW rather than kept as a pyramid. Zooming into two seconds
 * of a 40 minute take reads only those samples; zooming out to the whole take
 * reads 19.2M, which is 26 ms measured on this machine — once per zoom or
 * resize, never per frame. A mipmap would save that at the cost of a second
 * representation of the same audio that can disagree with the first.
 */

export interface Peaks {
  /** The lowest sample in each column, −1..1. */
  readonly lo: Float32Array;
  /** The highest. */
  readonly hi: Float32Array;
}

/**
 * The peaks of `pcm[from..to)` in `columns` columns.
 *
 * `from` and `to` are SAMPLE indices, not seconds: the caller already knows the
 * rate and converting here would mean rounding a second into a sample twice,
 * in two places, with two answers about which sample a boundary sits on.
 */
export function peaksOf(
  pcm: Float32Array,
  from: number,
  to: number,
  columns: number,
): Peaks {
  const wide = Math.max(1, Math.floor(columns));
  const lo = new Float32Array(wide);
  const hi = new Float32Array(wide);
  const first = Math.max(0, Math.min(Math.floor(from), pcm.length));
  const last = Math.max(first, Math.min(Math.ceil(to), pcm.length));
  if (last === first) return { lo, hi };

  const per = (last - first) / wide;
  for (let c = 0; c < wide; c += 1) {
    const a = first + Math.floor(c * per);
    /* At least one sample per column. Zoomed in past one sample per pixel the
       stride is below 1 and every column would otherwise be empty, which drew
       a blank strip exactly when somebody was looking closest. */
    const b = Math.max(a + 1, first + Math.floor((c + 1) * per));
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = a; i < b && i < last; i += 1) {
      const v = pcm[i] as number;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === Number.POSITIVE_INFINITY) { min = 0; max = 0; }
    lo[c] = min;
    hi[c] = max;
  }
  return { lo, hi };
}
