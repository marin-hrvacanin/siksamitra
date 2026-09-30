/**
 * THE TYPING HELP — the app's IAST palette and its F9 leader, as one dialog.
 *
 * In the app, F9 and then a letter types that letter's long or dotted form,
 * and the palette is a popover. Word lets a shortcut be a chord and never a
 * sequence (learn.microsoft.com/office/dev/add-ins/design/keyboard-shortcuts),
 * so here the chord OPENS this dialog, which is the armed leader: press `a`
 * and ā goes in at the caret and the dialog closes, exactly as F9 then `a`
 * does in the app. Clicking a key types it and leaves the dialog open, so
 * several can be picked, as in the app's popover. Escape closes it.
 *
 * The keys, the letters and the hints are the app's own (`@siksamitra/ui`).
 */
import { useEffect, type ReactNode } from 'react';
import { IastKeys, leaderStep } from '@siksamitra/ui';
import { useMode } from '../ui/useMode.js';
import type { Reply } from '../word/dialog.js';

const send = (r: Reply): void => { Office.context.ui.messageParent(JSON.stringify(r)); };

export function TypeHelp(): ReactNode {
  const mode = useMode();
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); send({ close: true }); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const step = leaderStep(e.key);
      if (step === null || step === 'miss') return;
      e.preventDefault();
      send({ ch: step.insert, close: true });
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  return (
    <div className="dlg dlg--type" data-chrome="palladio" data-mode={mode}>
      <p className="dlg__lead">
        Press the letter in a key’s corner to type it and close — <kbd>s</kbd> for ś, <kbd>Shift</kbd>+<kbd>s</kbd> for
        ṣ — or click keys to type several. <kbd>Esc</kbd> closes. In the document, <kbd>Alt</kbd>+<kbd>s</kbd> types ś
        without opening this.
      </p>
      <div className="iast__pad">
        <IastKeys insert={(ch) => send({ ch })} leaderLabel="press" />
      </div>
    </div>
  );
}
