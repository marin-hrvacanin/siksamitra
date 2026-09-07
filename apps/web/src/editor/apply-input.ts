/**
 * WHAT A BROWSER INPUT EVENT MEANS TO THIS DOCUMENT.
 *
 * The page is `contenteditable`, so the browser announces every change it is
 * about to make — as an `inputType` and, usefully, as the exact DOM range it
 * was about to change. It never gets to make any of them: `EditorSurface`
 * refuses the event and calls this, which says the same thing as a command
 * against the model.
 *
 * WHY `getTargetRanges()` RATHER THAN A TABLE OF KEYS. The browser has already
 * decided what "delete the previous word" covers in this font, at this
 * wrapping, in this script — and it is a much better authority on that than a
 * rule written here would be. Word-wise delete, line-wise delete, deleting a
 * selection and deleting one letter are then one code path rather than five
 * special cases with a sixth missing.
 *
 * Separate from the surface because it is the part with the decisions in it,
 * and because it can be read — and argued with — without a browser.
 */
import { offsetOf, selectionRange } from '@siksamitra/edit';
import { addressAtDom } from './dom-selection.js';
import type { Session } from './useSession.js';

/** Apply one refused `beforeinput` to the document. */
export function applyInput(e: InputEvent, session: Session): void {
  /*
   * WHAT THE BROWSER MEANT, AND OTHERWISE WHAT THE STATUS BAR PROMISED.
   *
   * The event carries the exact range the browser was about to change, and
   * that is the better authority: it knows what "delete the previous word"
   * covers in this font at this wrapping. When it cannot be mapped — it
   * reaches outside the section the caret is bound to, which Ctrl+A across a
   * multi-section document does — the model's own selection is used instead,
   * because that is the range the status bar has been telling the person is
   * selected. What a command touches and what the window says is selected are
   * then the same thing.
   *
   * When neither exists, nothing happens. The old fallback was to act at the
   * caret regardless: one letter deleted out of four hundred highlighted ones,
   * silently, and not the ones anybody pointed at.
   */
  const range = rangeOf(e, session) ?? modelRange(session);

  switch (e.inputType) {
    case 'insertText':
    case 'insertReplacementText':
    case 'insertFromPaste':
    case 'insertFromDrop': {
      const text = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
      if (text === '') return;
      /*
       * A BURST OF TYPING IS ONE UNDO STEP.
       *
       * The browser hands us a target range for an ordinary keystroke too — a
       * collapsed one, at the caret. Sending every keystroke down the range
       * path made each letter its own history entry, so Ctrl+Z after typing a
       * word took the word back one letter at a time. A paste, and text typed
       * over a selection, are genuinely one edit and stay one.
       */
      const drop = e.inputType === 'insertFromDrop';
      const paste = e.inputType === 'insertFromPaste';
      if (range === null) { session.insert(text); return; }
      /* A drop shares its key with the `deleteByDrag` just before it, so the
         move is one undo step. A paste is one edit on its own. */
      session.replaceRange(range.from, range.to, text, drop ? 'drag' : (paste ? undefined : 'type'));
      return;
    }

    /*
     * DRAGGING TEXT WITHIN THE DOCUMENT IS A MOVE, NOT A COPY.
     *
     * The browser sends two events for it: `deleteByDrag` where the text came
     * from, and `insertFromDrop` where it landed. Handling only the second
     * duplicated the text — which is what happened, because `deleteByDrag`
     * fell through to the silent default below.
     */
    case 'deleteByDrag':
      /*
       * ONE UNDO STEP WITH THE DROP THAT FOLLOWS IT, because a move is one
       * act. Without the shared key, one Ctrl+Z undid the insertion and left
       * the deletion standing — the dragged text simply gone.
       *
       * The two arrive in the same task, so the drop's own offsets are
       * computed against the text as it was BEFORE this delete. That is a
       * known defect and it is written down in `docs/EDITING.md` rather than
       * papered over here: dragging text to a point after where it came from
       * lands it short by its own length. Dragging within a document is a
       * rare gesture in this program and a wrong fix would be worse than a
       * recorded one.
       */
      if (range !== null && range.from !== range.to) {
        session.replaceRange(range.from, range.to, '', 'drag');
      }
      return;

    case 'insertParagraph':
      /* Enter is a breath — a new line inside the verse. Ctrl+Enter is a new
         verse, and the browser has no idea such a thing exists, so it stays a
         binding of ours. */
      session.newLine(false);
      return;
    case 'insertLineBreak':
      session.newLine(false);
      return;

    case 'deleteContentBackward':
    case 'deleteWordBackward':
    case 'deleteSoftLineBackward':
    case 'deleteHardLineBackward':
      /* Held Backspace is one undo step, the same as held letters. */
      if (range !== null && range.from !== range.to) {
        session.replaceRange(range.from, range.to, '', 'delete');
      } else session.remove(-1);
      return;

    /* `deleteContent` names no direction: it is what a browser sends for a
       selection it is about to remove, where the range says everything and the
       direction says nothing. It is grouped here because the collapsed
       fallback below never runs for it — a directionless delete always
       carries a range. */
    case 'deleteContent':
    case 'deleteContentForward':
    case 'deleteWordForward':
    case 'deleteSoftLineForward':
    case 'deleteHardLineForward':
      if (range !== null && range.from !== range.to) {
        session.replaceRange(range.from, range.to, '', 'delete');
      } else session.remove(1);
      return;

    /* Reached when undo comes from somewhere other than the keyboard — a
       trackpad gesture, or a menu the browser draws itself. The keyboard path
       is a binding, which stops the event before it gets here. */
    case 'historyUndo':
      session.undoEdit();
      return;
    case 'historyRedo':
      session.redoEdit();
      return;

    default:
      /*
       * Anything else — bold, italic, a font, a colour — has no meaning in a
       * document whose marks are data rather than formatting. Refused in
       * silence: somebody pressed Ctrl+B in an editor that has no bold, and
       * an error message would be answering a question they did not ask.
       *
       * Also arriving here, and also refused: `insertTranspose`,
       * `insertFromYank`, `insertFromPasteAsQuotation` and
       * `deleteEntireSoftLine`. Each is a real editing gesture on some
       * platform, none is wrong to want, and none is implemented — so they do
       * nothing rather than doing something approximate.
       */
  }
}

