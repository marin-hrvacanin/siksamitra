/**
 * DOCUMENT — what is set once rather than pressed: the śikṣāmitra styles in
 * this document, a specimen of every mark, a document of the app's brought
 * in, the guide, and the keyboard.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { officeChord } from '@siksamitra/ui';
import { COMMANDS, PANEL_COMMANDS, type Command } from '../../commands-table.js';
import { ADDIN_VERSION, GUIDE_URL } from '../../version.js';
import { documentStyles, type DocStyles } from '../../word/client.js';
import { InsertDocument } from '../InsertDocument.js';

const byId = (id: string): Command => PANEL_COMMANDS.find((c) => c.id === id)!;

export function DocumentTab({ busy, press }: { busy: boolean; press: (c: Command) => void }): ReactNode {
  const [styles, setStyles] = useState<DocStyles | null>(null);
  const read = (): void => { void documentStyles().then(setStyles, () => setStyles(null)); };
  useEffect(read, [busy]);

  return (
    <>
      <section className="pnl-group">
        <h3 className="pnl-h">Styles in this document</h3>
        {styles === null ? <p className="pnl-quiet">Reading the document…</p> : (
          <>
            <div className="pnl-meter" role="img" aria-label={`${styles.total - styles.missing.length} of ${styles.total} styles`}>
              <span style={{ inlineSize: `${(100 * (styles.total - styles.missing.length)) / Math.max(1, styles.total)}%` }} />
            </div>
            <p className="pnl-quiet">
              {styles.missing.length === 0 && styles.older.length === 0
                ? `All ${styles.total} śikṣāmitra styles are here.`
                : `${styles.total - styles.missing.length} of ${styles.total} are here. A mark adds the style it needs by itself; `
                  + 'Import styles brings them all in at once.'}
              {styles.older.length > 0 ? ` It uses the older names (${styles.older.join(', ')}); Import styles takes it into the clean ones, looking exactly as it does now.` : ''}
            </p>
          </>
        )}
        <div className="pnl-wrap">
          <button type="button" className="pnl-btn" disabled={busy} title={byId('import-styles').tip}
            onClick={() => press(byId('import-styles'))}>Import styles</button>
          <button type="button" className="pnl-btn" disabled={busy} title={byId('specimen').tip}
            onClick={() => press(byId('specimen'))}>Add a specimen</button>
        </div>
      </section>

      <InsertDocument />

      <section className="pnl-group">
        <h3 className="pnl-h">Keyboard</h3>
        <table className="pnl-keys">
          <tbody>
            {COMMANDS.filter((c) => c.key !== undefined).map((c) => (
              <tr key={c.id}><td><kbd>{officeChord(c.key!)}</kbd></td><td>{c.label}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="pnl-foot">
        <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">The marking rules, explained</a>
        <span>v{ADDIN_VERSION}</span>
      </footer>
    </>
  );
}
