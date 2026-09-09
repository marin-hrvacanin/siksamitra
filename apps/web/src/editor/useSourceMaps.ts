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
import type { ChantDoc, ChantSection } from '@siksamitra/format';
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

  /** Source maps, cached by section, verse and the verse's own source text. */
  const cache = useRef(new Map<string, { key: string; map: SrcMap | null }>());
  const srcMapIn = useCallback((where: string, verseId: string): SrcMap | null => {
    const found = live.sections.find((s) => s.id === where);
    const verse = found?.verses.find((v) => v.id === verseId);
    if (found === undefined || verse === undefined) return null;
    const key = (verse.src?.lines ?? []).join('\n');
    const at = `${where}/${verseId}`;
    const hit = cache.current.get(at);
    if (hit !== undefined && hit.key === key) return hit.map;
    const map = srcMapFor(live, found.id, verseId);
    cache.current.set(at, { key, map });
    return map;
  }, [live]);

  const srcMapOf = useCallback(
    (verseId: string): SrcMap | null => srcMapIn(sectionId, verseId),
    [srcMapIn, sectionId],
  );

  return { flatFor, srcMapIn, srcMapOf };
}
