/**
 * THE EDITOR, HEADLESS — every change a person can make, made by a command.
 *
 * The requirement is not "a CLI that can also edit". It is that an agent and a
 * person have the SAME powers, because the owner authors documents both ways
 * and a capability only one of them has is a capability that rots. So these
 * verbs are not a second implementation of editing: each one builds an
 * `EditCommand` and hands it to `@siksamitra/edit`'s `apply`, which is the
 * same function the window calls when a key is pressed. Rule zero, the
 * override rebasing, the re-derivation and the refusals are therefore
 * identical by construction rather than by discipline.
 *
 * NOTHING IS WRITTEN WITHOUT `--write`. Every verb prints what it WOULD do and
 * exits; the flag is what commits it. An agent that is unsure can run the
 * command, read the report and decide — and a wrong command costs nothing.
 *
 * The document on disk is the whole state, so there is no session to keep
 * between calls: read, apply, write, and the next command starts from what the
 * last one left. That is slower than holding a session open and it is the
 * right trade — an agent that dies halfway leaves a valid document.
 */
import {
  CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES, type ChantDoc, type ChantProfileKey,
} from '@siksamitra/format';
import {
  extentOf, findVerse, lines, requireFlag, run, units, type EditContext,
} from './edit-shared.js';
import { addVerse, removeVerse, setField } from './edit-structure.js';

export type { EditContext } from './edit-shared.js';

export const EDIT_VERBS = [
  'set-register', 'set-text', 'hold', 'clear-marks', 'auto-hold',
  'set-field', 'add-verse', 'remove-verse',
] as const;

export type EditVerb = (typeof EDIT_VERBS)[number];

export const EDIT_HELP = `Editing — the same commands the window runs.
Nothing is saved without --write.

  set-register <doc.json>    which register's rules govern the text
                             --preset <name> | --none  [--section <id>]
  set-text <doc.json>        replace a verse's own text and re-derive it
                             --verse <id> --text "line one/line two"
  hold <doc.json>            place a holding on letters, by hand
                             --verse <id> --units 0,3,5 --value short|long|none
  clear-marks <doc.json>     withdraw a hand-placed opinion; the rules decide again
                             --verse <id> --units 0,3 --fields hold,svara
  auto-hold <doc.json>       re-run the holding rules over verses that carry marks
                             --section <id> [--verses a,b] --mode keep|replace
  set-field <doc.json>       a document's, section's or verse's own words
                             --path <see below> --value "..." | --none
  add-verse <doc.json>       a new verse, derived from the text you give it
                             --section <id> [--after <verseId>] --text "..." [--id <id>]
  remove-verse <doc.json>    take a verse out of its section
                             --verse <id>

  --path for set-field       title | subtitle
                             section.<id>.title | section.<id>.source
                             verse.<id>.n | verse.<id>.translation | verse.<id>.source
  --units                    0,3,5 or 0-4, counted from the verse's first letter
  --write                    save the result back over the file
  --out <path>               save it somewhere else instead
  --accept-loss              proceed with an edit that costs transcribed marks`;

/* ── the verbs ─────────────────────────────────────────────────────────── */

export function runEditVerb(verb: EditVerb, ctx: EditContext): void {
  const doc = ctx.readDoc(ctx.path);

  switch (verb) {
    case 'set-register': return setRegister(ctx, doc);
    case 'set-text': return setText(ctx, doc);
    case 'hold': return hold(ctx, doc);
    case 'clear-marks': return clearMarks(ctx, doc);
    case 'auto-hold': return autoHold(ctx, doc);
    case 'set-field': return setField(ctx, doc);
    case 'add-verse': return addVerse(ctx, doc);
    case 'remove-verse': return removeVerse(ctx, doc);
    default: return ctx.die(2, `unknown editing verb "${String(verb)}"`);
  }
}

function setRegister(ctx: EditContext, doc: ChantDoc): void {
  const none = ctx.has('none');
  const preset = none ? null : (ctx.flag('preset') as ChantProfileKey | undefined);
  if (preset !== null && (preset === undefined || !CHANT_PROFILE_KEYS.includes(preset))) {
    ctx.die(2, `--preset must be one of ${CHANT_PROFILE_KEYS.join(', ')}, or pass --none`);
  }
  const sectionId = ctx.flag('section');
  if (sectionId !== undefined && doc.sections.every((s) => s.id !== sectionId)) {
    ctx.die(2, `no section "${sectionId}" in this document`);
  }
  const named = preset === null ? 'no register of its own' : CHANT_PROFILE_NOTES[preset].name;
  run(
    ctx,
    doc,
    sectionId === undefined
      ? { k: 'profile', scope: 'document', preset }
      : { k: 'profile', scope: 'section', sectionId, preset },
    `${sectionId ?? 'the document'} now follows ${named}`,
  );
}

