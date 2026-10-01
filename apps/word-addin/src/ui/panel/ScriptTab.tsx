/**
 * SCRIPT — the line under the caret in each of the four scripts, and a press
 * writes the selected lines (or, with nothing selected, the document, after
 * asking) in that one. The preview is drawn by the app's renderer from the
 * line as the add-in reads it, so it is what the press will write.
 */
import type { ReactNode } from 'react';
import { getScript } from '@siksamitra/engine';
import { COMMANDS, SCRIPTS, type Command } from '../../commands-table.js';
import type { Here } from './useHere.js';
import { Drawn } from './Drawn.js';

export function ScriptTab({ here, busy, press }: { here: Here; busy: boolean; press: (c: Command) => void }): ReactNode {
  const at = here.at;
  const selected = at !== null && (at.from !== at.to || at.lines.length > 1);
  return (
    <section className="pnl-group">
      <h3 className="pnl-h">Write {selected ? 'the selected lines' : 'the whole document'} in</h3>
      <div className="pnl-scripts">
        {SCRIPTS.map(([script, ch]) => {
          const c = COMMANDS.find((x) => x.id === `script-${script}`)!;
          const current = at?.script === script;
          return (
            <button type="button" key={script} className="pnl-script" aria-pressed={current} disabled={busy}
              title={c.tip} onClick={() => press(c)}>
              <span className="pnl-script__glyph" aria-hidden>{ch}</span>
              <span className="pnl-script__name">{getScript(script)?.name ?? script}{current ? ' · now' : ''}</span>
              {at !== null && <Drawn tm={at.tm} script={script} />}
            </button>
          );
        })}
      </div>
      <p className="pnl-quiet">Every mark is kept, and IAST gives back exactly what was there.</p>
    </section>
  );
}
