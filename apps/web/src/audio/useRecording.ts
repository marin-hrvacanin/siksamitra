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
import { clipOf, clipsOfDoc, padasOfDoc, sourceFor, versesWithAudio, type PadaAt } from './clips.js';
import { applyRate, SEG_LEAD, startAt } from '@siksamitra/render';
import { resolveMedia } from '../shell/media.js';

export interface Recording {
  /** What is loaded, if anything — a name to show, not a path. */
  readonly name: string | null;
  /** Whether the DOCUMENT has a recitation, whether or not one is loaded. */
  readonly mapped: boolean;
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

export { clipOf, clipsOfDoc, padasOfDoc, sourceFor, versesWithAudio } from './clips.js';
export type { PadaAt } from './clips.js';

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
  /**
   * The clip the element is on, and the verse it belongs to.
   *
   * A chant is one file per verse, so "what is playing" is a file, and both
   * the highlight and the advance need it. `verse` is what a clip ending has
   * to look up in order to know which one comes next.
   */
  const onAir = useRef<{ file: string | null; verse: string | null }>({ file: null, verse: null });

  if (el.current === null && typeof Audio !== 'undefined') {
    el.current = new Audio();
    el.current.preload = 'auto';
  }

  /*
   * THE ELEMENT GOES IN THE PAGE, hidden.
   *
   * `new Audio()` is a real media element and plays perfectly well detached —
   * but nothing can SEE it. `document.querySelector('audio')` found nothing,
   * so a browser gate could not tell "the recitation is playing" from "the
   * recitation is silently failing to load", and neither could dev tools, and
   * neither could anyone reading the page's accessibility tree. That is the
   * whole reason audio could be broken for this long without a check going
   * red. The platform's reader has always had a real `<audio>` in its tree.
   *
   * It costs nothing: an element with no controls and `hidden` draws nothing.
   */
  useEffect(() => {
    const audio = el.current;
    if (audio === null || typeof document === 'undefined') return;
    audio.hidden = true;
    audio.setAttribute('data-recitation', '');
    document.body.append(audio);
    return () => { audio.remove(); };
  }, []);

  /* The mapping, kept in a ref so the frame loop is not rebuilt every render. */
  const padas = useRef<PadaAt[]>([]);
  useEffect(() => { padas.current = padasOfDoc(doc); }, [doc]);

