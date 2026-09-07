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
import { newState, sourcesOf, verseExtents } from '@siksamitra/edit';
import type { ChantDoc } from '@siksamitra/format';
import {
  finish, findVerse, lines, requireFlag, run, type EditContext,
} from './edit-shared.js';

/* ── the document's own words ──────────────────────────────────────────── */

/**
 * A TITLE IS NOT A MARK, so it does not go through `apply`.
 *
 * `apply` exists to keep derived marks honest, and a document's title, a
 * step's heading and a verse's translation are none of the engine's business:
 * changing one re-derives nothing and can lose nothing. They are edited as
 * plain fields — but through an ALLOW-LIST, because `--path` comes from an
 * agent, and "set any field by path" is how a tool ends up rewriting `tokens`
 * and quietly inventing marks nobody placed.
 */
export function setField(ctx: EditContext, doc: ChantDoc): void {
  const path = requireFlag(ctx, 'path');
  const clear = ctx.has('none');
  const value = clear ? null : requireFlag(ctx, 'value');
  const next = JSON.parse(JSON.stringify(doc)) as ChantDoc;

  const parts = path.split('.');
  const put = (on: Record<string, unknown>, key: string): void => {
    if (clear) delete on[key];
    else on[key] = value;
  };

  if (parts.length === 1 && (path === 'title' || path === 'subtitle')) {
    put(next as unknown as Record<string, unknown>, path);
  } else if (parts[0] === 'section' && parts.length === 3) {
    const section = next.sections.find((s) => s.id === parts[1]);
    if (section === undefined) ctx.die(2, `no section "${parts[1] ?? ''}"`);
    if (parts[2] !== 'title' && parts[2] !== 'source') {
      ctx.die(2, `a section's "${parts[2] ?? ''}" is not editable here — title or source`);
    }
    put(section as unknown as Record<string, unknown>, parts[2]);
  } else if (parts[0] === 'verse' && parts.length === 3) {
    const { verse } = findVerse(ctx, next, parts[1] as string);
    const field = parts[2] as string;
    if (field === 'translation') {
      if (clear) delete (verse as unknown as Record<string, unknown>).translation;
      else verse.translation = { en: value as string };
    } else if (field === 'n' || field === 'source') {
      put(verse as unknown as Record<string, unknown>, field);
    } else {
      ctx.die(2, `a verse's "${field}" is not editable here — n, translation or source`);
    }
  } else {
    ctx.die(2, `--path "${path}" is not one this command may set; see --help`);
  }

  finish(ctx, doc, newState(next), clear ? `${path} cleared` : `${path} set`);
}

/* ── verses in and out ─────────────────────────────────────────────────── */

/**
 * A NEW VERSE IS TYPED, not constructed.
 *
 * It goes in as a text insertion at a verse boundary, with the id it should
 * carry passed as `newIds` — which is how the surface mints one too. A verse
 * assembled here by calling `derive` would have no override rebasing behind it
 * and no guarantee that its id is free document-wide, which is exactly the
 * collision that made a new verse inherit another section's hand-placed box.
 */
export function addVerse(ctx: EditContext, doc: ChantDoc): void {
  const sectionId = requireFlag(ctx, 'section');
  const section = doc.sections.find((s) => s.id === sectionId);
  if (section === undefined) ctx.die(2, `no section "${sectionId}"`);
  const text = lines(requireFlag(ctx, 'text'));
  if (text.length === 0) ctx.die(2, '--text is empty');

  const after = ctx.flag('after');
  const id = ctx.flag('id');
  const taken = new Set(doc.sections.flatMap((s) => s.verses.map((v) => v.id)));
  if (id !== undefined && taken.has(id)) ctx.die(2, `verse id "${id}" is already in use`);

  const extents = verseExtents(sourcesOf(section));
  const last = extents[extents.length - 1];
  let at: number;
  if (after === undefined) {
    at = last === undefined ? 0 : last.end;
  } else {
    const found = extents.find((e) => e.id === after);
    if (found === undefined) ctx.die(2, `no verse "${after}" in section "${sectionId}"`);
    at = found.end;
  }

  run(
    ctx,
    doc,
    {
      k: 'replace',
      sectionId,
      from: at,
      to: at,
      /* The blank line is the verse boundary — see `VERSE_GAP`. */
      insert: `\n\n${text.join('\n')}`,
      ...(id === undefined ? {} : { newIds: [id] }),
    },
    `${sectionId}: a verse added${after === undefined ? ' at the end' : ` after ${after}`}`,
  );
}

export function removeVerse(ctx: EditContext, doc: ChantDoc): void {
  const verseId = requireFlag(ctx, 'verse');
  const { section } = findVerse(ctx, doc, verseId);
  if (section.verses.length === 1) {
    ctx.die(2, `"${verseId}" is the only verse in "${section.id}" — remove the section instead`);
  }
  const extents = verseExtents(sourcesOf(section));
  const i = extents.findIndex((e) => e.id === verseId);
  if (i < 0) ctx.die(2, `verse "${verseId}" has no text to remove`);
  const me = extents[i] as { start: number; end: number };
  /* The separator goes with it, on whichever side there is one — otherwise
     two verses become one, which is the exact merge rule zero guards. */
  const from = i > 0 ? (extents[i - 1] as { end: number }).end : me.start;
  const to = i > 0 ? me.end : (extents[i + 1]?.start ?? me.end);
  run(
    ctx,
    doc,
    { k: 'replace', sectionId: section.id, from, to, insert: '' },
    `${verseId}: removed from ${section.id}`,
  );
}

