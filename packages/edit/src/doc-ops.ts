/**
 * WHAT AN AUTHOR DOES TO A DOCUMENT, AS DATA — for every driver that is not a
 * key press.
 *
 * The command line's verbs and the agent's tools both change a document by
 * name — "this verse's text", "that section's title" — where the window
 * changes it by caret. These are the functions both call, so a title is set
 * one way and a verse is added one way whoever asks (rule 1). Each answers a
 * value or the reason it cannot, and never prints or exits: the CLI turns a
 * reason into its exit code, the agent into a tool result.
 *
 * A TITLE IS NOT A MARK, so it does not go through `apply`: it re-derives
 * nothing and can lose nothing. But it goes through an ALLOW-LIST, because the
 * path comes from an agent, and "set any field by path" is how a tool ends up
 * rewriting `tokens` and quietly inventing marks nobody placed.
 *
 * A VERSE IS TYPED, not constructed: adding, replacing and removing one is a
 * range replace over its section's flat source — the edit a person makes by
 * selecting and typing — so override rebasing, fresh ids and the refusals are
 * `apply`'s, as for every keystroke.
 */
import { withVerses, type ChantDoc, type ChantSection, type ChantVerse } from '@siksamitra/format';
import { verseExtents } from './range.js';
import { sourcesOf } from './sync.js';
import type { EditCommand } from './command.js';

export type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const no = <T>(error: string): Outcome<T> => ({ ok: false, error });

/** The paths `setDocField` may set — said once, for every help text. */
export const FIELD_PATHS = [
  'title', 'subtitle',
  'section.<id>.title', 'section.<id>.source',
  'verse.<id>.n', 'verse.<id>.translation', 'verse.<id>.source',
] as const;

/**
 * Line breaks as a caller will actually type them: a newline, a literal
 * backslash-n (what a shell passes through), or ` / ` between pādas, which is
 * how the marking documents themselves write a line break.
 */
export const splitLines = (text: string): string[] => text
  .replace(/\\n/g, '\n')
  .split(/\n|\s\/\s/)
  .map((l) => l.trim())
  .filter((l) => l !== '');

export function findVerseIn(doc: ChantDoc, verseId: string): { section: ChantSection; verse: ChantVerse } | null {
  for (const section of doc.sections) {
    const verse = section.verses.find((v) => v.id === verseId);
    if (verse !== undefined) return { section, verse };
  }
  return null;
}

/** A document, section or verse field set — or cleared, with `null`. */
export function setDocField(doc: ChantDoc, path: string, value: string | null): Outcome<ChantDoc> {
  const next = JSON.parse(JSON.stringify(doc)) as ChantDoc;
  const parts = path.split('.');
  const put = (on: Record<string, unknown>, key: string): void => {
    if (value === null) delete on[key];
    else on[key] = value;
  };

  if (parts.length === 1 && (path === 'title' || path === 'subtitle')) {
    put(next as unknown as Record<string, unknown>, path);
    return ok(next);
  }
  if (parts[0] === 'section' && parts.length === 3) {
    const section = next.sections.find((s) => s.id === parts[1]);
    if (section === undefined) return no(`no section "${parts[1] ?? ''}"`);
    if (parts[2] !== 'title' && parts[2] !== 'source') return no(`a section's "${parts[2] ?? ''}" is not editable — title or source`);
    put(section as unknown as Record<string, unknown>, parts[2]);
    return ok(next);
  }
  if (parts[0] === 'verse' && parts.length === 3) {
    const found = findVerseIn(next, parts[1] as string);
    if (found === null) return no(`no verse "${parts[1] ?? ''}" in this document`);
    const { section, verse } = found;
    const field = parts[2] as string;
    if (field === 'translation') {
      if (value === null) delete (verse as unknown as Record<string, unknown>).translation;
      else verse.translation = { en: value };
    } else if (field === 'n' || field === 'source') {
      put(verse as unknown as Record<string, unknown>, field);
    } else {
      return no(`a verse's "${field}" is not editable — n, translation or source`);
    }
    /*
     * THROUGH `withVerses`, because a composed section keeps its verses in
     * `items` as well and `normalizeChantDoc` rebuilds `verses` from THAT.
     * Mutating the verse in place changed only the derived copy, so on ten of
     * the eleven corpus documents a field set did nothing at all.
     */
    next.sections = next.sections.map((s) => (s.id === section.id ? withVerses(s, s.verses) : s));
    return ok(next);
  }
  return no(`"${path}" is not a field that may be set — ${FIELD_PATHS.join(', ')}`);
}

