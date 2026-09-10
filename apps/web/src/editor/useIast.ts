/**
 * THE F9 LEADER, wired to the document.
 *
 * `iast.ts` is the table; this is the state machine, and it has exactly three
 * states: idle, armed, and inserting. It is a hook rather than part of
 * `handleEditKey` because a leader is MODAL — the meaning of the next key
 * depends on the last one — and a table of independent bindings cannot say
 * that. `keymap.ts` names the key so it is still listed in one place.
 *
 * IT INSERTS THROUGH THE SESSION, like typing does. `session.insert` is the
 * one path a character reaches the document by, so a leader insertion
 * coalesces into the same undo step as the letters around it and lands in the
 * right verse without this file knowing anything about verses.
 *
 * ARMED IS VISIBLE, and that is not decoration. A modal key with no feedback
 * is how a person concludes a shortcut is broken: they press F9, nothing
 * happens (nothing should), and they press it again. The status bar says so.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { IAST_LEADER_KEY, leaderStep } from './iast.js';

export interface Iast {
  /** Insert a character at the caret, as if it had been typed. */
  insert: (ch: string) => void;
  /** The leader is waiting for its second key. */
  armed: boolean;
}

export function useIast(
  { insert, editing }: {
    insert: (text: string) => void;
    /** Only while the document takes an edit: F9 elsewhere is not ours. */
    editing: boolean;
  },
): Iast {
  const [armed, setArmed] = useState(false);
  /* The ref, because the listener is registered once and a closure over the
     state would see the value it had when it was registered. */
  const isArmed = useRef(false);

  const put = useCallback((ch: string) => { insert(ch); }, [insert]);

  useEffect(() => {
    if (!editing) {
      isArmed.current = false;
      setArmed(false);
      return;
    }
    const down = (e: KeyboardEvent): void => {
      if (e.key === IAST_LEADER_KEY) {
        /*
         * F9 IS TAKEN, so the browser's own use of it does not happen. It is
         * not a chord: a person presses and releases it before the letter, so
         * there is nothing to hold and nothing to time out.
         */
        e.preventDefault();
        isArmed.current = true;
        setArmed(true);
        return;
      }
      if (!isArmed.current) return;
      const step = leaderStep(e.key);
      /* A modifier is how the capital half of the table is typed — F9 then
         Shift+T for `ṭh` — so it does not end the leader. */
      if (step === null) return;
      /*
       * PREVENTED EITHER WAY. A hit must not also type the plain letter, and a
       * MISS must not either: F9 followed by `q` means the person meant a
       * diacritic and named one that does not exist, and inserting `q` into a
       * mantra is worse than inserting nothing. v1 did the same.
       */
      e.preventDefault();
      if (step !== 'miss') put(step.insert);
      isArmed.current = false;
      setArmed(false);
    };
    /* Released without a second key: still armed. v1 disarms on keyup only
       when the leader was already spent, so holding F9 does not latch. */
    const up = (e: KeyboardEvent): void => {
      if (e.key === IAST_LEADER_KEY && !isArmed.current) setArmed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [editing, put]);

  return { insert: put, armed };
}
