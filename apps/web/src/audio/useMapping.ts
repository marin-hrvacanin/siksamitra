/**
 * THE MAPPING, AS THE WINDOW WORKS ON IT.
 *
 * One place that knows: which take is open, what the engine heard in it, which
 * boundary is selected, and which seconds of it are on screen. The ribbon and
 * the strip under the document both read this, so the boundary the buttons
 * nudge is the boundary the waveform is drawing — with the state in each of
 * them they were two selections that agreed until somebody scrolled.
 *
 * EVERY EDIT GOES THROUGH `session.setRecording`, which is a history step like
 * any other — ONCE, when the pointer comes up.
 *
 * A drag is not committed frame by frame, for two reasons and both are
 * measured rather than tidy. `record` in `@siksamitra/edit` coalesces only
 * steps that carry a matching key, and `setRecording` carries none, so a
 * three-second drag would leave 180 undo steps between a person and the
 * mapping they started with. And `setRecording` bumps the session's revision,
 * which is in the paged view's content key — so every frame of the drag would
 * re-measure the whole document to move one line by two pixels.
 *
 * So the moving boundary is a PREVIEW document held here, which only the strip
 * reads, and `moveSeam` is always applied to the document the drag started
 * from rather than to the last frame's result.
 *
 * WHAT IT DOES NOT OWN: playback. That is `useRecording`, because the transport
 * outlives the Audio tab — a recording that stopped whenever somebody looked at
 * the Marking tab would be useless.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  mainFile, mappedIn, moveSeam, seamKinds, seamsOf,
  type SeamPada, type Span,
} from '@siksamitra/audio';
import type { ChantDoc } from '@siksamitra/format';
import { mapRecording } from './map-in-browser.js';
import { openTake, STAGE_SAYS, type Stage, type Take } from './take.js';
import { follow, viewAround, ZOOM_STEP, type View } from './view.js';

/**
 * Where a boundary came from, as the strip draws it.
 *
 *   'breath'  it is sitting on a silence in the recording
 *   'even'    nothing is near it; it is the arithmetic's guess — the `?` the
 *             command line prints, and the one worth looking at
 *   'hand'    somebody has moved it in this sitting
 *   'edge'    the first and the last: where the recitation starts and stops
 *
 * 'hand' is remembered here and nowhere else, on purpose. A boundary a person
 * has just placed should stop being nagged about, but the document has no room
 * to record that — `ChantRecording` is a start and an end — and adding a field
 * would be a format change to hold an opinion that expires when the window
 * closes. An undo does not take it back: the history belongs to the session
 * and nothing tells this hook a step was reversed. That is the honest side of
 * the trade — the boundary has still been LOOKED at, which is what the mark is
 * there to say.
 *
 * 'edge' EXISTS SO THE TWO NUMBERS AGREE. `mapPadas` fixes the endpoints rather
 * than snapping them — they are given, not inferred — so it counts neither in
 * its confidence, and neither is printed with a `?`. Classified by breath
 * proximity like the rest, the ribbon said "14 guessed" beside a status line
 * reading "13 evenly spaced": the start of the take had no breath within
 * 1.2 s, and was being reported as work to do when there is nothing to fix.
 */
export type SeamKind = 'breath' | 'even' | 'hand' | 'edge';

export interface Mapping {
  readonly take: Take | null;
  /** What the program is doing, while it is doing it. Null when idle. */
  readonly busy: string | null;
  readonly padas: readonly SeamPada[];
  readonly seams: readonly number[];
  readonly kinds: readonly SeamKind[];
  /** How many boundaries are still the arithmetic's guess. */
  readonly guesses: number;
  readonly selected: number | null;
  readonly view: View;
  readonly duration: number;

  readonly attach: (file: File) => Promise<void>;
  readonly align: () => Promise<void>;
  readonly select: (index: number | null) => void;
  /** Move a seam. `settle` ends the gesture and marks the boundary as placed. */
  readonly drag: (index: number, to: number, settle: boolean) => void;
  readonly nudge: (by: number) => void;
  readonly setFrom: (at: number) => void;
  /** Select the next boundary the mapper guessed, and bring it into view. */
  readonly nextGuess: () => number | null;
  readonly zoom: (direction: 1 | -1) => void;
  /** Keep the playhead on screen without moving the window unnecessarily. */
  readonly followPlayhead: (at: number) => void;
}

/**
 * How far one press of Earlier or Later moves a boundary.
 *
 * 0.05 s is about an eighth of a chanted syllable: small enough that a press
 * cannot cross into the next syllable, large enough to be heard. Below the
 * hundredth-of-a-second grid the mapping is written on there would be presses
 * that changed nothing.
 */
export const NUDGE = 0.05;

const NO_GAPS: Span[] = [];

