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
  /** Height in POINTS at zoom 1. */
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
 */
export function measureBlocks(root: HTMLElement): MeasuredBlock[] {
  const out: MeasuredBlock[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-block-id]')) {
    const id = el.dataset['blockId'];
    if (id === undefined) continue;
    const rect = el.getBoundingClientRect();
    const lineEls = el.querySelectorAll<HTMLElement>('[data-line]');
    const lines = lineEls.length > 1
      ? [...lineEls].map((l) => pxToPt(l.getBoundingClientRect().height))
      : undefined;
    out.push({
      id,
      height: pxToPt(rect.height),
      ...(lines === undefined ? {} : { lines }),
    });
  }
  return out;
}

/**
 * Keep a measurement of the probe subtree up to date.
 *
 * Re-measures when the content changes or the column width changes — the two
 * things that can move a line, and therefore a page break. It deliberately does
 * NOT re-measure on zoom: that is the invariant the paged view rests on, and
 * re-measuring on zoom would quietly break it by letting rounding at one zoom
 * level change a height.
 */
export function useMeasuredBlocks(
  probe: React.RefObject<HTMLElement | null>,
  page: PageGeometry,
  contentKey: string,
): readonly MeasuredBlock[] {
  const [blocks, setBlocks] = useState<readonly MeasuredBlock[]>([]);
  const columnPt = contentBox(page).width;
  const last = useRef('');

  useEffect(() => {
    const el = probe.current;
    if (el === null) return;
    const key = `${contentKey}|${columnPt}`;
    if (last.current === key && blocks.length > 0) return;

    // Two frames: one for the browser to lay out the probe, one to read it.
    // Reading in the same frame as the render returns pre-layout zeroes.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const measured = measureBlocks(el);
        if (measured.length > 0) {
          last.current = key;
          setBlocks(measured);
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [probe, contentKey, columnPt, blocks.length]);

  return blocks;
}
