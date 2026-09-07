/**
 * A popover that is not clipped by the thing it belongs to.
 *
 * THE BUG THIS EXISTS FOR. Every menu in the ribbon — the appearance picker,
 * a folded group, the overflow — was rendered inside `.rbn__body`, which has
 * `overflow: hidden` so a group that does not fit cannot spill out of the row.
 * That clip applies to descendants whether they are in flow or not, so the
 * menus were cut off at the ribbon's edge: the appearance popover was 717px
 * tall inside an 88px row, and 90% of it could not be seen.
 *
 * So a popover is PORTALLED to the document body and positioned against its
 * anchor. That is the standard answer, and the only one that survives a
 * clipping ancestor without weakening the clip that the ribbon needs.
 *
 * It positions itself after mounting — measured, not guessed — so it flips to
 * the other side rather than hanging off the window, which is the second thing
 * hand-rolled menus get wrong.
 */
import {
  useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export function Popover(
  { anchor, open, onClose, label, align = 'start', children }: {
    /** What it hangs from. Its rectangle decides where the popover goes. */
    anchor: RefObject<HTMLElement | null>;
    open: boolean;
    onClose: () => void;
    /** Named for a screen reader: a bare dialog announces nothing. */
    label: string;
    /** Which edge to line up with — `end` for a control near the right. */
    align?: 'start' | 'end';
    children: ReactNode;
  },
): ReactNode {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  /** What had the keyboard before this opened. */
  const came = useRef<HTMLElement | null>(null);

  /*
   * FOCUS GOES BACK WHERE IT CAME FROM.
   *
   * Without this the editor goes deaf the moment anyone opens a menu: the
   * document's keyboard is a hidden field, opening a popover moves focus to
   * the button, closing it leaves focus on `<body>`, and from then on typing
   * and the arrow keys do nothing at all while the page still looks editable.
   * Measured, and it is exactly what "editing is still not working" was.
   */
  useEffect(() => {
    if (open) {
      came.current = document.activeElement as HTMLElement | null;
      return;
    }
    const back = came.current;
    came.current = null;
    if (back !== null && back.isConnected) back.focus({ preventScroll: true });
  }, [open]);

  /* Positioned after layout, from both rectangles. `useLayoutEffect` so it is
     placed before the browser paints — otherwise it appears at 0,0 and jumps. */
  useLayoutEffect(() => {
    if (!open) { setAt(null); return; }
    const from = anchor.current;
    const self = box.current;
    if (from === null || self === null) return;
    const a = from.getBoundingClientRect();
    const b = self.getBoundingClientRect();
    const margin = 8;

    let left = align === 'end' ? a.right - b.width : a.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - b.width - margin));

    /* Below the anchor, unless there is no room — then above it. A menu that
       hangs off the bottom of the window is a menu with items nobody can
       reach. */
    const below = a.bottom + 2;
    const top = below + b.height + margin > window.innerHeight && a.top - b.height - 2 > margin
      ? a.top - b.height - 2
      : below;
    setAt({ top, left });
  }, [open, align, anchor]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (box.current?.contains(target) === true) return;
      if (anchor.current?.contains(target) === true) return;
      onClose();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      /*
       * CONSUMED, so one press does one thing. This listener is on `document`
       * and the app's own Escape handler is on `window`, so stopping
       * propagation here keeps the press from ALSO leaving the writing mode —
       * which is what made "close the menu" and "the editor stops taking
       * keys" the same gesture.
       */
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    /* Both, because a popover that only closes one way is one people learn to
       distrust. `mousedown` rather than `click` so it closes before whatever
       was clicked underneath acts. */
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose, anchor]);

  if (!open || typeof document === 'undefined') return null;

  /*
   * PORTALLED INTO THE THEMED ROOT, not into `<body>`.
   *
   * The theme lives on `.app` — `data-chrome`, `data-mode`, `data-density` —
   * and every chrome token is declared there. A portal to `document.body`
   * escapes that scope, so the menu resolved the `:root` defaults instead: in
   * a dark window the appearance popover came up in LIGHT colours, and the
   * selected item in its light/dark toggle was white on white.
   *
   * `.app` also has `overflow: hidden`, which does not clip a `position:
   * fixed` child — its containing block is the viewport, not the scroller. So
   * this keeps the theme AND stays out of the ribbon's clip.
   */
  const root = document.querySelector('.app') ?? document.body;

  return createPortal(
    <div
      className="pop"
      role="dialog"
      aria-label={label}
      ref={box}
      style={at === null
        /* Measured first, in place but invisible: the position needs the
           popover's own size, and reading it requires it to be laid out. */
        ? { visibility: 'hidden', top: 0, left: 0 }
        : { top: `${at.top}px`, left: `${at.left}px` }}
    >
      {children}
    </div>,
    root,
  );
}
