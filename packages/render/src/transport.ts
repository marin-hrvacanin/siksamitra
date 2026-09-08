/**
 * STARTING A CLIP AT A KNOWN POSITION, and keeping it at a known speed.
 *
 * Two players read a mapping: the reader on the site (`ChantReader`) and the
 * editor's own transport. Both drive one `<audio>` element from a `{start,
 * end}` in `recording.byVerse`, and both met the same three defects of the
 * media element. They are recorded here once because each was found by
 * listening to a chant and not by reading a specification, and a second copy
 * of this file would be a second chance to lose them.
 *
 * 1. `a.src = src; a.currentTime = t; a.play()` DOES NOT START AT `t`.
 *    Assigning `currentTime` before the media has loaded is dropped or
 *    deferred, and assigning the same `src` may or may not trigger a reload, so
 *    playback began sometimes at `t` and sometimes a little past it — the same
 *    pāda differing between presses, which is what "sometimes it swallows the
 *    first syllable" was. A fade could not do that: it is baked into the file
 *    and would swallow identically every time. So: make sure metadata is
 *    there, seek, WAIT FOR `seeked`, then play. Each step confirmed rather than
 *    assumed.
 *
 * 2. ASSIGNING `src` RESETS THE RATE. The media load algorithm puts
 *    `playbackRate` back to `defaultPlaybackRate` — 1 unless told otherwise —
 *    and it runs as a queued task, so `a.src = …; a.playbackRate = 0.65;`
 *    silently loses the 0.65. Writing BOTH properties, and writing them again
 *    after every load, is the only thing that holds.
 *
 * 3. A PĀDA HAS TO BE STOPPED A HAIR EARLY. `pause()` does not retract audio
 *    the device has already buffered, and that buffer is tens of milliseconds
 *    on a wired output and 100–200 ms over Bluetooth. The error has to go one
 *    way or the other and the two are not equally audible: a pāda ends on a
 *    held syllable that is already decaying, so clipping its last 35 ms is
 *    inaudible, whereas letting the next word's consonant through is exactly
 *    the artefact being removed.
 *
 * This is a mitigation of (3), not a cure — the cure is scheduling the stop in
 * the audio clock (Web Audio `start(when, offset, duration)`), which stops
 * sample-accurately and exposes `outputLatency` so the highlight can be matched
 * to the ears too. `<audio>` and `currentTime` can express neither.
 */

/** How early a segment is stopped, in seconds. See (3) above. */
export const SEG_LEAD = 0.035;

/** Set the speed so that the next load cannot revert it. See (2) above. */
export function applyRate(el: HTMLAudioElement, rate: number): void {
  el.defaultPlaybackRate = rate;
  el.playbackRate = rate;
}

export interface StartAt {
  /** The clip. `null` keeps whatever is loaded — replaying a segment of it. */
  readonly src: string | null;
  /** Where to begin, in seconds from the start of the clip. */
  readonly at: number;
  readonly rate: number;
  readonly loop?: boolean;
  /**
   * Whether this play is still the one that was asked for.
   *
   * Every await below is a chance for somebody to press another pāda, and
   * without this the earlier play resumes after the later one and the wrong
   * line sounds. The caller owns the token because the caller is what changes
   * it; a token inside here could not see a `pause()` from elsewhere.
   */
  readonly alive: () => boolean;
}

/** Start, and say whether the play that finished is still the wanted one. */
export async function startAt(el: HTMLAudioElement, opts: StartAt): Promise<boolean> {
  const once = (event: string): Promise<void> => new Promise((done) => {
    const handler = (): void => { el.removeEventListener(event, handler); done(); };
    el.addEventListener(event, handler);
  });

  const { src } = opts;
  if (src !== null && !el.src.endsWith(src) && el.src !== src) {
    el.src = src;
    el.load();
    await once('loadedmetadata');
  } else if (el.readyState < 1) {
    /* HAVE_NOTHING: the element has a source but has not read its header yet,
       so it does not know its own duration and a seek would be discarded. */
    await once('loadedmetadata');
  }
  if (!opts.alive()) return false;

  el.loop = opts.loop ?? false;
  applyRate(el, opts.rate);
  /* 5 ms: below what a seek can resolve anyway, and it stops a replay of the
     same pāda from waiting on a `seeked` event that will never come because
     the element is already exactly there. */
  if (Math.abs(el.currentTime - opts.at) > 0.005) {
    el.currentTime = opts.at;
    await once('seeked');
    if (!opts.alive()) return false;
  }
  try {
    await el.play();
  } catch {
    /* Autoplay refused, or the element was torn down mid-await. Neither is an
       error to report: nothing is playing, which is what the caller is told. */
    return false;
  }
  return opts.alive();
}
