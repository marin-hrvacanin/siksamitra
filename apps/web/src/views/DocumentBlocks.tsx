/**
 * A document as a flat list of measurable blocks.
 *
 * ONE renderer, three views. Flow, paged and web all render THIS — the
 * difference between them is the container it sits in and the theme it sits
 * under, never how a mark is drawn. That is what makes the modes
 * interchangeable rather than three lookalikes that drift apart.
 *
 * Every block carries `data-block-id` so `useMeasure` can find it, and every
 * rendered line carries `data-line` so a long verse can be split between lines
 * rather than mid-line.
 *
 * WHAT A DOCUMENT IS MADE OF, and it is more than verses. This drew section
 * headings and verses and nothing else, so a page of Durgā Sūktam showed nine
 * verses and dropped all eighteen translations on the floor — and a page of
 * the pūjā manual dropped 212 instructions and 54 part headings with them.
 * The document says what it holds; the renderer's job is to draw all of it, in
 * the order `items` gives, which is the format's canonical order.
 *
 * STILL NOT DRAWN: embeds. They are declared in the format and carried through
 * the file untouched, but nothing here renders one yet. Named here rather than
 * silently skipped.
 *
 * FIGURES ARE DRAWN, and by the render package's one `Figure` component — the
 * same one the reader uses — so a picture is the same picture in the flow view,
 * on a page, on the web, in the reader and in every export. This file decides
 * only WHERE it goes in the block order and what the page map calls it; how
 * wide it is and how the text moves around it are `figure.css`, and the widths
 * are tokens.
 */

import { Fragment, memo, type MouseEvent, type ReactNode } from 'react';
import type {
  ChantDoc, ChantScriptKey, ChantToken, ChantVerse,
} from '@siksamitra/format';
import { Figure, MissingFigure, holdJoins } from '@siksamitra/render';
import { blockId, figureOf, headingOf, itemsOf, sourceOf } from './blocks.js';
import type { GrabPoint } from '../editor/figure-drag.js';
import { renderToken, unitsBefore, type TokenContext } from './token-renderers.js';

const FONT_STACK = 'var(--doc-verse-face)';

/**
 * One verse, split into lines at its `br` tokens.
 *
 * The lines matter for two reasons: pagination splits between them, and a
 * recitation line is a breath — so it is a real unit of the text and not a
 * consequence of the column width.
 */
function VerseLines(
  { verse, script, showMarks, addressable, number, range }: {
    verse: ChantVerse; script: ChantScriptKey; showMarks: boolean; addressable: boolean;
    /** The page's own verse number, drawn in the gutter of the FIRST line. */
    number?: string;
    /**
     * Which lines this copy draws, `[first, last]` inclusive — the page map's
     * `lineRange`, for a verse a page break runs through. Absent means all of
     * them, which is every view but the paged one.
     */
    range?: readonly [number, number];
  },
): ReactNode {
  // Split at `br`: a recitation line is a BREATH, so it is a real unit of the
  // text and not a consequence of the column width. Pagination splits between
  // these, never inside one.
  const lines: ChantToken[][] = [[]];
  for (const t of verse.tokens) {
    if (t.t === 'br') lines.push([]);
    else lines[lines.length - 1]!.push(t);
  }
  const ctx: TokenContext = {
    script, showMarks, fontStack: FONT_STACK, ...(addressable ? { addressable } : {}),
  };

  /*
   * The unit counter runs over the WHOLE verse, not per line: `SrcMap.units`
   * is one entry per letter of the verse in token order, and a `br` contributes
   * none. A per-line counter would address every letter after the first break
   * to the wrong source offset — the mark would land a line early.
   */
  let offset = 0;
  return (
    <>
      {lines.map((line, li) => {
        const base = offset;
        offset += unitsBefore(line, line.length);
        /*
         * A line outside this copy's range is skipped, but the unit counter
         * above it is NOT — `base` is an offset into the whole verse, so the
         * second half of a split verse must count the first half's letters
         * even though it does not draw them. `data-line` likewise stays the
         * line's index in the VERSE: a recording addresses a pāda by it
         * (`useRecording`), and renumbering per page would play the wrong line.
         */
        if (range !== undefined && (li < range[0] || li > range[1])) return null;
        return (
          <div className="pada" data-line={li} key={li}>
            {/*
              INSIDE the first line, not floating beside the verse. Positioned
              absolutely against the verse it sat on its own tiny line box, a
              third of a line above the text it numbers — which reads as a
              footnote marker. On the line, its baseline is the line's baseline,
              because it is the same line.
            */}
            {li === 0 && number !== undefined && (
              <span className="verse__n" aria-hidden>{number}</span>
            )}
            {(() => {
              /* Which boxes run through a syllable boundary, once per line —
                 see `holdJoins`. Per line, because a line break ends a box. */
              const joins = holdJoins(line);
              return line.map((t, ti) => renderToken(
                t, ti, ctx, base + unitsBefore(line, ti), joins.get(ti),
              ));
            })()}
          </div>
        );
      })}
    </>
  );
}

