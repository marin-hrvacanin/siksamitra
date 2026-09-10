/**
 * Measuring blocks, so they can be paginated.
 *
 * `@siksamitra/layout` places blocks whose heights someone else measured, and
 * this is that someone. It has to be here rather than in the layout package
 * because only the rendered DOM knows how tall a marked verse is: the holding
 * boxes and the svara strokes sit OUTSIDE the line box, so a height computed
 * from font metrics is wrong by exactly the marks — which is the whole subject.
 *
 * Measured at zoom 1 and converted to points, because pagination must not
 * depend on zoom. The measuring pass therefore renders into a hidden probe at
 * natural size rather than reading the visible, zoomed surface.
 */

import { useEffect, useRef, useState } from 'react';
import { PT_TO_PX, contentBox, type PageGeometry } from '@siksamitra/layout';

export interface MeasuredBlock {
  readonly id: string;
  /**
   * The block's ADVANCE in POINTS at zoom 1 — its own height plus the space
   * that separates it from the block after it. See `measureBlocks`: the box
   * alone leaves out every margin, and a page filled with boxes overflows by
   * the gaps.
   */
  readonly height: number;
  /** Line heights in points, when the block reported them. */
  readonly lines?: readonly number[];
}

const pxToPt = (px: number): number => px / PT_TO_PX;

/**
 * Measure every element carrying `data-block-id` inside `root`.
 *
 * Line heights come from child elements carrying `data-line`, which the
 * renderer emits per rendered line. A block that reports none is treated as
 * unbreakable, which is the safe default: a verse that cannot be split is a
 * short page, and a verse split in the wrong place is a wrong document.
 *
 * THE LINES ARE MEASURED FROM THEIR OFFSETS, NOT THEIR OWN HEIGHTS, and the
 * difference is the contract `LayoutBlock.lines` states: they must sum to the
 * block's height. A pāda's own `getBoundingClientRect().height` leaves out the
 * gaps between pādas AND everything a verse carries UNDER them — its
 * translation, its instructions, its source line, its own pictures. Summed,
 * those heights came to less than the block, so `paginate` split a verse
 * believing the tail was shorter than it is and the page overflowed by exactly
 * the translation.
 *
 * So each line is measured from where it starts to where the NEXT one starts,
 * the first from the top of the block and the last to the bottom of it. The
 * trailing matter is then part of the last line's height, which is also where
 * it is DRAWN — a continued verse's translation belongs under its final line,
 * not repeated on both pages.
 *
 * AND A BLOCK'S HEIGHT IS ITS ADVANCE — from its own top to the NEXT block's
 * top — not `getBoundingClientRect().height`, which is the border box and
 * excludes every margin. The space between blocks is not decoration: a verse
 * is separated from the next by `--doc-verse-gap` and a heading takes more
 * still, and `paginate` was told none of it. It therefore filled a page with
 * the sum of the boxes and the browser drew the boxes AND the gaps.
 *
 * MEASURED on Śrī Rudram, before the fix: 40 to 101 px of unaccounted gap per
 * page — 16 of 58 pages at A4, 19 of 75 at A5 and 23 of 59 at Letter drawn
 * past the foot of their text column, the worst by 100 px, some of it past the
 * edge of the paper. The bottom margin hid most of it, which is why it had
 * never been seen: the page LOOKED full because it was over-full.
 *
 * The last block of the document keeps its own height, having nothing after it
 * to advance to. A block that ends up last on a PAGE reserves the gap it does
 * not need, which costs one gap of slack — the safe direction, and the one CSS
 * takes too when it drops a margin at a fragment boundary.
 */
