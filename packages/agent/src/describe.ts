/**
 * WHAT A DELIVERED FILE IS, SAID BY THE PROGRAM — from the file's document.
 *
 * The bot once sent a Gāyatrī with a message that described another document:
 * a passage it had "compared word for word" with a second witness it had read
 * twenty lines of, and a text spaced as the file was not. The model wrote what
 * it believed it had done. This is written from the document itself — its
 * name, its tradition, where it is from, how many verses, how it begins, where
 * its letters were taken from, and what the check found — and goes with the
 * file, so what the person is told about the file is the file.
 */
import type { ChantDoc } from '@siksamitra/format';
import { toTextAndMarks } from '@siksamitra/format';
import type { Workspace } from './workspace.js';

const host = (origin: string): string => {
  if (origin.startsWith('library:')) return 'the library';
  try { return new URL(origin).hostname.replace(/^www\./, ''); } catch { return origin; }
};

/** The facts of a document, a line each. `checked` is what `check` found. */
export function describeDocument(ws: Workspace, doc: ChantDoc, checked: string): string {
  const verses = doc.sections.flatMap((s) => s.verses);
  const part = doc.sections.find((s) => s.part !== undefined)?.part;
  const sources = [...new Set(doc.sections.flatMap((s) => (s.source ?? '').split('\n')).map((l) => l.trim()).filter((l) => l !== ''))];
  const first = verses[0] === undefined ? '' : toTextAndMarks(verses[0]).text.split('\n')[0]!.trim();
  /* Where its letters came from: the witnesses its sections and verses were
     built from, by their own site — or the author's own document. */
  const from = [...new Set([...ws.builtFrom.values()]
    .map((b) => ws.witnesses.get(b.witness))
    .filter((w) => w !== undefined)
    .map((w) => `${w!.title} (${host(w!.origin)})`))];
  const origin = ws.origin === 'author'
    ? 'Its letters and marks are its author’s own, from the library.'
    : from.length === 0 ? 'Its letters were typed, not taken from a source.'
      : `Its letters are those of ${from.join(' and ')}.`;
  return [
    `${doc.title}${part === undefined ? '' : ` — ${part}`}`,
    ...(sources.length === 0 ? [] : [`From: ${sources.join(' · ')}`]),
    `${verses.length} verse${verses.length === 1 ? '' : 's'}, beginning “${first.length > 70 ? `${first.slice(0, 70)}…` : first}”`,
    origin,
    checked,
  ].join('\n');
}
