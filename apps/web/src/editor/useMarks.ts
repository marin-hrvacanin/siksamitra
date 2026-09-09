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
import type { ChantSection, ChantUnit } from '@siksamitra/format';
import { unitsOf, type EditCommand, type Selection } from '@siksamitra/edit';
import { STAGES, type ReRunMode, type SrcMap } from '@siksamitra/engine';
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

/** What the letters a mark would apply to are carrying now. */
export type HoldState = 'short' | 'long' | 'none' | 'mixed' | null;

export interface Marks {
  mark: (patch: Record<string, unknown>, note?: string) => void;
  unmark: (fields: readonly MarkField[]) => void;
  /** Run the marking rules over the selection, or the whole step. */
  reapplyRules: (mode: ReRunMode) => void;
  /** The holding on the selection: one value, `mixed`, or null for nothing. */
  holdState: HoldState;
  /** Press Long on letters that are already long, and the box comes off. */
  toggleHold: (value: 'short' | 'long') => void;
}

export function useMarks(
  { run, refuse, section, selected, selection, srcMapOf }: {
    run: (command: EditCommand) => void;
    /** Say why nothing happened, when nothing does. */
    refuse: (why: string) => void;
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

  /**
   * Why a mark command found nothing to mark.
   *
   * There is now ONE reason: nothing is selected and the caret is nowhere.
   * This used to have a second — the verse was transcribed — and it was the
   * common one, printed at somebody who had selected a letter and pressed a
   * button. A transcribed verse now takes the mark (`adoptSource`, and
   * `markUnits` where that cannot go), so the message would be a lie.
   */
  const nothingToMark = useCallback(
    (): string => 'Put the caret in the text, or select some letters, and then mark them.',
    [],
  );

  /**
   * The letters a mark would land on, as units.
   *
   * Cached per verse, because the naive version walked every token of a verse
   * once per selected letter — quadratic, and a whole-verse selection in Śrī
   * Rudram is 400 letters.
   */
  const unitsAt = useCallback((): ChantUnit[] => {
    const cache = new Map<string, ChantUnit[]>();
    const out: ChantUnit[] = [];
    for (const t of targets()) {
      let all = cache.get(t.verseId);
      if (all === undefined) {
        const verse = section?.verses.find((v) => v.id === t.verseId);
        all = verse === undefined ? [] : unitsOf(verse.tokens);
        cache.set(t.verseId, all);
      }
      const u = all[t.unit];
      if (u !== undefined) out.push(u);
    }
    return out;
  }, [section, targets]);

  /**
   * What the selection is carrying, so the button can SHOW it.
   *
   * A ribbon button that never looks pressed is a button you cannot tell
   * worked. This is what Word does with bold, and the reason marking
   * already-marked text felt broken: the mark was applied, the page redrew
   * with a box that was already there, and nothing in the interface confirmed
   * anything had happened.
   */
  const holdState: HoldState = (() => {
    const units = unitsAt();
    if (units.length === 0) return null;
    const seen = new Set(units.map((u) => u.hold ?? 'none'));
    if (seen.size > 1) return 'mixed';
    return [...seen][0] as HoldState;
  })();

  const mark = useCallback((patch: Record<string, unknown>, note?: string) => {
    const where = targets();
    if (where.length === 0 || section === undefined) { refuse(nothingToMark()); return; }
    run({
      k: 'mark',
      sectionId: section.id,
      targets: where,
      patch,
      why: 'owner-hand',
      ...(note === undefined ? {} : { note }),
    });
  }, [run, refuse, nothingToMark, section, targets]);

  const unmark = useCallback((fields: readonly MarkField[]) => {
    const where = targets();
    if (where.length === 0 || section === undefined) { refuse(nothingToMark()); return; }
    run({ k: 'unmark', sectionId: section.id, targets: where, fields });
  }, [run, refuse, nothingToMark, section, targets]);

  /**
   * RE-APPLY THE RULES — the only thing in the window that runs the engine.
   *
   * Over the SELECTED verses, or over every verse of the step when nothing is
   * selected, which is the owner's "only on selection or the entire document,
   * with user action". Every stage: a per-stage menu is `text-and-marks` §6.7
   * and belongs in the right-click menu, not in a button whose label would
   * then have to name five things.
   *
   * `keep-hand` and `replace-all` are the two answers to the only question
   * that matters when re-running over work somebody did: whose decision wins.
   */
  const reapplyRules = useCallback((mode: ReRunMode) => {
    if (section === undefined) return;
    const verseIds = selected.length > 0
      ? [...new Set(selected.map((r) => r.verseId))]
      : section.verses.map((v) => v.id);
    if (verseIds.length === 0) { refuse(nothingToMark()); return; }
    run({ k: 'recompute', sectionId: section.id, verseIds, stages: STAGES, mode });
  }, [run, refuse, nothingToMark, section, selected]);

  /**
   * A holding button, pressed twice.
   *
   * WORD'S RULE, because it is the one people already have. A selection that
   * is entirely Long, pressed Long again, loses the box. A MIXED selection —
   * some long, some not — becomes all long on the first press rather than
   * toggling each letter separately, so one press always has one visible
   * meaning.
   *
   * Off is `hold: null`, which now simply takes the marking off the range.
   * It used to mean something else — "there IS no holding here, overruling the
   * rules" — because the rules ran on every keystroke and would otherwise put
   * the box straight back. Nothing runs them unless somebody presses Re-apply,
   * so off is off, and the `None` button that said it explicitly is gone.
   */
  const toggleHold = useCallback((value: 'short' | 'long') => {
    mark({ hold: holdState === value ? null : value });
  }, [mark, holdState]);

  return { mark, unmark, reapplyRules, holdState, toggleHold };
}
