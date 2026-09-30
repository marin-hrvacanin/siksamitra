/** The typing help dialog's entry. */
import '@siksamitra/tokens/tokens.css';
import '@siksamitra/ui/controls.css';
import '@siksamitra/ui/popover.css';
import './ui/fonts.generated.css';
import './ui/settings.css';
import { createRoot } from 'react-dom/client';
import { TypeHelp } from './dialog/TypeHelp.js';

const root = document.getElementById('root');
if (root !== null && typeof Office !== 'undefined') {
  Office.onReady(() => { createRoot(root).render(<TypeHelp />); });
}
