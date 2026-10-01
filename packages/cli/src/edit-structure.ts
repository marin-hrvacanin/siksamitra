/**
 * A DOCUMENT'S OWN WORDS, AND ITS VERSES.
 *
 * Split from `edit-commands.ts` because these answer to a different authority.
 * A holding is the engine's business: it goes through `apply`, which refuses,
 * rebases and re-derives around it. A title, a heading, a verse number and a
 * translation are nobody's business but the author's — changing one derives
 * nothing and can lose nothing, so they are plain field writes behind an
 * allow-list. Adding and removing a VERSE sits in between: it is a text edit,
 * so it goes through `apply` like every other one.
 */
import { addVerseCommand, newState, removeVerseCommand, setDocField } from '@siksamitra/edit';
import type { ChantDoc } from '@siksamitra/format';
import { finish, lines, orDie, requireFlag, run, type EditContext } from './edit-shared.js';

/* ── the document's own words ──────────────────────────────────────────── */

/** A title, a heading, a number, a translation — `setDocField`'s allow-list. */
export function setField(ctx: EditContext, doc: ChantDoc): void {
  const path = requireFlag(ctx, 'path');
  const clear = ctx.has('none');
  const value = clear ? null : requireFlag(ctx, 'value');
  const next = orDie(ctx, setDocField(doc, path, value));
  finish(ctx, doc, newState(next), clear ? `${path} cleared` : `${path} set`);
}

/* ── verses in and out ─────────────────────────────────────────────────── */

export function addVerse(ctx: EditContext, doc: ChantDoc): void {
  const sectionId = requireFlag(ctx, 'section');
  const text = lines(requireFlag(ctx, 'text'));
  if (text.length === 0) ctx.die(2, '--text is empty');
  const after = ctx.flag('after');
  const command = orDie(ctx, addVerseCommand(doc, sectionId, text, after, ctx.flag('id')));
  run(ctx, doc, command, `${sectionId}: a verse added${after === undefined ? ' at the end' : ` after ${after}`}`);
}

export function removeVerse(ctx: EditContext, doc: ChantDoc): void {
  const verseId = requireFlag(ctx, 'verse');
  const command = orDie(ctx, removeVerseCommand(doc, verseId));
  const section = doc.sections.find((s) => s.verses.some((v) => v.id === verseId));
  run(ctx, doc, command, `${verseId}: removed from ${section?.id ?? ''}`);
}