export function useMapping(
  doc: ChantDoc | null,
  setRecording: (next: ChantDoc) => void,
  onNote: (note: string) => void,
): Mapping {
  const [take, setTake] = useState<Take | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hand, setHand] = useState<ReadonlySet<number>>(() => new Set());
  const [view, setView] = useState<View>({ from: 0, to: 1 });
  /* The document with the boundary where the pointer currently is. Null except
     between a pointer down and the pointer up that commits it. */
  const [preview, setPreview] = useState<ChantDoc | null>(null);

  /* The document as it was when the drag began. Every frame of the drag is
     applied to THIS, so the gesture is one difference and not a stack of them. */
  const gesture = useRef<{ from: ChantDoc; index: number } | null>(null);

  const live = preview ?? doc;
  const file = useMemo(
    () => take?.file.name ?? (live === null ? null : mainFile(live)),
    [take, live],
  );
  const padas = useMemo(
    () => (live === null ? [] : mappedIn(live, file ?? undefined)),
    [live, file],
  );
  const seams = useMemo(() => seamsOf(padas), [padas]);
  const duration = take?.duration
    ?? (seams.length === 0 ? 0 : (seams[seams.length - 1] as number));

  const kinds = useMemo<SeamKind[]>(
    () => seamKinds(seams, take?.gaps ?? NO_GAPS).map((k, i): SeamKind => {
      if (hand.has(i)) return 'hand';
      return i === 0 || i === seams.length - 1 ? 'edge' : k;
    }),
    [seams, take, hand],
  );
  const guesses = useMemo(() => kinds.filter((k) => k === 'even').length, [kinds]);

  const showAround = useCallback((at: number) => {
    setView((was) => viewAround(duration, was.to - was.from, at));
  }, [duration]);

  const attach = useCallback(async (chosen: File): Promise<void> => {
    setBusy(STAGE_SAYS.reading);
    try {
      const opened = await openTake(chosen, (stage: Stage) => setBusy(STAGE_SAYS[stage]));
      setTake(opened);
      setSelected(null);
      setHand(new Set());
      setPreview(null);
      setView({ from: 0, to: Math.max(opened.duration, 1) });
      onNote(`${chosen.name} — ${Math.round(opened.duration)}s, `
        + `${opened.gaps.length} breath(s) found.`);
    } catch (e) {
      onNote(`Could not read ${chosen.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [onNote]);

  const align = useCallback(async (): Promise<void> => {
    if (doc === null || take === null) return;
    setBusy(STAGE_SAYS.matching);
    /* A frame, so the label is on screen before the arithmetic runs. It is
       quick — 31 ms over a 40 minute take, measured — but a button that looks
       dead for even that long is a button somebody presses twice. */
    await new Promise<void>((done) => { requestAnimationFrame(() => done()); });
    try {
      const result = mapRecording(doc, take);
      setRecording(result.doc);
      setHand(new Set());
      setSelected(null);
      setPreview(null);
      onNote(result.note);
    } catch (e) {
      onNote(`Could not map ${take.file.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [doc, take, setRecording, onNote]);

  const drag = useCallback((index: number, to: number, settle: boolean) => {
    const held = gesture.current;
    const base = held !== null && held.index === index ? held.from : doc;
    if (base === null) return;
    const next = moveSeam(base, mappedIn(base, file ?? undefined), index, to, take?.duration);
    setSelected(index);
    if (!settle) {
      gesture.current = { from: base, index };
      setPreview(next);
      return;
    }
    gesture.current = null;
    setPreview(null);
    setRecording(next);
    setHand((was) => new Set(was).add(index));
  }, [doc, file, take, setRecording]);

  const nudge = useCallback((by: number) => {
    if (selected === null) return;
    const at = seams[selected];
    if (at !== undefined) drag(selected, at + by, true);
  }, [selected, seams, drag]);

  const setFrom = useCallback((at: number) => {
    if (selected !== null) drag(selected, at, true);
  }, [selected, drag]);

  const nextGuess = useCallback((): number | null => {
    /* From the one after the selection, and round to the beginning — the way
       Find behaves, because this is a Find over the same kind of list. */
    const after = selected === null ? -1 : selected;
    const found = kinds.findIndex((k, i) => k === 'even' && i > after);
    const index = found === -1 ? kinds.indexOf('even') : found;
    if (index === -1) return null;
    setSelected(index);
    const at = seams[index];
    if (at !== undefined) showAround(at);
    return index;
  }, [kinds, seams, selected, showAround]);

  const zoom = useCallback((direction: 1 | -1) => {
    setView((was) => {
      const span = (was.to - was.from) * (direction === 1 ? 1 / ZOOM_STEP : ZOOM_STEP);
      /* Around what is being worked on: the selected boundary if there is one,
         otherwise the middle of what is already shown. Zooming about the middle
         of the TAKE would throw the boundary off screen at the first press. */
      const middle = (was.from + was.to) / 2;
      return viewAround(duration, span, selected === null ? middle : (seams[selected] ?? middle));
    });
  }, [duration, selected, seams]);

  const followPlayhead = useCallback((at: number) => {
    setView((was) => follow(was, duration, at));
  }, [duration]);

  return {
    take,
    busy,
    padas,
    seams,
    kinds,
    guesses,
    selected,
    view,
    duration,
    attach,
    align,
    select: setSelected,
    drag,
    nudge,
    setFrom,
    nextGuess,
    zoom,
    followPlayhead,
  };
}

/** What the selected boundary is between, in words — for the readout and for
 *  the screen reader, which has no picture to look at. */
export function seamSays(padas: readonly SeamPada[], index: number | null): string | null {
  if (index === null) return null;
  const before = padas[index - 1];
  const after = padas[index];
  if (before === undefined) {
    return after === undefined ? null : `start of ${after.verseId} pāda ${after.line + 1}`;
  }
  if (after === undefined) return `end of ${before.verseId} pāda ${before.line + 1}`;
  return `${before.verseId} pāda ${before.line + 1} to ${after.verseId} pāda ${after.line + 1}`;
}
