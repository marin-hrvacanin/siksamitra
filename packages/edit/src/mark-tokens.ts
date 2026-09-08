/**
 * MARKING A LETTER THAT HAS NO SOURCE TO ADDRESS.
 *
 * Almost every mark in this program is an override in source coordinates and
 * the token is recomputed — that is rule three, and `marks.ts` is where it
 * lives. This is the other case, and it is small on purpose.
 *
 * A transcribed verse has no source layer. `adoptSource` gives most of them
 * one, but not all: where the engine's sandhi and the transcription disagree
 * about a LETTER rather than a mark, there is no source text that derives to
 * what is on the page, and inventing one would rewrite the transcription. Over
 * the corpus that is 42% of transcribed verses.
 *
 * The old answer was to refuse, which meant the marking buttons did nothing on
 * those verses. But the argument for refusing never applied to this gesture.
 * Rule zero protects a transcription from being REPLACED BY A GUESS — from the
 * engine overwriting a record it cannot rebuild. A person selecting a letter
 * and pressing Long is not a guess: it is the same act that produced the
 * transcription in the first place, by the same authority, and it changes
 * exactly the letters they selected and nothing else.
 *
 * So the mark is written onto the unit. The verse stays frozen — no `src`, no
 * re-derivation, every other letter byte-identical — and the one letter the
 * person marked carries what they said. Undo restores it like any other edit.
 */
import { normaliseHoldings } from './holdings.js';
import type { ChantToken, ChantUnit, ChantVerse } from '@siksamitra/format';
import type { MarkPatch } from './marks.js';

/** The unit fields a hand mark may write. `hg` is managed, not set by hand. */
const WRITABLE = new Set(['hold', 'svara', 'change', 'sup', 'candra', 'sbhakti']);

/**
 * Apply a patch to some letters of a verse, by unit index.
 *
 * `units` are indexes into the verse's letters in drawing order — the same
 * numbering `unitsOf` produces and the same one a `SrcMap` uses, so a caller
 * that has a selection does not have to translate it.
 *
 * A field set to `null` is REMOVED rather than stored as null: on a token,
 * absent is what "no mark here" means, and a literal null would be a mark of
 * its own that the renderer and the validator would both have to learn about.
 */
export function markUnits(
  verse: ChantVerse,
  units: readonly number[],
  patch: MarkPatch,
): { verse: ChantVerse; marked: number } {
  const wanted = new Set(units);
  if (wanted.size === 0) return { verse, marked: 0 };

  let i = -1;
  let marked = 0;

  const editUnit = (u: ChantUnit): ChantUnit => {
    i += 1;
    if (!wanted.has(i)) return u;
    const next: ChantUnit = { ...u };
    const bag = next as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(patch)) {
      if (!WRITABLE.has(field)) continue;
      if (value === null || value === undefined) delete bag[field];
      else bag[field] = value;
    }
    /*
     * A holding that has just been removed must not keep its group id: `hg`
     * with no `hold` is a box round nothing, and `assertHoldings` rejects it.
     */
    if (next.hold === undefined) delete next.hg;
    marked += 1;
    return next;
  };

  const walk = (tokens: readonly ChantToken[]): ChantToken[] => tokens.map((t) => {
    if (t.t === 'syl') return { ...t, units: t.units.map(editUnit) };
    if (t.t === 'slot') return { ...t, tokens: walk(t.tokens) };
    return t;
  });

  const tokens = walk(verse.tokens);
  if (marked === 0) return { verse, marked: 0 };

  /*
   * The boxes are regrouped after the edit, not before.
   *
   * Marking two adjacent letters long produces two holdings with no group id,
   * which draw as two touching strokes where the author drew one box. This is
   * the same repair `deriveVerse` runs after every derivation — see
   * `normaliseHoldings` — and it has to happen here too or a hand mark on a
   * frozen verse looks different from the identical mark on a derived one.
   */
  const { tokens: grouped } = normaliseHoldings(tokens);
  return { verse: { ...verse, tokens: grouped }, marked };
}
