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
 * IDENTITY. A verse id is what a recording, a word analysis and an audio
 * segment are keyed to, so a verse that survives an edit must keep its id.
 * Three rules, in order, and between them they cover every case:
 *
 *   1. verses whose text is untouched keep their ids, matched from BOTH ends —
 *      so deleting the first verse of a section does not slide every id up one
 *      and silently re-point four recordings;
 *   2. of the verses the edit actually reached, the FIRST keeps its id, and the
 *      last keeps its id when the edit left more than one verse there. That is
 *      what a person means by joining two verses (the first one survives and
 *      absorbs the second) and by splitting one (the top half is still it);
 *   3. anything left over is new, and anything unclaimed is REPORTED as gone,
 *      so nothing is orphaned quietly.
 *
 * AN EMPTY VERSE IS ALLOWED. Pressing Enter at the end of a verse has to leave
 * somewhere to type, so this function does not prune them; `pruneEmpty` does,
 * and belongs to the save path rather than to editing.
 */
import { norm } from '@siksamitra/engine';
import { VERSE_GAP, flatten, type VerseSource } from './caret.js';
import { alignArrays } from './diff.js';

export interface RangeEdit {
  /** Half-open, in flat-source characters. */
  from: number;
  to: number;
  insert: string;
  /** Ids for verses a paste creates, in order. Falls back to a derived id. */
  newIds?: readonly string[];
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
    const lines = block.split('\n').map((line) => norm(line));
    // Empty lines at the ends are the residue of the split, not breaths.
    while (lines.length > 1 && lines[0] === '') lines.shift();
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines;
  });
}

const textOf = (lines: readonly string[]): string => lines.join('\n');

/** Verses with no text at all. Not an error while editing; not saved either. */
export const isEmpty = (v: VerseSource): boolean => v.lines.every((l) => l === '');

/** Drop empty verses. For the save path, never for the editing path. */
export const pruneEmpty = (verses: readonly VerseSource[]): VerseSource[] =>
  verses.filter((v) => !isEmpty(v));

/**
 * Assign ids to the new blocks. See IDENTITY in the header.
 *
 * Returns the id per new block, plus which old ids nothing claimed.
 */
function identify(
  verses: readonly VerseSource[],
  blocks: readonly string[][],
  offered: readonly string[],
): { ids: string[]; removed: string[]; added: string[] } {
  const matched = alignArrays(verses.map((v) => textOf(v.lines)), blocks.map(textOf));

  const ids: (string | undefined)[] = blocks.map(() => undefined);
  const claimed = new Set<number>();
  matched.forEach((target, i) => {
    if (target === null) return;
    ids[target] = verses[i]!.id;
    claimed.add(i);
  });

  // Rule 2. The verses the edit reached, and the blocks that replaced them.
  const middleOld = verses.map((_, i) => i).filter((i) => !claimed.has(i));
  const middleNew = blocks.map((_, i) => i).filter((i) => ids[i] === undefined);

  if (middleOld.length > 0 && middleNew.length > 0) {
    ids[middleNew[0]!] = verses[middleOld[0]!]!.id;
    claimed.add(middleOld[0]!);
    if (middleNew.length > 1 && middleOld.length > 1) {
      const lastOld = middleOld[middleOld.length - 1]!;
      ids[middleNew[middleNew.length - 1]!] = verses[lastOld]!.id;
      claimed.add(lastOld);
    }
  }

  // Rule 3. Fresh ids for what is left, and a report for what nothing claimed.
  const taken = new Set([...verses.map((v) => v.id), ...ids.filter((x) => x !== undefined)]);
  const queue = [...offered];
  const added: string[] = [];
  const final = ids.map((id, i) => {
    if (id !== undefined) return id;
    let next = queue.shift();
    if (next === undefined || taken.has(next)) {
      let n = i + 1;
      do { next = `v-${n}`; n += 1; } while (taken.has(next));
    }
    taken.add(next);
    added.push(next);
    return next;
  });

  return {
    ids: final,
    removed: verses.filter((_, i) => !claimed.has(i)).map((v) => v.id),
    added,
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

  const { ids, removed, added } = identify(verses, blocks, edit.newIds ?? []);
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

/** Insert a line break within a verse — a new breath, not a new verse. */
export const splitLine = (verses: readonly VerseSource[], at: number): RangeResult =>
  replaceRange(verses, { from: at, to: at, insert: '\n' });