/** Where a verse sits in its section's flat source. */
function extentIn(section: ChantSection, verseId: string): { start: number; end: number } | null {
  const found = verseExtents(sourcesOf(section)).find((e) => e.id === verseId);
  return found === undefined ? null : { start: found.start, end: found.end };
}

/** Replace a verse's text: the same verse, so it keeps its id and what hangs on it. */
export function setTextCommand(doc: ChantDoc, verseId: string, lines: readonly string[]): Outcome<EditCommand> {
  if (lines.length === 0) return no('the text is empty; remove the verse instead');
  const found = findVerseIn(doc, verseId);
  if (found === null) return no(`no verse "${verseId}" in this document`);
  const extent = extentIn(found.section, verseId);
  if (extent === null) return no(`verse "${verseId}" has no text to replace`);
  return ok({
    k: 'replace', sectionId: found.section.id, from: extent.start, to: extent.end,
    insert: lines.join('\n'),
    /* Named, so it is the same verse: its recording and translation belong
       to these words, not to the ones replaced. */
    newIds: [verseId],
  });
}

/** A new verse at the end of a section, or after one of its verses. */
export function addVerseCommand(
  doc: ChantDoc, sectionId: string, lines: readonly string[], after?: string, id?: string,
): Outcome<EditCommand> {
  const section = doc.sections.find((s) => s.id === sectionId);
  if (section === undefined) return no(`no section "${sectionId}"`);
  if (lines.length === 0) return no('the text is empty');
  const taken = new Set(doc.sections.flatMap((s) => s.verses.map((v) => v.id)));
  if (id !== undefined && taken.has(id)) return no(`verse id "${id}" is already in use`);
  const extents = verseExtents(sourcesOf(section));
  let at: number;
  if (after === undefined) {
    at = extents[extents.length - 1]?.end ?? 0;
  } else {
    const found = extents.find((e) => e.id === after);
    if (found === undefined) return no(`no verse "${after}" in section "${sectionId}"`);
    at = found.end;
  }
  return ok({
    k: 'replace', sectionId, from: at, to: at,
    /* The blank line is the verse boundary — see `VERSE_GAP`. */
    insert: `\n\n${lines.join('\n')}`,
    ...(id === undefined ? {} : { newIds: [id] }),
  });
}

/** A verse taken out of its section, with the separator on whichever side there is one. */
export function removeVerseCommand(doc: ChantDoc, verseId: string): Outcome<EditCommand> {
  const found = findVerseIn(doc, verseId);
  if (found === null) return no(`no verse "${verseId}" in this document`);
  const { section } = found;
  if (section.verses.length === 1) return no(`"${verseId}" is the only verse in "${section.id}" — remove the section instead`);
  const extents = verseExtents(sourcesOf(section));
  const i = extents.findIndex((e) => e.id === verseId);
  if (i < 0) return no(`verse "${verseId}" has no text to remove`);
  const me = extents[i] as { start: number; end: number };
  /* Otherwise two verses become one. */
  const from = i > 0 ? (extents[i - 1] as { end: number }).end : me.start;
  const to = i > 0 ? me.end : (extents[i + 1]?.start ?? me.end);
  return ok({ k: 'replace', sectionId: section.id, from, to, insert: '' });
}
