/** The message dialog's entry: its arguments are the page's query. */
import '@siksamitra/tokens/tokens.css';
import '@siksamitra/ui/controls.css';
import './ui/fonts.generated.css';
import './ui/settings.css';
import { createRoot } from 'react-dom/client';
import { Said, argsOf } from './dialog/Said.js';

const root = document.getElementById('root');
if (root !== null && typeof Office !== 'undefined') {
  Office.onReady(() => { createRoot(root).render(<Said args={argsOf(location.search)} />); });
}
