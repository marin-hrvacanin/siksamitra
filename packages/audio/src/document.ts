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

/** One verse's recitation: the clip, and the pādas inside it if anyone mapped them. */
export interface VerseClip {
  readonly verseId: string;
  /** The document's own name for the file. `audioBase` is NOT applied here —
   *  joining it, and resolving where it is served from, is the caller's job. */
  readonly file: string;
  /** Seconds, or `null` where the document does not say. */
  readonly duration: number | null;
  readonly label: string | null;
  /** The pāda offsets, when the verse has been mapped. Empty is normal. */
  readonly lines: readonly { start: number; end: number }[];
}

/**
 * WHAT CAN BE PLAYED, IN THE ORDER IT IS SUNG.
 *
 * This is the list a transport runs on, and the reason it exists is that the
 * editor was deriving one from `mappedIn` — which returns PĀDAS, and only for
 * verses that carry a `lines` array. One document in the corpus has them:
 *
 *   bhagya-suktam           9 clips, 9 with lines
 *   durga-suktam            8 clips, 0 with lines   <- the one the app opens
 *   purusha-suktam         24 clips, 0
 *   shiva-sankalpa-suktam  39 clips, 0
 *
 * So for Durgā Sūktam the list came back EMPTY: Play found nothing and
 * returned, and the transport never appeared at all. That is the whole of the
 * owner's report that "audio should be fully functional, as it used to be on
 * vedaunion.org" — the platform reads `byVerse[id].file` directly and treats
 * `lines` as the extra that enables per-pāda play, which is what this does.
 *
 * THE ORDER IS THE DOCUMENT'S, and that is not tidiness either. `byVerse` is a
 * record, `canonicalJson` sorts a record's keys, and `mappedIn` sorts what is
 * left by `file.localeCompare` — so śiva saṅkalpa sūktam's thirty-nine verses,
 * whose clips are `v-1.mp3` … `v-39.mp3`, come back as v-1, v-10, v-11, v-12,
 * and a chant plays in an order nobody recites it in. Purusha Sūktam's clips
 * are named `audio-1762807901669-1ceh38.mp3` and carry no order at all.
 * `section.verses` is ordered, and `normalizeChantDoc` guarantees it.
 *
 * A SECTION MAY NAME THE CLIP FOR ITS FIRST VERSE (`section.audio`), which is
 * how a take of a whole step was recorded before there was a per-verse
 * mapping. `byVerse` wins where both exist.
 */
export function clipsOf(doc: ChantDoc | null | undefined): VerseClip[] {
  if (doc === null || doc === undefined) return [];
  const byVerse = doc.recording?.byVerse ?? {};
  const out: VerseClip[] = [];

  for (const section of doc.sections) {
    for (const [index, verse] of section.verses.entries()) {
      const row = byVerse[verse.id] as RecordingRow | undefined;
      /* The step's own take, for the verse it starts at. */
      const fallback = index === 0 ? section.audio : undefined;
      const file = row?.file !== undefined && row.file !== ''
        ? row.file
        : (fallback?.file ?? '');
      if (file === '') continue;
      out.push({
        verseId: verse.id,
        file,
        duration: seconds(row?.duration ?? fallback?.duration),
        label: row?.label ?? fallback?.label ?? null,
        lines: (row?.lines ?? []).filter((l) => l !== undefined && l !== null),
      });
    }
  }
  return out;
}

/**
 * A duration as a number of seconds, whatever the document wrote it as.
 *
 * Every one of these is in the corpus: `15.90` the STRING (durgā sūktam, all
 * eight verses), `17.38` the number (śiva saṅkalpa), and `null` (puruṣa
 * sūktam, all twenty-four). A string went into arithmetic as a string and came
 * out as `"15.900"` or `NaN` depending on the operator.
 */
function seconds(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
 *
 * THE VERSES ARE PUT IN TIME ORDER FIRST, and that is not tidiness.
 * `byVerse` is a record, and `canonicalJson` sorts a record's keys — so the
 * file `sm audio map --write` produces has its verses in ALPHABETICAL order,
 * which for ids past nine is v-1, v-10, v-11, v-12, v-2. Walking it as written
 * and comparing each verse with the one before it made `sm audio check` report
 * `v-2: starts before v-12 has finished` on a mapping it had just written
 * itself, and exit 1. Reproduced with twelve contiguous verses.
 */
export function checkMapping(doc: ChantDoc): MappingProblem[] {
  const out: MappingProblem[] = [];
  const verses = new Map<string, ChantVerse>();
  for (const s of doc.sections) for (const v of s.verses) verses.set(v.id, v);

  const sound: { verseId: string; file: string; start: number; end: number }[] = [];
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
    const end = rows[rows.length - 1]?.end;
    if (first !== undefined && end !== undefined) {
      sound.push({ verseId, file: row.file, start: first.start, end });
    }
  }

  /* Within one take only: two clips have no second in common, so a verse in
     `a.wav` starting at 0 says nothing about one in `b.wav` ending at 30. */
  sound.sort((a, b) => (a.file === b.file ? a.start - b.start : a.file.localeCompare(b.file)));
  for (const [i, v] of sound.entries()) {
    const prev = sound[i - 1];
    if (prev === undefined || prev.file !== v.file) continue;
    if (v.start < prev.end - 0.001) {
      out.push({ verseId: v.verseId, why: `starts before ${prev.verseId} has finished` });
    }
  }
  return out;
}
