/**
 * TYPE — every IAST letter and Vedic sign, one click each, and the Alt chords
 * that type them from the keyboard. The app's own keys (`IastKeys`), so the
 * palette is the desktop app's palette; it stays open beside the document,
 * which the old typing-help dialog could not.
 */
import type { ReactNode } from 'react';
import { IastKeys, officeChord } from '@siksamitra/ui';
import { LEADER_COMMANDS } from '../../commands-table.js';
import { locate } from '../../word/selection.js';
import { typeInSelection } from '../../word/actions.js';
import { tell } from '../../word/dialog.js';
import type { Here } from './useHere.js';

export function TypeTab({ here }: { here: Here }): ReactNode {
  const insert = (ch: string): void => {
    void (async () => {
      const said = await typeInSelection(await locate(), ch);
      if (said.kind === 'warn') await tell(said);
      here.refresh();
    })();
  };
  return (
    <>
      <section className="pnl-group">
        <h3 className="pnl-h">Type at the caret</h3>
        <div className="iast__pad pnl-iast">
          <IastKeys insert={insert} leaderLabel="Alt" />
        </div>
      </section>
      <section className="pnl-group">
        <h3 className="pnl-h">From the keyboard</h3>
        <p className="pnl-quiet">Alt and a letter types its long or dotted form; Shift gives the other half.</p>
        <div className="pnl-chords">
          {LEADER_COMMANDS.map((c) => (
            <span key={c.id} className="pnl-chord">
              <kbd>{officeChord(c.key!)}</kbd>
              <span className="pnl-chord__ch">{typeof c.does === 'object' && 'insert' in c.does ? c.does.insert : ''}</span>
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
