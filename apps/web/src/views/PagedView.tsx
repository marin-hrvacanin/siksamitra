/**
 * The paged view — "exactly how it will export".
 *
 * The promise is narrow and worth stating: the pages drawn here come from the
 * SAME page map the exporter uses. Not a similar calculation, the same one. So
 * the preview cannot drift from the export, because there is nothing to drift
 * between.
 *
 * How it works, in order:
 *   1. A hidden probe renders the document at the page's content width, at
 *      zoom 1, and `useMeasure` reads every block's height in POINTS.
 *   2. `paginate` places those heights onto pages. It takes no zoom argument.
 *   3. Each page draws only the blocks the map assigned to it, scaled to the
 *      current zoom.
 *
 * Step 1 is the expensive one and it runs only when the content or the column
 * width changes — never on zoom, which is what keeps breaks stable.
 */

import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import type { ChantDoc, ChantScriptKey } from '@siksamitra/format';
import { contentBox, paginate, px, type PageGeometry } from '@siksamitra/layout';
import { DocumentBlocks } from './DocumentBlocks.js';
import { KEEP_WITH_NEXT } from './blocks.js';
import { useMeasuredBlocks } from './useMeasure.js';

/**
 * Blocks that must not be left alone at the foot of a page.
 *
 * The list is the renderer's, not this file's: it knew only `h:` while the
 * renderer had grown part headings and instructions, so a part heading could
 * be left at the foot of a page with its steps overleaf.
 */
const isHeading = (id: string): boolean => KEEP_WITH_NEXT.some((p) => id.startsWith(p));

export function PagedView(
  {
    doc, script, showMarks, page, zoom, contentKey, addressable = false, rebuild = 0,
    selectedFigure, onFigure,
  }: {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    page: PageGeometry;
    zoom: number;
    /** Changes when the document changes, to trigger re-measurement. */
    contentKey: string;
    /** The editor is drawing: letters carry `data-u` so a click finds them. */
    addressable?: boolean;
    /** Forces a rebuild rather than a patch — see `Session.rebuild`. The key
     *  goes on each page's content, never on the measuring probe. */
    rebuild?: number;
    /** The picture the editor has selected, and how one is chosen. Passed
     *  through to `DocumentBlocks`; this view has no opinion about either. */
    selectedFigure?: string;
    onFigure?: (blockId: string, sectionId: string, at: number) => void;
  },
): ReactNode {
  const probe = useRef<HTMLDivElement>(null);
  const measured = useMeasuredBlocks(probe, page, contentKey);
  const { width: column, height: columnHeight } = contentBox(page);

  const map = useMemo(() => paginate(
    measured.map((m) => ({
      id: m.id,
      height: m.height,
      keepWithNext: isHeading(m.id),
      // A verse may split between its lines; a heading may not split at all.
      ...(isHeading(m.id) || m.lines === undefined
        ? {}
        : { breakable: true, lines: m.lines }),
    })),
    page,
  ), [measured, page]);

  return (
    <div className="paged">
      {/*
        The probe. Off-screen but LAID OUT — `visibility: hidden` rather than
        `display: none`, because a display-none subtree has no geometry and
        every measurement comes back zero. Its width is the page's content box
        at zoom 1, so the lines it measures are the lines the page will hold.
      */}
      <div
        /*
         * `doc`, LIKE THE PAGE — and the omission was not cosmetic. The
         * document's type is scoped to that class, so a probe without it was
         * measured under the inherited stylesheet's 19.44 pt on 37.9 pt: every
         * verse came back 1.6x too tall and a page that holds five held three.
         * A probe styled differently from the page it stands in for measures a
         * different document.
         */
        className="doc paged__probe"
        aria-hidden
        ref={probe}
        /*
         * THE PICTURE CAP IS ON THE PROBE TOO, at zoom 1 like everything it
         * measures. A probe without it measures a figure at its natural height
         * and the page draws it capped, so the page map would reserve space
         * for a picture that is not that tall.
         */
        style={{
          width: `${px(column, 1)}px`,
          ...({ '--doc-fig-max-h': `${px(columnHeight, 1)}px` } as CSSProperties),
        }}
      >
        <DocumentBlocks doc={doc} script={script} showMarks={showMarks} />
      </div>

      {measured.length === 0 ? (
        <p className="paged__measuring">Measuring…</p>
      ) : (
        map.pages.map((p) => {
          const ids = new Set(p.blocks.map((b) => b.id));
          return (
            <section
              className="page"
              key={p.index}
              style={{
                width: `${px(page.width, zoom)}px`,
                height: `${px(page.height, zoom)}px`,
                paddingTop: `${px(page.margins.top, zoom)}px`,
                paddingRight: `${px(page.margins.right, zoom)}px`,
                paddingBottom: `${px(page.margins.bottom, zoom)}px`,
                paddingLeft: `${px(page.margins.left, zoom)}px`,
              }}
              data-page={p.index + 1}
            >
              {/* Zoom as a multiplier, not a font-size — see `FlowView`. */}
              <div
                key={rebuild}
                contentEditable={addressable}
                suppressContentEditableWarning
                spellCheck={false}
                {...(addressable ? { role: 'textbox', 'aria-multiline': true, 'aria-label': 'The document' } : {})}
                className="doc page__content"
                style={{
                  ...({ '--doc-zoom': String(zoom) } as CSSProperties),
                  ...({ '--doc-fig-max-h': `${px(columnHeight, zoom)}px` } as CSSProperties),
                }}
              >
                <DocumentBlocks
                  doc={doc}
                  script={script}
                  showMarks={showMarks}
                  only={ids}
                  addressable={addressable}
                  {...(selectedFigure === undefined ? {} : { selectedFigure })}
                  {...(onFigure === undefined ? {} : { onFigure })}
                />
              </div>
              {/*
                THE RUNNING HEAD, where his own pages carry it: in the top
                margin, the document's name centred and the folio at the right,
                over a hairline. Measured off his PDF — the head sets at 12 pt
                (the `Header` style) and its baseline is 33.8 pt from the trim,
                which is inside the 25 mm margin rather than in the text
                column. The folio used to sit alone in the bottom corner,
                which is furniture no VU page has.
              */}
              <header
                className="page__head"
                aria-hidden
                style={{
                  top: `${px(page.margins.top / 2, zoom)}px`,
                  left: `${px(page.margins.left, zoom)}px`,
                  right: `${px(page.margins.right, zoom)}px`,
                }}
              >
                <span className="page__head-name">{doc.title}</span>
                <span className="page__folio">{p.index + 1}</span>
              </header>
            </section>
          );
        })
      )}
    </div>
  );
}
