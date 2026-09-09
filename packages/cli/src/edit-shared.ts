/**
 * WHAT EVERY HEADLESS EDITING COMMAND NEEDS.
 *
 * The context an argument list arrives in, how a change is reported, and when
 * it is written to disk. It is one module because the answer to "was that
 * refused, or did it merely cost something?" has to be the same for every
 * verb — a command that decided for itself would eventually decide wrong, and
 * the wrong answer here is a marked text overwritten without anyone being
 * told.
 */
import { writeFileSync } from 'node:fs';
import {
  apply, emptyHistory, newState, sourcesOf, verseExtents,
  type EditCommand, type EditState,
} from '@siksamitra/edit';
import {
  canonicalJson, writeChantFile, type ChantDoc, type ChantSection, type ChantVerse,
} from '@siksamitra/format';

export interface EditContext {
  readonly flag: (name: string) => string | undefined;
  readonly has: (name: string) => boolean;
  readonly say: (...a: unknown[]) => void;
  readonly emit: (value: unknown) => void;
  readonly die: (code: number, message: string) => never;
  readonly readDoc: (path: string) => ChantDoc;
  readonly path: string;
}

/* ── reading the arguments ─────────────────────────────────────────────── */

export function requireFlag(ctx: EditContext, name: string): string {
  const v = ctx.flag(name);
  if (v === undefined || v.startsWith('--')) ctx.die(2, `--${name} is required`);
  return v as string;
}

/** `0,3,5` and `0-4` both, because an agent will write either. */
export function units(ctx: EditContext): number[] {
  const raw = requireFlag(ctx, 'units');
  const out = new Set<number>();
  for (const part of raw.split(',')) {
    const range = /^(\d+)-(\d+)$/.exec(part.trim());
    if (range !== null) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from) ctx.die(2, `--units "${part}" counts backwards`);
      for (let i = from; i <= to; i += 1) out.add(i);
      continue;
    }
    const one = Number(part.trim());
    if (!Number.isInteger(one) || one < 0) ctx.die(2, `--units "${part}" is not a letter number`);
    out.add(one);
  }
  if (out.size === 0) ctx.die(2, '--units named no letters');
  return [...out].sort((a, b) => a - b);
}

/**
 * Line breaks as an agent will actually type them.
 *
 * A shell does not agree with itself about `\n`: PowerShell passes the two
 * characters through, bash in a double-quoted string does too, and only
 * `$'...'` turns it into a newline. So both a real newline and a literal
 * backslash-n mean the same thing here, and so does `/` between pādas — which
 * is how the marking documents themselves write a line break.
 */
export const lines = (text: string): string[] => text
  .replace(/\\n/g, '\n')
  .split(/\n|\s\/\s/)
  .map((l) => l.trim())
  .filter((l) => l !== '');

export function findVerse(
  ctx: EditContext,
  doc: ChantDoc,
  verseId: string,
): { section: ChantSection; verse: ChantVerse } {
  for (const section of doc.sections) {
    const verse = section.verses.find((v) => v.id === verseId);
    if (verse !== undefined) return { section, verse };
  }
  return ctx.die(2, `no verse "${verseId}" in this document`);
}

/** Where a verse sits in its section's flat source. */
export function extentOf(
  ctx: EditContext,
  section: ChantSection,
  verseId: string,
): { start: number; end: number } {
  const found = verseExtents(sourcesOf(section)).find((e) => e.id === verseId);
  if (found === undefined) ctx.die(2, `verse "${verseId}" has no text to replace`);
  return { start: found.start, end: found.end };
}

/* ── how a change is reported and saved ────────────────────────────────── */

export function finish(ctx: EditContext, before: ChantDoc, state: EditState, what: string): void {
  const changed = canonicalJson(state.doc) !== canonicalJson(before);

  /*
   * REFUSED AND COSTLY ARE NOT THE SAME THING, and the first version of this
   * treated them as one.
   *
   * A refusal with NOTHING CHANGED is rule zero: the command was not carried
   * out. A refusal alongside a change is a REPORT of what the change cost —
   * "19 transcribed accents were on letters this edit replaced, and went with
   * them" — and the edit did happen. Collapsing the two made `set-text`
   * impossible on any accented verse, which is most of them.
   *
   * So a cost has to be accepted out loud. `--accept-loss` is that, and
   * without it the command exits 3 having written nothing, which is the safe
   * default for a tool an agent drives unattended.
   */
  const lost = state.refusals.length > 0;
  if (lost && !changed) {
    ctx.emit({ ok: false, what, refusals: state.refusals, changed: false });
    for (const r of state.refusals) ctx.say(`  refused: ${r}`);
    process.exit(3);
  }

  ctx.emit({
    ok: !lost || ctx.has('accept-loss'),
    what,
    changed,
    rederived: state.reports.map((r) => r.verseId),
    cost: state.refusals,
    lostMarks: state.lostMarks,
    orphaned: state.orphaned,
  });
  ctx.say(`  ${what}`);
  if (state.reports.length > 0) {
    ctx.say(`  ${state.reports.length} verse(s) re-derived: `
      + `${state.reports.map((r) => r.verseId).join(', ')}`);
  }
  if (state.lostMarks.length > 0) {
    /* NEVER SILENT. A hand-placed mark an edit could not carry is the one
       thing in this program that cannot be recovered from the file. */
    ctx.say(`  ${state.lostMarks.length} hand-placed mark(s) could NOT be carried:`);
    for (const m of state.lostMarks) ctx.say(`    ${JSON.stringify(m)}`);
  }
  if (state.orphaned.length > 0) {
    ctx.say(`  recordings and word grammar orphaned: ${state.orphaned.join(', ')}`);
  }
  for (const r of state.refusals) ctx.say(`  cost: ${r}`);

  if (!changed) {
    ctx.say('  nothing changed.');
    return;
  }
  if (lost && !ctx.has('accept-loss')) {
    ctx.say('  NOT saved: this edit costs marks that cannot be rebuilt.');
    ctx.say('  Re-run with --accept-loss if that is what you mean.');
    process.exit(3);
  }

  const out = ctx.flag('out') ?? (ctx.has('write') ? ctx.path : null);
  if (out === null) {
    ctx.say('  not saved — add --write to save it, or --out <path>.');
    return;
  }
  writeFileSync(out, `${writeChantFile(state.doc)}
`, 'utf8');
  ctx.say(`  -> ${out}`);
}

/** Run one command through the same `apply` the window uses. */
export function run(ctx: EditContext, doc: ChantDoc, command: EditCommand, what: string): void {
  const { state } = apply(newState(doc), emptyHistory(), command);
  finish(ctx, doc, state, what);
}
