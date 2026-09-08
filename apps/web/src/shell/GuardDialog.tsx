/**
 * SAVE / DISCARD / CANCEL — the only modal in the program, and it earns it.
 *
 * WHY IT IS OURS AND NOT THE PLATFORM'S. Neither host can ask this question.
 * A browser's `confirm` has two buttons; Tauri's `confirm` has two buttons.
 * The third one is the whole point — the answer "actually, never mind" is the
 * one somebody reaches for when they realise they were about to lose a
 * morning's work — and a two-button dialog forces it to be spelled as
 * "Cancel means don't save", which is how work gets lost.
 *
 * WHY IT IS MODAL. Everything else in this shell says what it has to say in
 * the status bar, and a modal for "saved" is an insult. This one is different
 * in kind: the program is about to do something irreversible and cannot
 * proceed until it is told which. There is nothing useful to do behind it.
 *
 * DISCARD IS NOT THE DEFAULT AND IS DRAWN AS THE DANGER. Enter and the initial
 * focus go to Save; Escape cancels. The one arrangement in which a reflex —
 * pressing the key that dismisses dialogs — cannot destroy anything.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { guardOutcome, type GuardAnswer, type PendingAction } from './doc-file.js';

export function GuardDialog(
  { name, action, onAnswer }: {
    /** The document that has the unsaved changes. */
    name: string;
    /** What was asked for, so the question can name it. */
    action: PendingAction;
    onAnswer: (answer: GuardAnswer) => void;
  },
): ReactNode {
  const save = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    save.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      /*
       * Stopped, not merely handled. Escape is also the editor's way out of
       * write mode and the backstage's way out, and both listen on the
       * document — one press was answering the dialog and dropping the author
       * out of edit mode behind it.
       */
      e.stopPropagation();
      e.preventDefault();
      onAnswer('cancel');
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [onAnswer]);

  return (
    <div className="guard" role="presentation" onMouseDown={() => onAnswer('cancel')}>
      <div
        className="guard__box"
        role="alertdialog"
        aria-modal
        aria-labelledby="guard-q"
        /* The backdrop cancels; a click inside it must not travel up to that. */
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="guard__q" id="guard-q">
          Save the changes to {name}?
        </h2>
        <p className="guard__note">
          Your changes will be lost if you go on without saving.
        </p>
        <div className="guard__acts">
          <button
            type="button"
            className="guard__b guard__b--danger"
            onClick={() => onAnswer('discard')}
          >
            Don’t save
          </button>
          <span className="guard__gap" />
          <button type="button" className="guard__b" onClick={() => onAnswer('cancel')}>
            Cancel
          </button>
          <button
            type="button"
            className="guard__b guard__b--go"
            ref={save}
            onClick={() => onAnswer('save')}
          >
            Save
          </button>
        </div>
        <p className="guard__what">{guardOutcome(action)}</p>
      </div>
    </div>
  );
}
