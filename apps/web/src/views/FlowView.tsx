/**
 * The flow view — continuous scroll, for writing.
 *
 * The default, because an author spends their day here. No page furniture and
 * nothing that moves while you type: a break indicator that jumped as you
 * added a syllable would pull the eye off the word being edited.
 *
 * The column is the PAGE's content box, not an arbitrary reading measure, so a
 * line that fits here fits on paper. Switching to pages then reflows nothing —
 * which is what makes the two views feel like one document.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { ChantDoc, ChantScriptKey } from '@siksamitra/format';
import { contentBox, px, type PageGeometry } from '@siksamitra/layout';
import { DocumentBlocks } from './DocumentBlocks.js';

export function FlowView(
  {
    doc, script, showMarks, page, zoom, addressable = false, web = false, rebuild = 0,
    selectedFigure, onFigure,
  }: {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    page: PageGeometry;
    zoom: number;
    /** The editor is drawing: letters carry `data-u` so a click finds them. */
    addressable?: boolean;
    /**
     * A COUNTER THAT FORCES A REBUILD, used as the `key` on the page.
     *
     * Changing a React key throws the old DOM away instead of patching it,
     * which is the only way to be rid of text an IME wrote into the page
     * behind React's back — see `Session.rebuild`. It changes once per
     * composition and never during ordinary typing.
     */
    rebuild?: number;

    /**
     * NO PAGE — the web shape.
     *
     * The same document, laid out as HTML: no sheet, no paper margins, no page
     * width. It fills the window with a reading measure, which is what a web
     * page is and what the third view mode means.
     */
    web?: boolean;

    /** The picture the editor has selected, and how one is chosen. Passed
     *  through to `DocumentBlocks`; this view has no opinion about either. */
    selectedFigure?: string;
    onFigure?: (blockId: string, sectionId: string, at: number) => void;
  },
): ReactNode {
  const picture = {
    ...(selectedFigure === undefined ? {} : { selectedFigure }),
    ...(onFigure === undefined ? {} : { onFigure }),
  };
  if (web) {
    return (
      <div className="flow flow--web">
        <div
          key={rebuild}
          contentEditable={addressable}
          suppressContentEditableWarning
          spellCheck={false}
          {...(addressable ? { role: 'textbox', 'aria-multiline': true, 'aria-label': 'The document' } : {})}
          className="doc web__column"
          /*
           * NO PICTURE CAP HERE, and that is not an omission. The cap exists so
           * a figure can never be taller than the page it has to be placed on;
           * the web shape has no page, so there is nothing for a tall picture
           * to break across and capping it would shrink a picture for a reason
           * that does not apply.
           */
          style={{ ...({ '--doc-zoom': String(zoom) } as CSSProperties) }}
        >
          <DocumentBlocks
            doc={doc}
            script={script}
            showMarks={showMarks}
            addressable={addressable}
            {...picture}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flow">
      <div
        key={rebuild}
        contentEditable={addressable}
        suppressContentEditableWarning
        spellCheck={false}
        {...(addressable ? { role: 'textbox', 'aria-multiline': true, 'aria-label': 'The document' } : {})}
        className="doc flow__column"
        /*
         * Zoom is a MULTIPLIER the document tokens read (`--doc-zoom`), not a
         * font-size on the column: as a font-size it scaled only the values
         * that happened to be in `em`, so the paper grew and the mantra line
         * stayed put. As a custom property every size, leading and indent on
         * the page moves together, because each token is `calc(x * zoom)`.
         */
        /*
         * The paper is the PAGE's width with the PAGE's margins as padding, so
         * the column inside it is the same measure as a page's — switching to
         * Pages reflows nothing, and a verse number has a margin to sit in.
         * It used to be the bare content box with `padding: var(--doc-pad)`, a
         * token no longer emitted by anything: the padding resolved to zero and
         * every line of the document touched the edge of the sheet.
         */
        style={{
          width: `${px(page.width, zoom)}px`,
          paddingTop: `${px(page.margins.top, zoom)}px`,
          paddingRight: `${px(page.margins.right, zoom)}px`,
          paddingBottom: `${px(page.margins.bottom, zoom)}px`,
          paddingLeft: `${px(page.margins.left, zoom)}px`,
          /*
           * THE TALLEST A PICTURE MAY BE, which is the page's content box.
           *
           * A figure cannot be split, so one taller than a page is placed on a
           * page of its own and then overflows it — `paginate` has nowhere
           * else to put it. Capped here, every picture fits, and the flow view
           * shows the same cap as the paged view because both take it from the
           * same geometry. Measured at A4: the content box is 700.2 pt and the
           * tallest a full-width figure gets on its own is 604.7 pt (100 % of a
           * 453.5 pt column at 4:3), so the cap bites only on a picture taller
           * than the page.
           */
          ...({ '--doc-zoom': String(zoom) } as CSSProperties),
          ...({ '--doc-fig-max-h': `${px(contentBox(page).height, zoom)}px` } as CSSProperties),
        }}
      >
        <DocumentBlocks
          doc={doc}
          script={script}
          showMarks={showMarks}
          addressable={addressable}
          {...picture}
        />
      </div>
    </div>
  );
}
