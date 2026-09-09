/**
 * WHAT A DOCUMENT SAYS ABOUT ITS RECITATION.
 *
 * Pure readings, no element and no React — which is why they are not in
 * `useRecording.ts`: the transport, the Audio tab, the mapping editor and two
 * gates all ask these questions, and a question answered inside a hook can
 * only be asked by something that renders.
 *
 * `@siksamitra/audio` owns the reading of the document itself (`clipsOf`,
 * `mappedIn`). This is the thin layer above it that the window needs: the
 * document's own path for a verse, and the order they are sung in.
 */
import type { ChantDoc } from '@siksamitra/format';
import { clipsOf, mappedIn, type VerseClip } from '@siksamitra/audio';

export interface PadaAt {
  readonly verseId: string;
  readonly line: number;
  readonly start: number;
  readonly end: number;
  /**
   * WHICH CLIP THESE SECONDS ARE IN.
   *
   * A chant is one `.mp3` PER VERSE and every clip starts at zero, so a time
   * of 4.2 s is inside a pāda of verse 1 and inside a pāda of verse 6 and
   * inside a pāda of verse 9. Without the file the highlight lit whichever of
   * them the record happened to be written first — which is a highlight on a
   * line nobody is singing.
   */
  readonly file: string;
}


/** Every mapped pāda of a document, in the order it is heard. `@siksamitra/audio`
 *  owns the reading, because the editor's boundary handles have to be numbered
 *  the same way the transport plays them. */
export const padasOfDoc = (doc: ChantDoc | null): PadaAt[] =>
  (doc === null ? [] : mappedIn(doc));

/**
 * WHAT THERE IS TO PLAY — one row per verse, in the order it is recited.
 *
 * `@siksamitra/audio` owns the reading. It used to be derived here from
 * `padasOfDoc`, which is `mappedIn`, which answers only for verses carrying a
 * `lines` array — and one document in the corpus has them. So for Durgā
 * Sūktam, the document the app opens, this list was EMPTY: Play found no
 * verse and returned, and the transport never appeared at all. See `clipsOf`
 * for the measurements and for why the order cannot come from the file names.
 */
export const clipsOfDoc = (doc: ChantDoc | null): readonly VerseClip[] =>
  (doc === null ? [] : clipsOf(doc));

/** The clip name a verse's audio is in — the document's own, unresolved. */
export function clipOf(doc: ChantDoc | null, verseId: string): string | null {
  return clipsOfDoc(doc).find((c) => c.verseId === verseId)?.file ?? null;
}

/** The verses that have a recitation, in the order they are sung. */
export const versesWithAudio = (doc: ChantDoc | null): string[] =>
  clipsOfDoc(doc).map((c) => c.verseId);

/**
 * The file a verse's audio is in, as the DOCUMENT names it.
 *
 * Joined to `audioBase` and no further. Where `/tests/durga-suktam/audio/…`
 * is actually served from is a different question with a different answer per
 * install, and it is answered once, at the point the element is given a source
 * — see `shell/media.ts` and `start` below. Keeping the two apart is what lets
 * a document say where its audio is without knowing where it is hosted.
 */
export function sourceFor(doc: ChantDoc | null, verseId: string): string | null {
  const file = clipOf(doc, verseId);
  if (file === null) return null;
  const base = doc?.audioBase ?? '';
  return /^(https?:|blob:|data:|\/)/.test(file) ? file : base + file;
}

