/**
 * The entry point: wait for Office, then draw the pane.
 *
 * `Office.onReady` rather than a `load` listener — the host injects its own
 * bridge and `Word` is not defined until it resolves. Everything the pane does
 * goes through `Word.run`, so a pane drawn before that fails on the first
 * press with a message that says nothing.
 *
 * The stylesheets are the app's own, in the app's order — tokens, then the
 * shared controls, ribbon, popover and tooltip sheets from `@siksamitra/ui` —
 * and only then the pane's arrangement.
 */
import '@siksamitra/tokens/tokens.css';
import '@siksamitra/ui/controls.css';
import '@siksamitra/ui/ribbon.css';
import '@siksamitra/ui/popover.css';
import '@siksamitra/ui/tooltip.css';
import './ui/pane.css';
import { createRoot } from 'react-dom/client';
import { Pane } from './ui/Pane.js';

const root = document.getElementById('root');

/*
 * office.js comes from Microsoft's CDN, not from this bundle. When it is
 * blocked or the machine is offline, `Office` is not defined at all and the
 * call below throws — which used to leave an empty pane and nothing to say why.
 */
if (typeof Office === 'undefined') {
  if (root !== null) {
    root.textContent = 'The pane could not reach Microsoft’s Office library '
      + '(appsforoffice.microsoft.com). Check the connection, then close and '
      + 'reopen the pane.';
  }
} else Office.onReady(({ host }) => {
  if (root === null) return;
  if (host !== Office.HostType.Word) {
    root.textContent = 'śikṣāmitra marks Word documents. This is not Word.';
    return;
  }
  createRoot(root).render(<Pane />);
});
