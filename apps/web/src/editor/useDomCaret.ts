/**
 * KEEPING THE BROWSER'S SELECTION AND THE MODEL IN STEP.
 *
 * The seam of the whole design, in both directions:
 *
 *   READING   `selectionchange` says where the browser's caret is; the letter
 *             map turns that into an address in the source.
 *   WRITING   after an edit, React has replaced the letters and the DOM
 *             selection with them, so it is put back from the model.
 *
 * WHAT PREVENTS A LOOP, since the obvious answer is wrong. Not the `placing`
 * flag — `selectionchange` is dispatched from a queued task, so the flag has
 * already been cleared by the time it fires. What prevents it is that reading
 * a selection does not bump `revision`, and the write below keys on `revision`
 * alone. A read can therefore never cause a write. The flag stays because it
 * saves a wasted round trip when the timing does happen to line up.
 */
import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { offsetOf } from '@siksamitra/edit';
import { addressAtDom, domPointOf } from './dom-selection.js';
import { unitOfAddress } from './unit-map.js';
import type { Session } from './useSession.js';

export function useDomCaret(
  session: Session,
  scroller: RefObject<HTMLElement | null>,
  placing: MutableRefObject<boolean>,
): void {
  /*
   * THE LIVE SESSION, THROUGH A REF.
   *
   * The listener below is registered once — it must be, or every keystroke
   * re-subscribes — so it closes over whatever it captured. A plain
   * `{ current: session }` would be a NEW object each render and the listener
   * would keep the first one for ever, reading a session several edits out of
   * date. This is the same trap the previous surface documented, met again in
   * a new place.
   */
  const live = useRef(session);
  live.current = session;

  /* ── reading ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onSelect = (): void => {
      if (placing.current) return;
      const now = live.current;
      if (!now.editing) return;
      const el = scroller.current;
      const sel = document.getSelection();
      if (el === null || sel === null || sel.anchorNode === null || sel.focusNode === null) return;
      /* Only a selection inside the document is ours. A click in the ribbon or
         in a menu is somebody else's business. */
      if (!el.contains(sel.focusNode)) return;

      const head = addressAtDom(
        { node: sel.focusNode, offset: sel.focusOffset },
        now.srcMapIn,
        now.flatFor,
      );
      if (head === null) return;
      const anchor = addressAtDom(
        { node: sel.anchorNode, offset: sel.anchorOffset },
        now.srcMapIn,
        now.flatFor,
      );
      /*
       * A SELECTION THAT SPANS TWO SECTIONS IS TRIMMED TO ONE, AND SAID SO.
       *
       * The model binds a caret to a single section, so there is no command
       * that can express the other half. Collapsing it to the head was the
       * first answer and it was a trap: the browser went on showing the whole
       * highlight while the model held a bare caret, so Backspace deleted one
       * letter of four hundred highlighted ones and typing replaced nothing at
       * all — silently, both times.
       *
       * So the anchor is pulled to the section boundary instead. What is
       * highlighted and what a command will touch are then the same thing,
       * and the browser's own selection is corrected to match, so the eye is
       * not told one story while the document is told another.
       */
      /*
       * A SELECTION THAT LEAVES ITS SECTION IS CLAMPED TO THE EDGE OF IT.
       *
       * The model binds a caret to one section, so the other half cannot be
       * expressed. Collapsing it to the head was the first answer and it was
       * a trap: the browser went on showing the whole highlight while the
       * model held a bare caret, so Backspace took one letter out of four
       * hundred highlighted ones — silently.
       *
       * Clamping keeps a REAL range: everything from the section's edge to
       * the caret. What a command touches is then a prefix of what is
       * highlighted rather than none of it, and the status bar's count says
       * how much.
       */
      const together = anchor !== null && anchor.sectionId === head.sectionId;
      now.setSelection(
        { anchor: together ? anchor.at : edgeOfSection(now, head), head: head.at },
        head.sectionId,
      );
    };
    document.addEventListener('selectionchange', onSelect);
    return () => document.removeEventListener('selectionchange', onSelect);
  }, [scroller]);

  /* ── the browser's caret, put back after an EDIT ───────────────────────── */
  /*
   * KEYED ON `revision`, WHICH MEANS "the document changed" — never on the
   * selection.
   *
   * The first version of this ran whenever the selection moved, and it did two
   * things wrong at once. It collapsed the range to the head, so dragging to
   * select destroyed the selection on every mouse-move and nothing could be
   * selected at all. And it did a `querySelector` over every letter in the
   * document per move, on top of a drag that was already the browser's
   * slowest gesture.
   *
   * The browser's selection is CORRECT while nothing is editing it — that is
   * the whole point of letting the browser own it. It only needs putting back
   * when React has replaced the letters underneath it, which is exactly when
   * the revision changes.
   */
  const revision = session.revision;
  /*
   * WHETHER THERE IS A CARET AT ALL — which changes exactly once, when the
   * document opens and the first caret is placed.
   *
   * Without it the write below never ran for that first caret: `revision` had
   * not moved and the mode had not changed, so the model held a caret in the
   * first EDITABLE verse while the browser held its own default position at
   * the very top of the document. The next `selectionchange` read the
   * browser's back into the model, and the program opened with its caret in a
   * transcribed verse that refuses every keystroke — the exact thing the
   * start-caret effect exists to prevent.
   */
  const hasCaret = session.selection !== null;
  useEffect(() => {
    const el = scroller.current;
    if (el === null || !session.editing || session.selection === null) return;

    const point = (at: { verseId: string; line: number; column: number }): {
      node: Node; offset: number;
    } | null => {
      const map = session.srcMapOf(at.verseId);
      const place = map === null ? null : unitOfAddress(map, at);
      return place === null ? null : domPointOf(el, session.sectionId, at.verseId, place);
    };
    const head = point(session.selection.head);
    if (head === null) return;
    const anchor = point(session.selection.anchor) ?? head;

    const sel = document.getSelection();
    if (sel === null) return;
    placing.current = true;
    try {
      /* `setBaseAndExtent`, not a collapsed range: an edit that keeps a
         selection — applying a mark, say — must leave it selected. */
      sel.setBaseAndExtent(
        anchor.node,
        Math.min(anchor.offset, lengthOf(anchor.node)),
        head.node,
        Math.min(head.offset, lengthOf(head.node)),
      );
    } catch {
      /* A node React has just replaced is not in the document any more. The
         next render places it; one frame without a caret is not worth a throw. */
    } finally {
      placing.current = false;
    }
    /*
     * `selection` AND `sectionId` ARE BOTH DELIBERATELY ABSENT.
     *
     * The claim above — that reading a selection can never cause a write — is
     * only true if nothing a read changes appears here. `setSelection` moves
     * `sectionId` when the caret crosses into another section, so listing it
     * made a drag across a section boundary re-run this effect mid-gesture and
     * replace the browser's range with the model's caret. The selection died
     * at the boundary, every time.
     */
  }, [revision, hasCaret, scroller, session.editing]);

}

/**
 * The far edge of the section the caret is in, on the side away from it.
 *
 * Used when a selection has run out of its section: the anchor is pulled here
 * so the model still holds a range rather than a bare caret. Which edge
 * depends on which way the drag went, and the caret's own position decides —
 * a caret nearer the start means the selection came from above.
 */
function edgeOfSection(
  session: Session,
  head: { at: { verseId: string; line: number; column: number }; sectionId: string },
): { verseId: string; line: number; column: number } {
  const flat = session.flatFor(head.sectionId);
  const first = flat.lineStarts[0];
  const last = flat.lineStarts[flat.lineStarts.length - 1];
  if (first === undefined || last === undefined) return head.at;
  const at = offsetOf(flat, head.at) ?? 0;
  const middle = (last.at + last.length) / 2;
  return at > middle
    ? { verseId: first.verseId, line: first.line, column: 0 }
    : { verseId: last.verseId, line: last.line, column: last.length };
}

/** How far into a node an offset may go. */
const lengthOf = (node: Node): number => (
  node.nodeType === Node.TEXT_NODE ? (node as Text).data.length : node.childNodes.length
);
