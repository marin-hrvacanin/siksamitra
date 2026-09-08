/**
 * A MAPPING'S SEAMS — reading them out of a document, and moving one by hand.
 *
 * `map.ts` places every boundary; two or three of them are the arithmetic's
 * guess and a person fixes those. Fixing one is not "edit a pāda", and that
 * distinction is the whole reason this file exists: a boundary is SHARED. The
 * second that ends pāda 4 is the second that begins pāda 5, and they are two
 * numbers in the document. Move one and the reader plays the gap as silence or
 * the overlap twice — which is exactly what `checkMapping` reports as "pāda 5
 * starts before pāda 4 has finished".
 *
 * So a mapping of N pādas is addressed here as N+1 seams, which is the shape a
 * hand actually manipulates, and `moveSeam` writes both sides of one.
 *
 * WHY THE DOCUMENT GOES IN AND COMES OUT. The editor's undo is a stack of
 * documents (`useSetRecording`), so an edit that returned a mapping would have
 * to be turned back into a document by its caller — once per call site, three
 * of them, each free to get the merge wrong. `writeMapping` writes a whole
 * mapping; this writes two numbers and leaves every other row alone.
 */
import type { ChantDoc } from '@siksamitra/format';
import type { RecordingRow } from './document.js';
import { DEFAULT_SNAP, nearestTo, roundSeconds } from './map.js';
import { breathsIn, type Span } from './silence.js';

/** One mapped pāda as the document has it, with the file it is heard in. */
export interface SeamPada {
  readonly verseId: string;
  /** Which line of the verse — 0 for the first pāda. */
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly file: string;
}

/**
 * The shortest a pāda may be made by dragging.
 *
 * A chanted syllable runs about 0.37 s — the figure the reader's segment lead
 * was measured against — so 0.05 s is well inside "nobody meant this" while
 * still leaving the invariant `checkMapping` enforces, `end > start`, true by
 * a margin that survives the hundredth-of-a-second rounding.
 */
export const MIN_PADA = 0.05;

/**
 * Every mapped pāda of a document, in the order it is heard.
 *
 * Sorted by time within a file, and grouped by file, because `byVerse` is a
 * record and a record has no order — the verses came out of it in whatever
 * order they were written, which for a hand-patched document is not the order
 * they are sung in.
 *
 * `file` is per verse (see `document.ts`), so a document may hold one take or
 * fifty clips. Seams only exist WITHIN a take: two clips have no shared second
 * between them, so `mappedIn` is normally called with the file being edited.
 */
export function mappedIn(doc: ChantDoc, file?: string): SeamPada[] {
  const out: SeamPada[] = [];
  for (const [verseId, raw] of Object.entries(doc.recording?.byVerse ?? {})) {
    const row = raw as RecordingRow;
    if (typeof row.file !== 'string' || row.file === '') continue;
    if (file !== undefined && row.file !== file) continue;
    for (const [line, span] of (row.lines ?? []).entries()) {
      out.push({ verseId, line, start: span.start, end: span.end, file: row.file });
    }
  }
  return out.sort((a, b) => (a.file === b.file
    ? a.start - b.start
    : a.file.localeCompare(b.file)));
}

/** Which file a document's mapping is mostly in — what to edit when nobody says. */
export function mainFile(doc: ChantDoc): string | null {
  const counts = new Map<string, number>();
  for (const raw of Object.values(doc.recording?.byVerse ?? {})) {
    const row = raw as RecordingRow;
    if (typeof row.file !== 'string' || row.file === '') continue;
    counts.set(row.file, (counts.get(row.file) ?? 0) + 1);
  }
  let best: string | null = null;
  let most = 0;
  for (const [file, n] of counts) if (n > most) { best = file; most = n; }
  return best;
}

/**
 * The N+1 seams of N pādas, in order.
 *
 * Where two pādas touch, the document holds two numbers that should be equal
 * and — after a hand patch, or after a mapping was written by an older
 * version — sometimes are not. The LATER pāda's start wins, because that is
 * the number the reader seeks to when the line is played on its own, so it is
 * the one a listener has actually heard.
 */
export function seamsOf(padas: readonly SeamPada[]): number[] {
  const last = padas[padas.length - 1];
  if (last === undefined) return [];
  return [...padas.map((p) => p.start), last.end];
}

