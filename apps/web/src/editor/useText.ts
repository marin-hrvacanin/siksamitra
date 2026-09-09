/**
 * CHANGING THE TEXT.
 *
 * Four commands — replace a range, insert, delete, break a line — and all of
 * them are one range replacement underneath. They are together in one file
 * because the rule that makes a burst of them a SINGLE undo step has to be the
 * same for all four, and a rule stated four times is a rule that will
 * eventually be stated four different ways.
 *
 * WHAT COALESCES AND WHAT DOES NOT. Typing coalesces with typing and deleting
 * with deleting, within a moment of each other, so Ctrl+Z takes back a word
 * rather than a letter. A paste is one edit on its own. A drag-move is one
 * act made of two events and shares a key so that one undo puts the text back
 * where it came from.
 */
import { useCallback } from 'react';
import type { ChantSection } from '@siksamitra/format';
import {
  VERSE_GAP, isCollapsed, lineBreakAt, selectionRange,
  type EditCommand, type FlatSource, type Selection,
} from '@siksamitra/edit';

export interface TextCommands {
  replace: (from: number, to: number, text: string, kind?: string) => void;
  insert: (text: string) => void;
  remove: (direction: 1 | -1) => void;
  newLine: (verse: boolean) => void;
}

export function useText(
  { run, section, flat, selection, coalesceKey }: {
    run: (command: EditCommand) => void;
    section: ChantSection | undefined;
    flat: FlatSource;
    selection: Selection | null;
    coalesceKey: (kind: string) => string;
  },
): TextCommands {
  const replace = useCallback((from: number, to: number, insert: string, kind?: string) => {
    if (section === undefined) return;
    run({
      k: 'replace',
      sectionId: section.id,
      from,
      to,
      insert,
      ...(kind === undefined ? {} : { coalesce: coalesceKey(kind) }),
    });
  }, [run, section, coalesceKey]);

  const insert = useCallback((text: string) => {
    if (selection === null) return;
    const range = selectionRange(flat, selection);
    // A stale selection names no range. It used to name "everything up to the
    // caret", and the next keystroke deleted all of it.
    if (range === null) return;
    replace(range.from, range.to, text, text.includes('\n') ? undefined : 'type');
  }, [flat, selection, replace]);

  const remove = useCallback((direction: 1 | -1) => {
    if (selection === null) return;
    const range = selectionRange(flat, selection);
    if (range === null) return;
    if (!isCollapsed(selection)) {
      replace(range.from, range.to, '', 'delete');
      return;
    }
    // A collapsed caret deletes the character beside it. `from === to === 0`
    // with Backspace deletes nothing rather than wrapping to the end.
    const from = direction === -1 ? Math.max(0, range.from - 1) : range.from;
    const to = direction === -1 ? range.from : Math.min(flat.text.length, range.to + 1);
    if (from === to) return;
    replace(from, to, '', 'delete');
  }, [flat, selection, replace]);

  /**
   * ENTER.
   *
   * What it inserts is `lineBreakAt`'s to decide, and that is the fix: this
   * inserted a bare `'\n'`, and a lone newline at either EDGE of a line makes
   * an empty line, which `split` prunes as the residue of its own verse
   * separator. So Enter at the start of a verse, at the end of a verse, and at
   * the end of a section changed NOT ONE BYTE — the owner's "Enter doesn't
   * work", exactly. `splitLine` in `@siksamitra/edit` has expressed the right
   * rule since it was written and nothing ever called it.
   *
   * `verse: true` — Ctrl+Enter, "start a new verse here" — still says so
   * outright, because at a line's middle that is a different request from
   * Enter and only the person knows which they mean.
   */
  const newLine = useCallback((verse: boolean) => {
    if (selection === null) return;
    const range = selectionRange(flat, selection);
    if (range === null) return;
    replace(range.from, range.to, verse ? VERSE_GAP : lineBreakAt(flat, range.from));
  }, [flat, selection, replace]);


  return { replace, insert, remove, newLine };
}
