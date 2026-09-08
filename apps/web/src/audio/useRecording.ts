/**
 * PLAYING A RECITATION AGAINST THE TEXT.
 *
 * One `<audio>` element, and a clock that says which pāda is being sung. The
 * document already carries the mapping (`recording.byVerse[id].lines`) and the
 * page already draws every pāda as `.pada[data-line]` inside `[data-verse]`,
 * so this needs to invent nothing: it turns a time into an address, and an
 * address into a class on one element.
 *
 * THE HIGHLIGHT IS IMPERATIVE, like the caret.
 *
 * Sixty times a second is the wrong rate to re-render a document at — the
 * blocks are memoised precisely so that moving the caret does not redraw a
 * page of marked text — so the sung pāda is a class added to one node and
 * removed from another, on an animation frame, and React is never told. That
 * is the same decision the caret made and for the same measured reason.
 *
 * WHERE THE FILE COMES FROM. Either the document's own `audioBase` plus the
 * name in the mapping, or a file the person picked off their disk. The second
 * matters more than it looks: mapping a take means having the take, and the
 * take is a 40 MB file that has no business inside a document.
 *
 * STARTING AND STOPPING IS `transport.ts` IN `@siksamitra/render`, not code of
 * its own. The reader met every defect of the media element first — a seek
 * dropped because the metadata had not loaded, a speed reset by assigning
 * `src`, a segment heard past its end because `pause()` does not retract what
 * the device has buffered — and each fix is a measurement, not a preference.
 * Two players with two copies of that would be two players that drift.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { mappedIn } from '@siksamitra/audio';
import { applyRate, SEG_LEAD, startAt } from '@siksamitra/render';

export interface PadaAt {
  readonly verseId: string;
  readonly line: number;
  readonly start: number;
  readonly end: number;
}

export interface Recording {
  /** What is loaded, if anything — a name to show, not a path. */
  readonly name: string | null;
  readonly ready: boolean;
  readonly playing: boolean;
  readonly duration: number;
  /** Seconds. Updated on a frame, so do not put it in the document's render. */
  readonly at: number;
  readonly rate: number;
  readonly loop: boolean;
  readonly setRate: (r: number) => void;
  readonly setLoop: (on: boolean) => void;

  /** Load a file the person picked. Returns its decoded samples for mapping. */
  readonly open: (file: File) => Promise<void>;
  /** The chosen file, kept so a mapping can be made without a second read. */
  readonly file: File | null;

  readonly playVerse: (verseId: string) => void;
  readonly playPada: (verseId: string, line: number) => void;
  readonly playAll: () => void;
  readonly pause: () => void;
  readonly seek: (t: number) => void;
  /** Which pāda the clock is inside, for anything that must re-render. */
  readonly sung: PadaAt | null;
}

/** Every mapped pāda of a document, in the order it is heard. `@siksamitra/audio`
 *  owns the reading, because the editor's boundary handles have to be numbered
 *  the same way the transport plays them. */
export const padasOfDoc = (doc: ChantDoc | null): PadaAt[] =>
  (doc === null ? [] : mappedIn(doc));

/** The file a verse's audio is in, resolved against the document's base. */
export function sourceFor(doc: ChantDoc | null, verseId: string): string | null {
  const row = doc?.recording?.byVerse?.[verseId] as { file?: string } | undefined;
  if (row?.file === undefined) return null;
  const base = doc?.audioBase ?? '';
  return /^(https?:|blob:|data:|\/)/.test(row.file) ? row.file : base + row.file;
}