  useEffect(() => {
    const audio = el.current;
    if (audio === null) return;
    const onMeta = (): void => { setDuration(audio.duration); setReady(true); };
    /*
     * A CLIP ENDING IS NOT THE CHANT ENDING.
     *
     * One `.mp3` per verse, so Play used to stop after the first one — fifteen
     * seconds of a nine-verse sūktam — and the only way through a chant was to
     * press a button per verse. What ends a run is running out of verses, a
     * segment that asked to stop (`until`), or a person pausing.
     */
    const onEnd = (): void => { if (!advance.current()) setPlaying(false); };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  /* Behind a ref, so the listener above is registered once and still sees the
     current document. */
  const advance = useRef<() => boolean>(() => false);

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

      /* IN THIS CLIP. Every verse's mp3 starts at zero, so a bare time matches
         a pāda in most of them; the file is what makes the answer one line. */
      const clip = onAir.current.file;
      const here = padas.current.find(
        (p) => (clip === null || p.file === clip) && t >= p.start && t < p.end,
      ) ?? null;
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

  const start = useCallback((
    src: string | null, begin: number, end: number | null, verseId: string | null = null,
  ): void => {
    const audio = el.current;
    if (audio === null) return;
    if (src === null && audio.src === '') return;
    /* Which clip is on air, for the highlight and for what plays next. The
       document's own name, not the resolved URL — that is what a pāda carries. */
    onAir.current = {
      file: verseId === null ? onAir.current.file : (clipOf(doc, verseId) ?? onAir.current.file),
      verse: verseId ?? onAir.current.verse,
    };
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
    /*
     * THE ONE PLACE A DOCUMENT'S PATH BECOMES A URL.
     *
     * `sourceFor` gives the document's own `/tests/durga-suktam/audio/…`,
     * which is a path this program does not serve — every fetch 404'd, and an
     * `<audio>` element that cannot load fails where nobody is listening, so
     * Play was a button that did nothing at all, in silence. `resolveMedia`
     * answers where those paths are, once, from one configurable value; a
     * `blob:` from a file somebody opened is already resolved and passes
     * through untouched. See `shell/media.ts`.
     */
    void startAt(audio, {
      src: src === null ? null : resolveMedia(src),
      at: begin,
      rate: speed.current,
      alive: () => mine === wanted.current,
    }).then((ok) => setPlaying(ok));
  }, [doc]);

  const playPada = useCallback((verseId: string, line: number) => {
    const p = padasOfDoc(doc).find((x) => x.verseId === verseId && x.line === line);
    if (p === undefined) return;
    start(object.current ?? sourceFor(doc, verseId), p.start, p.end, verseId);
  }, [doc, start]);

  /**
   * PLAY ONE VERSE — mapped or not.
   *
   * The bounds used to come from the verse's pādas, so a verse with no `lines`
   * had no first and no last and this returned having done nothing. That is
   * seven of the eight verses of the document the app opens, and all
   * twenty-four of Puruṣa Sūktam: pressing Play on the verse did nothing, in
   * silence, which read as "the audio is broken" because it was.
   *
   * A clip is one verse's recitation, so with no mapping the answer is simply
   * the WHOLE clip: from zero, with no end. `lines` narrows that when a verse
   * has been mapped and a person asked for less than all of it.
   */
  const playVerse = useCallback((verseId: string) => {
    const src = object.current ?? sourceFor(doc, verseId);
    if (src === null) return;
    const mine = padasOfDoc(doc).filter((p) => p.verseId === verseId);
    const first = mine[0];
    const last = mine[mine.length - 1];
    if (first === undefined || last === undefined) { start(src, 0, null, verseId); return; }
    start(src, first.start, last.end, verseId);
  }, [doc, start]);

  const playAll = useCallback(() => {
    const audio = el.current;
    if (audio === null) return;
    if (playing) { wanted.current += 1; audio.pause(); setPlaying(false); return; }
    /* Where it was paused rather than the beginning — the one thing a
       transport must not do is lose someone's place. */
    const resume = audio.currentTime > 0 && audio.currentTime < audio.duration
      ? audio.currentTime : 0;
    if (object.current !== null) { start(object.current, resume, null); return; }
    /* The first CLIP, not the first pāda: an unmapped chant has no pādas and
       every verse of it is still playable. */
    const verse = onAir.current.verse ?? clipsOfDoc(doc)[0]?.verseId ?? null;
    if (verse === null) { start(null, resume, null); return; }
    start(sourceFor(doc, verse), onAir.current.verse === null ? 0 : resume, null, verse);
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

  /*
   * WHAT PLAYS NEXT when a clip runs out. `false` means nothing does.
   *
   * Not while a single pāda or verse is playing — `until` says the person
   * asked for that much and no more — and not for a take opened off a disk,
   * which is one file for the whole chant and has nothing after it.
   */
  advance.current = (): boolean => {
    if (until.current !== null || object.current !== null) return false;
    /* The document's order. Taken from the mapping it was the order the CLIP
       NAMES sort in, so śiva saṅkalpa sūktam — v-1.mp3 … v-39.mp3 — advanced
       v-1, v-10, v-11, and puruṣa sūktam, whose clips are named after the
       millisecond they were cut at, advanced in no order at all. */
    const order = versesWithAudio(doc);
    const now = onAir.current.verse;
    const next = now === null ? order[0] : order[order.indexOf(now) + 1];
    if (next === undefined) return false;
    start(sourceFor(doc, next), 0, null, next);
    return true;
  };

  return {
    name,
    /* The DOCUMENT has a recitation — clips, not pādas. Asking the mapping
       made the dock invisible for every document but the one that is mapped. */
    mapped: clipsOfDoc(doc).length > 0,
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
