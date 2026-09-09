/**
 * The entry point: wait for Office, build the pane, follow the caret.
 *
 * `Office.onReady` rather than a `load` listener — the host injects its own
 * bridge and `Word` is not defined until it resolves. Everything the pane does
 * goes through `Word.run`, so a pane built before that fails on the first
 * press with a message that says nothing.
 */
import '@siksamitra/tokens/tokens.css';
import './ui/pane.css';
import { build, refresh } from './ui/pane.js';

Office.onReady(({ host }) => {
  const root = document.getElementById('root');
  if (root === null) return;

  if (host !== Office.HostType.Word) {
    root.textContent = 'śikṣāmitra marks Word documents. This is not Word.';
    return;
  }

  build(root);
  void refresh();

  /*
   * Follow the caret. Without this the pane shows the selection it was opened
   * with and every button acts on a range the reader has moved off — which
   * looks like the add-in marking the wrong word.
   */
  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    () => { void refresh(); },
  );
});
