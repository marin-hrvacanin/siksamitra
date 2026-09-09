/**
 * Changing the text — one flat range replacement, distributed back into verses.
 *
 * This is the only function in the program that alters a verse's source, and
 * it is deliberately the *only* one: a "delete", a "type a letter", a "paste
 * three verses", a "join two lines" and a "split a verse" are all one range
 * replacement, so they cannot disagree with each other about what a verse
 * boundary is.
 *
 * Every line it produces is canonical (`norm`), because the whole override
 * addressing scheme rests on that — see `rebase.ts`.
 *
 * IDENTITY IS DECIDED BY THE EDIT'S RANGE, not by comparing text. A verse id
 * is what a recording, a word analysis and an audio segment are keyed to, so
 * getting this wrong re-points a recording at unrelated words. The rule is
 * arithmetic, and it is exact:
 *
 *   a verse the edit did not reach          keeps its id
 *   a verse the edit reached but did not    keeps its id — the first such
 *   consume entirely                        verse, and the last of them
 *   a verse the edit consumed entirely      is gone, and REPORTED as removed
 *   any block left over                     is a new verse
 *
 * "Consumed entirely" is what separates "typed into verse 2" from "deleted
 * verse 1": both leave one block of text, and only the range says which.
 *
 * Text similarity was tried first and it over-claimed: selecting a whole
 * section and typing three new verses kept all three ids, so three recordings
 * and three translations silently attached themselves to text that had nothing
 * to do with them, and `removed` was empty.
 *
 * AN EMPTY VERSE IS ALLOWED. Pressing Enter at the end of a verse has to leave
 * somewhere to type, so this function does not prune them; `pruneEmpty` does,
 * and belongs to the save path rather than to editing. An empty LINE inside a
 * verse is a different matter and is not representable — see `splitLine`.
 */
import { normLoose } from '@siksamitra/engine';
import { VERSE_GAP, flatten, type VerseSource } from './caret.js';

export interface RangeEdit {
  /** Half-open, in flat-source characters. */
  from: number;
  to: number;
  insert: string;
  /** Ids for verses a paste creates, in order. */
  newIds?: readonly string[];
  /**
   * Ids already in use ANYWHERE in the document.
   *
   * A section does not know the document's other verses, and a minted id that
   * collides with one in another section is not a cosmetic problem: an
   * override is addressed `{verse, line, letter}` and applied document-wide, so
   * a new verse silently inherited another section's hand-placed holding.
   */
  taken?: readonly string[];
}

export interface RangeResult {
  verses: VerseSource[];
  /** Where the caret lands: a flat offset into the NEW flat source. */
  caret: number;
  /** Verses that no longer exist. Their marks and recordings are orphaned. */
  removed: string[];
  /** Verses that did not exist before. */
  added: string[];
}

/**
 * Split flat text back into verse blocks of canonical lines.
 *
 * The separator is a blank line, tolerant of whitespace on it, because a
 * person editing the source cannot see whether the empty line they left has a
 * space on it and should not have to.
 */
function split(text: string): string[][] {
  return text.split(/\n[^\S\n]*\n/).map((block) => {
    /*
     * `normLoose`, NOT `norm`. This runs on every keystroke, and `norm` trims
     * the ends of a line and collapses runs of spaces — so the space just
     * typed at the caret was deleted before it reached the document, and a
     * second word could never be started. `norm(' ')` is `''`. The owner's
     * report was "I just created a new document and I can't type space".
     * The whitespace tidy belongs to saving, not to typing.
     */
    const lines = block.split('\n').map((line) => normLoose(line));
    // Empty lines at the ends are the residue of the split, not breaths.
    while (lines.length > 1 && lines[0]?.trim() === '') lines.shift();
    while (lines.length > 1 && lines[lines.length - 1]?.trim() === '') lines.pop();
    return lines;
  });
}

/** Verses with no text at all. Not an error while editing; not saved either. */
export const isEmpty = (v: VerseSource): boolean => v.lines.every((l) => l.trim() === '');

