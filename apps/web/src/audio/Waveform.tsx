/**
 * THE RECORDING, DRAWN, WITH THE PĀDA BOUNDARIES ON IT.
 *
 * A mapping is fifty numbers, and fifty numbers cannot be checked by reading
 * them. Drawn against the signal they came from, a boundary that has landed in
 * the middle of a word is obvious at a glance — which is the whole reason this
 * exists, because the mapper's guesses are two or three out of fifty and
 * finding them any other way means listening to the whole take.
 *
 * A CANVAS, AND ONE DOM NODE FOR THE PLAYHEAD. Śrī Rudram is about 300 pādas;
 * 300 absolutely positioned handles is 300 nodes React has to reconcile every
 * time a boundary moves. The strip is drawn in one pass and the pointer is
 * hit-tested against the seam list, which is arithmetic in `nearestSeam`. The
 * playhead is the exception: it moves sixty times a second, and moving one
 * element's `left` is cheaper than repainting the waveform behind it.
 *
 * THE COLOURS COME OUT OF THE THEME, read from the custom properties resolved
 * on this element. A canvas cannot inherit a colour, so this is the one place
 * in the program that turns a token into a string.
 *
 * They are re-read when the APP'S ATTRIBUTES change, watched, rather than when
 * a prop says the theme has. `data-chrome` and `data-mode` are also written
 * straight onto the element by `tools/theme-matrix.mjs` and
 * `tools/walkthrough.mjs`, which never go through React — so a prop leaves the
 * canvas painted in the previous theme's ink while everything drawn in CSS
 * around it has changed. Measured: with the mode flipped to light, the seam was
 * still being painted rgb(232, 232, 236) while `--chrome-ink` resolved to
 * #1b1b1f.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { nearestSeam } from '@siksamitra/audio';
import { useElementWidth } from '../state/useElementWidth.js';
import { peaksOf } from './peaks.js';
import { fractionOf, secondsAt, type View } from './view.js';
import { NUDGE, type SeamKind } from './useMapping.js';
import type { Take } from './take.js';

export interface WaveformProps {
  readonly take: Take | null;
  readonly view: View;
  readonly seams: readonly number[];
  readonly kinds: readonly SeamKind[];
  readonly selected: number | null;
  /** The playhead, in seconds. */
  readonly at: number;
  readonly onSelect: (index: number | null) => void;
  readonly onDrag: (index: number, to: number, settle: boolean) => void;
  readonly onScrub: (at: number) => void;
  /** What the selected boundary is between, for a reader with no picture. */
  readonly says: string | null;
}

/**
 * How close a pointer has to be to a boundary to have meant it, in pixels.
 *
 * Six, because it is wide enough to catch a boundary without pixel-hunting
 * and still narrow enough that two boundaries a pāda apart cannot both be
 * under the cursor at any zoom worth dragging at.
 */
const GRAB_PX = 6;

