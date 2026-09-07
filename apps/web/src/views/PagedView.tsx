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

import { useMemo, useRef, type ReactNode } from 'react';
import type { ChantDoc, ChantScriptKey } from '@siksamitra/format';
import { contentBox, paginate, px, type PageGeometry } from '@siksamitra/layout';
import { DocumentBlocks } from './DocumentBlocks.js';
import { useMeasuredBlocks } from './useMeasure.js';

/** Blocks that must not be left alone at the foot of a page. */
const isHeading = (id: string): boolean => id.startsWith('h:');

export function PagedView(
  { doc, script, showMarks, page, zoom, contentKey }: {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    page: PageGeometry;
    zoom: number;
    /** Changes when the document changes, to trigger re-measurement. */
    contentKey: string;
  },
): ReactNode {
  const probe = useRef<HTMLDivElement>(null);
  const measured = useMeasuredBlocks(probe, page, contentKey);
  const column = contentBox(page).width;

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
        className="paged__probe"
        aria-hidden
        ref={probe}
        style={{ width: `${px(column, 1)}px` }}
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
              <div className="page__content chant-marks" style={{ fontSize: `${zoom}rem` }}>
                <DocumentBlocks doc={doc} script={script} showMarks={showMarks} only={ids} />
              </div>
              <footer className="page__folio" aria-hidden>
                {p.index + 1} / {map.pages.length}
              </footer>
            </section>
          );
        })
      )}
    </div>
  );
}
