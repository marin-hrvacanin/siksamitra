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
  /**
   * Do something that changes the document's geometry, keeping the place.
   *
   * A ZOOM IS AS MUCH A CHANGE OF GEOMETRY AS A CHANGE OF VIEW, and only the
   * view was anchored. Every length is scaled by the zoom and the column's
   * width with it, so the text re-wraps and every block moves — while
   * `scrollTop` stays exactly where it was, and `.canvas { overflow-anchor:
   * none }` deliberately stops the browser from compensating.
   *
   * Measured on Śrī Rudram, 198 verses, at the middle of the document: one
   * press of Zoom in moved the reader ELEVEN blocks, from the ninth verse of
   * the tenth praśna to the sixth of the eleventh. The page got shorter —
   * 49 568 px to 46 414 px, because a wider column wraps into fewer lines —
   * and `scrollTop` did not move, so the words under the eye did.
   */
  readonly withAnchor: (change: () => void) => void;
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
  const withAnchor = useCallback((change: () => void) => {
    const el = scroller.current;
    const anchor = el === null ? null : anchorAt(el.scrollTop, offsetsOf());
    change();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const after = scroller.current;
      if (after === null) return;
      const now = offsetsOf();
      /*
       * NOT AGAINST AN EMPTY LIST. The paged view draws `Measuring…` and its
       * off-screen probe on the first paint, and `drawnBlocks` rightly ignores
       * the probe — so two frames after a switch INTO pages there is nothing
       * to anchor to, and `scrollTopFor(anchor, [])` is 0. Restoring that
       * would land the reader at the top of the document, which is the exact
       * betrayal this function exists to prevent. Wait a frame and try again;
       * a few frames of the old scroll position is not worth a jump.
       */
      if (now.length === 0) {
        let tries = 0;
        const retry = (): void => {
          const el2 = scroller.current;
          if (el2 === null) return;
          const later = offsetsOf();
          if (later.length > 0) { el2.scrollTop = scrollTopFor(anchor, later); return; }
          tries += 1;
          if (tries < 30) requestAnimationFrame(retry);
        };
        requestAnimationFrame(retry);
        return;
      }
      after.scrollTop = scrollTopFor(anchor, now);
    }));
  }, [scroller, offsetsOf]);

  const switchView = useCallback(
    (next: ViewKind) => withAnchor(() => setView(next)),
    [withAnchor, setView],
  );

  return { goToBlock, offsetsOf, switchView, withAnchor };
}
