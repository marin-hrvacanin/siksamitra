/**
 * The editing buttons, rendered FROM the keyboard table.
 *
 * Not a parallel list. Every button here is a row in `EDIT_KEYS`, so a button
 * and its shortcut cannot drift apart, cannot disagree about whether the action
 * is available, and cannot be added in one place and forgotten in the other —
 * the failure v1 had three times over.
 */
import type { ReactNode } from 'react';
import { accelOf, ribbonActions, type Binding } from './keymap.js';
import type { Session } from './useSession.js';

function Buttons(
  { group, session }: { group: NonNullable<Binding['ribbon']>; session: Session },
): ReactNode {
  return (
    <div className="tb__row" role="group">
      {ribbonActions(group).map((b, i) => {
        const accel = accelOf(b);
        const enabled = b.enabled?.(session) ?? true;
        return (
          <button
            type="button"
            key={`${b.label}-${i}`}
            className="tb__b"
            disabled={!enabled || !session.editing}
            title={accel === undefined ? b.hint : `${b.hint ?? b.label} (${accel})`}
            onClick={() => b.run(session, false)}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}

export const MarkButtons = ({ session }: { session: Session }): ReactNode =>
  <Buttons group="marks" session={session} />;

export const HistoryButtons = ({ session }: { session: Session }): ReactNode =>
  <Buttons group="history" session={session} />;

export const AutoButtons = ({ session }: { session: Session }): ReactNode =>
  <Buttons group="auto" session={session} />;

/**
 * The edit toggle.
 *
 * A mode, and shown as one. An editor that is always editable is right for a
 * word processor and wrong here: most of the time this program is used to
 * PROOF a text against a printed source, and a stray keystroke into an
 * attested verse is exactly the accident rule zero exists to prevent.
 */
export function EditToggle({ session }: { session: Session }): ReactNode {
  return (
    <div className="tb__row" role="group" aria-label="Mode">
      <button
        type="button"
        className={session.editing ? 'tb__b is-on' : 'tb__b'}
        aria-pressed={session.editing}
        title="Type into the text (Esc leaves)"
        onClick={() => session.setEditing(!session.editing)}
      >
        {session.editing ? 'Editing' : 'Read only'}
      </button>
    </div>
  );
}
