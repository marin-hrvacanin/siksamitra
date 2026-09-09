/**
 * KEEPING THE READER'S PLACE — the impure half of scroll anchoring.
 *
 * The arithmetic is `packages/layout` (`anchorAt`, `scrollTopFor`), which is
 * pure and tested there. This is the part that has to touch a real scroller:
 * reading where the blocks actually ARE, in the view that is on screen now.
 *
 * It lived in `App.tsx`, and the shell is supposed to be thin — "it contains
 * no action logic of its own, so adding a feature does not grow this file",
 * which is the discipline `check:modules` keeps. Adding the audio dock took
 * that file to 407 lines, past the 400 the gate allows, and this is the piece
 * with the least to do with an application shell: it is one concern, it is
 * about the DOM and nothing else, and two other things already want it.
 *
 * THE PAGED VIEW'S PROBE IS EXCLUDED, and it must be. That view lays the whole
 * document out a SECOND time, off-screen, to measure it — so every block id
 * exists twice in the tree and a plain `querySelectorAll` finds the invisible
 * copy first about half the time. A drag once measured against it, and the
 * navigation panel scrolled to a heading nobody could see.
 */
import { useCallback, type RefObject } from 'react';
import { anchorAt, scrollTopFor, type BlockOffset, type ViewKind } from '@siksamitra/layout';

/** How far under the top of the column a block asked for should land. */
const LEAD_PX = 24;

export interface ScrollAnchor {
  /** Scroll a block into view — what the navigation panel asks for. */
  readonly goToBlock: (id: string) => void;
  /** Where each block sits in the CURRENT view, for anchoring. */
  readonly offsetsOf: () => BlockOffset[];
  /** Switch view, keeping the reader's place. */
  readonly switchView: (next: ViewKind) => void;
}

export function useScrollAnchor(
  scroller: RefObject<HTMLDivElement | null>,
  setView: (next: ViewKind) => void,
): ScrollAnchor {
  /** The blocks a person can actually see, in document order. */
  const drawnBlocks = useCallback((el: HTMLElement): HTMLElement[] =>
    [...el.querySelectorAll<HTMLElement>('[data-block-id]')]
      .filter((b) => b.closest('.paged__probe') === null), []);

  const goToBlock = useCallback((id: string) => {
    const el = scroller.current;
    if (el === null) return;
    const block = drawnBlocks(el).find((b) => b.dataset['blockId'] === id);
    if (block === undefined) return;
    /* Positioned, not `scrollIntoView`: the heading should land just under the
       top of the column with a little air, not flush against the ribbon. */
    const base = el.getBoundingClientRect().top - el.scrollTop;
    el.scrollTo({ top: block.getBoundingClientRect().top - base - LEAD_PX, behavior: 'smooth' });
  }, [scroller, drawnBlocks]);

  const offsetsOf = useCallback((): BlockOffset[] => {
    const el = scroller.current;
    if (el === null) return [];
    const base = el.getBoundingClientRect().top - el.scrollTop;
    return drawnBlocks(el).map((b) => {
      const r = b.getBoundingClientRect();
      return { id: b.dataset['blockId'] ?? '', top: r.top - base, height: r.height };
    });
  }, [scroller, drawnBlocks]);

  /**
   * Read the anchor BEFORE the switch, restore it after the new view has laid
   * out. Without this, toggling the view in a 700-verse document lands at the
   * top — the small betrayal that stops a feature being used at all.
   *
   * Two frames, not one: the first lets React commit the new view, the second
   * lets the browser lay it out. Measured at one frame it read every height as
   * the OLD view's and landed a screen and a half out.
   */
  const switchView = useCallback((next: ViewKind) => {
    const el = scroller.current;
    const anchor = el === null ? null : anchorAt(el.scrollTop, offsetsOf());
    setView(next);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const after = scroller.current;
      if (after !== null) after.scrollTop = scrollTopFor(anchor, offsetsOf());
    }));
  }, [scroller, setView, offsetsOf]);

  return { goToBlock, offsetsOf, switchView };
}
