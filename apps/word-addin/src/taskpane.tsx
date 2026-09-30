/**
 * THE ONE PAGE WORD KEEPS LOADED — the shared runtime, and Settings.
 *
 * Word loads this behind the tab (the manifest's `<Runtime lifetime="long">`)
 * and never shows it unless Settings is pressed. On load it registers every
 * command of the tab and every keyboard shortcut (`runtime.ts`); when Settings
 * is pressed Word shows this same page, and what it draws is the Settings
 * panel.
 *
 * `Office.onReady` rather than a `load` listener — the host injects its own
 * bridge and `Word` is not defined until it resolves.
 */
import '@siksamitra/tokens/tokens.css';
import '@siksamitra/ui/controls.css';
import './ui/fonts.generated.css';
import './ui/settings.css';
import { createRoot } from 'react-dom/client';
import { registerAll } from './runtime.js';
import { Settings } from './ui/Settings.js';

const root = document.getElementById('root');

/*
 * office.js comes from Microsoft's CDN, not from this bundle. When it is
 * blocked or the machine is offline, `Office` is not defined at all — which
 * used to leave an empty panel and nothing to say why.
 */
if (typeof Office === 'undefined') {
  if (root !== null) {
    root.textContent = 'śikṣāmitra could not reach Microsoft’s Office library '
      + '(appsforoffice.microsoft.com). Check the connection, then restart Word.';
  }
} else Office.onReady(({ host }) => {
  if (root === null) return;
  if (host !== Office.HostType.Word) {
    root.textContent = 'śikṣāmitra marks Word documents. This is not Word.';
    return;
  }
  registerAll();
  createRoot(root).render(<Settings />);
});
