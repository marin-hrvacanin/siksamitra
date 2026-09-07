/**
 * THE RECORDING AND THE DOCUMENT — reading one out of the other.
 *
 * The document already had a place to put this (`ChantDoc.recording.byVerse`,
 * which the reader has always played from) and no way to fill it in. So there
 * is nothing to invent here: this reads the pādas a mapping has to cover, and
 * writes the mapping back into the shape the reader already understands.
 *
 * ONE FILE OR MANY. `byVerse[id].file` is per verse, so a document may carry a
 * clip per verse or one take of the whole chant with every verse naming it and
 * differing only in its offsets. Both were always legal; only the second was
 * ever produced by hand, because cutting fifty clips is a day's work.
 */
import type { ChantDoc, ChantSection, ChantToken, ChantVerse } from '@siksamitra/format';
import type { MappedPada, Pada } from './map.js';

/**
 * The pādas of a section, with what each one weighs.
 *
 * SYLLABLES, not letters and not characters. A recitation's pace is one
 * syllable at a time — that is what the metre IS — so a pāda of eight
 * syllables takes twice as long as one of four whatever their spelling costs.
 * Counting characters made a pāda with three long vowels look 40% longer than
 * its neighbour and pulled every boundary after it out of place.
 *
 * A verse with no line break is one pāda. A verse with no syllables at all —
 * an instruction, a heading standing in a section — weighs nothing and is
 * skipped, rather than being given a share of the recording in which nobody
 * says anything.
 */
export function padasOf(section: ChantSection): Pada[] {
  const out: Pada[] = [];
  for (const verse of section.verses) {
    let line = 0;
    let syllables = 0;
    const push = (): void => {
      if (syllables > 0) out.push({ verseId: verse.id, line, weight: syllables });
      line += 1;
      syllables = 0;
    };
    for (const token of verse.tokens) {
      if (token.t === 'br') { push(); continue; }
      syllables += countSyllables(token);
    }
    push();
  }
  return out;
}

/** A slot's own tokens count: the saṅkalpa's variable words are chanted too. */
function countSyllables(token: ChantToken): number {
  if (token.t === 'syl') return 1;
  if (token.t === 'slot') return token.tokens.reduce((n, t) => n + countSyllables(t), 0);
  return 0;
}

export interface RecordingRow {
  file: string;
  duration?: string | number | null;
  label?: string | null;
  lines?: { start: number; end: number }[];
}

/**
 * Put a mapping into a document.
 *
 * The document is not mutated: a mapping is a change like any other, and the
 * caller decides whether to keep it. Verses the mapping does not cover keep
 * whatever they had — re-mapping one section of a manual must not wipe the
 * other twelve.
 */
export function writeMapping(
  doc: ChantDoc,
  file: string,
  mapped: readonly MappedPada[],
  extra: { duration?: number; label?: string } = {},
): ChantDoc {
  const byVerse: Record<string, RecordingRow> = {
    ...(doc.recording?.byVerse ?? {}),
  };
  const order: string[] = [];
  const lines = new Map<string, { start: number; end: number }[]>();
  for (const m of mapped) {
    if (!lines.has(m.verseId)) { lines.set(m.verseId, []); order.push(m.verseId); }
    (lines.get(m.verseId) as { start: number; end: number }[])[m.line] = {
      start: m.start, end: m.end,
    };
  }

  for (const verseId of order) {
    const rows = (lines.get(verseId) ?? []).filter((r) => r !== undefined);
    byVerse[verseId] = {
      ...byVerse[verseId],
      file,
      lines: rows,
      ...(extra.duration === undefined ? {} : { duration: extra.duration }),
      ...(extra.label === undefined ? {} : { label: extra.label }),
    };
  }

  return { ...doc, recording: { byVerse } };
}

/** What a document currently claims about a verse's audio. */
export const rowFor = (doc: ChantDoc, verseId: string): RecordingRow | undefined =>
  doc.recording?.byVerse?.[verseId] as RecordingRow | undefined;

export interface MappingProblem {
  readonly verseId: string;
  readonly why: string;
}

/**
 * Is the mapping in this document usable?
 *
 * Checked rather than trusted, because a mapping is edited by hand — dragged
 * in the editor, patched in a JSON file — and every one of these has been seen
 * in the corpus: a verse whose offsets run backwards, a pāda that overlaps the
 * next verse, a row naming a file no other row names.
 */
export function checkMapping(doc: ChantDoc): MappingProblem[] {
  const out: MappingProblem[] = [];
  const verses = new Map<string, ChantVerse>();
  for (const s of doc.sections) for (const v of s.verses) verses.set(v.id, v);

  let last: { verseId: string; end: number; file: string } | null = null;
  for (const [verseId, raw] of Object.entries(doc.recording?.byVerse ?? {})) {
    const row = raw as RecordingRow;
    if (!verses.has(verseId)) {
      out.push({ verseId, why: 'there is no such verse in this document' });
      continue;
    }
    if (typeof row.file !== 'string' || row.file === '') {
      out.push({ verseId, why: 'names no audio file' });
      continue;
    }
    const rows = row.lines ?? [];
    for (const [i, span] of rows.entries()) {
      if (!(span.end > span.start)) {
        out.push({ verseId, why: `pāda ${i + 1} ends at or before it starts` });
      }
      if (i > 0 && span.start < (rows[i - 1] as { end: number }).end - 0.001) {
        out.push({ verseId, why: `pāda ${i + 1} starts before pāda ${i} has finished` });
      }
    }
    const first = rows[0];
    if (last !== null && first !== undefined && last.file === row.file
      && first.start < last.end - 0.001) {
      out.push({ verseId, why: `starts before ${last.verseId} has finished` });
    }
    const end = rows[rows.length - 1]?.end;
    if (end !== undefined) last = { verseId, end, file: row.file };
  }
  return out;
}
