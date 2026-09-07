/**
 * PUTTING THE KEYBOARD BACK ON THE DOCUMENT.
 *
 * A `contenteditable` receives keys only while it holds the focus, and three
 * ordinary things take the focus away from it:
 *
 *   entering the writing mode at all — nothing had focused it;
 *   pressing a ribbon button, which focuses the button;
 *   finishing an IME composition, which rebuilds the page and destroys the
 *   node the focus was in.
 *
 * Each one left the page looking editable and taking no keys, which is the
 * failure the previous surface had a helper for and this one dropped. One
 * function, called from all three places, so there is one thing to get right.
 */

/**
 * Focus the document, if it is editable and does not already have the focus.
 *
 * Found from the document rather than passed a container, because the callers
 * are in three different parts of the tree and none of them should have to
 * know where the page is.
 *
 * `preventScroll`, because focusing an element the browser considers
 * off-screen otherwise jumps the reader to the top of the document.
 */
export function focusDocument(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  /* Already inside the text: nothing to do, and moving it would collapse a
     selection somebody is in the middle of making. */
  if (active instanceof HTMLElement && active.closest('.doc[contenteditable="true"]') !== null) {
    return;
  }
  /*
   * THE HOST THE CARET IS IN, not simply the first one.
   *
   * The paged view has one editable host per page. Focusing the first would
   * drag the caret to the top of the document whenever a ribbon button was
   * pressed on page four — Chrome moves the selection into an editable it is
   * given the focus of. The browser's own selection says which page the person
   * is on; only when there is none does the first host become the right guess.
   */
  const sel = document.getSelection();
  const node = sel?.focusNode ?? null;
  const near = node === null
    ? null
    : (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement))
      ?.closest<HTMLElement>('.doc[contenteditable="true"]') ?? null;
  const host = near ?? document.querySelector<HTMLElement>('.doc[contenteditable="true"]');
  host?.focus({ preventScroll: true });
}
