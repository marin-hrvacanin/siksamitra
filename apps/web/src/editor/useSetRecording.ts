/**
 * Putting a mapping into the document, as one undoable step.
 *
 * Mapping a take rewrites every verse's offsets at once, and it is exactly the
 * kind of thing somebody tries, listens to, and wants to take back — so it is
 * a history step like any other, which is why `Snapshot` carries `recording`.
 *
 * It does not go through `apply`. `apply` exists to keep DERIVED marks honest:
 * it refuses, rebases and re-derives. A mapping derives nothing and can lose
 * no mark — the text is untouched — so putting it through the mark machinery
 * would be ceremony, and ceremony is where a bug hides.
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { record, snapshot, type EditState, type History } from '@siksamitra/edit';

interface Live {
  state: EditState;
  history: History;
}

export function useSetRecording(
  setLive: Dispatch<SetStateAction<Live>>,
  setRevision: Dispatch<SetStateAction<number>>,
): (next: ChantDoc) => void {
  return useCallback((next: ChantDoc) => {
    setLive((current) => {
      const ids = current.state.doc.sections.map((s) => s.id);
      return {
        state: { ...current.state, doc: next, refusals: [], reports: [] },
        history: record(current.history, {
          before: snapshot(current.state.doc, ids, current.state.selection),
          after: snapshot(next, ids, current.state.selection),
        }),
      };
    });
    setRevision((n) => n + 1);
  }, [setLive, setRevision]);
}
