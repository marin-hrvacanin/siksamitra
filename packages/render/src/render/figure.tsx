/**
 * A picture on the page — the ONE component that draws one.
 *
 * Every surface goes through here: the flow, paged and web views of the editor
 * (`DocumentBlocks`), the reader (`ChantReader`'s `FigureView`), the print
 * sheet and every export, because an export renders the views. There is no
 * second `<img>` anywhere, which is what makes "the picture you see is the
 * picture you send" true rather than hoped for.
 *
 * NOTHING HERE DECIDES A SIZE. The class names say which of the five steps the
 * figure is; `figure.css` turns that into a width, and the widths are tokens.
 * A component that also knew a number would be a second place to change one.
 *
 * THE RESOLVER IS THE WHOLE SEAM.
 *
 * A `src` is either the bytes (`data:…`) or a name only the host can turn into
 * a URL — the platform serves `/figures/…`, a packaged desktop app resolves
 * against its own bundle. So the host supplies `resolve`, and the default
 * resolves the bytes and nothing else.
 *
 * That default is not timidity. The lossless `.html` export must contain no URL
 * it would have to fetch, and its gate counts them; an exporter that emitted
 * `/figures/step-dipa.png` would produce a file that looks complete on the
 * machine that wrote it and shows a broken image everywhere else. A picture the
 * document does not carry draws as a PLACEHOLDER carrying its alt text, in the
 * editor and in the export alike — so the preview cannot be right while the
 * export is wrong, which is the failure this codebase refuses everywhere else.
 */
import type { MouseEvent, ReactNode } from 'react';
import {
  FIGURE_DEFAULTS, FIGURE_MAX_PCT, FIGURE_MIN_PCT, isEmbeddedImage, type ChantFigure,
} from '@siksamitra/format';

/** Turn a figure's `src` into something an `<img>` can load, or `null`. */
export type ResolveFigureSrc = (src: string) => string | null;

/** The bytes, and nothing else. See the header for why this is the default. */
export const EMBEDDED_ONLY: ResolveFigureSrc = (src) => (isEmbeddedImage(src) ? src : null);

export interface FigureProps {
  fig: ChantFigure;
  /** How a `src` becomes a URL. Defaults to `EMBEDDED_ONLY`. */
  resolve?: ResolveFigureSrc;
  /**
   * The id the page map knows this block by, when it is one.
   *
   * Only the document views set it: pagination measures `[data-block-id]`, and
   * the reader has no pages. Passing it from outside rather than deriving it
   * here keeps `blockId` in one file.
   */
  blockId?: string;
  /** The editor is drawing, and this picture is the one selected. */
  selected?: boolean;
  /**
   * Take the selection. Only the editor passes one.
   *
   * On `mousedown` rather than `click`, because the page is `contenteditable`
   * and the browser places a caret on mousedown — by click time the selection
   * has already moved and the status bar is reporting a column inside a verse
   * the person did not point at.
   */
  onSelect?: () => void;
  /**
   * A corner was dragged. The width, in per cent of the column.
   *
   * The editor passes it; the reader and every export do not, so no handle is
   * drawn and nothing is draggable on a page meant to be read.
   *
   * Called ONCE, when the button comes up. It used to be called on every
   * mousemove, which put forty figure commands into the history for one drag —
   * so Ctrl+Z after resizing a picture gave back a width nobody had stopped
   * at, forty times. What the person sees while dragging is the element's own
   * inline width; the document hears about it when the gesture ends.
   */
  onResize?: (pct: number) => void;
  /**
   * The picture itself was pressed, and the pointer may be about to move.
   *
   * The renderer does not know where a picture MAY go — that is the document's
   * item list and the page it is drawn on — so it reports the gesture and the
   * editor runs it. See `figure-drag.ts`.
   */
  onGrab?: (e: MouseEvent) => void;
}

/**
 * Dragging a corner, from the mousedown that started it.
 *
 * The width is measured against the COLUMN the picture stands in, because
 * that is what the stored figure is a percentage of — measuring against the
 * window would make the same drag mean different widths at different zooms.
 *
 * The listeners go on the window and not on the handle: a fast drag leaves the
 * handle behind, and a pointer that has left the element still belongs to the
 * gesture until the button comes up.
 */
function startResize(
  e: MouseEvent,
  corner: 'nw' | 'ne' | 'sw' | 'se',
  onResize: (pct: number) => void,
): void {
  const handle = e.currentTarget as HTMLElement;
  const figure = handle.closest('.fig') as HTMLElement | null;
  const column = figure?.parentElement;
  if (figure === null || column === null || column === undefined) return;

  const startX = e.clientX;
  const startW = figure.getBoundingClientRect().width;
  const columnW = column.getBoundingClientRect().width;
  if (columnW <= 0) return;
  /* A west handle grows the picture when the pointer moves LEFT. */
  const sign = corner === 'nw' || corner === 'sw' ? -1 : 1;

  let pct = Math.round((startW / columnW) * 100);
  const move = (ev: globalThis.MouseEvent): void => {
    const next = startW + sign * (ev.clientX - startX);
    pct = Math.max(
      FIGURE_MIN_PCT, Math.min(FIGURE_MAX_PCT, Math.round((next / columnW) * 100)),
    );
    /* The preview is the element's own width. The DOCUMENT is told once, at
       the end — see the note on `onResize`. */
    figure.style.width = `${pct}%`;
  };
  const up = (): void => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    document.body.classList.remove('is-resizing');
    onResize(pct);
  };
  document.body.classList.add('is-resizing');
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

