/**
 * The two lookups the caret makes on every pointer move, cached.
 *
 * A `selectionchange` fires for each pixel of a drag, and both of these were
 * being recomputed from scratch inside it: flattening Śrī Rudram is 198 verses
 * of source, and a verse's source map costs one derivation. Neither can change
 * while a mouse is moving.
 *
 * KEYED ON THE OBJECT, NOT THE ID. An edit gives the section a new identity, so
 * a cache entry falls out of date exactly when the text does and never a moment
 * later. A key of `sectionId` would have gone stale on the first keystroke and
 * served a map of the text as it used to be — a caret placed at an offset in a
 * document that no longer exists.
 *
 * Split out of `useSession.ts` when that file crossed the 400-line limit
 * `check:modules` holds new code to. Its header names the source-map cache as
 * one of the two impure things it owns; this is that one, whole.
 */
import { useCallback, useRef } from 'react';
import type { ChantDoc, ChantSection, ChantVerse } from '@siksamitra/format';
import type { SrcMap } from '@siksamitra/engine';
import { flatten, sourcesOf, srcMapFor, type FlatSource } from '@siksamitra/edit';

export interface SourceMaps {
  /** The flat source of ANY section, for turning a click into an offset. */
  readonly flatFor: (sectionId: string) => FlatSource;
  /** A verse's source map, in a named section — a click can land in any. */
  readonly srcMapIn: (sectionId: string, verseId: string) => SrcMap | null;
  /** The same, in the section the caret is in. */
  readonly srcMapOf: (verseId: string) => SrcMap | null;
}

export function useSourceMaps(live: ChantDoc, sectionId: string): SourceMaps {
  /**
   * The flat source of ANY section, not only the one the caret is in.
   *
   * A click in another section has to be turned into an offset in THAT section
   * before the caret can move there — and without this it could not be, so the
   * caret was trapped in the first section: 2 of Durgā Sūktam's 9 verses and
   * 191 of Śrī Rudram's 198 were unreachable in edit mode, with no keyboard
   * route either.
   */
  /*
   * CACHED BY SECTION.
   *
   * It re-flattened the whole section on every call, and it is called from the
   * mapping that runs on every `selectionchange` — so a drag across Śrī
   * Rudram re-flattened 198 verses of source per event. Nothing about the
   * source changes while a mouse is moving.
   *
   * Keyed on the SECTION OBJECT, not its id: an edit gives the section a new
   * identity, so the entry falls out of date exactly when the text does and
   * never a moment later.
   */
  const flats = useRef(new Map<string, { of: ChantSection; flat: FlatSource }>());
  const flatFor = useCallback((id: string): FlatSource => {
    const found = live.sections.find((s) => s.id === id);
    if (found === undefined) return flatten([]);
    const hit = flats.current.get(id);
    if (hit !== undefined && hit.of === found) return hit.flat;
    const flat = flatten(sourcesOf(found));
    flats.current.set(id, { of: found, flat });
    return flat;
  }, [live]);

  /**
   * Source maps, cached by section and verse — KEYED ON THE VERSE OBJECT.
   *
   * It was keyed on `verse.src.lines`, and that is a cache that could not
   * expire. `src` is the accented witness and the declared departures — where
   * the verse came FROM — and since the document model became text + markings
   * it is no longer what the caret edits, so it does not change when the text
   * does. For a verse with no `src` at all the key was `''`, forever.
   *
   * WHAT THAT COST, measured: press Enter in the middle of a pāda and the
   * caret is drawn on the line BELOW the one the text went into. The split is
   * correct, the model's address is correct — and the map that turns that
   * address into a letter was built when the document was opened, so
   * `{line: 1, column: 0}` resolved to unit 29, the first letter of the line
   * that USED to be second. Every keystroke after that acted where the person
   * was not looking. The owner: "I pressed enter, it put it in the next line
   * but my cursor was shown 2 lines below."
   *
   * The verse OBJECT is the honest key, for the reason `flatFor` above already
   * gives about sections: an edit gives the verse a new identity, so the entry
   * falls out of date exactly when the text does and never a moment later. A
   * verse an edit did not touch keeps its identity — `retext` returns the same
   * object when the text is unchanged — so the cache still does its job, which
   * is not re-flattening 198 verses on every `selectionchange`.
   */
  const cache = useRef(new Map<string, { of: ChantVerse; map: SrcMap | null }>());
  const srcMapIn = useCallback((where: string, verseId: string): SrcMap | null => {
    const found = live.sections.find((s) => s.id === where);
    const verse = found?.verses.find((v) => v.id === verseId);
    if (found === undefined || verse === undefined) return null;
    const at = `${where}/${verseId}`;
    const hit = cache.current.get(at);
    if (hit !== undefined && hit.of === verse) return hit.map;
    const map = srcMapFor(live, found.id, verseId);
    cache.current.set(at, { of: verse, map });
    return map;
  }, [live]);

  const srcMapOf = useCallback(
    (verseId: string): SrcMap | null => srcMapIn(sectionId, verseId),
    [srcMapIn, sectionId],
  );

  return { flatFor, srcMapIn, srcMapOf };
}
