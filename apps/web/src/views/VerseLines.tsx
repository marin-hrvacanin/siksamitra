/**
 * ONE VERSE, LINE BY LINE — split at its `br` tokens.
 *
 * The lines matter for two reasons: pagination splits between them, and a
 * recitation line is a breath — so it is a real unit of the text and not a
 * consequence of the column width.
 *
 * AND WHICH LINE STARTS A PARAGRAPH, which is what his hanging indent is
 * about: a line that starts one of his paragraphs is drawn at the margin, a
 * line after a soft break hangs in, and so does a long line as it wraps
 * (`ChantVerse.paragraphs`). Out of `DocumentBlocks.tsx` when that file
 * reached the 400-line limit.
 */
import type { ReactNode } from 'react';
import type { ChantScriptKey, ChantToken, ChantVerse } from '@siksamitra/format';
import { holdJoins, renderToken, unitsBefore, type TokenContext } from '@siksamitra/render';

const FONT_STACK = 'var(--doc-verse-face)';

/** The lines that start a paragraph: the first, and each after a paragraph's last. */
export function paragraphStarts(counts: readonly number[] | undefined, lines: number): ReadonlySet<number> {
  const starts = new Set<number>([0]);
  if (counts === undefined) return starts;
  let at = 0;
  for (const n of counts) {
    if (at < lines) starts.add(at);
    at += n;
  }
  return starts;
}

export function VerseLines(
  { verse, script, showMarks, addressable, number, range }: {
    verse: ChantVerse; script: ChantScriptKey; showMarks: boolean; addressable: boolean;
    /** The page's own verse number, drawn in the gutter of the FIRST line. */
    number?: string;
    /**
     * Which lines this copy draws, `[first, last]` inclusive — the page map's
     * `lineRange`, for a verse a page break runs through. Absent means all of
     * them, which is every view but the paged one.
     */
    range?: readonly [number, number];
  },
): ReactNode {
  const lines: ChantToken[][] = [[]];
  for (const t of verse.tokens) {
    if (t.t === 'br') lines.push([]);
    else lines[lines.length - 1]!.push(t);
  }
  const starts = paragraphStarts(verse.paragraphs, lines.length);
  const ctx: TokenContext = {
    script, showMarks, fontStack: FONT_STACK, ...(addressable ? { addressable } : {}),
  };

  /*
   * The unit counter runs over the WHOLE verse, not per line: `SrcMap.units`
   * is one entry per letter of the verse in token order, and a `br` contributes
   * none. A per-line counter would address every letter after the first break
   * to the wrong source offset — the mark would land a line early.
   */
  let offset = 0;
  return (
    <>
      {lines.map((line, li) => {
        const base = offset;
        offset += unitsBefore(line, line.length);
        /*
         * A line outside this copy's range is skipped, but the unit counter
         * above it is NOT — `base` is an offset into the whole verse, so the
         * second half of a split verse must count the first half's letters
         * even though it does not draw them. `data-line` likewise stays the
         * line's index in the VERSE: a recording addresses a pāda by it
         * (`useRecording`), and renumbering per page would play the wrong line.
         */
        if (range !== undefined && (li < range[0] || li > range[1])) return null;
        return (
          <div className={starts.has(li) ? 'pada pada--para' : 'pada'} data-line={li} key={li}>
            {/*
              INSIDE the first line, not floating beside the verse. On the line,
              its baseline is the line's baseline, because it is the same line.
            */}
            {li === 0 && number !== undefined && (
              <span className="verse__n" aria-hidden>{number}</span>
            )}
            {(() => {
              /* Which boxes run through a syllable boundary, once per line —
                 see `holdJoins`. Per line, because a line break ends a box. */
              const joins = holdJoins(line);
              return line.map((t, ti) => renderToken(
                t, ti, ctx, base + unitsBefore(line, ti), joins.get(ti),
              ));
            })()}
          </div>
        );
      })}
    </>
  );
}
