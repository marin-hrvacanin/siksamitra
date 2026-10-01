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
import { setConventions, setProfile, type EditState, type History, type ProfileResult } from '@siksamitra/edit';
import type { ConventionId } from '@siksamitra/engine';

interface Live {
  state: EditState;
  history: History;
}

export type SetRegister = (
  scope: 'document' | 'section',
  preset: ChantProfileKey | null,
) => string;

export type SetConventions = (
  scope: 'document' | 'section',
  chosen: Partial<Record<ConventionId, boolean>>,
) => string;

/** One profile change as one undoable step, its sentence handed back. */
function useProfileStep<A extends unknown[]>(
  setLive: Dispatch<SetStateAction<Live>>,
  setRevision: Dispatch<SetStateAction<number>>,
  step: (doc: Live['state']['doc'], history: History, ...a: A) => ProfileResult | null,
): (...a: A) => string {
  return useCallback((...a: A) => {
    let said = '';
    setLive((current) => {
      const done = step(current.state.doc, current.history, ...a);
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
  }, [setLive, setRevision, step]);
}

export function useRegister(
  setLive: Dispatch<SetStateAction<Live>>,
  setRevision: Dispatch<SetStateAction<number>>,
  sectionId: string,
): SetRegister {
  const step = useCallback((doc: Live['state']['doc'], history: History, scope: 'document' | 'section', preset: Parameters<SetRegister>[1]) =>
    setProfile(doc, history, { k: 'profile', scope, ...(scope === 'section' ? { sectionId } : {}), preset }), [sectionId]);
  return useProfileStep(setLive, setRevision, step);
}

/** The conventions switched, for the same two scopes as the register. */
export function useConventions(
  setLive: Dispatch<SetStateAction<Live>>,
  setRevision: Dispatch<SetStateAction<number>>,
  sectionId: string,
): SetConventions {
  const step = useCallback((doc: Live['state']['doc'], history: History, scope: 'document' | 'section', chosen: Parameters<SetConventions>[1]) =>
    setConventions(doc, history, { k: 'conventions', scope, ...(scope === 'section' ? { sectionId } : {}), chosen }), [sectionId]);
  return useProfileStep(setLive, setRevision, step);
}