function setText(ctx: EditContext, doc: ChantDoc): void {
  const verseId = requireFlag(ctx, 'verse');
  const text = lines(requireFlag(ctx, 'text'));
  if (text.length === 0) ctx.die(2, '--text is empty; use remove-verse to delete a verse');
  const { section, verse } = findVerse(ctx, doc, verseId);
  /*
   * REPLACING A VERSE IS A RANGE REPLACE OVER THE SECTION'S FLAT SOURCE — the
   * same edit a person makes by selecting the verse and typing over it.
   * Writing `verse.src.lines` directly would skip the override rebasing, and
   * every hand-placed mark after that point would end up a letter out.
   */
  const extent = extentOf(ctx, section, verse.id);
  run(
    ctx,
    doc,
    {
      k: 'replace',
      sectionId: section.id,
      from: extent.start,
      to: extent.end,
      insert: text.join('\n'),
      /*
       * IT IS STILL THE SAME VERSE.
       *
       * Replacing a verse's text down to the last letter is, to a text
       * comparison, indistinguishable from deleting it and typing another —
       * and that is the right reading for a keystroke. Here the caller has
       * NAMED the verse, so its id is offered back: its recording, its
       * translation and its word grammar belong to these words, not to the
       * ones being replaced.
       */
      newIds: [verse.id],
    },
    `${verseId}: text replaced`,
  );
}

function hold(ctx: EditContext, doc: ChantDoc): void {
  const verseId = requireFlag(ctx, 'verse');
  const value = requireFlag(ctx, 'value');
  if (!['short', 'long', 'none'].includes(value)) {
    ctx.die(2, '--value must be short, long or none');
  }
  const { section } = findVerse(ctx, doc, verseId);
  const targets = units(ctx).map((unit) => ({ verseId, unit }));
  const note = ctx.flag('note');
  run(
    ctx,
    doc,
    {
      k: 'mark',
      sectionId: section.id,
      targets,
      patch: { hold: value === 'none' ? null : value },
      why: 'owner-hand',
      ...(note === undefined ? {} : { note }),
    },
    `${verseId}: ${targets.length} letter(s) held ${value}`,
  );
}

function clearMarks(ctx: EditContext, doc: ChantDoc): void {
  const verseId = requireFlag(ctx, 'verse');
  const { section } = findVerse(ctx, doc, verseId);
  const fields = (ctx.flag('fields') ?? 'hold').split(',').map((f) => f.trim());
  const targets = units(ctx).map((unit) => ({ verseId, unit }));
  run(
    ctx,
    doc,
    { k: 'unmark', sectionId: section.id, targets, fields: fields as never },
    `${verseId}: ${fields.join(', ')} withdrawn from ${targets.length} letter(s)`,
  );
}

function autoHold(ctx: EditContext, doc: ChantDoc): void {
  const sectionId = requireFlag(ctx, 'section');
  const section = doc.sections.find((s) => s.id === sectionId);
  if (section === undefined) ctx.die(2, `no section "${sectionId}" in this document`);
  const mode = ctx.flag('mode') ?? 'keep';
  if (mode !== 'keep' && mode !== 'replace') ctx.die(2, '--mode must be keep or replace');
  const named = ctx.flag('verses');
  const verseIds = named === undefined
    ? section.verses.map((v) => v.id)
    : named.split(',').map((s) => s.trim());
  run(
    ctx,
    doc,
    /* `recompute` over the holdings stage. `auto-holdings` was the same
       request said a second way, and it edited the override list, which
       nothing writes any more. */
    {
      k: 'recompute',
      sectionId,
      verseIds,
      stages: ['holdings'],
      mode: mode === 'keep' ? 'keep-hand' : 'replace-all',
    },
    `${sectionId}: holdings re-run over ${verseIds.length} verse(s), ${mode}`,
  );
}