/**
 * MEMOISED, and this is the difference between an editor and a slideshow.
 *
 * The caret and the selection are drawn imperatively — a rectangle, and a
 * class toggle on the letters in range — precisely so that moving the caret
 * does not touch the document. But the component was re-created on every
 * render anyway, so a single arrow key rebuilt all 198 verses of Śrī Rudram
 * through `renderSyl`: measured at 377–438 ms per keystroke, in long tasks of
 * 300–470 ms. Holding an arrow key down blocked the main thread.
 *
 * The props are all primitives or stable references, so this comparison is
 * exact rather than a guess.
 */
/**
 * THE PICTURE PROPS, declared once.
 *
 * Four props travel from `useFigures` through `FlowView` and `PagedView` to
 * here, and they were spelled out in all three files: adding the drag meant
 * three edits, and a view that forgot one dropped the gesture silently. The
 * views have no opinion about any of them, so they take this and pass it on.
 *
 * `onFigure` is passed in rather than handled here because the SESSION owns
 * what is selected — the ribbon's picture controls read it, and a second
 * notion of selection living in the renderer would be a second thing to keep
 * in step. All four are stable, so the memo below still holds.
 */
export interface FigureBlockProps {
  /** The block id of the picture the editor has selected, if any. */
  selectedFigure?: string;
  /** Somebody pointed at a picture. */
  onFigure?: (blockId: string, sectionId: string, at: number, figureId: string) => void;
  /** A corner was dragged: the new width in per cent of the column. */
  onFigureResize?: (pct: number) => void;
  /** A picture was pressed: the editor decides whether it becomes a drag. */
  onFigureGrab?: (e: GrabPoint, sectionId: string, at: number) => void;
}

/** The same four with the absent ones dropped, so a spread satisfies
 *  `exactOptionalPropertyTypes`. One picker, for both views. */
export const figureBlockProps = (p: FigureBlockProps): FigureBlockProps => ({
  ...(p.selectedFigure === undefined ? {} : { selectedFigure: p.selectedFigure }),
  ...(p.onFigure === undefined ? {} : { onFigure: p.onFigure }),
  ...(p.onFigureResize === undefined ? {} : { onFigureResize: p.onFigureResize }),
  ...(p.onFigureGrab === undefined ? {} : { onFigureGrab: p.onFigureGrab }),
});

