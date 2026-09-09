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
  FIGURE_DEFAULTS, isEmbeddedImage, type ChantFigure,
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
  { fig, resolve = EMBEDDED_ONLY, blockId, selected = false, onSelect }: FigureProps,
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
      {...(onSelect === undefined ? {} : {
        onMouseDown: (e: MouseEvent): void => { e.preventDefault(); onSelect(); },
      })}
    >
      {captionAt === 'above' ? cap : null}
      <div className="fig__box">
        <Picture fig={fig} url={url} />
      </div>
      {captionAt === 'above' ? null : cap}
    </figure>
  );
}
