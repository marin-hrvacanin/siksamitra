/**
 * The caret, over a whole section.
 *
 * THE PROBLEM THIS SOLVES. v1 gave one caret over an entire document and
 * crashed on long ones. The platform's editor gave one caret per verse, which
 * is why it read as a CMS form rather than an editor: you clicked a row, it
 * became a field, and Escape got you out. Neither is what a person means by
 * "an editor".
 *
 * Both are wrong in opposite directions, and the SECTION is the right unit
 * because it is already the unit of loading — the API sends a section at a
 * time, so a caret bounded by one costs nothing extra, while a document-wide
 * caret would force the whole document resident and give back the property
 * that makes a 700-verse text openable.
 *
 * So: one continuous caret within a section. Arrow-down crosses a verse
 * boundary, selection spans verses, select-all selects the section, and pasting
 * several lines distributes across verses.
 *
 * Pure addressing only. It maps between a position in the SECTION's flat
 * source text and a `(verse, line, column)` address; changing the text is
 * `range.ts`, and deciding what a change means is `session.ts`.
 */

/** One verse's source, as the author types it. */
export interface VerseSource {
  readonly id: string;
  /** One string per rendered line. A recitation line is a breath. */
  readonly lines: readonly string[];
}

/** Where the caret is, in content terms rather than pixels. */
export interface CaretAddress {
  readonly verseId: string;
  /** Index into that verse's `lines`. */
  readonly line: number;
  /** UTF-16 offset within the line. */
  readonly column: number;
}

export interface Selection {
  readonly anchor: CaretAddress;
  readonly head: CaretAddress;
}

export interface LineStart {
  readonly verseId: string;
  readonly line: number;
  readonly at: number;
  readonly length: number;
}

/** The section's source as one string, and the map back. */
export interface FlatSource {
  readonly text: string;
  /** Where each line starts in `text`, in order. */
  readonly lineStarts: readonly LineStart[];
}

/** Verses are separated by a blank line; lines within a verse by one newline. */
export const VERSE_GAP = '\n\n';

/**
 * Join a section's verses into one editable string.
 *
 * The blank-line separator is not cosmetic: it is what lets a paste of several
 * lines be distributed back into verses unambiguously, and what makes a verse
 * boundary visible to someone editing the source directly.
 */
export function flatten(verses: readonly VerseSource[]): FlatSource {
  const lineStarts: LineStart[] = [];
  let text = '';
  for (const [v, verse] of verses.entries()) {
    if (v > 0) text += VERSE_GAP;
    for (const [l, line] of verse.lines.entries()) {
      if (l > 0) text += '\n';
      lineStarts.push({ verseId: verse.id, line: l, at: text.length, length: line.length });
      text += line;
    }
  }
  return { text, lineStarts };
}

/** A flat offset to an address. Clamped, never out of range. */
export function addressAt(flat: FlatSource, offset: number): CaretAddress | null {
  if (flat.lineStarts.length === 0) return null;
  const clamped = Math.max(0, Math.min(offset, flat.text.length));
  let chosen = flat.lineStarts[0]!;
  for (const entry of flat.lineStarts) {
    if (entry.at <= clamped) chosen = entry;
    else break;
  }
  return {
    verseId: chosen.verseId,
    line: chosen.line,
    column: Math.max(0, Math.min(clamped - chosen.at, chosen.length)),
  };
}

/** An address to a flat offset. */
export function offsetOf(flat: FlatSource, at: CaretAddress): number {
  const entry = flat.lineStarts.find((e) => e.verseId === at.verseId && e.line === at.line);
  if (entry === undefined) return 0;
  return entry.at + Math.max(0, Math.min(at.column, entry.length));
}

const lineIndex = (flat: FlatSource, at: CaretAddress): number =>
  flat.lineStarts.findIndex((e) => e.verseId === at.verseId && e.line === at.line);

/**
 * Move the caret one line up or down, across verse boundaries.
 *
 * `goal` is the column the caret is *trying* to keep — Word's behaviour, and
 * the reason moving down through a short line and out the other side returns
 * to where you started rather than staying short. Without it, arrow-down
 * through a one-syllable pada permanently loses the column.
 */
export function moveLine(
  flat: FlatSource,
  at: CaretAddress,
  direction: 1 | -1,
  goal = at.column,
): CaretAddress {
  const index = lineIndex(flat, at);
  if (index === -1) return at;
  const next = flat.lineStarts[index + direction];
  if (next === undefined) return at;
  return { verseId: next.verseId, line: next.line, column: Math.min(goal, next.length) };
}

/** Move one character, stepping across line and verse boundaries. */
export function moveChar(
  flat: FlatSource,
  at: CaretAddress,
  direction: 1 | -1,
): CaretAddress {
  return addressAt(flat, offsetOf(flat, at) + direction) ?? at;
}

/** Start or end of the current line — Home and End. */
export function lineEdge(flat: FlatSource, at: CaretAddress, edge: 'start' | 'end'): CaretAddress {
  const entry = flat.lineStarts[lineIndex(flat, at)];
  if (entry === undefined) return at;
  return { ...at, column: edge === 'start' ? 0 : entry.length };
}

/**
 * Move one word — Ctrl+Arrow.
 *
 * A "word" here is a run of non-space characters in the source, which in IAST
 * is a pada. Not a syllable: Ctrl+Right in every editor crosses a word, and a
 * reciter reading the source thinks in padas for exactly the same reason.
 */
export function moveWord(
  flat: FlatSource,
  at: CaretAddress,
  direction: 1 | -1,
): CaretAddress {
  const text = flat.text;
  let i = offsetOf(flat, at);
  const isSpace = (k: number): boolean => /\s/.test(text[k] ?? ' ');

  if (direction === 1) {
    while (i < text.length && !isSpace(i)) i += 1;
    while (i < text.length && isSpace(i)) i += 1;
  } else {
    while (i > 0 && isSpace(i - 1)) i -= 1;
    while (i > 0 && !isSpace(i - 1)) i -= 1;
  }
  return addressAt(flat, i) ?? at;
}

/** The whole section, for select-all. Bounded by the section, deliberately. */
export function selectAll(flat: FlatSource): Selection | null {
  const first = addressAt(flat, 0);
  const last = addressAt(flat, flat.text.length);
  return first === null || last === null ? null : { anchor: first, head: last };
}

export const isCollapsed = (s: Selection): boolean =>
  s.anchor.verseId === s.head.verseId
  && s.anchor.line === s.head.line
  && s.anchor.column === s.head.column;

/** The selection as a flat range, low offset first. */
export function selectionRange(flat: FlatSource, s: Selection): { from: number; to: number } {
  const a = offsetOf(flat, s.anchor);
  const b = offsetOf(flat, s.head);
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** A collapsed selection at one address — the ordinary caret. */
export const caretAt = (at: CaretAddress): Selection => ({ anchor: at, head: at });

/** Which verses a selection touches, in document order. */
export function versesInSelection(flat: FlatSource, s: Selection): string[] {
  const { from, to } = selectionRange(flat, s);
  const out: string[] = [];
  for (const entry of flat.lineStarts) {
    const end = entry.at + entry.length;
    if (end < from || entry.at > to) continue;
    if (!out.includes(entry.verseId)) out.push(entry.verseId);
  }
  return out;
}
