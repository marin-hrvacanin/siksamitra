/**
 * PLACING A MARK BY HAND.
 *
 * The one part of the session that is about the MARKING rather than about the
 * text, which is why it is its own file: somebody reading this program to
 * understand how a holding gets onto a letter should not have to read the
 * caret, the clipboard and the undo stack first.
 *
 * WHAT A MARK APPLIES TO. The selection, if there is one; otherwise the single
 * letter under the caret. That rule is here rather than in each command
 * because "Short", "Long", "None" and "Clear" must all agree about it — and
 * when they did not, a mark button meant one thing with a selection and
 * another without, which is the sort of difference nobody reports and
 * everybody works around.
 */
import { useCallback } from 'react';
import type { ChantSection } from '@siksamitra/format';
import type { EditCommand, Selection } from '@siksamitra/edit';
import type { SrcMap } from '@siksamitra/engine';
import { unitAddresses, unitAtCaret, type UnitRange } from './selection.js';

/**
 * The fields a `Clear` may withdraw.
 *
 * The engine's own override fields, named here so the one list is the one the
 * command sends — an invented subset would compile and then silently fail to
 * clear whatever it had left out.
 */
export type MarkField =
  | 'hold' | 'hg' | 'svara' | 'change' | 'sup' | 'candra' | 'sbhakti' | 'dirgha';

export interface Marks {
  mark: (patch: Record<string, unknown>, note?: string) => void;
  unmark: (fields: readonly MarkField[]) => void;
  autoHoldings: (mode: 'keep' | 'replace') => void;
}

export function useMarks(
  { run, section, selected, selection, srcMapOf }: {
    run: (command: EditCommand) => void;
    section: ChantSection | undefined;
    selected: readonly UnitRange[];
    selection: Selection | null;
    srcMapOf: (verseId: string) => SrcMap | null;
  },
): Marks {
  /** The letters a mark command applies to. */
  const targets = useCallback(() => {
    if (selection === null || section === undefined) return [];
    if (selected.length > 0) return unitAddresses(selected);
    const one = unitAtCaret(selection, srcMapOf(selection.head.verseId));
    return one === null ? [] : [one];
  }, [selection, section, selected, srcMapOf]);

  const mark = useCallback((patch: Record<string, unknown>, note?: string) => {
    const where = targets();
    if (where.length === 0 || section === undefined) return;
    run({
      k: 'mark',
      sectionId: section.id,
      targets: where,
      patch,
      why: 'owner-hand',
      ...(note === undefined ? {} : { note }),
    });
  }, [run, section, targets]);

  const unmark = useCallback((fields: readonly MarkField[]) => {
    const where = targets();
    if (where.length === 0 || section === undefined) return;
    run({ k: 'unmark', sectionId: section.id, targets: where, fields });
  }, [run, section, targets]);

  /**
   * Re-run the holding rules.
   *
   * Over the SELECTED verses, or over every derivable verse in the section
   * when nothing is selected. Never over a transcribed one: it has no source
   * to derive from, and the session refuses it anyway — filtering here means
   * the command does not arrive carrying a refusal it could have avoided.
   */
  const autoHoldings = useCallback((mode: 'keep' | 'replace') => {
    if (section === undefined) return;
    const verseIds = selected.length > 0
      ? [...new Set(selected.map((r) => r.verseId))]
      : section.verses.filter((v) => v.src !== undefined).map((v) => v.id);
    run({ k: 'auto-holdings', sectionId: section.id, verseIds, mode });
  }, [run, section, selected]);

  return { mark, unmark, autoHoldings };
}