/** The classes that say what this figure is. `figure.css` does the rest. */
export function figureClassName(fig: ChantFigure, selected = false): string {
  const captionAt = fig.captionAt ?? FIGURE_DEFAULTS.captionAt;
  return [
    'fig',
    `fig--${fig.size ?? FIGURE_DEFAULTS.size}`,
    `fig--flow-${fig.flow ?? FIGURE_DEFAULTS.flow}`,
    `fig--cap-${captionAt}`,
    `fig--frame-${fig.frame ?? FIGURE_DEFAULTS.frame}`,
    fig.rounded === false ? 'fig--square-corners' : 'fig--rounded',
    selected ? 'is-selected' : '',
  ].filter((c) => c !== '').join(' ');
}

/**
 * The picture itself, or the plate that says it is not here.
 *
 * `loading="lazy"` and `decoding="async"` are for a reader scrolling a manual
 * of 22 figures. They cost nothing in an export, where the whole file is
 * already in memory.
 *
 * The intrinsic `width`/`height` are written whenever the document knows them,
 * because that is what reserves the aspect box before the bytes decode — a
 * figure landing mid-step must never push the mantra being read down the
 * screen.
 */
function Picture({ fig, url }: { fig: ChantFigure; url: string | null }): ReactNode {
  if (url === null) {
    /*
     * NOT AN ERROR STATE, AND NOT SILENT. The pūjā manual names 22 pictures
     * that live on the platform, so a document with none of its bytes is a
     * normal thing to open here. What is refused is drawing nothing: the alt
     * text is the instruction, and a reader who cannot see the picture still
     * needs it.
     */
    return (
      <div className="fig__missing">
        <span className="fig__missing-eyebrow">picture not in this file</span>
        <span className="fig__missing-alt">{fig.alt}</span>
      </div>
    );
  }
  const img = (
    <img
      className="fig__img"
      src={url}
      alt={fig.alt}
      loading="lazy"
      decoding="async"
      {...(fig.width === undefined ? {} : { width: fig.width })}
      {...(fig.height === undefined ? {} : { height: fig.height })}
    />
  );
  if (fig.srcDark === undefined) return img;
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={fig.srcDark} />
      {img}
    </picture>
  );
}

/**
 * One figure, drawn.
 *
 * `<figure>`/`<figcaption>`, so the caption is ASSOCIATED with the picture
 * rather than merely near it — that association is the whole reason the
 * elements exist, and a screen reader reads the two as one thing.
 */
export function Figure(
  {
    fig, resolve = EMBEDDED_ONLY, blockId, selected = false, onSelect, onResize, onGrab,
  }: FigureProps,
): ReactNode {
  const captionAt = fig.captionAt ?? FIGURE_DEFAULTS.captionAt;
  const caption = captionAt === 'none' ? undefined : fig.caption?.en;
  const url = resolve(fig.src);
  const cap = caption === undefined || caption === ''
    ? null
    : <figcaption className="fig__cap" lang="en">{caption}</figcaption>;

  return (
    <figure
      className={figureClassName(fig, selected)}
      data-crop={fig.crop ?? FIGURE_DEFAULTS.crop}
      data-figure={fig.id}
      {...(blockId === undefined ? {} : { 'data-block-id': blockId })}
      /*
       * NOT EDITABLE, even inside the editable column.
       *
       * The document views make the whole column `contenteditable`, and
       * without this the browser treats the picture as content it owns: the
       * caret walks into it, a Backspace beside it deletes the `<img>` from
       * the DOM, and the document knows nothing about either. A picture is
       * changed through a command, like everything else here.
       */
      contentEditable={false}
      {...(fig.widthPct === undefined ? {} : {
        style: { width: `${fig.widthPct}%` },
      })}
      {...(onSelect === undefined && onGrab === undefined ? {} : {
        onMouseDown: (e: MouseEvent): void => {
          e.preventDefault();
          onSelect?.();
          /* Selecting first, so the gesture that follows is about the picture
             the person is holding rather than the one that was selected
             before it. */
          onGrab?.(e);
        },
      })}
    >
      {captionAt === 'above' ? cap : null}
      <div className="fig__box">
        <Picture fig={fig} url={url} />
      </div>
      {captionAt === 'above' ? null : cap}
      {/*
        THE FOUR CORNER HANDLES, drawn only on the selected picture in the
        editor. Word's arrangement: corners resize, and there are no side
        handles because a side handle changes the aspect ratio, which for a
        photograph of a mudrā is a wrong picture rather than a resized one.
      */}
      {selected && onResize !== undefined && (
        <span className="fig__handles" aria-hidden>
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
            <span
              key={corner}
              className={`fig__handle fig__handle--${corner}`}
              onMouseDown={(e: MouseEvent): void => {
                e.preventDefault();
                e.stopPropagation();
                startResize(e, corner, onResize);
              }}
            />
          ))}
        </span>
      )}
    </figure>
  );
}
