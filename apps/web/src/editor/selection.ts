/**
 * A selection, as the letters it covers.
 *
 * The selection is stored in SOURCE coordinates — `(verse, line, column)` —
 * because that is what an edit needs. What the screen needs is the opposite:
 * which drawn letters to highlight, and which letters a mark command applies
 * to. This module is the one translation between them, so the highlight and
 * the mark can never disagree about what is selected.
 */
import type { SrcMap } from '@siksamitra/engine';
import type { UnitAddress } from '@siksamitra/edit';
import { selectionRange, versesInSelection, type FlatSource, type Selection } from '@siksamitra/edit';

/** A run of units within one verse, inclusive at both ends. */
export interface UnitRange {
  verseId: string;
  from: number;
  to: number;
}

/**
 * The units a selection covers, per verse.
 *
 * A unit is IN the selection when its span overlaps it. An overlap rather than
 * containment, because a selection that starts in the middle of a syllable
 * still has that syllable's letters in it — and a holding applied to a partial
 * selection must land on the letters the author can see are highlighted.
 *
 * Bounded by the SELECTION, not by the document: it walks the source map of
 * the selected verses only, and a collapsed caret returns nothing at all
 * without walking anything.
 */
export function selectedUnits(
  flat: FlatSource,
  selection: Selection,
  srcMapOf: (verseId: string) => SrcMap | null,
): UnitRange[] {
  const range = selectionRange(flat, selection);
  if (range === null || range.from === range.to) return [];
  const { from, to } = range;
  const out: UnitRange[] = [];

  for (const verseId of versesInSelection(flat, selection)) {
    const srcMap = srcMapOf(verseId);
    if (srcMap === null) continue;

    /*
     * The verse's own lines, looked up ONCE. `offsetOf` is a linear scan of
     * the section's line list, and calling it twice per unit made a selection
     * cost O(units × lines) on every caret move.
     */
    const lineAt = new Map<number, number>();
    for (const line of flat.lineStarts) {
      if (line.verseId === verseId) lineAt.set(line.line, line.at);
    }

    let first = -1;
    let last = -1;
    for (const [unit, span] of srcMap.units.entries()) {
      const base = lineAt.get(span.line);
      if (base === undefined) continue;
      const start = base + span.start;
      const end = base + span.end;
      if (end <= from || start >= to) continue;
      if (first === -1) first = unit;
      last = unit;
    }
    if (first !== -1) out.push({ verseId, from: first, to: last });
  }

  return out;
}

/** The same thing as individual addresses — what a mark command takes. */
export function unitAddresses(ranges: readonly UnitRange[]): UnitAddress[] {
  const out: UnitAddress[] = [];
  for (const range of ranges) {
    for (let unit = range.from; unit <= range.to; unit += 1) {
      out.push({ verseId: range.verseId, unit });
    }
  }
  return out;
}

/**
 * The letter the caret is ON, for a mark command with nothing selected.
 *
 * Word applies bold to the word you are in; a holding is finer than that — it
 * belongs to ONE letter, and the owner's rule is one box on one letter. So a
 * collapsed caret marks the letter it precedes, or the last letter of the line
 * when it sits at the end.
 */
export function unitAtCaret(
  selection: Selection,
  srcMap: SrcMap | null,
): UnitAddress | null {
  if (srcMap === null) return null;
  const head = selection.head;
  let fallback: number | null = null;
  for (const [unit, span] of srcMap.units.entries()) {
    if (span.line !== head.line) continue;
    if (head.column >= span.start && head.column < span.end) {
      return { verseId: head.verseId, unit };
    }
    if (span.end <= head.column) fallback = unit;
  }
  return fallback === null ? null : { verseId: head.verseId, unit: fallback };
}