/**
 * The DOM range the browser was about to change, as a range in the source.
 *
 * `null` when it cannot be mapped — a range that reaches outside the section
 * the caret is bound to, or into a verse with no source layer. The caller then
 * falls back to a one-letter edit at the caret, which is the conservative
 * reading and the one rule zero will check.
 */
function rangeOf(e: InputEvent, session: Session): { from: number; to: number } | null {
  const target = e.getTargetRanges?.()[0];
  if (target === undefined) return null;

  const start = addressAtDom(
    { node: target.startContainer, offset: target.startOffset },
    session.srcMapIn,
    session.flatFor,
  );
  const end = addressAtDom(
    { node: target.endContainer, offset: target.endOffset },
    session.srcMapIn,
    session.flatFor,
  );
  if (start === null || end === null) return null;
  /* Both ends must be in the section the command will name. */
  if (start.sectionId !== session.sectionId || end.sectionId !== session.sectionId) return null;

  const flat = session.flatFor(session.sectionId);
  const from = offsetOf(flat, start.at);
  const to = offsetOf(flat, end.at);
  if (from === null || to === null) return null;
  return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * The range the model believes is selected — the one the status bar names.
 *
 * `null` for a bare caret, so a plain keystroke still takes the collapsed
 * path and coalesces into one undo step.
 */
function modelRange(session: Session): { from: number; to: number } | null {
  if (session.selection === null) return null;
  const at = selectionRange(session.flat, session.selection);
  return at === null || at.from === at.to ? null : at;
}
