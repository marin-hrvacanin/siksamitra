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
import type { ChantDoc, ChantSection, ChantToken, ChantVerse } from '@siksamitra/format';
import { linesFromTokens } from './sync.js';

/**
 * A source map over a verse's own recited text — ANY verse.
 *
 * IT USED TO REFUSE A VERSE THAT HAD A SOURCE LAYER, on the reasoning that
 * such a verse "has a real map and must use it, or a mark would be addressed
 * against the wrong text". That was true when `src` was the thing being
 * edited. It is not any more: the caret edits the text that is SHOWN, and
 * `sourcesOf` returns `toTextAndMarks(v).text` for every verse without asking
 * whether it has a source.
 *
 * SO THE REFUSAL BECAME THE BUG. `srcMapFor` preferred the source-derived map
 * wherever there was one, which is most of the corpus, so the caret addressed
 * the shown text through a map of the TYPED text — two coordinate systems in
 * one flat string, which is the exact thing the migration removed from
 * `sourcesOf` and left here. And because `src` does not change when the text
 * does, the map went stale on the first keystroke: press Enter in the middle
 * of a pāda and `{line: 1, column: 0}` resolved to the first letter of the
 * line that USED to be second, so the caret was painted a line below the text.
 * Measured: unit 29 where unit 4 was wanted. The owner: "I pressed enter, it
 * put it in the next line but my cursor was shown 2 lines below."
 *
 * A derivation is still a derivation and this is still not one — nothing is
 * derived from this map, and an override is still addressed through
 * `verseSrcMap`. This answers "which letter is that", for every verse.
 */
export function tokenSrcMap(verse: ChantVerse): SrcMap | null {
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

/** The source map for one verse — how a rendered letter finds its offset. */
export function srcMapFor(
  doc: ChantDoc,
  sectionId: string,
  verseId: string,
): SrcMap | null {
  const section: ChantSection | undefined = doc.sections.find((s) => s.id === sectionId);
  const verse = section?.verses.find((v: ChantVerse) => v.id === verseId);
  if (verse === undefined) return null;
  /*
   * THE CARET'S MAP IS OVER THE TEXT THAT IS SHOWN. Always, for every verse.
   *
   * This used to prefer `verseSrcMap` — a map derived from the verse's `src`,
   * the typed input — and fall back to `tokenSrcMap` only for a transcribed
   * verse with no source at all. Both halves were wrong once the document
   * became text + markings:
   *
   *   THE SPACE. `sourcesOf` gives the caret `toTextAndMarks(v).text` for
   *   every verse. A map built from `src` addresses a different string, so a
   *   verse with a source layer had the caret's offsets resolved through the
   *   wrong text — two coordinate systems in one flat string, which is
   *   precisely what the migration removed from `sourcesOf` (see its note
   *   there) and did not remove from here.
   *
   *   THE STALENESS. `src` does not change when the text changes, so the map
   *   could not follow an edit. Press Enter in the middle of a pāda and
   *   `{line: 1, column: 0}` resolved to unit 29 — the first letter of the
   *   line that used to be second — so the caret was PAINTED a line below the
   *   line the text went into, and every keystroke after that acted where the
   *   person was not looking.
   *
   * `verseSrcMap` is still what an OVERRIDE is addressed through
   * (`apply-mark.ts`, `adopt-source.ts`): storing a mark against the typed
   * source is a different question from finding the letter under the caret,
   * and it is the one place a real derivation is required.
   */
  return tokenSrcMap(verse);
}