function DocumentBlocksInner(
  {
    doc, script, showMarks, only, slices, addressable = false,
    selectedFigure, onFigure, onFigureResize, onFigureGrab,
  }: FigureBlockProps & {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    /** Render only these block ids — how the paged view draws one page. */
    only?: ReadonlySet<string>;
    /**
     * For a block a page break runs THROUGH, which of its lines this copy
     * draws — the page map's `lineRange`, by block id.
     *
     * WHY THIS EXISTS. `paginate` has always been able to split a verse
     * between its lines and has always said so, in `lineRange`,
     * `continuesFrom` and `continuesOnto`. Nothing read them: the paged view
     * filtered by block ID alone, and a split verse's id is on BOTH pages —
     * so the whole verse was drawn twice, once overflowing the foot of one
     * page and once from the top of the next. Measured on the sample document
     * at A4: verse `v-4` drawn on two pages, eight pādas where the verse has
     * four, one of them past the paper's edge.
     */
    slices?: ReadonlyMap<string, readonly [number, number]>;
    /**
     * The editor is drawing: letters carry `data-u` and verses `data-verse`.
     *
     * ALL of it is gated on this, not just `data-u`. The paged view renders
     * the document twice — the second copy is an off-screen probe used to
     * measure block heights — and while the probe carried `data-verse` it won
     * every `querySelector`, so the caret was drawn at x = −99985 and the
     * selection highlight never appeared.
     */
    addressable?: boolean;
  },
): ReactNode {
  const wanted = (id: string): boolean => only === undefined || only.has(id);
  /* Built once per render rather than per figure item: the pūjā manual has 22
     figure items against a 22-entry library, so a lookup per item is 484
     comparisons on every keystroke. */
  const library = new Map((doc.figures ?? []).map((f) => [f.id, f]));
  /* A part heading is drawn where the part CHANGES — it names a run of steps,
     not a step, so repeating it above each one would be noise. */
  let part: string | undefined;

  return (
    <>
      {doc.sections.map((section) => {
        const partHere = section.part !== undefined && section.part !== part
          ? section.part
          : undefined;
        /* A section with no part ends the run, so the next section that names
           the same part heads a NEW run and gets its heading again. */
        part = section.part;
        const heading = headingOf(section);
        return (
          <Fragment key={section.id}>
            {partHere !== undefined && wanted(blockId.part(section.id)) && (
              <h2 className="doc__part" data-block-id={blockId.part(section.id)}>
                {partHere}
              </h2>
            )}
            {heading !== undefined && wanted(blockId.heading(section.id)) && (
              <h3 className="section__title" data-block-id={blockId.heading(section.id)}>
                {heading}
              </h3>
            )}
            {itemsOf(section).map((item, at) => {
              if (item.t === 'instruction') {
                const id = blockId.instruction(section.id, at);
                if (!wanted(id)) return null;
                return (
                  <p className="doc__instruction" data-block-id={id} key={id}>
                    {item.instruction.text.en}
                  </p>
                );
              }
              if (item.t === 'figure') {
                const id = blockId.figure(section.id, at);
                if (!wanted(id)) return null;
                const read = figureOf(item, library);
                /*
                 * A PICTURE THE DOCUMENT NAMES AND DOES NOT HAVE IS SAID, not
                 * skipped. This returned `null` — so a `ref` naming nothing
                 * drew nothing, on a page that had reserved a block for it,
                 * and the only evidence was a step that was not there.
                 */
                if (read.figure === undefined) {
                  return <MissingFigure key={id} ref_={read.missingRef} blockId={id} />;
                }
                const fig = read.figure;
                return (
                  <Figure
                    key={id}
                    fig={fig}
                    blockId={id}
                    selected={selectedFigure === id}
                    {...(addressable && onFigureResize !== undefined && selectedFigure === id
                      ? { onResize: onFigureResize }
                      : {})}
                    {...(addressable && onFigure !== undefined
                      ? { onSelect: () => onFigure(id, section.id, at, fig.id) }
                      : {})}
                    {...(addressable && onFigureGrab !== undefined
                      ? { onGrab: (e: MouseEvent) => onFigureGrab(e, section.id, at) }
                      : {})}
                  />
                );
              }
              if (item.t !== 'verse') return null;
              const id = blockId.verse(section.id, item.id);
              if (!wanted(id)) return null;
              const range = slices?.get(id);
              /*
               * WHAT A VERSE CARRIES UNDER ITS LINES goes with its LAST line
               * and nowhere else. A translation drawn on both halves of a
               * split verse is the same sentence twice; drawn on the first
               * half it sits above lines it translates. `useMeasure` counts
               * its height into the last line for the same reason.
               */
              const lineCount = item.tokens.filter((t) => t.t === 'br').length + 1;
              const tail = range === undefined || range[1] >= lineCount - 1;
              return (
                <div
                  className="verse"
                  data-block-id={id}
                  /*
                   * `data-verse` IS NOT AN EDITING ATTRIBUTE.
                   *
                   * It used to be written only in edit mode, along with the
                   * caret's other addressing. But a recording is played
                   * against the text in READ mode — that is what reading with
                   * a recitation is — and the highlight and the click both
                   * need to know which verse a line belongs to. So the
                   * identity is always there; only what edit mode adds to it
                   * is conditional.
                   */
                  data-verse={item.id}
                  {...(addressable
                    ? {
                      'data-section': section.id,
                      ...(item.src === undefined ? { 'data-attested': '1' } : {}),
                    }
                    : {})}
                  key={item.id}
                >
                  {/*
                    THE LOCK IS GONE, and so is the thing it was about.
                    A verse with no source layer used to be uneditable — its
                    marks were a record and there was nowhere for an edit to
                    go — so it wore a lock, and hovering it explained why. A
                    verse is one text and a list of markings now; every one of
                    them takes an edit, and there is nothing left to say.
                  */}
                  <VerseLines
                    verse={item}
                    script={script}
                    showMarks={showMarks}
                    addressable={addressable}
                    {...(item.n == null ? {} : { number: `${item.n}` })}
                    {...(range === undefined ? {} : { range })}
                  />
                  {tail && (item.instructions ?? []).map((ins, k) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <p className="doc__instruction" key={k}>{ins.text.en}</p>
                  ))}
                  {tail && item.translation !== undefined && (
                    <p className="doc__translation">{item.translation.en}</p>
                  )}
                  {tail && item.source !== undefined && (
                    <p className="doc__source">{item.source}</p>
                  )}
                  {/*
                    A VERSE MAY CARRY ITS OWN PICTURES (`ChantVerse.figures`),
                    and they are not blocks: they are inside the verse, so the
                    page map moves them with it and they cannot be selected on
                    their own. The format has both placements and the reader
                    draws both; drawing only the section's would lose a picture
                    silently.
                  */}
                  {tail && (item.figures ?? []).map((fig) => (
                    <Figure key={fig.id} fig={fig} />
                  ))}
                </div>
              );
            })}
            {/* A block of its own, with an id: an element the page map has
                never heard of would be drawn again on every page of the
                section rather than once, under it. */}
            {sourceOf(section) !== undefined && wanted(blockId.source(section.id)) && (
              <p className="doc__source" data-block-id={blockId.source(section.id)}>
                {sourceOf(section)}
              </p>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export const DocumentBlocks = memo(DocumentBlocksInner);