/** Drop empty verses. For the save path, never for the editing path. */
export const pruneEmpty = (verses: readonly VerseSource[]): VerseSource[] =>
  verses.filter((v) => !isEmpty(v));

/** Each verse's extent in the flat source, INCLUDING the gap that follows it. */
export function verseExtents(
  verses: readonly VerseSource[],
): { id: string; start: number; end: number }[] {
  const flat = flatten(verses);
  return verses.map((verse) => {
    const lines = flat.lineStarts.filter((l) => l.verseId === verse.id);
    const first = lines[0];
    const last = lines[lines.length - 1];
    return {
      id: verse.id,
      start: first?.at ?? 0,
      end: last === undefined ? 0 : last.at + last.length,
    };
  });
}

/**
 * Assign ids to the new blocks. See IDENTITY in the header.
 *
 * `from`/`to` are in the OLD flat coordinates, which is what makes this exact:
 * the edit's range says which verses it reached, and nothing has to be guessed
 * from the text.
 */
function identify(
  verses: readonly VerseSource[],
  blocks: readonly string[][],
  edit: { from: number; to: number },
  offered: readonly string[],
  taken: readonly string[],
): { ids: string[]; removed: string[]; added: string[] } {
  const extents = verseExtents(verses);

  const before = extents.filter((v) => v.end < edit.from);
  const after = extents.filter((v) => v.start > edit.to);
  const middle = extents.filter((v) => edit.from <= v.end && edit.to >= v.start);

  const ids: (string | undefined)[] = blocks.map(() => undefined);
  const claimed = new Set<string>();
  const claim = (at: number, id: string): void => {
    if (at < 0 || at >= ids.length || ids[at] !== undefined) return;
    ids[at] = id;
    claimed.add(id);
  };

  // Untouched verses keep their ids: they are the same text in the same order,
  // so they are the first N blocks and the last M.
  const head = Math.min(before.length, blocks.length);
  before.slice(0, head).forEach((v, i) => claim(i, v.id));
  const tail = Math.min(after.length, blocks.length - head);
  after.slice(after.length - tail).forEach((v, i) => {
    claim(blocks.length - tail + i, v.id);
  });

  const free = blocks.map((_, i) => i).filter((i) => ids[i] === undefined);
  const first = middle[0];
  const last = middle[middle.length - 1];

  /*
   * A reached verse keeps its id only if the edit left part of it. A verse the
   * edit consumed ENTIRELY is gone, and the block in its place belongs to
   * whatever survived — that is the difference between "typed into verse 2"
   * and "deleted verse 1", which look identical to a text comparison and gave
   * the surviving verse its neighbour's id and its neighbour's recording.
   */
  if (first !== undefined && free.length > 0) {
    const partly = edit.from > first.start || edit.to < first.end;
    if (partly) claim(free[0]!, first.id);
  }
  if (last !== undefined && middle.length > 1 && free.length > 0) {
    const partly = edit.to < last.end || edit.from > last.start;
    if (partly && !claimed.has(last.id)) {
      // The LAST free slot, unless the first verse already took it — then this
      // one is the only surviving verse and the slot is its own.
      const at = ids[free[free.length - 1]!] === undefined
        ? free[free.length - 1]!
        : -1;
      claim(at, last.id);
    }
  }

  /*
   * AN ID THIS EDIT CONSUMED IS FREE AGAIN — but only to whoever ASKS for it.
   *
   * Two different needs met the same set. Minting a fresh id must avoid every
   * id the document has ever had in play, or deleting `v-1` and typing
   * something else hands the new words the old verse's name, its recording and
   * its translation. But an id passed in `newIds` is a caller saying "this is
   * still that verse", which is exactly what replacing a verse's whole text
   * means — and refusing it there orphaned the verse and re-minted it as
   * `v-10`.
   *
   * So: `reserved` governs minting and holds everything; an offered id is
   * accepted unless a verse that SURVIVED this edit is still using it.
   */
  const surviving = new Set(verses.filter((v) => claimed.has(v.id)).map((v) => v.id));
  const reserved = new Set<string>([
    ...taken,
    ...verses.map((v) => v.id),
    ...ids.filter((x): x is string => x !== undefined),
  ]);
  const queue = [...offered];
  const final = ids.map((id, i) => {
    if (id !== undefined) return id;
    const asked = queue.shift();
    if (asked !== undefined && !surviving.has(asked)) {
      surviving.add(asked);
      reserved.add(asked);
      return asked;
    }
    let next: string;
    let n = i + 1;
    do { next = `v-${n}`; n += 1; } while (reserved.has(next));
    reserved.add(next);
    surviving.add(next);
    return next;
  });

  /* Reported from the RESULT, not from what was claimed along the way: an id
     that came back through `offered` was neither removed nor added. */
  const kept = new Set(final);
  const was = new Set(verses.map((v) => v.id));
  return {
    ids: final,
    removed: verses.filter((v) => !kept.has(v.id)).map((v) => v.id),
    added: final.filter((id) => !was.has(id)),
  };
}