export function Waveform(props: WaveformProps): ReactNode {
  const {
    take, view, seams, kinds, selected, at, onSelect, onDrag, onScrub, says,
  } = props;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useElementWidth(box);
  /* Which seam the pointer took hold of, if any. In a ref because a drag is a
     stream of events and re-rendering per event is what the canvas avoids. */
  const held = useRef<number | null>(null);
  /* Bumped when the appearance changes, which is the only thing that can make
     an already-correct drawing wrong without any of its inputs moving. */
  const [repaint, setRepaint] = useState(0);

  useEffect(() => {
    const root = box.current?.closest('[data-mode]');
    if (root === null || root === undefined) return;
    const watch = new MutationObserver(() => setRepaint((n) => n + 1));
    watch.observe(root, { attributes: true, attributeFilter: ['data-mode', 'data-chrome'] });
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const parent = box.current;
    if (el === null || parent === null || width === 0) return;
    const height = parent.clientHeight;
    if (height === 0) return;

    /* Device pixels, or a hairline boundary is drawn across two CSS pixels and
       reads as a smudge on a 2× display. */
    const ratio = window.devicePixelRatio || 1;
    el.width = Math.round(width * ratio);
    el.height = Math.round(height * ratio);
    const ctx = el.getContext('2d');
    if (ctx === null) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const css = getComputedStyle(el);
    const ink = (name: string): string => css.getPropertyValue(name).trim();
    const size = (name: string): number => parseFloat(css.getPropertyValue(name)) || 1;
    const hair = size('--border-hair');
    const thick = size('--rule-mark');

    /* The signal first, then everything that says something about it. */
    if (take !== null) {
      const { lo, hi } = peaksOf(
        take.pcm,
        view.from * take.rate,
        view.to * take.rate,
        Math.round(width),
      );
      const middle = height / 2;
      ctx.fillStyle = ink('--chrome-ink-mute');
      for (let x = 0; x < lo.length; x += 1) {
        const top = middle - (hi[x] as number) * middle;
        const bottom = middle - (lo[x] as number) * middle;
        ctx.fillRect(x, top, hair, Math.max(hair, bottom - top));
      }
    }

    const xOf = (t: number): number => fractionOf(view, t) * width;
    const colour: Record<SeamKind, string> = {
      /* Heard, guessed, placed, given. The guess is the DANGER colour on
         purpose: it is the one thing on this strip a person is being asked to
         act on, and the command line already prints it as `?`. The two ends of
         the take recede, because nothing about them needs deciding. */
      breath: ink('--chrome-accent'),
      even: ink('--chrome-danger'),
      hand: ink('--chrome-ink'),
      edge: ink('--chrome-ink-soft'),
    };
    for (const [i, t] of seams.entries()) {
      const x = xOf(t);
      if (x < -thick || x > width + thick) continue;
      const kind = kinds[i] ?? 'even';
      ctx.fillStyle = colour[kind];
      const wide = i === selected ? thick : hair;
      ctx.fillRect(x - wide / 2, 0, wide, height);
      /* A guess gets a foot as well as a line, so it is findable at a glance
         in a strip that has three hundred lines on it. */
      if (kind === 'even') ctx.fillRect(x - thick * 2, height - thick * 2, thick * 4, thick * 2);
    }
  }, [take, view, seams, kinds, selected, width, repaint]);

  const secondsFor = (clientX: number): number => {
    const el = box.current;
    if (el === null) return 0;
    const rect = el.getBoundingClientRect();
    return secondsAt(view, (clientX - rect.left) / Math.max(1, rect.width));
  };

  /** What GRAB_PX is worth in seconds at the zoom currently shown. */
  const reach = (): number => (view.to - view.from) * (GRAB_PX / Math.max(1, width));

  return (
    <div
      className="wave"
      ref={box}
      /*
       * FOCUSABLE, and every gesture has a key. A boundary is dragged with a
       * mouse and nudged with the arrows; without the second there is no way
       * to do this at all without one, and a hundredth of a second is not a
       * distance a hand is good at anyway.
       */
      tabIndex={0}
      role="slider"
      aria-label="Pāda boundaries in the recitation"
      aria-valuemin={view.from}
      aria-valuemax={view.to}
      aria-valuenow={selected === null ? at : (seams[selected] ?? at)}
      aria-valuetext={says ?? 'no boundary selected'}
      onPointerDown={(e) => {
        const t = secondsFor(e.clientX);
        const index = nearestSeam(seams, t, reach());
        box.current?.focus();
        if (index === null) { onSelect(null); onScrub(t); return; }
        held.current = index;
        onSelect(index);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (held.current === null) return;
        onDrag(held.current, secondsFor(e.clientX), false);
      }}
      onPointerUp={(e) => {
        const index = held.current;
        held.current = null;
        if (index === null) return;
        onDrag(index, secondsFor(e.clientX), true);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        if (selected === null) { onSelect(step === 1 ? 0 : seams.length - 1); return; }
        /* Shift moves the boundary; a bare arrow moves the SELECTION. The same
           pairing as everywhere else a list has both a cursor and a value. */
        if (e.shiftKey) {
          const t = seams[selected];
          if (t !== undefined) onDrag(selected, t + step * NUDGE, true);
          return;
        }
        onSelect(Math.min(Math.max(selected + step, 0), seams.length - 1));
      }}
    >
      <canvas className="wave__c" ref={canvas} />
      {/*
        The playhead is a node rather than part of the drawing, so sixty frames
        a second move one `left` instead of repainting three hundred boundaries
        and a waveform behind them.
      */}
      <div className="wave__head" style={{ left: `${fractionOf(view, at) * 100}%` }} />
    </div>
  );
}
