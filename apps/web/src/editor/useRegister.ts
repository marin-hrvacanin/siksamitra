/**
 * Changing which register's rules govern the text, from the interface.
 *
 * IT GOES THROUGH `setProfile` RATHER THAN `apply`.
 *
 * `apply` throws the command's own account of itself away — it keeps the
 * reports and the refusals, which is all a keystroke has to say. This command's
 * whole point is how much it moved: which scope changed, how many verses were
 * re-derived, and how many were left alone because they were copied from a
 * marked source. That sentence exists only where it is computed, so the call
 * is made directly and the sentence handed back to whoever has somewhere to
 * put it.
 *
 * Same state, same history: it is one undo step like any other command.
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ChantProfileKey } from '@siksamitra/format';
import { setProfile, type EditState, type History } from '@siksamitra/edit';

interface Live {
  state: EditState;
  history: History;
}

export type SetRegister = (
  scope: 'document' | 'section',
  preset: ChantProfileKey | null,
) => string;

export function useRegister(
  setLive: Dispatch<SetStateAction<Live>>,
  setRevision: Dispatch<SetStateAction<number>>,
  sectionId: string,
): SetRegister {
  return useCallback((scope, preset) => {
    let said = '';
    setLive((current) => {
      const done = setProfile(current.state.doc, current.history, {
        k: 'profile',
        scope,
        ...(scope === 'section' ? { sectionId } : {}),
        preset,
      });
      if (done === null) return current;
      said = done.note;
      return {
        state: {
          ...current.state,
          doc: done.doc,
          reports: done.reports,
          refusals: done.refusals,
        },
        history: done.history,
      };
    });
    setRevision((n) => n + 1);
    return said;
  }, [setLive, setRevision, sectionId]);
}