/** Replace a flat range, and put the result back into verses. */
export function replaceRange(
  verses: readonly VerseSource[],
  edit: RangeEdit,
): RangeResult {
  const flat = flatten(verses);
  const from = Math.max(0, Math.min(edit.from, edit.to, flat.text.length));
  const to = Math.min(Math.max(edit.from, edit.to), flat.text.length);

  const head = flat.text.slice(0, from);
  const tail = flat.text.slice(to);
  const blocks = split(head + edit.insert + tail);

  /*
   * The caret. Computed by normalising the text BEFORE it — not by adding the
   * insertion's length to `from`, which is wrong whenever normalisation shrank
   * something (a double space collapsed, a trailing space trimmed) and lands
   * the caret one character past where the text actually ends.
   */
  const caret = flatten(
    split(head + edit.insert).map((lines, i) => ({ id: `p${i}`, lines })),
  ).text.length;

  const { ids, removed, added } = identify(
    verses, blocks, { from, to }, edit.newIds ?? [], edit.taken ?? [],
  );
  const out: VerseSource[] = blocks.map((lines, i) => ({ id: ids[i]!, lines }));

  return { verses: out, caret: Math.min(caret, flatten(out).text.length), removed, added };
}

/**
 * Split the verse the caret is in, at the caret.
 *
 * Enter at the end of a verse's last line is the ordinary way to write the
 * next one, so it must not be an obscure command — but it is still a range
 * replacement: inserting the verse separator. Expressed that way rather than
 * as its own code path, so there is one definition of what a verse boundary is.
 */
export const splitVerse = (
  verses: readonly VerseSource[],
  at: number,
  newId?: string,
): RangeResult => replaceRange(verses, {
  from: at,
  to: at,
  insert: VERSE_GAP,
  ...(newId === undefined ? {} : { newIds: [newId] }),
});

/**
 * Insert a line break — a new breath.
 *
 * AT A LINE EDGE THIS BREAKS THE VERSE INSTEAD, and that is a consequence of
 * the encoding rather than a choice: a blank line separates verses, so an
 * empty line INSIDE a verse cannot be written down. It is also not a thing a
 * recitation has — a line is a breath, and an empty breath is nothing.
 *
 * So Enter between two syllables divides the line, and Enter at either edge of
 * a line starts a new verse. What it never does is nothing at all, which is
 * what it did when the empty line it produced was pruned away.
 */
export function splitLine(verses: readonly VerseSource[], at: number): RangeResult {
  const flat = flatten(verses);
  const edge = flat.lineStarts.some((l) => at === l.at || at === l.at + l.length);
  return replaceRange(verses, {
    from: at,
    to: at,
    insert: edge ? VERSE_GAP : '\n',
  });
}