export function measureBlocks(root: HTMLElement): MeasuredBlock[] {
  const els = [...root.querySelectorAll<HTMLElement>('[data-block-id]')];
  const rects = els.map((el) => el.getBoundingClientRect());
  const out: MeasuredBlock[] = [];
  for (const [i, el] of els.entries()) {
    const id = el.dataset['blockId'];
    if (id === undefined) continue;
    const rect = rects[i]!;
    /* Where this block's share of the column ends: the next block's top, or
       its own bottom when it is the last thing in the document. */
    const end = i + 1 < rects.length ? Math.max(rects[i + 1]!.top, rect.bottom) : rect.bottom;
    const lineEls = [...el.querySelectorAll<HTMLElement>('[data-line]')];
    const edges = lineEls.map((l) => l.getBoundingClientRect().top);
    const lines = lineEls.length > 1
      ? edges.map((_, j) => pxToPt(
        (j + 1 < edges.length ? edges[j + 1]! : end) - (j === 0 ? rect.top : edges[j]!),
      ))
      : undefined;
    out.push({
      id,
      height: pxToPt(end - rect.top),
      ...(lines === undefined ? {} : { lines }),
    });
  }
  return out;
}

/** Do two measurements say the same thing about every block? */
function same(a: readonly MeasuredBlock[], b: readonly MeasuredBlock[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => {
    const other = b[i]!;
    return m.id === other.id && Math.abs(m.height - other.height) < 0.01
      && (m.lines?.length ?? 0) === (other.lines?.length ?? 0);
  });
}

/**
 * Keep a measurement of the probe subtree up to date.
 *
 * Re-measures when the content changes or the column width changes — the two
 * things that can move a line, and therefore a page break. It deliberately does
 * NOT re-measure on zoom: that is the invariant the paged view rests on, and
 * re-measuring on zoom would quietly break it by letting rounding at one zoom
 * level change a height.
 *
 * AND IT WATCHES THE PROBE, because a measurement taken too early is not a
 * measurement. The heights were read two frames after the mount and never
 * again — so whatever the document was at that instant is what the page map
 * was built from, for ever. A document font that had not loaded yet is
 * measured in the fallback face, which is SHORTER, and every page then holds
 * more than it can: measured on Śrī Rudram at A4, eight elements past the foot
 * of the text column and one past the edge of the paper — on some runs and not
 * others, which is what a race looks like from outside. A picture decoding
 * after the mount is the same fault with a different cause.
 *
 * A `ResizeObserver` on the probe is the browser's own answer to "tell me when
 * this changed size", and it does not care WHY it changed — fonts, images, a
 * stylesheet arriving late. Re-measuring is cheap and idempotent: the pages
 * are only re-rendered when a height actually moved, so a probe that settles
 * costs one extra pass and then goes quiet.
 */
export function useMeasuredBlocks(
  probe: React.RefObject<HTMLElement | null>,
  page: PageGeometry,
  contentKey: string,
): readonly MeasuredBlock[] {
  const [blocks, setBlocks] = useState<readonly MeasuredBlock[]>([]);
  const columnPt = contentBox(page).width;
  const last = useRef('');
  /* The state, readable from inside the observer without making it a
     dependency — an observer torn down and rebuilt on every measurement would
     never see the change that comes after it. */
  const held = useRef<readonly MeasuredBlock[]>([]);
  held.current = blocks;

  useEffect(() => {
    const el = probe.current;
    if (el === null) return;
    const key = `${contentKey}|${columnPt}`;

    let raf1 = 0;
    let raf2 = 0;
    /** Read the probe two frames from now — one to lay out, one to read. */
    const take = (): void => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          const measured = measureBlocks(el);
          if (measured.length === 0) return;
          last.current = key;
          if (!same(measured, held.current)) setBlocks(measured);
        });
      });
    };

    if (last.current !== key || blocks.length === 0) take();

    /* Whatever changes the probe's shape after that — a font, a picture, a
       late stylesheet — is a new measurement, not a stale one. */
    const observer = new ResizeObserver(() => take());
    observer.observe(el);
    /* And the fonts explicitly, because a face that loads without changing the
       probe's own box still changes the lines inside it. */
    let cancelled = false;
    void document.fonts.ready.then(() => { if (!cancelled) take(); });

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [probe, contentKey, columnPt, blocks.length]);

  return blocks;
}
