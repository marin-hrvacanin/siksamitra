/**
 * ADDRESSING THE LETTERS OF A VERSE THAT HAS NO SOURCE.
 *
 * A `SrcMap` says where each drawn letter sits in the verse's source text, and
 * the whole editor is built on it: a click becomes a unit, a drag becomes a
 * range of units, a mark is placed on the letters that range names.
 * `verseSrcMap` produces one by deriving — and returns null for a transcribed
 * verse, which has no source to derive from.
 *
 * That null was the reason the owner could not mark anything. The letters were
 * on the page, the pointer highlighted them, and the model was handed no
 * addresses at all — so the status bar said "col 1", the selection was empty,
 * and the holding button had nothing to act on. It looked exactly like a
 * broken button, and it was reported as one three times.
 *
 * The letters are addressable all the same. `linesFromTokens` already stands
 * the verse's recited text in for the caret; this walks the same text and the
 * same units together, so a letter has an offset in it. The map is over the
 * STAND-IN, not over a source layer the verse does not have — which is exactly
 * what the caret, the selection and `selectedUnits` need, since they work in
 * the same flat text.
 *
 * It is not a substitute for a real derivation. Nothing is derived from this
 * map and no override is addressed through it: `adoptSource` builds a genuine
 * source layer when a mark has to be stored, and `markUnits` writes onto the
 * letter when it cannot. This only answers "which letter is that".
 */
import type { SrcMap } from '@siksamitra/engine';
import type { ChantToken, ChantVerse } from '@siksamitra/format';
import { linesFromTokens } from './sync.js';

/**
 * A source map over a transcribed verse's own recited text.
 *
 * Returns null for a verse that HAS a source layer — that one has a real map
 * and must use it, or a mark would be addressed against the wrong text.
 */
export function tokenSrcMap(verse: ChantVerse): SrcMap | null {
  if (verse.src !== undefined) return null;

  const lines = linesFromTokens(verse);
  const units: SrcMap['units'] = [];

  let line = 0;
  /* Where the scan has reached on the current line. The glyphs come out of the
     tokens in the order they were written into the line, so a forward search
     from here cannot match an earlier identical letter. */
  let at = 0;

  const walk = (tokens: readonly ChantToken[]): void => {
    for (const t of tokens) {
      if (t.t === 'br') { line += 1; at = 0; continue; }
      if (t.t === 'slot') { walk(t.tokens); continue; }
      if (t.t !== 'syl') continue;
      for (const u of t.units) {
        const text = lines[line] ?? '';
        /*
         * FOUND, not assumed. `linesFromTokens` normalises the line it
         * returns, so a letter is not necessarily at the offset a running
         * total would predict — collapsing a double space moves everything
         * after it. Searching forward for the glyph keeps the two in step, and
         * a glyph that cannot be found gets an empty span at the scan point
         * rather than a wrong one.
         */
        const found = u.c === '' ? -1 : text.indexOf(u.c, at);
        if (found === -1) {
          units.push({ line, start: at, end: at });
          continue;
        }
        units.push({ line, start: found, end: found + u.c.length });
        at = found + u.c.length;
      }
    }
  };
  walk(verse.tokens);

  return { units, lines };
}
