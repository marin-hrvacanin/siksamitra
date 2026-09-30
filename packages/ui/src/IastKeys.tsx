/**
 * THE IAST KEYS — the varṇamālā in groups, every key showing the F9 letter
 * that types it. `iast.ts`'s table, drawn once, for the app's popover and the
 * Word add-in's insert palette alike.
 *
 * THE CARET MUST NOT MOVE. A button that takes the focus takes it from the
 * document, and the insertion then has no caret to land at — so every key
 * refuses the mousedown's focus.
 */
import type { ReactNode } from 'react';
import { IAST_PALETTE, leaderFor } from './iast.js';

export function IastKeys(
  { insert, leader = true, leaderLabel = 'F9' }: {
    /** Insert a character at the caret, as if it had been typed. */
    insert: (ch: string) => void;
    /** Show the F9 letter on each key — only where F9 does something. */
    leader?: boolean;
    /** What the tooltip calls the leader: `F9` in the app; in Word's typing
     *  help the dialog is already armed, so it is just the letter to press. */
    leaderLabel?: string;
  },
): ReactNode {
  return (
    <>
      {IAST_PALETTE.map((group) => (
        <section className="iast__grp" key={group.group}>
          <h3 className="iast__lbl">{group.group}</h3>
          <div className="iast__keys">
            {group.keys.map((key) => {
              const f9 = leader ? leaderFor(key.ch) : undefined;
              const hint = [key.name, f9 === undefined ? undefined : `${leaderLabel} ${f9}`]
                .filter((s) => s !== undefined).join(' · ');
              return (
                <button
                  type="button"
                  key={key.ch}
                  className="iast__key"
                  title={hint === '' ? key.ch : `${key.ch} — ${hint}`}
                  aria-label={key.name ?? key.ch}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(key.ch)}
                >
                  <span className="iast__ch">{key.show ?? key.ch}</span>
                  {f9 !== undefined && <span className="iast__f9" aria-hidden>{f9}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