export function useRecording(doc: ChantDoc | null): Recording {
  const el = useRef<HTMLAudioElement | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [at, setAt] = useState(0);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [sung, setSung] = useState<PadaAt | null>(null);

  /** Where to stop, when a single pāda or verse is playing. */
  const until = useRef<number | null>(null);
  const from = useRef(0);
  const object = useRef<string | null>(null);

  if (el.current === null && typeof Audio !== 'undefined') {
    el.current = new Audio();
    el.current.preload = 'auto';
  }

  /* The mapping, kept in a ref so the frame loop is not rebuilt every render. */
  const padas = useRef<PadaAt[]>([]);
  useEffect(() => { padas.current = padasOfDoc(doc); }, [doc]);

  useEffect(() => {
    const audio = el.current;
    if (audio === null) return;
    const onMeta = (): void => { setDuration(audio.duration); setReady(true); };
    const onEnd = (): void => setPlaying(false);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  /* The speed in a ref as well as in state: `start` must not hold a closure
     over a speed that was current when it was built. */
  const speed = useRef(rate);
  useEffect(() => {
    speed.current = rate;
    if (el.current !== null) applyRate(el.current, rate);
  }, [rate]);

  /*
   * THE FRAME LOOP.
   *
   * Runs only while something is playing — a rAF that never stops keeps a
   * laptop's GPU awake for a document nobody is listening to. It does three
   * things: stops at the end of a segment, loops it if asked, and moves the
   * highlight.
   */
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let lit: Element | null = null;

    const light = (p: PadaAt | null): void => {
      const next = p === null
        ? null
        : document.querySelector(`[data-verse="${p.verseId}"] .pada[data-line="${p.line}"]`);
      if (next === lit) return;
      lit?.classList.remove('is-sung');
      next?.classList.add('is-sung');
      lit = next;
    };

    const tick = (): void => {
      const audio = el.current;
      if (audio === null) return;
      const t = audio.currentTime;
      setAt(t);

      const stop = until.current;
      if (stop !== null && t >= stop - SEG_LEAD) {
        if (loop) {
          audio.currentTime = from.current;
        } else {
          audio.pause();
          setPlaying(false);
          light(null);
          setSung(null);
          return;
        }
      }

      const here = padas.current.find((p) => t >= p.start && t < p.end) ?? null;
      light(here);
      setSung((was) => (was?.verseId === here?.verseId && was?.line === here?.line ? was : here));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      lit?.classList.remove('is-sung');
    };
  }, [playing, loop]);

  /* A blob URL is a handle on a file the browser is holding open; letting one
     leak keeps a 40 MB take in memory for the life of the tab. */
  useEffect(() => () => {
    if (object.current !== null) URL.revokeObjectURL(object.current);
  }, []);

  const open = useCallback(async (chosen: File): Promise<void> => {
    const audio = el.current;
    if (audio === null) return;
    if (object.current !== null) URL.revokeObjectURL(object.current);
    const url = URL.createObjectURL(chosen);
    object.current = url;
    setFile(chosen);
    setName(chosen.name);
    setReady(false);
    audio.src = url;
    audio.load();
    await new Promise<void>((done) => {
      const once = (): void => { audio.removeEventListener('loadedmetadata', once); done(); };
      audio.addEventListener('loadedmetadata', once);
    });
  }, []);

  /*
   * WHICH PLAY IS THE WANTED ONE.
   *
   * `startAt` awaits a load and a seek, and a person clicking down a chant
   * pāda by pāda starts a second play inside that wait. Without a token the
   * first one resumes after the second and the wrong line sounds. Bumped by
   * every start, and by pause and seek, so a play that is no longer wanted
   * cannot come back.
   */
  const wanted = useRef(0);

  const start = useCallback((src: string | null, begin: number, end: number | null): void => {
    const audio = el.current;
    if (audio === null) return;
    if (src === null && audio.src === '') return;
    /* Only change the shown name when the source really differs: `startAt`
       leaves the element alone in that case, and renaming it would say a
       different file was playing. */
    if (src !== null && !audio.src.endsWith(src) && audio.src !== src) {
      setName(src.split('/').pop() ?? src);
    }
    const mine = wanted.current + 1;
    wanted.current = mine;
    from.current = begin;
    until.current = end;
    void startAt(audio, {
      src, at: begin, rate: speed.current, alive: () => mine === wanted.current,
    }).then((ok) => setPlaying(ok));
  }, []);

  const playPada = useCallback((verseId: string, line: number) => {
    const p = padasOfDoc(doc).find((x) => x.verseId === verseId && x.line === line);
    if (p === undefined) return;
    start(object.current ?? sourceFor(doc, verseId), p.start, p.end);
  }, [doc, start]);

  const playVerse = useCallback((verseId: string) => {
    const mine = padasOfDoc(doc).filter((p) => p.verseId === verseId);
    const first = mine[0];
    const last = mine[mine.length - 1];
    if (first === undefined || last === undefined) return;
    start(object.current ?? sourceFor(doc, verseId), first.start, last.end);
  }, [doc, start]);

  const playAll = useCallback(() => {
    const audio = el.current;
    if (audio === null) return;
    if (playing) { wanted.current += 1; audio.pause(); setPlaying(false); return; }
    const all = padasOfDoc(doc);
    const first = all[0];
    const src = object.current ?? (first === undefined ? null : sourceFor(doc, first.verseId));
    /* Resume where it was paused rather than starting over — the one thing a
       transport must not do is lose someone's place. */
    start(src, audio.currentTime > 0 && audio.currentTime < audio.duration ? audio.currentTime : 0, null);
  }, [doc, playing, start]);

  const pause = useCallback(() => {
    wanted.current += 1;
    el.current?.pause();
    setPlaying(false);
  }, []);

  const seek = useCallback((t: number) => {
    const audio = el.current;
    if (audio === null) return;
    audio.currentTime = Math.max(0, Math.min(t, audio.duration || t));
    setAt(audio.currentTime);
    /* Seeking out of a segment means the segment is no longer what is playing,
       and a start that is still waiting on a load must not seek back. */
    until.current = null;
    wanted.current += 1;
  }, []);

  return {
    name,
    file,
    ready,
    playing,
    duration,
    at,
    rate,
    loop,
    setRate,
    setLoop,
    open,
    playVerse,
    playPada,
    playAll,
    pause,
    seek,
    sung,
  };
}