/** Where a seam may go without collapsing either pāda it touches. */
export function limitsOf(
  padas: readonly SeamPada[],
  index: number,
  duration?: number,
): { readonly low: number; readonly high: number } | null {
  const seams = seamsOf(padas);
  if (index < 0 || index >= seams.length) return null;
  const before = seams[index - 1];
  const after = seams[index + 1];
  return {
    low: before === undefined ? 0 : before + MIN_PADA,
    high: after === undefined
      ? (duration === undefined ? Number.POSITIVE_INFINITY : duration)
      : after - MIN_PADA,
  };
}

/**
 * Move one seam, and write both sides of it back into the document.
 *
 * Clamped rather than refused. A drag is a continuous gesture: refusing the
 * frames that overshoot a neighbour would make the boundary stick, jump and
 * stick again, and the person dragging would read that as the editor being
 * broken rather than as a limit. It stops against the neighbour instead, which
 * is what a slider does.
 *
 * The pādas are passed in rather than re-read, so the seam the caller is
 * showing and the seam this moves cannot be two different seams — the record
 * `byVerse` has no order, and re-deriving it here was a second answer.
 */
export function moveSeam(
  doc: ChantDoc,
  padas: readonly SeamPada[],
  index: number,
  to: number,
  duration?: number,
): ChantDoc {
  const limits = limitsOf(padas, index, duration);
  if (limits === null) return doc;
  const at = roundSeconds(Math.min(Math.max(to, limits.low), limits.high));

  const byVerse: Record<string, RecordingRow> = { ...(doc.recording?.byVerse ?? {}) };
  /* The seam ENDS the pāda before it and BEGINS the one after it. At the two
     ends of a take only one of those exists, which is why each is optional
     rather than the pair being indexed together. */
  const ends = padas[index - 1];
  const begins = padas[index];
  if (ends !== undefined) set(byVerse, ends, 'end', at);
  if (begins !== undefined) set(byVerse, begins, 'start', at);
  return { ...doc, recording: { byVerse } };
}

/** One offset of one pāda, replaced without disturbing the rest of its row. */
function set(
  byVerse: Record<string, RecordingRow>,
  pada: SeamPada,
  field: 'start' | 'end',
  at: number,
): void {
  const row = byVerse[pada.verseId];
  if (row === undefined) return;
  const lines = [...(row.lines ?? [])];
  const span = lines[pada.line];
  if (span === undefined) return;
  lines[pada.line] = { ...span, [field]: at };
  byVerse[pada.verseId] = { ...row, lines };
}

/**
 * Where a boundary came from, seam by seam.
 *
 * DERIVED, NOT STORED. The document's format has room for a start and an end
 * and nothing else (`ChantRecording` in `@siksamitra/format`), so the `from`
 * that `mapPadas` reports is gone the moment the mapping is saved — and the
 * two or three boundaries worth fixing are exactly the ones it named. Asking
 * the recording again costs one pass of silence detection and answers for a
 * mapping this program never made, which storing a flag could not.
 *
 * The threshold is `mapPadas`'s own, so a boundary this calls 'even' is one
 * `mapPadas` would have refused to snap.
 */
export function seamKinds(
  seams: readonly number[],
  gaps: readonly Span[],
  within: number = DEFAULT_SNAP,
): ('breath' | 'even')[] {
  const breaths = breathsIn(gaps);
  return seams.map((t) => {
    const near = nearestTo(breaths, t);
    return near !== null && Math.abs(near - t) <= within ? 'breath' : 'even';
  });
}

/**
 * The seam nearest a moment, if one is near enough to have been meant.
 *
 * `within` is in the caller's units — the editor passes the seconds that a
 * handful of pixels are worth at the current zoom, so a click is as forgiving
 * on a 40-minute take as on a two-minute one.
 */
export function nearestSeam(
  seams: readonly number[],
  t: number,
  within: number,
): number | null {
  let best: number | null = null;
  let gap = Number.POSITIVE_INFINITY;
  for (const [i, at] of seams.entries()) {
    const d = Math.abs(at - t);
    /* Strictly nearer, so a pointer exactly between two seams always takes the
       earlier one. With `<=` the answer flipped to the later seam, and a drag
       started at the midpoint picked a different boundary each time the mouse
       shook by a pixel. */
    if (d <= within && d < gap) { gap = d; best = i; }
  }
  return best;
}
